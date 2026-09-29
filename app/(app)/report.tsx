import { useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AuthScreen } from '../../src/features/auth/components/AuthScreen';
import { useAuthStyles } from '../../src/features/auth/components/authTheme';
import { getAuthErrorMessage } from '../../src/api/apiClient';
import { reportService } from '../../src/features/social/services/reportService';
import { ReportReason, ReportTarget } from '../../src/types/social';
import { useThemeColors } from '../../src/theme/useThemeColors';
import { Colors } from '../../src/theme/colors';

// Same order and values as posts-api's closed list. A screen and not a native
// Alert: Android caps an Alert at three buttons, and this needs four plus
// Cancelar.
const REASON_OPTIONS: { value: ReportReason; label: string }[] = [
  { value: 'spam', label: 'Spam' },
  { value: 'harassment', label: 'Acoso' },
  { value: 'inappropriate_content', label: 'Contenido inapropiado' },
  { value: 'impersonation', label: 'Suplantación de identidad' },
];

export default function ReportScreen() {
  const router = useRouter();
  const authStyles = useAuthStyles();
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const params = useLocalSearchParams<{ userId?: string; postId?: string; handle?: string }>();

  const [reason, setReason] = useState<ReportReason | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // A post wins when both arrive: it counts against its author anyway, and
  // posts-api keeps which post it was.
  const target: ReportTarget | null = params.postId
    ? { postId: params.postId }
    : params.userId
      ? { userId: params.userId }
      : null;
  const name = params.handle || 'esta cuenta';

  const handleSubmit = async () => {
    if (!target || !reason) return;
    setIsSubmitting(true);
    try {
      await reportService.report(target, reason);
      Alert.alert('Denuncia enviada', 'Gracias por avisarnos. La vamos a revisar.');
      router.back();
    } catch (error) {
      Alert.alert('No se pudo enviar la denuncia', getAuthErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthScreen
      header={
        <>
          <Text style={authStyles.title}>Denunciar a {name}</Text>
          <Text style={authStyles.subtitle}>
            {target && 'postId' in target
              ? 'Contanos qué tiene de malo este post. La denuncia cuenta contra su autor.'
              : 'Contanos qué hace mal esta cuenta.'}
          </Text>
        </>
      }
      submitLabel="Enviar denuncia"
      onSubmit={handleSubmit}
      isSubmitting={isSubmitting}
      disabled={!target || !reason}
      footer={
        <Text style={authStyles.footerLink} onPress={() => router.back()}>
          Cancelar
        </Text>
      }
    >
      <View style={styles.options}>
        {REASON_OPTIONS.map((option) => {
          const isSelected = reason === option.value;
          return (
            <TouchableOpacity
              key={option.value}
              style={[styles.option, isSelected && styles.optionSelected]}
              onPress={() => setReason(option.value)}
              disabled={isSubmitting}
              accessibilityRole="radio"
              accessibilityState={{ selected: isSelected }}
            >
              <Text style={[styles.optionLabel, isSelected && styles.optionLabelSelected]}>
                {option.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </AuthScreen>
  );
}

function createStyles(colors: Colors) {
  return StyleSheet.create({
    options: {
      gap: 10,
    },
    option: {
      paddingVertical: 14,
      paddingHorizontal: 16,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.field,
    },
    optionSelected: {
      borderColor: colors.primary,
      backgroundColor: colors.primary,
    },
    optionLabel: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.text,
    },
    optionLabelSelected: {
      color: colors.onPrimary,
    },
  });
}
