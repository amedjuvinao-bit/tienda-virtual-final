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
    expect(loginSettingsEqual(DEFAULT_LOGIN_SETTINGS, { ...DEFAULT_LOGIN_SETTINGS, theme: 'smokeGlass' })).toBe(false);
  });

  it('convierte temas retirados sin volver a mostrarlos', () => {
    expect(normalizeLoginSettings({ theme: 'orbit3d' }).theme).toBe('liquidGlass');
    expect(normalizeLoginSettings({ theme: 'noirGallery' }).theme).toBe('smokeGlass');
    expect(normalizeLoginSettings({ theme: 'roseLuxuryLight' }).theme).toBe('immersiveGallery');
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

  it('conserva una tonalidad válida de Galería Inmersiva y descarta valores inventados', () => {
    const roseGold = normalizeLoginSettings({
      ...DEFAULT_LOGIN_SETTINGS,
      customizations: {
        immersiveGallery: {
          ...DEFAULT_LOGIN_SETTINGS.customizations.immersiveGallery,
          imageTone: 'roseGold',
        },
      },
    });
    const invalid = normalizeLoginSettings({
      ...DEFAULT_LOGIN_SETTINGS,
      customizations: {
        immersiveGallery: {
          ...DEFAULT_LOGIN_SETTINGS.customizations.immersiveGallery,
          imageTone: 'inventado',
        },
      },
    });

    expect(roseGold.customizations.immersiveGallery.imageTone).toBe('roseGold');
    expect(invalid.customizations.immersiveGallery.imageTone).toBe('black');
  });

  it('rechaza fondos con protocolos inseguros o URLs relativas a otro host', () => {
    expect(safeLoginImageUrl('javascript:alert(1)')).toBe('');
    expect(safeLoginImageUrl('//malicioso.example/fondo.png')).toBe('');
    expect(safeLoginImageUrl('/uploads/login.webp')).toBe('/uploads/login.webp');
    expect(safeLoginImageUrl('https://cdn.example.com/login.webp')).toBe('https://cdn.example.com/login.webp');
  });
});
