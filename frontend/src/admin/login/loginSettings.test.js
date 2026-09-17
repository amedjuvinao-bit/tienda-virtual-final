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
    })).toMatchObject({
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
    expect(loginSettingsEqual(DEFAULT_LOGIN_SETTINGS, { ...DEFAULT_LOGIN_SETTINGS, theme: 'neonPortal' })).toBe(false);
  });

  it('conserva colores y textos válidos por cada tema', () => {
    const normalized = normalizeLoginSettings({
      ...DEFAULT_LOGIN_SETTINGS,
      theme: 'liquidGlass',
      customizations: {
        liquidGlass: {
          ...DEFAULT_LOGIN_SETTINGS.customizations.liquidGlass,
          accent: '#12abef',
          headline: 'Control total',
        },
      },
    });

    expect(normalized.customizations.liquidGlass.accent).toBe('#12abef');
    expect(normalized.customizations.liquidGlass.headline).toBe('Control total');
  });

  it('rechaza fondos con protocolos inseguros o URLs relativas a otro host', () => {
    expect(safeLoginImageUrl('javascript:alert(1)')).toBe('');
    expect(safeLoginImageUrl('//malicioso.example/fondo.png')).toBe('');
    expect(safeLoginImageUrl('/uploads/login.webp')).toBe('/uploads/login.webp');
    expect(safeLoginImageUrl('https://cdn.example.com/login.webp')).toBe('https://cdn.example.com/login.webp');
  });
});
