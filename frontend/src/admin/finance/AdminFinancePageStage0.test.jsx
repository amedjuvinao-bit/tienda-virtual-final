import React from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  getAdminBranches,
  getFinanceCash,
  getFinanceExpenses,
  getFinanceProfit,
  getFinanceSales,
  getFinanceSummary,
} from './api/financeApi';
import AdminFinancePage from './AdminFinancePage';

const permissionState = vi.hoisted(() => ({
  granted: new Set(['finance:expenses', 'finance:export']),
}));

vi.mock('./api/financeApi', () => ({
  cancelFinanceExpense: vi.fn(),
  createFinanceExpense: vi.fn(),
  exportFinanceCsv: vi.fn(),
  getAdminBranches: vi.fn(),
  getFinanceCash: vi.fn(),
  getFinanceExpenses: vi.fn(),
  getFinanceProfit: vi.fn(),
  getFinanceSales: vi.fn(),
  getFinanceSummary: vi.fn(),
  updateFinanceExpense: vi.fn(),
}));

vi.mock('../security/useAdminPermissions', () => ({
  default: () => ({
    can: (permission) => permissionState.granted.has(permission),
  }),
}));

const summary = {
  dateRange: {
    fromISO: '2026-09-01T00:00:00.000Z',
    toISO: '2026-09-30T23:59:59.999Z',
  },
  kpis: {
    grossRevenue: 150000,
    refunds: 50000,
    revenue: 100000,
    ordersCount: 2,
    averageTicket: 50000,
    grossCogs: 70000,
    returnedCogs: 20000,
    cogs: 50000,
    grossProfit: 50000,
    grossMarginPercent: 50,
    operatingExpenses: 10000,
    manualExpenses: 10000,
    cashOperatingExpenses: 0,
    netProfit: 40000,
    netMarginPercent: 40,
    cashDifference: 0,
    costQuality: {
      historicalCostItems: 1,
      estimatedCostItems: 1,
      missingCostItems: 0,
      usesEstimatedCosts: true,
      hasMissingCosts: false,
    },
  },
  sales: { bySource: [], byChannel: [], byPaymentMethod: [], daily: [] },
  profit: { byProduct: [], bySource: [] },
  cash: {
    sessionsCount: 0,
    openSessions: 0,
    closedSessions: 0,
    expectedCash: 0,
    countedCash: 0,
    differenceAmount: 0,
    paymentTotals: {},
    movements: {},
  },
  expenses: { manualTotal: 10000, manualCount: 1, latest: [] },
};

beforeEach(() => {
  permissionState.granted = new Set(['finance:expenses', 'finance:export']);
  getFinanceSummary.mockResolvedValue(summary);
  getFinanceSales.mockResolvedValue({ bySource: [], byPaymentMethod: [] });
  getFinanceProfit.mockResolvedValue({ byProduct: [] });
  getFinanceCash.mockResolvedValue({ paymentTotals: {}, movements: {} });
  getFinanceExpenses.mockResolvedValue({ data: [], manualTotal: 10000 });
  getAdminBranches.mockResolvedValue([]);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('Finanzas Nivel Plus · Etapa 0', () => {
  it('diferencia ingresos brutos, devoluciones e ingresos netos', async () => {
    render(<AdminFinancePage />);

    expect(await screen.findByText('Ingresos netos')).toBeInTheDocument();
    expect(screen.getByText(/Bruto.*150\.000.*Devoluciones.*50\.000/i)).toBeInTheDocument();
    expect(screen.getByText('Costos netos')).toBeInTheDocument();
    expect(screen.getByText(/Costo devuelto.*20\.000/i)).toBeInTheDocument();
  });

  it('advierte cuando la utilidad contiene costos estimados', async () => {
    render(<AdminFinancePage />);

    expect(await screen.findByText('Costo histórico incompleto')).toBeInTheDocument();
    expect(screen.getByText(/1 producto\(s\) usan el costo actual como estimación/i)).toBeInTheDocument();
    await waitFor(() => expect(getFinanceSummary).toHaveBeenCalledTimes(1));
  });

  it('oculta acciones que el usuario no puede ejecutar', async () => {
    permissionState.granted = new Set();
    render(<AdminFinancePage />);

    expect(await screen.findByText('Ingresos netos')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Ventas CSV' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Gastos CSV' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Nuevo gasto' })).not.toBeInTheDocument();
    expect(screen.getByText('Consulta habilitada en modo de solo lectura.')).toBeInTheDocument();
  });
});
