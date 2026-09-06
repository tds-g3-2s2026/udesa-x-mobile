import { z } from 'zod';

// A handle is '@' plus 3 to 14 word characters, so 4 to 15 characters in total.
const HANDLE_PATTERN = /^@[a-zA-Z0-9_]{3,14}$/;

// The email verification code is exactly 6 digits.
const VERIFICATION_CODE_PATTERN = /^[0-9]{6}$/;

const HANDLE_MESSAGE =
  'El usuario debe comenzar con @ y tener entre 4 y 15 caracteres, usando solo letras, números y guiones bajos';

export const loginSchema = z.object({
  identifier: z.string().trim().min(1, 'El usuario o email es obligatorio'),
  password: z.string().min(1, 'La contraseña es obligatoria'),
});

// One definition for the whole app: the password rules of the registration and
// the ones a reset has to meet are the same rules, and a copy could drift.
const passwordSchema = z
  .string()
  .min(8, 'La contraseña debe tener al menos 8 caracteres')
  .regex(/[A-Z]/, 'La contraseña debe contener al menos una letra mayúscula')
  .regex(/[0-9]/, 'La contraseña debe contener al menos un número');

export const registerSchema = z.object({
  handle: z.string().min(1, 'El usuario es obligatorio').regex(HANDLE_PATTERN, HANDLE_MESSAGE),
  email: z
    .string()
    .trim()
    .min(1, 'El correo electrónico es obligatorio')
    .email('Ingresá un correo electrónico válido'),
  fullName: z.string().trim().min(2, 'El nombre completo debe tener al menos 2 caracteres'),
  password: passwordSchema,
});

// The reset is asked for with an email or a handle, the same identifier the
// login takes: the API resolves either one.
export const forgotPasswordSchema = z.object({
  identifier: z.string().trim().min(1, 'Ingresá tu correo o nombre de usuario'),
});

// The token is pasted by hand from the email, so it is trimmed: a copy from a
// mail client usually drags a space or a newline with it.
export const resetPasswordSchema = z
  .object({
    token: z.string().trim().min(1, 'Pegá el código que te llegó por correo'),
    password: passwordSchema,
    passwordConfirmation: z.string().min(1, 'Repetí la contraseña nueva'),
  })
  .refine((values) => values.password === values.passwordConfirmation, {
    message: 'Las contraseñas no coinciden',
    // Attaches the failure to the second field, which is the one the user has
    // to retype: blaming the first one would be misleading.
    path: ['passwordConfirmation'],
  });

export const verifyEmailSchema = z.object({
  code: z
    .string()
    .min(1, 'El código es obligatorio')
    .regex(VERIFICATION_CODE_PATTERN, 'El código debe tener exactamente 6 dígitos'),
});

// Keeps the leading '@' the handle format requires while the user types it.
// Strips any symbol other than letters, numbers and underscores (like Instagram/Twitter).
export function normalizeHandle(value: string): string {
  const cleaned = value.replace(/[^a-zA-Z0-9_]/g, '');
  return cleaned.length > 0 ? `@${cleaned}`.slice(0, 15) : '';
}

// Changing the password from an open session asks for the current one on top
// of the pair the reset already asks for.
export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Ingresá tu contraseña actual'),
    password: passwordSchema,
    passwordConfirmation: z.string().min(1, 'Repetí la contraseña nueva'),
  })
  .refine((values) => values.password === values.passwordConfirmation, {
    message: 'Las contraseñas no coinciden',
    path: ['passwordConfirmation'],
  })
  // The API rejects this too; checking it here saves a round trip and says it
  // on the field the user has to change.
  .refine((values) => values.password !== values.currentPassword, {
    message: 'La contraseña nueva tiene que ser distinta de la actual',
    path: ['password'],
  });

// The resolved reading here is that this is the display name, not the
// handle — the handle is immutable (registration already guarantees it is
// unique and set) and PATCH /me rejects it outright if sent. Trimmed so a
// whitespace-only value is caught by min(1) instead of slipping through.
// The 50-character cap is not in the consigna: it is users-api's own choice,
// modeled after X's display name field, checked here too for fast feedback.
export const editProfileSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(1, 'El nombre visible no puede quedar vacío')
    .max(50, 'El nombre visible no puede superar los 50 caracteres'),
  // Optional — an empty bio just means the user cleared it — capped at the
  // same 160 characters the backend enforces.
  bio: z.string().max(160, 'La biografía no puede superar los 160 caracteres'),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type EditProfileInput = z.infer<typeof editProfileSchema>;

export type RegisterField = keyof RegisterInput;

// Validates a single registration field with the same rule the whole form uses,
// so a step of the signup wizard can never disagree with the final submit.
export function validateRegisterField(field: RegisterField, value: string): string | null {
  const result = registerSchema.shape[field].safeParse(value);
  return result.success ? null : result.error.issues[0].message;
}
