import postcss from 'postcss';
import { afterEach, describe, expect, it } from 'vitest';

import pageEditorSource from '../pages/PageEditor.jsx?raw';
import { applyAdminGlobalStyles } from './adminGlobalStyles';

const embeddedPreviewEditors = import.meta.glob(
  [
    '../appearance/banner/BannerPanel.jsx',
    '../appearance/footer/FooterPanel.jsx',
    '../appearance/header/HeaderPanel.jsx',
    '../appearance/sections/SectionsPanel.jsx',
    '../appearance/sections/categorias/CategoriasSectionUI.jsx',
    '../appearance/sections/complementos/ComplementosSectionUI.jsx',
    '../appearance/sections/editor/CardsEditor.jsx',
    '../appearance/sections/info/infoSectionUI.jsx',
    '../appearance/sections/instagram/InstagramSectionUI.jsx',
    '../appearance/sections/look/LookSectionUI.jsx',
    '../appearance/sections/tiktok/TiktokSectionUI.jsx',
    '../pages/CartPageEditor.jsx',
    '../pages/CatalogPageEditor.jsx',
    '../pages/CheckoutPageEditor.jsx',
    '../pages/FavoritesPageEditor.jsx',
    '../pages/NotFoundPageEditor.jsx',
    '../pages/ProductDetailPageEditor.jsx',
    '../pages/ThanksPageEditor.jsx',
  ],
  { eager: true, import: 'default', query: '?raw' }
);

describe('admin storefront preview isolation', () => {
  afterEach(() => {
    document.getElementById('admin-global-glass-styles')?.remove();
  });

  it('keeps generic admin rules outside every embedded storefront preview', () => {
    applyAdminGlobalStyles();

    const css = document.getElementById('admin-global-glass-styles')?.textContent || '';
    const root = postcss.parse(css);
    const scopedCss = [];

    root.walkAtRules('scope', (rule) => {
      expect(rule.params).toBe(
        '(.admin-area) to ([data-admin-storefront-preview="true"])'
      );
      scopedCss.push(rule.toString());
    });

    expect(scopedCss).toHaveLength(3);
    expect(scopedCss.join('\n')).toContain('.admin-area button');
    expect(scopedCss.join('\n')).toContain('.admin-area input');
    expect(scopedCss.join('\n')).toContain('.admin-area .bg-white');
    expect(css).toContain(
      '.admin-area [data-admin-storefront-preview="true"]'
    );
    expect(css).toContain('font-family: var(--font-base');
  });

  it.each(Object.entries(embeddedPreviewEditors))(
    'marks the real preview canvas in %s',
    (_path, source) => {
      expect(source).toContain('data-admin-storefront-preview="true"');
    }
  );

  it('keeps the generic page editor preview outside the admin document', () => {
    expect(pageEditorSource).toContain(
      'window.open(previewUrl, "_blank", "noopener,noreferrer")'
    );
    expect(pageEditorSource).not.toContain('data-admin-storefront-preview');
  });
});
