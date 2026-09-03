import { describe, expect, it } from 'vitest';
import {
  buildPosShiftReportCsv,
  formatPosReportDateTime,
  getPaymentRows,
  getPosReportStatus,
  getPosShiftReportFilename,
  POS_REPORT_RANGES,
} from './posShiftReportModel';

const report = {
  generatedAt: '2026-09-03T20:00:00.000Z',
  branch: { name: 'Sede Principal', code: 'PRINCIPAL' },
  cashRegisterCode: 'CAJA POS',
  period: {
    start: '2026-09-03T13:00:00.000Z',
    end: '2026-09-03T20:00:00.000Z',
    timezone: 'America/Bogota',
  },
  status: 'attention',
  metrics: {
    ordersCount: 2,
    itemsCount: 3,
    grossSales: 80000,
    discounts: 1500,
    refunds: 10000,
    netSales: 68500,
    averageTicket: 34250,
    invoicePendingCount: 1,
  },
  paymentBreakdown: { cash: 48500, card: 30000, total: 78500 },
  reconciliation: { openingAmount: 50000, cashSales: 44500, cashIn: 5000, cashOut: 2000, expectedCash: 97500 },
  heldSales: { activeCount: 1 },
};

describe('posShiftReportModel', () => {
  it('ofrece jornada, hoy y siete días como rangos explícitos', () => {
    expect(POS_REPORT_RANGES.map((range) => range.value)).toEqual(['current_shift', 'today', 'last_7_days']);
  });

  it('presenta únicamente medios de pago con valor', () => {
    expect(getPaymentRows(report)).toEqual([
      { key: 'cash', label: 'Efectivo', amount: 48500 },
      { key: 'card', label: 'Tarjeta / Datáfono', amount: 30000 },
    ]);
  });

  it('distingue estado crítico, pendiente y saludable', () => {
    expect(getPosReportStatus({ status: 'critical' }).tone).toBe('critical');
    expect(getPosReportStatus({ status: 'attention' }).tone).toBe('attention');
    expect(getPosReportStatus({ status: 'healthy' }).tone).toBe('healthy');
  });

  it('exporta un CSV de conciliación completo y compatible con Excel', () => {
    const csv = buildPosShiftReportCsv(report);
    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv).toContain('"Venta neta";"68500"');
    expect(csv).toContain('"Efectivo esperado";"97500"');
    expect(csv).toContain('"Facturas pendientes";"1"');
  });

  it('exporta fechas y nombre de archivo con el día vigente en Colombia', () => {
    const colombiaNightReport = {
      ...report,
      generatedAt: '2026-09-03T02:12:30.553Z',
      period: {
        start: '2026-07-07T03:47:35.479Z',
        end: '2026-09-03T02:12:30.553Z',
        timezone: 'America/Bogota',
      },
    };
    const csv = buildPosShiftReportCsv(colombiaNightReport);

    expect(formatPosReportDateTime(colombiaNightReport.generatedAt)).toBe('2026-09-02 21:12:30');
    expect(csv).toContain('"Periodo desde";"2026-07-06 22:47:35"');
    expect(csv).toContain('"Periodo hasta";"2026-09-02 21:12:30"');
    expect(csv).toContain('"Generado";"2026-09-02 21:12:30"');
    expect(getPosShiftReportFilename(colombiaNightReport)).toBe('jornada-pos-principal-2026-09-02.csv');
  });
});
