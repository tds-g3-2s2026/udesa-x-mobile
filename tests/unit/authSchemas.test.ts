import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  normalizeHandle,
  registerSchema,
  resetPasswordSchema,
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

describe('E1-H5. Olvidé Mi Contraseña', () => {
  const validReset = {
    token: 'mock-reset-token-1',
    password: 'Password123',
    passwordConfirmation: 'Password123',
  };

  function resetErrorFor(field: keyof typeof validReset, value: string): string | null {
    const result = resetPasswordSchema.safeParse({ ...validReset, [field]: value });
    if (result.success) return null;
    const issue = result.error.issues.find((candidate) => candidate.path[0] === field);
    return issue ? issue.message : null;
  }

  it('E1-H5.CA4 - the request takes an email or a handle as identifier', () => {
    expect(forgotPasswordSchema.safeParse({ identifier: '@joaquin_dev' }).success).toBe(true);
    expect(forgotPasswordSchema.safeParse({ identifier: 'jleon@udesa.edu.ar' }).success).toBe(true);
    expect(forgotPasswordSchema.safeParse({ identifier: '   ' }).success).toBe(false);
  });

  it('E1-H5.CA3 - accepts a reset whose confirmation matches and meets the policy', () => {
    expect(resetPasswordSchema.safeParse(validReset).success).toBe(true);
  });

  it('E1-H5.CA3 - rejects a confirmation that does not match, blaming the second field', () => {
    const result = resetPasswordSchema.safeParse({
      ...validReset,
      passwordConfirmation: 'Password124',
    });

    expect(result.success).toBe(false);
    if (result.success) return;
    const issue = result.error.issues[0];
    expect(issue.message).toBe('Las contraseñas no coinciden');
    expect(issue.path).toEqual(['passwordConfirmation']);
  });

  it('E1-H5.CA3 - applies the same password policy as the registration', () => {
    // Same values and same messages as the registration cases above: a copy
    // of the rules that drifted would show up right here.
    expect(resetErrorFor('password', 'Short1')).toBe(
      'La contraseña debe tener al menos 8 caracteres'
    );
    expect(resetErrorFor('password', 'password123')).toBe(
      'La contraseña debe contener al menos una letra mayúscula'
    );
    expect(resetErrorFor('password', 'PasswordAbc')).toBe(
      'La contraseña debe contener al menos un número'
    );
  });

  it('E1-H5.CA2 - requires the token that arrives by email and trims what was pasted', () => {
    expect(resetErrorFor('token', '   ')).toBe('Pegá el código que te llegó por correo');

    const result = resetPasswordSchema.safeParse({ ...validReset, token: '  abc123  ' });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.token).toBe('abc123');
  });
});

describe('E1-H13. Cambiar Contraseña', () => {
  const validChange = {
    currentPassword: 'Vieja1234',
    password: 'Nueva1234',
    passwordConfirmation: 'Nueva1234',
  };

  it('E1-H13.CA1 - requires the current password, new password, and confirmation', () => {
    expect(changePasswordSchema.safeParse(validChange).success).toBe(true);

    const result = changePasswordSchema.safeParse({ ...validChange, currentPassword: '' });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues[0].message).toBe('Ingresá tu contraseña actual');
  });

  it('E1-H13.CA2 - applies the same password policy as registration', () => {
    const weak = changePasswordSchema.safeParse({
      ...validChange,
      password: 'minuscula1',
      passwordConfirmation: 'minuscula1',
    });

    expect(weak.success).toBe(false);
    if (weak.success) return;
    expect(weak.error.issues[0].message).toBe(
      'La contraseña debe contener al menos una letra mayúscula'
    );
  });

  it('E1-H13.CA2 - rejects a new password equal to the current one and marks the new password field', () => {
    const result = changePasswordSchema.safeParse({
      currentPassword: 'Vieja1234',
      password: 'Vieja1234',
      passwordConfirmation: 'Vieja1234',
    });

    expect(result.success).toBe(false);
    if (result.success) return;
    const issue = result.error.issues[0];
    expect(issue.message).toBe('La contraseña nueva tiene que ser distinta de la actual');
    expect(issue.path).toEqual(['password']);
  });

  it('E1-H13.CA1 - rejects a mismatched confirmation and marks the confirmation field', () => {
    const result = changePasswordSchema.safeParse({
      ...validChange,
      passwordConfirmation: 'Nueva1235',
    });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues[0].path).toEqual(['passwordConfirmation']);
  });
});

describe('Registration wizard step validation', () => {
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
