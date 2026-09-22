import { afterEach, describe, expect, it } from 'vitest';

import { applyAdminTheme } from './adminTheme';
import { ADMIN_FONT_PRESETS } from './adminTypography';
import { applyAdminWidgetTexture } from './adminWidgetTexture';

describe('adminTheme Nivel Plus', () => {
  afterEach(() => {
    document.documentElement.removeAttribute('class');
    document.documentElement.removeAttribute('data-admin-theme-mode');
    document.documentElement.removeAttribute('data-admin-theme-preset');
    document.documentElement.removeAttribute('data-admin-theme-style');
    document.documentElement.removeAttribute('data-admin-font-preset');
    document.documentElement.removeAttribute('style');
  });

  it('genera texto claro y firma visual para un tema oscuro', () => {
    applyAdminTheme({
      preset: 'darkCyber',
      fontPreset: 'boutiqueEditorial',
      pageBg: '#030712',
      sidebarBg: '#09090b',
      headerBg: '#18181b',
      cardBg: '#111827',
      cardHeaderBg: '#181026',
      inputBg: '#09090b',
      modalBg: '#111827',
      primary: '#a855f7',
      activeNavBg: '#581c87',
      activeNavText: '#f5d0fe',
      buttonBg: '#9333ea',
      buttonText: '#ffffff',
      layout: { radius: 30 },
    });
    applyAdminWidgetTexture('solidPremium');

    const root = document.documentElement;
    expect(root.dataset.adminThemeMode).toBe('dark');
    expect(root.dataset.adminThemeStyle).toBe('cyber');
    expect(root.dataset.adminFontPreset).toBe('boutiqueEditorial');
    expect(root.style.getPropertyValue('--admin-card-text')).toBe('#ffffff');
    expect(root.style.getPropertyValue('--admin-input-text')).toBe('#ffffff');
    expect(root.style.getPropertyValue('--admin-font-heading')).toContain('Cormorant Garamond');
    expect(root.style.getPropertyValue('--admin-theme-pattern')).toContain('repeating-linear-gradient');
    expect(root.style.getPropertyValue('--admin-theme-card-radius')).toBe('5px 22px 5px 22px');
    expect(root.style.getPropertyValue('--admin-active-nav-text')).toBe('#f5d0fe');
    expect(root.style.getPropertyValue('--admin-button-text')).toBe('#ffffff');
    expect(root.style.getPropertyValue('--admin-widget-surface-bg')).toContain('#334155');
    expect(root.style.getPropertyValue('--admin-radius')).toBe('30px');
  });

  it('ofrece familias tipográficas distintas también para el texto de lectura', () => {
    const bodies = new Set(ADMIN_FONT_PRESETS.map((preset) => preset.body));
    const combinations = new Set(
      ADMIN_FONT_PRESETS.map((preset) => `${preset.body}|${preset.heading}`)
    );

    expect(bodies.size).toBe(ADMIN_FONT_PRESETS.length);
    expect(combinations.size).toBe(ADMIN_FONT_PRESETS.length);
  });

  it('genera texto oscuro sobre superficies claras y limita radios extremos', () => {
    applyAdminTheme({
      preset: 'goldBoutiqueLight',
      pageBg: '#fffbeb',
      sidebarBg: '#fffdf5',
      headerBg: '#ffffff',
      cardBg: '#ffffff',
      cardHeaderBg: '#fffbeb',
      inputBg: '#ffffff',
      modalBg: '#ffffff',
      primary: '#d4af37',
      layout: { radius: 80 },
    });

    const root = document.documentElement;
    expect(root.dataset.adminThemeMode).toBe('light');
    expect(root.dataset.adminThemeStyle).toBe('gilded');
    expect(root.style.getPropertyValue('--admin-card-text')).toBe('#111827');
    expect(root.style.getPropertyValue('--admin-input-text')).toBe('#111827');
    expect(root.style.getPropertyValue('--admin-radius')).toBe('32px');
  });
});
