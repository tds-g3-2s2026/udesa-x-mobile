import React, { forwardRef, useCallback, useRef, useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  type FocusEvent,
  type LayoutChangeEvent,
  type TextInputProps,
} from 'react-native';
import { colors } from './authTheme';
import { useFormScroll, type FieldRect } from './formScroll';

type FormInputProps = Omit<TextInputProps, 'style' | 'onLayout' | 'secureTextEntry'> & {
  label: string;
  // Blocking validation message. Takes precedence over `warning` and `hint`.
  error?: string | null;
  // Live feedback while the value is still incomplete.
  warning?: string | null;
  // Rule shown when there is nothing to correct.
  hint?: string;
  // Renders the field masked, with a button to reveal the text.
  secure?: boolean;
};

/**
 * Labelled field of an auth form. On focus it asks the enclosing `AuthScreen`
 * to scroll it above the keyboard, which React Native does not do on its own.
 */
export const FormInput = forwardRef<TextInput, FormInputProps>(function FormInput(
  { label, error, warning, hint, secure = false, onFocus, ...inputProps },
  ref
) {
  const { revealField } = useFormScroll();
  const fieldRect = useRef<FieldRect>({ y: 0, height: 0 });
  const [isValueVisible, setIsValueVisible] = useState(false);

  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    const { y, height } = event.nativeEvent.layout;
    fieldRect.current = { y, height };
  }, []);

  const handleFocus = useCallback(
    (event: FocusEvent) => {
      revealField(fieldRect.current);
      onFocus?.(event);
    },
    [onFocus, revealField]
  );

  const errorText = error || null;
  const warningText = warning || null;
  const alertText = errorText ?? warningText;
  const message = alertText ?? hint ?? null;
  const messageStyle = alertText ? styles.alertMessage : styles.hintMessage;
  const hasAlert = alertText !== null;

  return (
    <View style={styles.group} onLayout={handleLayout}>
      <Text style={styles.label}>{label}</Text>

      {secure ? (
        <View style={[styles.secureWrapper, hasAlert && styles.fieldAlert]}>
          <TextInput
            ref={ref}
            style={styles.secureInput}
            placeholderTextColor={colors.placeholder}
            secureTextEntry={!isValueVisible}
            // Keeps the OS strong-password overlay away from the field.
            textContentType="oneTimeCode"
            autoComplete="off"
            clearTextOnFocus={false}
            autoCapitalize="none"
            autoCorrect={false}
            spellCheck={false}
            {...inputProps}
            onFocus={handleFocus}
          />
          <TouchableOpacity
            style={styles.toggle}
            onPress={() => setIsValueVisible((visible) => !visible)}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessibilityRole="button"
            accessibilityLabel={isValueVisible ? 'Ocultar contraseña' : 'Ver contraseña'}
          >
            <Text style={styles.toggleLabel}>{isValueVisible ? 'Ocultar' : 'Ver'}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <TextInput
          ref={ref}
          style={[
            styles.field,
            inputProps.multiline && styles.multilineField,
            hasAlert && styles.fieldAlert,
          ]}
          placeholderTextColor={colors.placeholder}
          {...inputProps}
          onFocus={handleFocus}
        />
      )}

      {message ? <Text style={messageStyle}>{message}</Text> : null}
    </View>
  );
});

const styles = StyleSheet.create({
  group: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  field: {
    height: 50,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    fontSize: 15,
    color: colors.text,
    backgroundColor: colors.field,
  },
  secureWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 50,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    backgroundColor: colors.field,
  },
  secureInput: {
    flex: 1,
    height: '100%',
    fontSize: 15,
    color: colors.text,
  },
  // The fixed `height` of `field` above would clip a growing text area, and
  // Android needs `textAlignVertical` set explicitly or it centers the text.
  multilineField: {
    height: undefined,
    minHeight: 90,
    paddingTop: 12,
    paddingBottom: 12,
    textAlignVertical: 'top',
  },
  fieldAlert: {
    borderColor: colors.danger,
    backgroundColor: colors.dangerSoft,
  },
  toggle: {
    paddingLeft: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleLabel: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '600',
  },
  alertMessage: {
    color: colors.danger,
    fontSize: 12,
    marginTop: 4,
  },
  hintMessage: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 4,
  },
});
