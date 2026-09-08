import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createFinanceBudget,
  createFinanceCostCenter,
  createFinanceExpense,
  getAdminBranches,
  getFinanceBudgetControl,
  getFinanceCash,
  getFinanceCostCenters,
  getFinanceExpenses,
  getFinanceProfit,
  getFinanceSales,
  getFinanceSummary,
  reviewFinanceExpense,
} from './api/financeApi';
import AdminFinancePage from './AdminFinancePage';

const security = vi.hoisted(() => ({
  granted: new Set([
    'finance:expenses',
    'finance:expenses:approve',
    'finance:budgets:manage',
    'finance:budgets:override',
  ]),
}));

vi.mock('./api/financeApi', () => ({
  cancelFinanceExpense: vi.fn(),
  createFinanceBudget: vi.fn(),
  createFinanceCostCenter: vi.fn(),
  createFinanceExpense: vi.fn(),
  exportFinanceCsv: vi.fn(),
  getAdminBranches: vi.fn(),
  getFinanceBudgetControl: vi.fn(),
  getFinanceBudgets: vi.fn(),
  getFinanceCash: vi.fn(),
  getFinanceCostCenters: vi.fn(),
  getFinanceExpenses: vi.fn(),
  getFinanceProfit: vi.fn(),
  getFinanceSales: vi.fn(),
  getFinanceSummary: vi.fn(),
  getFinanceTreasury: vi.fn(),
  registerFinancePayablePayment: vi.fn(),
  reviewFinanceExpense: vi.fn(),
  updateFinanceBudget: vi.fn(),
  updateFinanceCostCenter: vi.fn(),
  updateFinanceExpense: vi.fn(),
}));

vi.mock('../security/useAdminPermissions', () => ({
  default: () => ({
    can: (permission) => security.granted.has(permission),
    adminUser: { id: '64b000000000000000000001', adminRole: 'manager' },
    role: 'manager',
  }),
}));

const costCenter = {
  _id: '64c000000000000000000001',
  code: 'LOG',
  name: 'Logística',
  status: 'active',
  revision: 0,
};

const pendingExpense = {
  _id: 'expense-budget',
  date: '2026-09-08T12:00:00.000Z',
  amount: 40000,
  type: 'operating',
  category: 'Mensajería',
  description: 'Entrega nacional',
  paymentMethod: 'transfer',
  status: 'pending',
  revision: 2,
  createdBy: '64b000000000000000000009',
  createdBySnapshot: { displayName: 'Solicitante' },
  costCenter: costCenter._id,
  costCenterSnapshot: { code: 'LOG', name: 'Logística' },
  budgetEvaluation: { outcome: 'exceeded', periodKey: '2026-09' },
  workflow: [],
};

const summary = {
  dateRange: {
    fromISO: '2026-09-01T00:00:00.000Z',
    toISO: '2026-09-30T23:59:59.999Z',
  },
  kpis: { costQuality: {} },
  sales: { bySource: [], byPaymentMethod: [] },
  profit: { byProduct: [] },
  cash: { paymentTotals: {}, movements: {} },
  expenses: {
    workflow: {
      pending: { count: 1, amount: 40000 },
      paid: { count: 0, amount: 0 },
      rejected: { count: 0, amount: 0 },
      cancelled: { count: 0, amount: 0 },
    },
  },
};

const budgetControl = {
  periodKey: '2026-09',
  summary: {
    allocatedAmount: 100000,
    committedAmount: 40000,
    spentAmount: 30000,
    availableAmount: 30000,
  },
  lines: [{
    _id: 'budget-1',
    periodKey: '2026-09',
    branch: null,
    branchSnapshot: {},
    costCenter: costCenter._id,
    costCenterSnapshot: { code: 'LOG', name: 'Logística' },
    expenseType: 'operating',
    amount: 100000,
    committedAmount: 40000,
    spentAmount: 30000,
    availableAmount: 30000,
    percentUsed: 70,
    warningThresholdPercent: 80,
    level: 'healthy',
    revision: 0,
  }],
  unbudgeted: [],
};

beforeEach(() => {
  security.granted = new Set([
    'finance:expenses',
    'finance:expenses:approve',
    'finance:budgets:manage',
    'finance:budgets:override',
  ]);
  getFinanceSummary.mockResolvedValue(summary);
  getFinanceSales.mockResolvedValue({ bySource: [], byPaymentMethod: [] });
  getFinanceProfit.mockResolvedValue({ byProduct: [] });
  getFinanceCash.mockResolvedValue({ paymentTotals: {}, movements: {} });
  getFinanceExpenses.mockResolvedValue({
    data: [pendingExpense],
    workflow: summary.expenses.workflow,
  });
  getAdminBranches.mockResolvedValue([]);
  getFinanceCostCenters.mockResolvedValue([costCenter]);
  getFinanceBudgetControl.mockResolvedValue(budgetControl);
  createFinanceExpense.mockResolvedValue({ _id: 'new-expense' });
  createFinanceCostCenter.mockResolvedValue(costCenter);
  createFinanceBudget.mockResolvedValue(budgetControl.lines[0]);
  reviewFinanceExpense.mockResolvedValue({ ...pendingExpense, status: 'paid' });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('Finanzas Nivel Plus · Etapa 2', () => {
  it('muestra el control mensual con cifras derivadas del presupuesto', async () => {
    render(<AdminFinancePage />);

    expect(await screen.findByText('Presupuesto mensual')).toBeInTheDocument();
    const budgetSummary = await screen.findByRole('group', { name: 'Resumen presupuestal' });
    expect(budgetSummary).toHaveTextContent('Asignado');
    expect(budgetSummary).toHaveTextContent('$ 100.000');
    expect(budgetSummary).toHaveTextContent('Comprometido');
    expect(screen.getAllByText('Logística').length).toBeGreaterThan(0);
    expect(screen.getByText('$ 30.000 disponible')).toBeInTheDocument();
    expect(screen.getByText('Utilización · 70%')).toBeInTheDocument();
    expect(screen.queryByText('Disponible · 70%')).not.toBeInTheDocument();
  });

  it('asigna el centro de costo al registrar una solicitud', async () => {
    render(<AdminFinancePage />);

    fireEvent.click(await screen.findByRole('button', { name: 'Nuevo gasto' }));
    fireEvent.change(screen.getByLabelText('Valor'), { target: { value: '25000' } });
    fireEvent.change(screen.getByLabelText('Centro de costo'), { target: { value: costCenter._id } });
    fireEvent.change(screen.getByLabelText('Categoría'), { target: { value: 'Transporte' } });
    fireEvent.change(screen.getByLabelText('Descripción'), { target: { value: 'Traslado de mercancía' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar a aprobación' }));

    await waitFor(() => expect(createFinanceExpense).toHaveBeenCalledTimes(1));
    expect(createFinanceExpense.mock.calls[0][0].costCenterId).toBe(costCenter._id);
  });

  it('exige justificación para autorizar un exceso presupuestal', async () => {
    render(<AdminFinancePage />);

    fireEvent.click(await screen.findByRole('button', { name: 'Aprobar' }));
    expect(screen.getByText('Esta aprobación supera el presupuesto')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Confirmar aprobación' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Justificación presupuestal'), {
      target: { value: 'Entrega crítica autorizada por dirección' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar aprobación' }));

    await waitFor(() => expect(reviewFinanceExpense).toHaveBeenCalledWith(
      'expense-budget',
      {
        expectedRevision: 2,
        decision: 'approve',
        reviewNotes: '',
        budgetOverrideReason: 'Entrega crítica autorizada por dirección',
      }
    ));
    await waitFor(() => expect(getFinanceBudgetControl).toHaveBeenCalledTimes(2));
  });

  it('bloquea visualmente el exceso cuando falta el permiso de excepción', async () => {
    security.granted.delete('finance:budgets:override');
    render(<AdminFinancePage />);

    fireEvent.click(await screen.findByRole('button', { name: 'Aprobar' }));
    expect(screen.getByText('Necesitas el permiso para autorizar excepciones presupuestales.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Confirmar aprobación' })).toBeDisabled();
    expect(screen.queryByLabelText('Justificación presupuestal')).not.toBeInTheDocument();
  });

  it('configura centros y presupuestos en un modal centrado', async () => {
    render(<AdminFinancePage />);

    fireEvent.click(await screen.findByRole('button', { name: 'Configurar' }));
    expect(screen.getByRole('dialog', { name: 'Configurar presupuesto' })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Código del centro'), { target: { value: 'MERCADEO' } });
    fireEvent.change(screen.getByLabelText('Nombre del centro'), { target: { value: 'Mercadeo' } });
    fireEvent.click(screen.getByRole('button', { name: 'Crear centro' }));
    await waitFor(() => expect(createFinanceCostCenter).toHaveBeenCalledWith({
      code: 'MERCADEO',
      name: 'Mercadeo',
      description: '',
    }));

    fireEvent.change(screen.getByLabelText('Centro de costo del presupuesto'), { target: { value: costCenter._id } });
    fireEvent.change(screen.getByLabelText('Monto del presupuesto'), { target: { value: '200000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Crear presupuesto' }));
    await waitFor(() => expect(createFinanceBudget).toHaveBeenCalledWith(expect.objectContaining({
      periodKey: '2026-09',
      costCenterId: costCenter._id,
      amount: 200000,
      warningThresholdPercent: 80,
    })));
  });
});
