import { z } from 'zod';

// A handle is '@' plus 3 to 14 word characters, so 4 to 15 characters in total (E1-H1.CA3).
const HANDLE_PATTERN = /^@[a-zA-Z0-9_]{3,14}$/;

// The email verification code is exactly 6 digits (E1-H1.CA6).
const VERIFICATION_CODE_PATTERN = /^[0-9]{6}$/;

const HANDLE_MESSAGE =
  'El usuario debe comenzar con @ y tener entre 4 y 15 caracteres, usando solo letras, números y guiones bajos';

export const loginSchema = z.object({
  identifier: z.string().trim().min(1, 'El usuario o email es obligatorio'),
  password: z.string().min(1, 'La contraseña es obligatoria'),
});

export const registerSchema = z.object({
  handle: z.string().min(1, 'El usuario es obligatorio').regex(HANDLE_PATTERN, HANDLE_MESSAGE),
  email: z
    .string()
    .trim()
    .min(1, 'El correo electrónico es obligatorio')
    .email('Ingresá un correo electrónico válido'),
  fullName: z.string().trim().min(2, 'El nombre completo debe tener al menos 2 caracteres'),
  password: z
    .string()
    .min(8, 'La contraseña debe tener al menos 8 caracteres')
    .regex(/[A-Z]/, 'La contraseña debe contener al menos una letra mayúscula')
    .regex(/[0-9]/, 'La contraseña debe contener al menos un número'),
});

export const verifyEmailSchema = z.object({
  code: z
    .string()
    .min(1, 'El código es obligatorio')
    .regex(VERIFICATION_CODE_PATTERN, 'El código debe tener exactamente 6 dígitos'),
});

// Keeps the leading '@' that E1-H1.CA3 requires while the user types the handle.
// Strips any symbol other than letters, numbers and underscores (like Instagram/Twitter).
export function normalizeHandle(value: string): string {
  const cleaned = value.replace(/[^a-zA-Z0-9_]/g, '');
  return cleaned.length > 0 ? `@${cleaned}`.slice(0, 15) : '';
}

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;

export type RegisterField = keyof RegisterInput;

// Validates a single registration field with the same rule the whole form uses,
// so a step of the signup wizard can never disagree with the final submit.
export function validateRegisterField(field: RegisterField, value: string): string | null {
  const result = registerSchema.shape[field].safeParse(value);
  return result.success ? null : result.error.issues[0].message;
}
