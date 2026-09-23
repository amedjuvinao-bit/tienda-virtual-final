import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

function source(relativeUrl) {
  return fs.readFileSync(new URL(relativeUrl, import.meta.url), 'utf8');
}

const layoutSource = source('./AdminLayout.jsx');
const globalStylesSource = source('./theme/adminGlobalStyles.js');

describe('encabezado principal del panel administrativo', () => {
  it('permanece visible y adopta una versión compacta durante el scroll', () => {
    expect(layoutSource).toContain('setHeaderCondensed(window.scrollY > 56)');
    expect(layoutSource).toContain('data-condensed={headerCondensed}');
    expect(layoutSource).toMatch(
      /\.admin-area \.admin-header-panel\s*\{[^}]*position: sticky;[^}]*top: var\(--admin-padding\);/s,
    );
    expect(layoutSource).toContain('.admin-area .admin-header-panel[data-condensed="true"]');
  });

  it('mantiene visibles el nombre y el tipo de usuario en escritorio', () => {
    expect(layoutSource).toContain('<strong>{activeAdminName}</strong>');
    expect(layoutSource).toContain('Tipo de usuario: <b>{activeAdminRoleLabel}</b>');
    expect(layoutSource).not.toContain(
      '.admin-profile-compact > div:last-child { display: none; }',
    );
  });

  it('muestra el fondo personalizado en una capa fija que no tapa el tema', () => {
    expect(layoutSource).toContain(
      'className="admin-panel-custom-background"'
    );
    expect(globalStylesSource).toMatch(
      /\.admin-panel-custom-background\s*\{[^}]*position: fixed;[^}]*background-image:/s,
    );
    expect(globalStylesSource).toContain(
      'html[data-admin-panel-background="image"] .admin-panel-custom-background',
    );
  });
});

describe('menú lateral contraíble', () => {
  it('oculta el logo y las etiquetas, pero conserva los iconos al contraerse', () => {
    expect(layoutSource).toContain('data-collapsed={sidebarCollapsed}');
    expect(layoutSource).toContain('aria-hidden={sidebarCollapsed}');
    expect(layoutSource).toContain('compact={sidebarCollapsed}');
    expect(layoutSource).toContain('className="admin-nav-label"');
    expect(layoutSource).toContain('!sidebarCollapsed && (');
    expect(layoutSource).toContain('width: 46px !important;');
    expect(layoutSource).toContain('overflow: visible !important;');
    expect(layoutSource).toMatch(
      /\.admin-sidebar-panel\[data-collapsed="true"\] \.admin-brand-float\s*\{[^}]*max-height: 0;[^}]*opacity: 0;/s,
    );
  });

  it('ofrece control accesible, tooltips y recuerda la preferencia', () => {
    expect(layoutSource).toContain('ADMIN_SIDEBAR_COLLAPSED_KEY');
    expect(layoutSource).toContain('onClick={handleSidebarToggle}');
    expect(layoutSource).toContain('aria-expanded={!sidebarCollapsed}');
    expect(layoutSource).toContain('data-tooltip={item.label}');
    expect(layoutSource).toContain('data-sidebar-collapsed={sidebarCollapsed}');
  });

  it('incluye facturación y cupones en el menú nativo para evitar portales desbordados', () => {
    expect(layoutSource).toContain(
      "{ to: '/admin/facturacion', label: 'Facturación', icon: ReceiptText }",
    );
    expect(layoutSource).toContain(
      "{ to: '/admin/cupones', label: 'Cupones', icon: BadgePercent }",
    );
  });

  it('limita el cristal transparente a los iconos sin rellenos grises', () => {
    const glassRule = layoutSource.match(
      /\.admin-premium-nav-icon__glass\s*\{([\s\S]*?)\n\s*\}/,
    )?.[1] || '';

    expect(glassRule).toContain('rgba(255,255,255,.035)');
    expect(glassRule).toContain('backdrop-filter: blur(4px)');
    expect(glassRule).toContain('transparent 58%');
    expect(glassRule).not.toContain('var(--admin-card-bg)');
    expect(glassRule).not.toContain('rgba(15,23,42');
    expect(glassRule).not.toContain('var(--admin-card-text)');

    const glyphRule = layoutSource.match(
      /\.admin-premium-nav-icon__glyph\s*\{([\s\S]*?)\n\s*\}/,
    )?.[1] || '';

    expect(glyphRule).toContain('var(--admin-primary) 76%');
    expect(glyphRule).toContain('stroke-width: 1.85');
  });
});

describe('contenedores desplazables del panel', () => {
  it('conserva el desplazamiento de tablas, pestañas, registros y modales', () => {
    expect(globalStylesSource).toMatch(
      /\.admin-area \.overflow-x-auto\s*\{[^}]*overflow-x: auto !important;/s,
    );
    expect(globalStylesSource).toMatch(
      /\.admin-area \.overflow-auto\s*\{[^}]*overflow: auto !important;/s,
    );
  });
});
