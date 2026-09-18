import { describe, expect, it } from 'vitest';
import {
  ADMIN_PASSWORD_MIN_LENGTH,
  getAdminPasswordPolicyError,
} from './adminPasswordPolicy';

describe('adminPasswordPolicy', () => {
  it('mantiene la longitud administrativa mínima en 10', () => {
    expect(ADMIN_PASSWORD_MIN_LENGTH).toBe(10);
    expect(getAdminPasswordPolicyError('Corta1!')).toMatch(/mínimo 10/i);
  });

  it('exige mayúscula, minúscula, número y símbolo', () => {
    expect(getAdminPasswordPolicyError('solominusculas1!')).toMatch(/mayúscula/i);
    expect(getAdminPasswordPolicyError('SOLOMAYUSCULAS1!')).toMatch(/minúscula/i);
    expect(getAdminPasswordPolicyError('SinNumeros!')).toMatch(/número/i);
    expect(getAdminPasswordPolicyError('SinSimbolo2026')).toMatch(/símbolo/i);
  });

  it('acepta una contraseña que cumple toda la política', () => {
    expect(getAdminPasswordPolicyError('Segura2026!')).toBe('');
  });
});
