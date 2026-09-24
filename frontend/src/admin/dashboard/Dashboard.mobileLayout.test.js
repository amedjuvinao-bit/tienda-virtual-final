import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

function source(relativeUrl) {
  return fs.readFileSync(new URL(relativeUrl, import.meta.url), 'utf8');
}

const layoutSource = source('../AdminLayout.jsx');
const mobileNavigationSource = source('../components/AdminMobileNavigation.jsx');
const mobileSystemStyles = source('../theme/adminMobileSystem.css');
const dashboardPageSource = source('./DashboardPage.jsx');
const dashboardLayoutSource = source('./layouts/DashboardModelOne.jsx');
const kpiGridSource = source('./components/DashboardKpiGrid.jsx');
const responsiveStyles = source('./dashboardResponsive.css');

describe('organización móvil escalable del Panel Admin', () => {
  it('reduce la navegación móvil a tres destinos principales y un menú Más', () => {
    expect(layoutSource).toContain("'/admin/dashboard'");
    expect(layoutSource).toContain("'/admin/productos'");
    expect(layoutSource).toContain("'/admin/ordenes'");
    expect(layoutSource).toContain('<AdminMobileNavigation');
    expect(mobileNavigationSource).toContain('<MoreHorizontal');
    expect(mobileNavigationSource).toContain('<span>Más</span>');
    expect(mobileSystemStyles).toContain('.admin-mobile-bottom-nav');
    expect(mobileSystemStyles).toContain('.admin-mobile-more-sheet');
  });

  it('centraliza la densidad móvil del dashboard en una hoja dedicada', () => {
    expect(dashboardPageSource).toContain("import './dashboardResponsive.css';");
    expect(dashboardPageSource).toContain('className="dashboard-page text-slate-950"');
    expect(dashboardLayoutSource).toContain('dashboard-layout');
    expect(responsiveStyles).toContain('@media (max-width: 767px)');
  });

  it('organiza los indicadores en dos columnas compactas en móvil', () => {
    expect(kpiGridSource).toContain('dashboard-kpi-grid');
    expect(responsiveStyles).toMatch(
      /\.dashboard-kpi-grid\s*\{[^}]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);/s,
    );
    expect(responsiveStyles).toMatch(
      /\.dashboard-kpi-card\s*\{[^}]*height: 76px !important;/s,
    );
  });

  it('mantiene nombres semánticos para ampliar las zonas responsive', () => {
    for (const className of [
      'dashboard-primary-grid',
      'dashboard-sales-region',
      'dashboard-side-stack',
      'dashboard-secondary-grid',
    ]) {
      expect(dashboardLayoutSource).toContain(className);
    }

    expect(responsiveStyles).toContain('.dashboard-products-grid');
    expect(responsiveStyles).toContain('.dashboard-sales-chart');
  });

  it('elimina el contenedor exterior gigante y compacta métricas compartidas', () => {
    expect(mobileSystemStyles).toMatch(
      /\.admin-content-card\s*\{[\s\S]*?padding: 0 !important;[\s\S]*?background: transparent !important;/,
    );
    expect(mobileSystemStyles).toContain('.orders-admin-metrics');
    expect(mobileSystemStyles).toContain('.cart-admin-metrics');
    expect(mobileSystemStyles).toContain('.favorites-admin-metrics');
    expect(mobileSystemStyles).toContain('.finance-summary-grid');
    expect(mobileSystemStyles).toContain('.customer-admin-row__layout');
  });
});
