import type { TextInputProps } from 'react-native';
import type { RegisterField } from './schemas/authSchemas';

// Route of every step. Declared as literals so `router.push` keeps its typed routes.
type StepRoute =
  | '/(auth)/register'
  | '/(auth)/register/email'
  | '/(auth)/register/handle'
  | '/(auth)/register/password';

export type RegisterStepDefinition = {
  field: RegisterField;
  route: StepRoute;
  title: string;
  subtitle: string;
  label: string;
  placeholder: string;
  hint?: string;
  secure?: boolean;
  // Keyboard and text behaviour of the field. `value` and `onChangeText` stay
  // with the step component, which reads and writes the shared draft.
  input?: Omit<TextInputProps, 'style' | 'onLayout' | 'secureTextEntry' | 'value' | 'onChangeText'>;
};

// One question per screen, easiest first and the password last.
export const REGISTER_STEPS: RegisterStepDefinition[] = [
  {
    field: 'fullName',
    route: '/(auth)/register',
    title: '¿Cómo te llamás?',
    subtitle: 'Usá tu nombre real: así te encuentran tus compañeros de cursada.',
    label: 'Nombre completo',
    placeholder: 'Joaquín León',
    input: { autoCapitalize: 'words', autoComplete: 'name' },
  },
  {
    field: 'email',
    route: '/(auth)/register/email',
    title: '¿Cuál es tu correo?',
    subtitle: 'Te mandamos un código de 6 dígitos para verificar que es tuyo.',
    label: 'Correo universitario',
    placeholder: 'nombre@udesa.edu.ar',
    input: { keyboardType: 'email-address', autoCapitalize: 'none', autoCorrect: false },
  },
  {
    field: 'handle',
    route: '/(auth)/register/handle',
    title: 'Elegí tu usuario',
    subtitle: 'Es tu identidad en UdeSA-X y con eso te van a mencionar.',
    label: 'Nombre de usuario',
    placeholder: 'ej. @joaquin_dev',
    hint: 'Solo letras, números y guiones bajos (máximo 15 caracteres).',
    input: { autoCapitalize: 'none', autoCorrect: false, maxLength: 15 },
  },
  {
    field: 'password',
    route: '/(auth)/register/password',
    title: 'Creá tu contraseña',
    subtitle: 'Al menos 8 caracteres, con una mayúscula y un número.',
    label: 'Contraseña',
    placeholder: '••••••••',
    secure: true,
  },
];
