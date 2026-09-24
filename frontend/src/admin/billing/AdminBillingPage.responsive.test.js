import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

function source(relativeUrl) {
  return fs.readFileSync(new URL(relativeUrl, import.meta.url), 'utf8');
}

const pageSource = source('./AdminBillingPage.jsx');
const constantsSource = source('./billingConstants.js');
const mobileStylesSource = source('../theme/adminMobileSystem.css');
const summarySource = source('./panels/BillingSummaryPanel.jsx');
const reportsSource = source('./panels/BillingReportsPanel.jsx');
const configurationSource = source('../configuracion/sections/FacturacionSection.jsx');
const wizardProgressSource = source('../configuracion/sections/facturacion/components/BillingWizardProgress.jsx');
const wizardNavigationSource = source('../configuracion/sections/facturacion/components/BillingWizardNavigation.jsx');

const responsiveTables = [
  {
    source: source('./panels/BillingDocumentsPanel.jsx'),
    className: 'billing-documents-table',
    labels: ['Documento', 'Cliente / correo', 'Estado / proveedor', 'Fechas', 'Acciones'],
  },
  {
    source: source('./panels/BillingCreditNotesPanel.jsx'),
    className: 'billing-credit-notes-table',
    labels: ['Nota crédito', 'Factura', 'Cliente', 'Estado / tipo', 'Valor', 'Acciones'],
  },
  {
    source: source('./panels/BillingPendingOrdersPanel.jsx'),
    className: 'billing-pending-orders-table',
    labels: ['Orden', 'Cliente', 'Canal', 'Pago', 'Total', 'Acciones'],
  },
  {
    source: source('./panels/BillingReportsPanel.jsx'),
    className: 'billing-report-table',
    labels: ['Fecha', 'Documento', 'Cliente', 'Estado', 'Total', 'Impacto fiscal'],
  },
];

describe('contrato responsive de Facturación', () => {
  it('usa una navegación móvil compacta sin pestañas cortadas', () => {
    expect(pageSource).toContain('billing-admin-tabs');
    expect(pageSource).toContain('billing-admin-tab-label--mobile');
    expect(constantsSource).toContain("mobileLabel: 'Pendientes'");
    expect(constantsSource).toContain("mobileLabel: 'Ajustes'");
    expect(mobileStylesSource).toMatch(
      /\.billing-admin-tabs\s*\{[^}]*grid-template-columns: repeat\(3, minmax\(0, 1fr\)\);/s,
    );
  });

  it('mantiene el resumen y sus métricas dentro del ancho disponible', () => {
    expect(summarySource).toContain('billing-summary-panel');
    expect(summarySource).toContain('billing-summary-metrics');
    expect(summarySource).toContain('billing-summary-actions');
    expect(mobileStylesSource).toMatch(
      /\.billing-summary-metrics\s*\{[^}]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\) !important;/s,
    );
  });

  it.each(responsiveTables)('convierte $className en fichas móviles con etiquetas', ({ source: panelSource, className, labels }) => {
    expect(panelSource).toContain(`billing-responsive-table ${className}`);
    labels.forEach((label) => {
      expect(panelSource).toContain(`data-label="${label}"`);
    });
  });

  it('elimina los anchos mínimos de escritorio dentro de las fichas móviles', () => {
    expect(mobileStylesSource).toMatch(
      /\.billing-responsive-table,\s*\.billing-responsive-table tbody\s*\{[^}]*width: 100% !important;[^}]*min-width: 0 !important;/s,
    );
    expect(mobileStylesSource).toContain('.billing-responsive-table thead');
    expect(mobileStylesSource).toContain('content: attr(data-label)');
  });

  it('mantiene las métricas de Reportes en una cuadrícula móvil compacta', () => {
    expect(reportsSource).toContain('billing-report-metrics');
    expect(mobileStylesSource).toMatch(
      /\.billing-report-metrics\s*\{[^}]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\) !important;/s,
    );
  });

  it('aplica un contrato móvil semántico al asistente de Configuración', () => {
    expect(configurationSource).toContain('billing-config-panel');
    expect(configurationSource).toContain('billing-config-card');
    expect(wizardProgressSource).toContain('billing-wizard-progress__steps');
    expect(wizardProgressSource).toContain('billing-wizard-progress__label--mobile');
    expect(wizardProgressSource).toContain("aria-current={index === currentStep ? 'step' : undefined}");
    expect(wizardNavigationSource).toContain('billing-wizard-navigation__primary');
    expect(mobileStylesSource).toMatch(
      /\.billing-wizard-progress__steps\s*\{[^}]*grid-template-columns: repeat\(4, minmax\(0, 1fr\)\);/s,
    );
    expect(mobileStylesSource).toMatch(
      /\.billing-wizard-navigation\s*\{[^}]*grid-template-columns:/s,
    );
  });
});
