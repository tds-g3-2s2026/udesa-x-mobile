import React, {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  ActivityIndicator,
  Keyboard,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { HeaderHeightContext } from '@react-navigation/elements';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from './authTheme';
import {
  FormScrollContext,
  keyboardOverlap,
  nextScrollOffset,
  type FieldRect,
  type FormScroll,
} from './formScroll';

// Identifies the view that carries the keyboard inset, so a test can assert that
// the action button clears the keyboard.
export const AUTH_SCREEN_BODY = 'auth-screen-body';

// iOS reports the keyboard before it animates, which keeps the footer in sync with it.
const KEYBOARD_SHOWN = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
const KEYBOARD_HIDDEN = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

type AuthScreenProps = {
  // Title block rendered above the fields.
  header: ReactNode;
  // Fields of the form. They have to be `FormInput` elements so that the
  // keyboard reveal can measure their position inside the scrolled content.
  children: ReactNode;
  submitLabel: string;
  onSubmit: () => void;
  isSubmitting?: boolean;
  // Disables the action button for a reason other than being in flight, e.g.
  // the terms checkbox on the signup form's last step. Independent of
  // `isSubmitting` on purpose: the spinner only ever means "request in progress".
  disabled?: boolean;
  // Links shown under the action button, inside the fixed footer.
  footer?: ReactNode;
  // Pinned between the navigation header and the scrolled content, for the
  // step indicator of the signup wizard.
  progress?: ReactNode;
};

/**
 * Layout shared by the authentication screens: the fields scroll and stay
 * centered, and the action button sits in a footer that rides above the
 * keyboard so the form can be completed without dismissing it.
 */
export function AuthScreen({
  header,
  children,
  submitLabel,
  onSubmit,
  isSubmitting = false,
  disabled = false,
  footer,
  progress,
}: AuthScreenProps) {
  const insets = useSafeAreaInsets();
  // Height of the navigation header above this view: 0 when the screen hides it
  // and when the screen is rendered outside a navigator. The keyboard reports its
  // position in screen coordinates while this view starts below the header, so the
  // difference is what the overlap calculation needs.
  const headerHeight = useContext(HeaderHeightContext) ?? 0;
  const scrollRef = useRef<ScrollView>(null);
  const viewportHeight = useRef(0);
  const scrollOffset = useRef(0);
  const focusedField = useRef<FieldRect | null>(null);
  const screenHeight = useRef(0);
  const keyboardScreenY = useRef<number | null>(null);
  const [keyboardInset, setKeyboardInset] = useState(0);

  const syncKeyboardInset = useCallback(() => {
    setKeyboardInset(keyboardOverlap(headerHeight, screenHeight.current, keyboardScreenY.current));
  }, [headerHeight]);

  // The navigation header publishes its measured height after the first render,
  // so the inset is recomputed when that arrives.
  const syncLatest = useRef(syncKeyboardInset);
  useEffect(() => {
    syncLatest.current = syncKeyboardInset;
    syncKeyboardInset();
  }, [syncKeyboardInset]);

  // Subscribed once, on mount. The keyboard position is also read from
  // `Keyboard.metrics()` here because moving between steps of the wizard keeps the
  // keyboard open: no show event is emitted for the new screen, and that is the
  // case `KeyboardAvoidingView` gets wrong (see its componentDidMount).
  //
  // A stored position is never cleared by a re-run of this effect: on iOS
  // `Keyboard.isVisible()` only turns true with `keyboardDidShow`, so between
  // `keyboardWillShow` and that event it would wrongly report no keyboard.
  useEffect(() => {
    if (Keyboard.isVisible()) {
      keyboardScreenY.current = Keyboard.metrics()?.screenY ?? null;
      syncLatest.current();
    }

    const shown = Keyboard.addListener(KEYBOARD_SHOWN, (event) => {
      keyboardScreenY.current = event.endCoordinates.screenY;
      syncLatest.current();
    });
    const hidden = Keyboard.addListener(KEYBOARD_HIDDEN, () => {
      focusedField.current = null;
      keyboardScreenY.current = null;
      syncLatest.current();
    });
    return () => {
      shown.remove();
      hidden.remove();
    };
  }, []);

  // React Native does not scroll the focused input into view by itself, and the
  // fixed footer makes the visible area smaller than the screen, so the offset
  // is computed from the field position and the current viewport.
  const revealFocusedField = useCallback(() => {
    const field = focusedField.current;
    if (!field) return;

    const target = nextScrollOffset(field, viewportHeight.current, scrollOffset.current);
    if (target === null) return;
    scrollRef.current?.scrollTo({ y: target, animated: true });
  }, []);

  const formScroll = useMemo<FormScroll>(
    () => ({
      revealField: (rect) => {
        focusedField.current = rect;
        revealFocusedField();
      },
    }),
    [revealFocusedField]
  );

  const handleScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    scrollOffset.current = event.nativeEvent.contentOffset.y;
  }, []);

  // The keyboard shrinks the scrollable area: re-run the reveal with the new height.
  const handleViewportLayout = useCallback(
    (event: LayoutChangeEvent) => {
      viewportHeight.current = event.nativeEvent.layout.height;
      revealFocusedField();
    },
    [revealFocusedField]
  );

  // Height of the whole screen area, which is what the keyboard overlaps. Padding
  // does not change it, so measuring here cannot feed back into itself.
  const handleScreenLayout = useCallback(
    (event: LayoutChangeEvent) => {
      screenHeight.current = event.nativeEvent.layout.height;
      syncKeyboardInset();
    },
    [syncKeyboardInset]
  );

  return (
    <FormScrollContext.Provider value={formScroll}>
      <View style={styles.screen}>
        {/* The keyboard inset is applied here instead of with KeyboardAvoidingView:
            that component only reacts to show events, and moving between steps of
            the wizard never emits one because the keyboard stays open. */}
        <View
          testID={AUTH_SCREEN_BODY}
          style={[
            styles.fill,
            { paddingBottom: keyboardInset },
            // Without a navigation header this view has to clear the status bar itself.
            headerHeight === 0 && { paddingTop: insets.top },
          ]}
          onLayout={handleScreenLayout}
        >
          {progress}

          <ScrollView
            ref={scrollRef}
            style={styles.fill}
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            /* Dragging must not close the keyboard: a tap outside the fields does. */
            showsVerticalScrollIndicator={false}
            scrollEventThrottle={16}
            onScroll={handleScroll}
            onLayout={handleViewportLayout}
          >
            <View style={styles.header}>{header}</View>
            {children}
          </ScrollView>

          <View
            style={[
              styles.footer,
              { paddingBottom: keyboardInset > 0 ? 12 : Math.max(insets.bottom, 16) },
            ]}
          >
            <TouchableOpacity
              style={[styles.button, (isSubmitting || disabled) && styles.buttonDisabled]}
              onPress={onSubmit}
              disabled={isSubmitting || disabled}
              accessibilityRole="button"
            >
              {isSubmitting ? (
                <ActivityIndicator color={colors.onPrimary} />
              ) : (
                <Text style={styles.buttonLabel}>{submitLabel}</Text>
              )}
            </TouchableOpacity>

            {footer ? <View style={styles.footerLinks}>{footer}</View> : null}
          </View>
        </View>
      </View>
    </FormScrollContext.Provider>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  fill: {
    flex: 1,
  },
  // flexGrow plus centering keeps a short form centered and lets a long one scroll.
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 16,
  },
  header: {
    marginBottom: 24,
  },
  footer: {
    paddingHorizontal: 24,
    paddingTop: 12,
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
  },
  button: {
    height: 50,
    backgroundColor: colors.primary,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonLabel: {
    color: colors.onPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  footerLinks: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 12,
  },
});
