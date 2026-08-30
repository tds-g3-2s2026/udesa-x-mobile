import {
  loginSchema,
  normalizeHandle,
  registerSchema,
  validateRegisterField,
  verifyEmailSchema,
  type RegisterField,
} from '../../src/features/auth/schemas/authSchemas';

const validRegistration = {
  handle: '@joaquin_dev',
  email: 'jleon@udesa.edu.ar',
  fullName: 'Joaquín León',
  password: 'Password123',
};

function registerErrorFor(field: keyof typeof validRegistration, value: string): string | null {
  const result = registerSchema.safeParse({ ...validRegistration, [field]: value });
  if (result.success) return null;
  const issue = result.error.issues.find((candidate) => candidate.path[0] === field);
  return issue ? issue.message : null;
}

describe('E1-H1. Registro de Usuarios', () => {
  it('E1-H1.CA2 - accepts a well formed email', () => {
    expect(registerSchema.safeParse(validRegistration).success).toBe(true);
  });

  it('E1-H1.CA2 - rejects an email with an invalid format', () => {
    expect(registerErrorFor('email', 'invalid-email')).toBe('Ingresá un correo electrónico válido');
    expect(registerErrorFor('email', 'jleon@')).toBe('Ingresá un correo electrónico válido');
    expect(registerErrorFor('email', 'jleon udesa.edu.ar')).toBe(
      'Ingresá un correo electrónico válido'
    );
  });

  it('E1-H1.CA3 - requires the handle to start with @', () => {
    expect(registerErrorFor('handle', 'joaquin_dev')).toContain('debe comenzar con @');
    expect(registerErrorFor('handle', 'joaquin@dev')).toContain('debe comenzar con @');
  });

  it('E1-H1.CA3 - accepts handles between 4 and 15 characters', () => {
    expect(registerErrorFor('handle', '@abc')).toBeNull();
    expect(registerErrorFor('handle', '@abcdefghijklmn')).toBeNull();
  });

  it('E1-H1.CA3 - rejects handles shorter than 4 or longer than 15 characters', () => {
    expect(registerErrorFor('handle', '@ab')).not.toBeNull();
    expect(registerErrorFor('handle', '@abcdefghijklmno')).not.toBeNull();
  });

  it('E1-H1.CA3 - rejects handles with characters other than letters, numbers and underscores', () => {
    expect(registerErrorFor('handle', '@joaquin-dev')).not.toBeNull();
    expect(registerErrorFor('handle', '@joaquin dev')).not.toBeNull();
    expect(registerErrorFor('handle', '@joaquín_dev')).not.toBeNull();
  });

  it('E1-H1.CA3 - normalizeHandle adds the leading @ while the user types', () => {
    expect(normalizeHandle('joaquin_dev')).toBe('@joaquin_dev');
    expect(normalizeHandle('@joaquin_dev')).toBe('@joaquin_dev');
    expect(normalizeHandle('@@joaquin')).toBe('@joaquin');
    expect(normalizeHandle('')).toBe('');
    expect(normalizeHandle('  joaquin dev ')).toBe('@joaquindev');
    expect(normalizeHandle('   ')).toBe('');
  });

  it('E1-H1.CA4 - accepts a password with 8 characters, an uppercase letter and a number', () => {
    expect(registerErrorFor('password', 'Passwo1d')).toBeNull();
  });

  it('E1-H1.CA4 - rejects a password shorter than 8 characters', () => {
    expect(registerErrorFor('password', 'Pass1')).toBe(
      'La contraseña debe tener al menos 8 caracteres'
    );
  });

  it('E1-H1.CA4 - rejects a password without an uppercase letter', () => {
    expect(registerErrorFor('password', 'password123')).toBe(
      'La contraseña debe contener al menos una letra mayúscula'
    );
  });

  it('E1-H1.CA4 - rejects a password without a number', () => {
    expect(registerErrorFor('password', 'PasswordAB')).toBe(
      'La contraseña debe contener al menos un número'
    );
  });

  it('E1-H1.CA5 - rejects a registration with every required field empty', () => {
    const result = registerSchema.safeParse({ handle: '', email: '', fullName: '', password: '' });
    expect(result.success).toBe(false);
    if (result.success) return;
    for (const field of ['handle', 'email', 'fullName', 'password'] as const) {
      expect(result.error.issues.some((issue) => issue.path[0] === field)).toBe(true);
    }
  });

  it('E1-H1.CA5 - rejects required fields that only contain whitespace', () => {
    expect(registerErrorFor('fullName', '   ')).not.toBeNull();
    expect(registerErrorFor('email', '   ')).not.toBeNull();
  });

  it('E1-H1.CA5 - rejects a login with empty fields', () => {
    const result = loginSchema.safeParse({ identifier: '', password: '' });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues.map((issue) => issue.message)).toEqual([
      'El usuario o email es obligatorio',
      'La contraseña es obligatoria',
    ]);
  });

  it('E1-H1.CA6 - accepts a verification code of exactly 6 digits', () => {
    const result = verifyEmailSchema.safeParse({ code: '123456' });
    expect(result.success).toBe(true);
  });

  it('E1-H1.CA6 - rejects verification codes that are not 6 digits', () => {
    expect(verifyEmailSchema.safeParse({ code: '12345' }).success).toBe(false);
    expect(verifyEmailSchema.safeParse({ code: '1234567' }).success).toBe(false);
    expect(verifyEmailSchema.safeParse({ code: 'abcdef' }).success).toBe(false);
    expect(verifyEmailSchema.safeParse({ code: '12 456' }).success).toBe(false);
    expect(verifyEmailSchema.safeParse({ code: '' }).success).toBe(false);
  });
});

describe('E1-H2. Inicio de Sesión', () => {
  it('E1-H2.CA1 - accepts credentials with an identifier and a password', () => {
    const result = loginSchema.safeParse({ identifier: '@joaquin_dev', password: 'Password123' });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data).toEqual({ identifier: '@joaquin_dev', password: 'Password123' });
  });

  it('E1-H2.CA1 - accepts an email as identifier and trims surrounding spaces', () => {
    const result = loginSchema.safeParse({
      identifier: '  jleon@udesa.edu.ar  ',
      password: 'Password123',
    });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.identifier).toBe('jleon@udesa.edu.ar');
  });
});

describe('Validación por paso del wizard de registro', () => {
  it('reports the same message the whole form reports for each field', () => {
    const invalidValues: [RegisterField, string][] = [
      ['handle', 'ab'],
      ['email', 'jleon.udesa.edu.ar'],
      ['fullName', 'J'],
      ['password', 'password'],
    ];

    for (const [field, value] of invalidValues) {
      expect(validateRegisterField(field, value)).toBe(registerErrorFor(field, value));
    }
  });

  it('accepts the valid value of every field', () => {
    for (const [field, value] of Object.entries(validRegistration)) {
      expect(validateRegisterField(field as RegisterField, value)).toBeNull();
    }
  });
});
