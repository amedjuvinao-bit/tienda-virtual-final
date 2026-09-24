import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

function source(relativeUrl) {
  return fs.readFileSync(new URL(relativeUrl, import.meta.url), 'utf8');
}

const layoutSource = source('./AdminLayout.jsx');
const layoutEntrySource = source('./AdminLayout.js');
const mobileNavigationSource = source('./components/AdminMobileNavigation.jsx');
const mobileStylesSource = source('./theme/adminMobileSystem.css');
const globalStylesSource = source('./theme/adminGlobalStyles.js');
const panelStylesSource = source('./configuracion/sections/PanelAdminSection.css');
const panelSource = source('./configuracion/sections/PanelAdminSection.jsx');

describe('accesibilidad y adaptación del Panel Admin', () => {
  it('usa una sola fuente de navegación y no reinyecta enlaces heredados', () => {
    expect(layoutEntrySource).toContain("export { default } from './AdminLayout.jsx';");
    expect(layoutEntrySource).not.toContain('createPortal');
    expect(layoutEntrySource).not.toContain('setInterval');
    expect(layoutEntrySource).not.toContain('AdminExtraMenuPortal');
  });

  it('permite saltar al contenido principal y muestra foco de teclado global', () => {
    expect(layoutSource).toContain('href="#admin-main-content"');
    expect(layoutSource).toContain('id="admin-main-content"');
    expect(layoutSource).toContain('Saltar al contenido principal');
    expect(globalStylesSource).toContain(
      '.admin-area :is(a[href], input, select, textarea, [role="button"]):focus-visible'
    );
    expect(globalStylesSource).toContain('outline-offset: 2px !important');
  });

  it('concentra la navegación móvil en una barra inferior y una bandeja accesible', () => {
    expect(layoutSource).toContain('<AdminMobileNavigation');
    expect(mobileNavigationSource).toContain('aria-label="Navegación móvil principal"');
    expect(mobileNavigationSource).toContain('role="dialog"');
    expect(mobileNavigationSource).toContain('aria-modal="true"');
    expect(mobileNavigationSource).toContain('aria-label="Buscar un módulo del panel"');
    expect(mobileNavigationSource).toContain("if (event.key === 'Escape')");
    expect(mobileNavigationSource).toContain("if (event.key !== 'Tab') return");
  });

  it('protege el foco y el cierre por teclado en el modal de reseñas', () => {
    expect(layoutSource).toContain('role="dialog"');
    expect(layoutSource).toContain('aria-modal="true"');
    expect(layoutSource).toContain("if (event.key === 'Escape')");
    expect(layoutSource).toContain("if (event.key !== 'Tab') return");
    expect(layoutSource).toContain("document.body.style.overflow = 'hidden'");
    expect(layoutSource).toContain('reviewsTriggerRef.current?.focus?.()');
    expect(layoutSource).toContain('role="alert"');
  });

  it('sale del panel aunque el servidor rechace una cookie vencida', () => {
    expect(layoutSource).toMatch(
      /const handleLogout = \(\) => \{[\s\S]*?void logout\(\);[\s\S]*?window\.location\.replace\('\/admin\/login'\);[\s\S]*?\};/,
    );
    expect(layoutSource).not.toContain("navigate('/admin/login');");
  });

  it('mantiene navegación y contenido utilizables en pantallas estrechas', () => {
    expect(mobileStylesSource).toContain('.admin-mobile-bottom-nav');
    expect(mobileStylesSource).toContain('grid-template-columns: repeat(4, minmax(0, 1fr))');
    expect(mobileNavigationSource).toContain('aria-label={item.mobileLabel || item.label}');
    expect(mobileNavigationSource).not.toContain('<span>{item.mobileLabel || item.label}</span>');
    expect(mobileStylesSource).toContain('.admin-mobile-more-sheet');
    expect(layoutSource).toContain('@media (max-width: 480px)');
    expect(layoutSource).toContain('max-height: calc(100dvh - 16px)');
    expect(globalStylesSource).toContain('overscroll-behavior-inline: contain');
    expect(globalStylesSource).toContain('-webkit-overflow-scrolling: touch');
  });

  it('deja el cargador de fondo disponible por teclado y conserva estados semánticos', () => {
    expect(panelStylesSource).toMatch(
      /\.panel-admin-upload-button input\s*\{[^}]*inset: 0;[^}]*width: 100%;[^}]*height: 100%;/s
    );
    expect(panelStylesSource).not.toContain('pointer-events: none; }\n.panel-admin-upload-button.is-disabled');
    expect(panelStylesSource).toContain('.panel-admin-upload-button:focus-within');
    expect(panelStylesSource).toContain('var(--admin-success-soft-bg)');
    expect(panelSource).toContain('aria-live="polite"');
  });
});
