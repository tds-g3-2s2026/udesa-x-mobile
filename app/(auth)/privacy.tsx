import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors } from '../../src/features/auth/components/authTheme';

// Static text linked from the terms checkbox of the signup form. Placeholder
// copy for the class project, modeled after a typical social app's privacy
// policy — not a reviewed legal document.
const SECTIONS: { title: string; body: string }[] = [
  {
    title: '1. Qué datos recolectamos',
    body:
      'Al registrarte guardamos tu nombre completo, tu correo, tu nombre de usuario y tu ' +
      'contraseña (nunca en texto plano). Además guardamos el contenido que publicás y ' +
      'metadatos técnicos como la fecha de cada inicio de sesión.',
  },
  {
    title: '2. Cómo usamos tus datos',
    body:
      'Usamos tu correo para verificar la cuenta y para recuperarla si perdés el acceso. Tu ' +
      'nombre de usuario y tu contenido son visibles para otros usuarios de la app, como parte ' +
      'normal de una red social. No vendemos tus datos a terceros.',
  },
  {
    title: '3. Dónde vive tu sesión',
    body:
      'El token de acceso de tu sesión se guarda cifrado en el dispositivo (Keychain en iOS, ' +
      'Keystore en Android) y viaja firmado en cada pedido a nuestros servidores. Al cerrar ' +
      'sesión, ese token se revoca del lado del servidor y se borra del dispositivo.',
  },
  {
    title: '4. Con quién compartimos datos',
    body:
      'Compartimos datos únicamente entre los servicios propios de UdeSA-X que necesitan ' +
      'operar la app (por ejemplo, el servicio que valida tu sesión y el que sirve tus ' +
      'publicaciones). No compartimos datos personales con anunciantes ni con terceros ajenos ' +
      'al proyecto.',
  },
  {
    title: '5. Tus derechos sobre tus datos',
    body:
      'Podés pedir la corrección de tus datos de perfil editándolos desde la app. La ' +
      'exportación y la eliminación completa de tus datos personales son funciones planificadas ' +
      'que todavía no están disponibles en esta versión.',
  },
  {
    title: '6. Cambios en esta política',
    body:
      'Si esta política cambia de forma relevante, te lo vamos a mostrar la próxima vez que ' +
      'abras la app, antes de seguir usándola.',
  },
];

export default function PrivacyScreen() {
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
