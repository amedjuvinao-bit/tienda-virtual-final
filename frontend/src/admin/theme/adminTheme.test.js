import { afterEach, describe, expect, it } from 'vitest';

import { applyAdminGlobalStyles } from './adminGlobalStyles';
import { applyAdminTheme } from './adminTheme';
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
      'rgba(8,13,27,0.64)'
    );
    expect(root.style.getPropertyValue('--admin-widget-button-bg')).toContain(
      'rgba(8,13,27,0.58)'
    );
    expect(root.style.getPropertyValue('--admin-card-text')).toBe('#ffffff');
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
