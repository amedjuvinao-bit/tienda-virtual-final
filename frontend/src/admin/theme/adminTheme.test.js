import { afterEach, describe, expect, it } from 'vitest';

import { applyAdminGlobalStyles } from './adminGlobalStyles';
import { applyAdminTheme } from './adminTheme';
import {
  ADMIN_FONT_PRESETS,
  applyAdminTypography,
} from './adminTypography';
import { applyAdminWidgetTexture } from './adminWidgetTexture';

describe('adminTheme Nivel Plus', () => {
  afterEach(() => {
    document.documentElement.removeAttribute('class');
    document.documentElement.removeAttribute('data-admin-theme-mode');
    document.documentElement.removeAttribute('data-admin-theme-preset');
    document.documentElement.removeAttribute('data-admin-theme-style');
    document.documentElement.removeAttribute('data-admin-font-preset');
    document.documentElement.removeAttribute('style');
    document.getElementById('admin-global-glass-styles')?.remove();
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
      layout: { radius: 30 },
    });

    const root = document.documentElement;
    expect(root.dataset.adminThemeMode).toBe('dark');
    expect(root.dataset.adminThemeStyle).toBe('cyber');
    expect(root.dataset.adminFontPreset).toBe('boutiqueEditorial');
    expect(root.style.getPropertyValue('--admin-card-text')).toBe('#ffffff');
    expect(root.style.getPropertyValue('--admin-input-text')).toBe('#ffffff');
    expect(root.style.getPropertyValue('--admin-accent')).toBe('#a855f7');
    expect(root.style.getPropertyValue('--admin-font-heading')).toContain('Cormorant Garamond');
    expect(root.style.getPropertyValue('--admin-theme-pattern')).toContain('repeating-linear-gradient');
    expect(root.style.getPropertyValue('--admin-radius')).toBe('30px');
  });

  it('define superficies suaves y estados deshabilitados legibles en oscuro', () => {
    applyAdminTheme({
      preset: 'darkCyber',
      pageBg: '#030712',
      sidebarBg: '#09090b',
      headerBg: '#18181b',
      cardBg: '#111827',
      cardHeaderBg: '#181026',
      buttonSoftBg: '#181026',
      buttonSoftText: '#d8b4fe',
      buttonSoftBorder: '#7e22ce',
      inputBg: '#09090b',
      modalBg: '#111827',
      primary: '#a855f7',
    });

    const root = document.documentElement;
    expect(root.style.getPropertyValue('--admin-soft-bg')).toBe('#181026');
    expect(root.style.getPropertyValue('--admin-soft-text')).toBe('#d8b4fe');
    expect(root.style.getPropertyValue('--admin-disabled-bg')).toBe('#181026');
    expect(root.style.getPropertyValue('--admin-disabled-text')).toBe('#d8b4fe');
    expect(root.style.getPropertyValue('--admin-disabled-border')).toBe('#7e22ce');
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

  it('ofrece cinco voces tipográficas realmente diferentes', () => {
    const bodyFamilies = ADMIN_FONT_PRESETS.map((preset) => preset.body);
    const headingFamilies = ADMIN_FONT_PRESETS.map((preset) => preset.heading);

    expect(new Set(bodyFamilies).size).toBe(ADMIN_FONT_PRESETS.length);
    expect(new Set(headingFamilies).size).toBe(ADMIN_FONT_PRESETS.length);

    applyAdminTypography('executiveSerif');

    const root = document.documentElement;
    expect(root.dataset.adminFontPreset).toBe('executiveSerif');
    expect(root.style.getPropertyValue('--admin-font-body')).toContain('IBM Plex Sans');
    expect(root.style.getPropertyValue('--admin-font-heading')).toContain('IBM Plex Serif');
    expect(root.style.getPropertyValue('--admin-font-heading-weight')).toBe('600');
  });

  it('mantiene vidrio líquido oscuro detrás del texto claro', () => {
    applyAdminTheme({
      preset: 'darkCyber',
      pageBg: '#030712',
      sidebarBg: '#09090b',
      headerBg: '#18181b',
      cardBg: '#111827',
      cardHeaderBg: '#181026',
      inputBg: '#09090b',
      modalBg: '#111827',
      primary: '#a855f7',
    });

    applyAdminWidgetTexture('liquidGlass');

    const root = document.documentElement;
    expect(root.style.getPropertyValue('--admin-widget-surface-bg')).toContain(
      'rgba(7,10,18,0.68)'
    );
    expect(root.style.getPropertyValue('--admin-widget-button-bg')).toContain(
      'rgba(7,10,18,0.62)'
    );
    expect(root.style.getPropertyValue('--admin-widget-surface-bg')).not.toContain(
      'var(--admin-primary)'
    );
    expect(root.style.getPropertyValue('--admin-card-text')).toBe('#ffffff');
  });

  it('mantiene el vidrio líquido claro neutro e independiente del color del tema', () => {
    applyAdminTheme({
      preset: 'goldBoutiqueLight',
      pageBg: '#fffbeb',
      sidebarBg: '#fffdf5',
      headerBg: '#ffffff',
      cardBg: '#ffffff',
      inputBg: '#ffffff',
      modalBg: '#ffffff',
      primary: '#d4af37',
    });

    applyAdminWidgetTexture('liquidGlass');

    const root = document.documentElement;
    const neutralSurfaces = [
      '--admin-widget-surface-bg',
      '--admin-widget-surface-strong-bg',
      '--admin-widget-surface-soft-bg',
      '--admin-widget-input-bg',
      '--admin-widget-button-bg',
      '--admin-widget-surface-shadow',
    ];

    neutralSurfaces.forEach((token) => {
      expect(root.style.getPropertyValue(token)).not.toContain('var(--admin-primary)');
    });
    expect(root.style.getPropertyValue('--admin-widget-surface-bg')).toContain(
      'rgba(255,255,255,0.52)'
    );
    expect(root.style.getPropertyValue('--admin-modal-bg')).toBe('rgba(255, 255, 255, 0.84)');
  });

  it('evita que una imagen clara atraviese el lienzo del vidrio oscuro', () => {
    applyAdminGlobalStyles();

    const css = document.getElementById('admin-global-glass-styles')?.textContent || '';
    expect(css).toContain(
      'html.admin-theme-dark[data-admin-widget-texture="liquidGlass"] .admin-area .admin-content-card'
    );
    expect(css).toContain('background: var(--admin-widget-surface-bg) !important');
    expect(css).toContain('An explicitly white inline surface always needs dark ink');
    expect(css).not.toContain('color: var(--admin-button-text) !important;\n    }\n\n    /* Disabled state */');
  });
});
