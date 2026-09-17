import { describe, expect, it } from 'vitest';

import {
  DEFAULT_LOGIN_SETTINGS,
  loginSettingsEqual,
  normalizeLoginSettings,
  safeLoginImageUrl,
} from './loginSettings';

describe('loginSettings', () => {
  it('normaliza valores públicos sin aceptar temas inventados', () => {
    expect(normalizeLoginSettings({
      theme: 'inventado',
      layout: 'inventado',
      background: { mode: 'color', color: '#ABCDEF', imageOpacity: 8, overlay: -1 },
    })).toEqual({
      theme: DEFAULT_LOGIN_SETTINGS.theme,
      layout: DEFAULT_LOGIN_SETTINGS.layout,
      background: {
        mode: 'color',
        color: '#abcdef',
        image: '',
        imageOpacity: 1,
        overlay: 0,
      },
    });
  });

  it('compara configuraciones por su forma canónica', () => {
    expect(loginSettingsEqual(DEFAULT_LOGIN_SETTINGS, normalizeLoginSettings(DEFAULT_LOGIN_SETTINGS))).toBe(true);
    expect(loginSettingsEqual(DEFAULT_LOGIN_SETTINGS, { ...DEFAULT_LOGIN_SETTINGS, theme: 'darkCyber' })).toBe(false);
  });

  it('rechaza fondos con protocolos inseguros o URLs relativas a otro host', () => {
    expect(safeLoginImageUrl('javascript:alert(1)')).toBe('');
    expect(safeLoginImageUrl('//malicioso.example/fondo.png')).toBe('');
    expect(safeLoginImageUrl('/uploads/login.webp')).toBe('/uploads/login.webp');
    expect(safeLoginImageUrl('https://cdn.example.com/login.webp')).toBe('https://cdn.example.com/login.webp');
  });
});
