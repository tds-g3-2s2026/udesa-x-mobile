import { ApiError, getAuthErrorMessage, toAuthError } from '../../src/api/apiClient';

describe('toAuthError', () => {
  it('passes a non-axios Error through unchanged', () => {
    const original = new Error('boom');

    const result = toAuthError(original, 'fallback');

    expect(result).toBe(original);
  });

  it('falls back to a generic ApiError for a thrown value that is not an Error', () => {
    const result = toAuthError('a string was thrown', 'fallback');

    expect(result).toBeInstanceOf(ApiError);
    expect(result.message).toBe('Ocurrió un error inesperado. Intentalo de nuevo.');
  });
});

describe('getAuthErrorMessage', () => {
  it('returns the generic message for a value that is not an Error', () => {
    expect(getAuthErrorMessage('not an error')).toBe(
      'Ocurrió un error inesperado. Intentalo de nuevo.'
    );
  });

  it('returns the generic message when the Error has no usable text', () => {
    expect(getAuthErrorMessage(new Error(''))).toBe(
      'Ocurrió un error inesperado. Intentalo de nuevo.'
    );
    expect(getAuthErrorMessage(new Error('   '))).toBe(
      'Ocurrió un error inesperado. Intentalo de nuevo.'
    );
  });

  it('returns the message when the Error has one', () => {
    expect(getAuthErrorMessage(new Error('algo salió mal'))).toBe('algo salió mal');
  });
});
