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
    document.documentElement.removeAttribute('data-admin-theme-background');
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

  it('mantiene éxito, advertencia y error independientes del color del tema', () => {
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
      success: '#d4af37',
      warning: '#d4af37',
      warningSoftBg: '#ffffff',
      warningText: '#d4af37',
      danger: '#d4af37',
      dangerHover: '#d4af37',
      dangerSoftBg: '#ffffff',
      dangerText: '#d4af37',
    });

    const root = document.documentElement;
    expect(root.style.getPropertyValue('--admin-success')).toBe('#16a34a');
    expect(root.style.getPropertyValue('--admin-success-soft-bg')).toBe('#f0fdf4');
    expect(root.style.getPropertyValue('--admin-success-text')).toBe('#166534');
    expect(root.style.getPropertyValue('--admin-warning')).toBe('#d97706');
    expect(root.style.getPropertyValue('--admin-warning-soft-bg')).toBe('#fffbeb');
    expect(root.style.getPropertyValue('--admin-warning-text')).toBe('#92400e');
    expect(root.style.getPropertyValue('--admin-danger')).toBe('#dc2626');
    expect(root.style.getPropertyValue('--admin-danger-soft-bg')).toBe('#fef2f2');
    expect(root.style.getPropertyValue('--admin-danger-text')).toBe('#991b1b');
  });

  it('conserva los tonos semánticos y adapta solo su contraste en modo oscuro', () => {
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
      warning: '#a855f7',
      danger: '#a855f7',
    });

    const root = document.documentElement;
    expect(root.style.getPropertyValue('--admin-success')).toBe('#16a34a');
    expect(root.style.getPropertyValue('--admin-success-soft-bg')).toBe('#052e16');
    expect(root.style.getPropertyValue('--admin-warning')).toBe('#d97706');
    expect(root.style.getPropertyValue('--admin-warning-soft-bg')).toBe('#451a03');
    expect(root.style.getPropertyValue('--admin-danger')).toBe('#dc2626');
    expect(root.style.getPropertyValue('--admin-danger-soft-bg')).toBe('#450a0a');
  });

  it('aplica el fondo propio y la firma clara del tema Horizonte azul', () => {
    applyAdminTheme({
      preset: 'azureHorizonLight',
      pageBg: '#eaf5ff',
      sidebarBg: '#f7fbff',
      headerBg: '#f8fbff',
      cardBg: '#f9fcff',
      cardHeaderBg: '#eff6ff',
      inputBg: '#fafdff',
      modalBg: '#f8fbff',
      primary: '#2563eb',
      layout: { radius: 24 },
    });

    const root = document.documentElement;
    expect(root.dataset.adminThemeMode).toBe('light');
    expect(root.dataset.adminThemeStyle).toBe('azure');
    expect(root.dataset.adminThemeBackground).toBe('image');
    expect(root.style.getPropertyValue('--admin-theme-background-image')).toContain(
      'azure-horizon-dashboard'
    );
    expect(root.style.getPropertyValue('--admin-card-text')).toBe('#111827');
    expect(root.style.getPropertyValue('--admin-radius')).toBe('24px');
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
    expect(css).toContain('Explicitly white inline surfaces follow the active widget material');
    expect(css).toContain('html[data-admin-theme-style="azure"]');
    expect(css).toContain('Semantic buttons are deliberately independent from the selected theme');
    expect(css).toContain('background: var(--admin-success-soft-bg) !important');
    expect(css).toContain('background: var(--admin-warning-soft-bg) !important');
    expect(css).toContain('background: var(--admin-danger-soft-bg) !important');
    expect(css).not.toContain('color: var(--admin-button-text) !important;\n    }\n\n    /* Disabled state */');
  });
});
