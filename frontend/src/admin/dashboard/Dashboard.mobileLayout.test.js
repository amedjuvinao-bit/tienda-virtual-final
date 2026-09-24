import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

function source(relativeUrl) {
  return fs.readFileSync(new URL(relativeUrl, import.meta.url), 'utf8');
}

const layoutSource = source('../AdminLayout.jsx');
const dashboardPageSource = source('./DashboardPage.jsx');
const dashboardLayoutSource = source('./layouts/DashboardModelOne.jsx');
const kpiGridSource = source('./components/DashboardKpiGrid.jsx');
const responsiveStyles = source('./dashboardResponsive.css');

describe('organización móvil escalable del Panel Admin', () => {
  it('reduce la navegación móvil a controles de icono accesibles', () => {
    expect(layoutSource).toContain('className="admin-mobile-nav-label"');
    expect(layoutSource).toContain('aria-label={item.label}');
    expect(layoutSource).toContain('title={item.label}');
    expect(layoutSource).toMatch(
      /@media \(max-width: 767px\)[\s\S]*?\.admin-mobile-nav-label\s*\{[\s\S]*?clip-path: inset\(50%\);/,
    );
    expect(layoutSource).toMatch(
      /\.admin-mobile-nav-panel \.admin-nav-link-mobile,[\s\S]*?width: 44px;[\s\S]*?justify-content: center;/,
    );
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
});
