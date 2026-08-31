import React, { useCallback, useRef, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type LayoutChangeEvent,
  type TextInputProps,
} from 'react-native';
import { colors } from './authTheme';
import { useFormScroll, type FieldRect } from './formScroll';

type OtpInputProps = Omit<
  TextInputProps,
  'style' | 'onLayout' | 'secureTextEntry' | 'value' | 'onChangeText'
> & {
  value: string;
  onChangeText: (code: string) => void;
  length?: number;
  label?: string;
  error?: string | null;
};

/**
 * 6-slot OTP code input for numeric verification codes.
 * Renders 6 distinct boxes for the digits while maintaining a single,
 * accessible TextInput underneath to support pasting, autofill, and keyboard controls.
 */
export function OtpInput({
  value,
  onChangeText,
  length = 6,
  label,
  error,
  autoFocus = true,
  placeholder = '123456',
  onSubmitEditing,
  ...inputProps
}: OtpInputProps) {
  const { revealField } = useFormScroll();
  const fieldRect = useRef<FieldRect>({ y: 0, height: 0 });
  const inputRef = useRef<TextInput>(null);
  const [isFocused, setIsFocused] = useState(false);

  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    const { y, height } = event.nativeEvent.layout;
    fieldRect.current = { y, height };
  }, []);

  const handleFocus = useCallback(() => {
    setIsFocused(true);
    revealField(fieldRect.current);
  }, [revealField]);

  const handleBlur = useCallback(() => {
    setIsFocused(false);
  }, []);

  const handlePress = () => {
    inputRef.current?.focus();
  };

  const cleanDigits = value.replace(/[^0-9]/g, '').slice(0, length);
  const digits = cleanDigits.split('');
  const hasError = Boolean(error);

  const slots = Array.from({ length }, (_, index) => {
    const digit = digits[index] ?? '';
    const isCurrent = isFocused && index === digits.length;
    const isFilled = digit.length > 0;

    return (
      <View
        key={index}
        style={[
          styles.slot,
          isFilled && styles.slotFilled,
          isCurrent && styles.slotFocused,
          hasError && styles.slotError,
        ]}
      >
        <Text style={[styles.slotText, hasError && styles.slotTextError]}>{digit}</Text>
        {isCurrent && <View style={styles.cursor} />}
      </View>
    );
  });

  return (
    <View style={styles.container} onLayout={handleLayout}>
      {label && <Text style={styles.label}>{label}</Text>}

      <Pressable
        onPress={handlePress}
        style={styles.slotsContainer}
        accessible
        accessibilityRole="none"
        accessibilityLabel={label ?? 'Código de verificación'}
      >
        {slots}

        <TextInput
          ref={inputRef}
          style={styles.hiddenInput}
          value={cleanDigits}
          onChangeText={(text) => {
            const numeric = text.replace(/[^0-9]/g, '').slice(0, length);
            onChangeText(numeric);
          }}
          keyboardType="number-pad"
          maxLength={length}
          textContentType="oneTimeCode"
          autoComplete="one-time-code"
          autoFocus={autoFocus}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder={placeholder}
          placeholderTextColor="transparent"
          caretHidden
          onSubmitEditing={onSubmitEditing}
          {...inputProps}
        />
      </Pressable>

      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
    width: '100%',
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 12,
    textAlign: 'center',
  },
  slotsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    position: 'relative',
  },
  slot: {
    width: 48,
    height: 58,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.field,
    alignItems: 'center',
    justifyContent: 'center',
  },
  slotFilled: {
    borderColor: colors.text,
    backgroundColor: colors.surface,
  },
  slotFocused: {
    borderColor: colors.primary,
    backgroundColor: colors.surface,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  slotError: {
    borderColor: colors.danger,
    backgroundColor: colors.dangerSoft,
  },
  slotText: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
  },
  slotTextError: {
    color: colors.danger,
  },
  cursor: {
    position: 'absolute',
    bottom: 12,
    width: 16,
    height: 2,
    backgroundColor: colors.primary,
    borderRadius: 1,
  },
  hiddenInput: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.01,
    color: 'transparent',
  },
  errorText: {
    fontSize: 13,
    color: colors.danger,
    marginTop: 10,
    textAlign: 'center',
    fontWeight: '500',
  },
});
