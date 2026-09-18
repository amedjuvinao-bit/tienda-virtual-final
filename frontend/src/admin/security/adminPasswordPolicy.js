export const ADMIN_PASSWORD_MIN_LENGTH = 10;

export const ADMIN_PASSWORD_POLICY_HINT =
  'Mínimo 10 caracteres, con mayúscula, minúscula, número y símbolo.';

export function getAdminPasswordPolicyError(password) {
  const value = String(password || '');

  if (value.length < ADMIN_PASSWORD_MIN_LENGTH) {
    return `La contraseña debe tener mínimo ${ADMIN_PASSWORD_MIN_LENGTH} caracteres.`;
  }

  if (!/[A-ZÁÉÍÓÚÑ]/.test(value)) {
    return 'La contraseña debe incluir al menos una mayúscula.';
  }

  if (!/[a-záéíóúñ]/.test(value)) {
    return 'La contraseña debe incluir al menos una minúscula.';
  }

  if (!/\d/.test(value)) {
    return 'La contraseña debe incluir al menos un número.';
  }

  if (!/[^A-Za-zÁÉÍÓÚÑáéíóúñ0-9]/.test(value)) {
    return 'La contraseña debe incluir al menos un símbolo.';
  }

  return '';
}
