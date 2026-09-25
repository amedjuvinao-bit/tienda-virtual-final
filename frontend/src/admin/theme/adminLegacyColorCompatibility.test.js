import postcss from 'postcss';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { applyAdminGlobalStyles } from './adminGlobalStyles';

function scopedCompatibilityCss() {
  const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
  try {
    applyAdminGlobalStyles();
  } finally {
    consoleError.mockRestore();
  }

  const css = document.getElementById('admin-global-glass-styles')?.textContent || '';
  const root = postcss.parse(css);
  const scopedRules = [];

  root.walkAtRules('scope', (rule) => {
    expect(rule.params).toBe(
      '(.admin-area) to ([data-admin-storefront-preview="true"])'
    );
    scopedRules.push(rule.toString());
  });

  return scopedRules.join('\n');
}

describe('admin legacy color compatibility', () => {
  afterEach(() => {
    document.getElementById('admin-global-glass-styles')?.remove();
  });

  it('adapts old neutral and brand utilities to the selected admin theme', () => {
    const css = scopedCompatibilityCss();

    expect(css).toContain('.text-gray-700');
    expect(css).toContain('color: var(--admin-card-text) !important');
    expect(css).toContain('.text-pink-700');
    expect(css).toContain('var(--admin-primary-soft-text, var(--admin-primary))');
    expect(css).toContain('.bg-pink-600');
    expect(css).toContain('background: var(--admin-primary) !important');
    expect(css).toContain('[class*="border-gray-"]');
    expect(css).toContain('border-color: var(--admin-widget-surface-border) !important');
  });

  it('converts fixed white and legacy gradient surfaces without entering storefront previews', () => {
    const css = scopedCompatibilityCss();

    expect(css).toContain('[style*="background: #fff"]');
    expect(css).toContain('background: var(--admin-widget-surface-soft-bg) !important');
    expect(css).toContain('[class~="from-white"]');
    expect(css).toContain('--tw-gradient-from: var(--admin-widget-surface-soft-bg)');
    expect(css).toContain('[class~="to-pink-50"]');
    expect(css).toContain('--tw-gradient-to: var(--admin-primary-soft-bg)');
  });

  it('keeps feedback colors semantic instead of replacing them with the theme accent', () => {
    const css = scopedCompatibilityCss();

    expect(css).toContain('.bg-emerald-50');
    expect(css).toContain('background: var(--admin-success-soft-bg) !important');
    expect(css).toContain('.bg-amber-50');
    expect(css).toContain('background: var(--admin-warning-soft-bg) !important');
    expect(css).toContain('.bg-rose-50');
    expect(css).toContain('background: var(--admin-danger-soft-bg) !important');
    expect(css).toContain('border-color: var(--admin-danger-border) !important');
    expect(css).toContain('html.admin-theme-dark .admin-area button:is(:disabled, [disabled], .disabled, [aria-disabled="true"])');
    expect(css).toContain('color: var(--admin-card-muted-text) !important');
  });
});
