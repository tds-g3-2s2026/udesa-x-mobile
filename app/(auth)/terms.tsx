import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors } from '../../src/features/auth/components/authTheme';

// Static text linked from the terms checkbox of the signup form. Placeholder
// copy for the class project, modeled after a typical social app's terms of
// service — not a reviewed legal document.
const SECTIONS: { title: string; body: string }[] = [
  {
    title: '1. Aceptación de los términos',
    body:
      'Al crear una cuenta en UdeSA-X aceptás estos Términos y Condiciones y la Política de ' +
      'Privacidad. Si no estás de acuerdo, no deberías registrarte ni usar la aplicación.',
  },
  {
    title: '2. Tu cuenta',
    body:
      'Sos responsable de mantener tu contraseña en secreto y de toda la actividad que ocurra ' +
      'con tu cuenta. Tenés que darnos un correo electrónico válido y un nombre de usuario que ' +
      'no suplante a otra persona o institución.',
  },
  {
    title: '3. Contenido publicado',
    body:
      'Sos dueño del contenido que publicás. Al publicarlo nos das una licencia para mostrarlo ' +
      'dentro de la app a otros usuarios, de la forma en que la propia app funciona (feed, ' +
      'perfil, búsqueda). No publiques contenido ilegal, discriminatorio o que viole los ' +
      'derechos de terceros: nos reservamos el derecho de eliminarlo y de suspender la cuenta.',
  },
  {
    title: '4. Uso aceptable',
    body:
      'No está permitido automatizar el uso de la app para spam, intentar acceder a cuentas ' +
      'ajenas, ni realizar ingeniería inversa sobre el servicio. El incumplimiento puede ' +
      'derivar en la suspensión o el cierre de la cuenta.',
  },
  {
    title: '5. Cambios en el servicio',
    body:
      'UdeSA-X es un proyecto en desarrollo activo: funciones pueden agregarse, cambiar o ' +
      'discontinuarse sin aviso previo. La cuenta y los datos siguen protegidos por la ' +
      'Política de Privacidad durante todo ese proceso.',
  },
  {
    title: '6. Cierre de cuenta',
    body:
      'Podés dejar de usar la app en cualquier momento cerrando sesión desde tu Perfil. La ' +
      'baja definitiva de una cuenta y sus datos es un flujo aparte, todavía no disponible en ' +
      'esta versión.',
  },
];

export default function TermsScreen() {
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.updated}>Última actualización: agosto de 2026</Text>

      {SECTIONS.map((section) => (
        <View key={section.title} style={styles.section}>
          <Text style={styles.heading}>{section.title}</Text>
          <Text style={styles.body}>{section.body}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  content: {
    padding: 24,
    paddingBottom: 40,
  },
  updated: {
    fontSize: 13,
    color: colors.placeholder,
    marginBottom: 20,
  },
  section: {
    marginBottom: 20,
  },
  heading: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 6,
  },
  body: {
    fontSize: 14,
    lineHeight: 21,
    color: colors.muted,
  },
});
