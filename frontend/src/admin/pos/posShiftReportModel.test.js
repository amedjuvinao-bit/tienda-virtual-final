import { describe, expect, it } from 'vitest';
import {
  buildPosShiftReportCsv,
  getPaymentRows,
  getPosReportStatus,
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
});
