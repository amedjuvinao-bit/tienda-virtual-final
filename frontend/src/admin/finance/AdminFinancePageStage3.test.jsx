import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createFinanceExpense,
  getFinanceExpenses,
  getFinanceTreasury,
  registerFinancePayablePayment,
} from './api/financeApi';
import AdminFinancePage from './AdminFinancePage';

const security = vi.hoisted(() => ({
  granted: new Set(['finance:expenses', 'finance:treasury:manage']),
}));

vi.mock('./api/financeApi', () => ({
  cancelFinanceExpense: vi.fn(),
  certifyFinancePeriod: vi.fn(),
  createFinanceBudget: vi.fn(),
  createFinanceCostCenter: vi.fn(),
  createFinanceExpense: vi.fn(),
  exportFinanceCsv: vi.fn(),
  exportFinanceClosingCsv: vi.fn(),
  getAdminBranches: vi.fn().mockResolvedValue([]),
  getFinanceBudgetControl: vi.fn().mockResolvedValue({ summary: {}, lines: [], unbudgeted: [] }),
  getFinanceBudgets: vi.fn().mockResolvedValue([]),
  getFinanceCash: vi.fn().mockResolvedValue({ paymentTotals: {}, movements: {} }),
  getFinanceClosingControl: vi.fn(),
  getFinanceCostCenters: vi.fn().mockResolvedValue([]),
  getFinanceExpenses: vi.fn().mockResolvedValue({ data: [], workflow: {} }),
  getFinanceProfit: vi.fn().mockResolvedValue({ byProduct: [] }),
  getFinanceSales: vi.fn().mockResolvedValue({ bySource: [], byPaymentMethod: [] }),
  getFinanceSummary: vi.fn().mockResolvedValue({
    dateRange: {},
    kpis: { costQuality: {} },
    sales: {},
    profit: {},
    cash: { paymentTotals: {}, movements: {} },
    expenses: { workflow: {} },
  }),
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

const treasury = {
  summary: {
    accountsReceivable: 85000,
    accountsPayable: 60000,
    overdueReceivable: 35000,
    overduePayable: 10000,
    dueNext30Receivable: 50000,
    dueNext30Payable: 50000,
    projectedNet30: 0,
  },
  receivables: {
    count: 1,
    data: [{
      _id: 'order-1',
      orderNumber: 'ORD-1001',
      customer: { name: 'Cliente Prueba' },
      balanceAmount: 85000,
      dueDate: '2026-09-08T00:00:00.000Z',
      branchSnapshot: { name: 'Principal' },
      aging: { label: 'Al día', overdue: false, daysOverdue: 0 },
    }],
  },
  payables: {
    count: 1,
    data: [{
      _id: 'expense-credit-1',
      vendor: 'Proveedor Empaques',
      category: 'Compra de inventario',
      description: 'Empaques del mes',
      amount: 100000,
      paidAmount: 40000,
      balanceAmount: 60000,
      dueDate: '2026-09-12T00:00:00.000Z',
      branchSnapshot: { name: 'Principal' },
      revision: 3,
      aging: { label: 'Al día', overdue: false, daysOverdue: 0 },
    }],
  },
};

beforeEach(() => {
  security.granted = new Set(['finance:expenses', 'finance:treasury:manage']);
  getFinanceTreasury.mockResolvedValue(treasury);
  createFinanceExpense.mockResolvedValue({ _id: 'expense-new' });
  registerFinancePayablePayment.mockResolvedValue({ revision: 4 });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('Finanzas Nivel Plus · Etapa 3', () => {
  it('muestra cartera, cuentas por pagar y flujo de 30 días', async () => {
    render(<AdminFinancePage />);
    fireEvent.click(screen.getByRole('button', { name: '3. Tesorería: Cobros y pagos' }));

    expect(await screen.findByText('Cartera y vencimientos')).toBeInTheDocument();
    expect(await screen.findByText('ORD-1001')).toBeInTheDocument();
    expect(await screen.findByText('Proveedor Empaques')).toBeInTheDocument();
    expect(screen.getByText('Flujo próximo 30 días')).toBeInTheDocument();
    expect(screen.getAllByText('$ 60.000').length).toBeGreaterThan(0);
  });

  it('registra una solicitud a crédito con vencimiento explícito', async () => {
    render(<AdminFinancePage />);

    fireEvent.click(await screen.findByRole('button', { name: 'Nuevo gasto' }));
    fireEvent.change(screen.getByLabelText('Valor'), { target: { value: '120000' } });
    fireEvent.change(screen.getByLabelText('Condición de pago'), { target: { value: 'credit' } });
    fireEvent.change(screen.getByLabelText('Vencimiento'), { target: { value: '2026-09-30' } });
    fireEvent.change(screen.getByLabelText('Categoría'), { target: { value: 'Inventario' } });
    fireEvent.change(screen.getByLabelText('Descripción'), { target: { value: 'Compra mensual a crédito' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar a aprobación' }));

    await waitFor(() => expect(createFinanceExpense).toHaveBeenCalledTimes(1));
    expect(createFinanceExpense.mock.calls[0][0]).toMatchObject({
      paymentTerms: 'credit',
      dueDate: '2026-09-30',
      amount: 120000,
    });
  });

  it('registra un abono versionado y con referencia', async () => {
    render(<AdminFinancePage />);
    fireEvent.click(screen.getByRole('button', { name: '3. Tesorería: Cobros y pagos' }));

    fireEvent.click(await screen.findByRole('button', { name: 'Registrar abono' }));
    fireEvent.change(screen.getByLabelText('Valor del abono'), { target: { value: '25000' } });
    fireEvent.change(screen.getByLabelText('Referencia'), { target: { value: 'TRX-9088' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar abono' }));

    await waitFor(() => expect(registerFinancePayablePayment).toHaveBeenCalledTimes(1));
    expect(registerFinancePayablePayment.mock.calls[0][0]).toBe('expense-credit-1');
    expect(registerFinancePayablePayment.mock.calls[0][1]).toMatchObject({
      amount: 25000,
      expectedRevision: 3,
      paymentMethod: 'transfer',
      reference: 'TRX-9088',
    });
  });

  it('muestra el día elegido del abono sin desplazarlo por zona horaria', async () => {
    getFinanceExpenses.mockResolvedValueOnce({
      data: [{
        _id: 'expense-credit-history',
        date: '2026-09-08T05:00:00.000Z',
        amount: 50000,
        type: 'operating',
        category: 'Servicios',
        description: 'Servicio mensual a crédito',
        status: 'paid',
        revision: 2,
        workflow: [{
          action: 'payable_payment_registered',
          at: '2026-09-08T00:00:00.000Z',
          notes: 'Abono de 20000. Referencia TRX-9088.',
          revision: 2,
        }],
      }],
      workflow: {},
    });

    render(<AdminFinancePage />);
    fireEvent.click(screen.getByRole('button', { name: '4. Gastos: Solicitudes y control' }));

    fireEvent.click(await screen.findByRole('button', { name: 'Historial' }));
    const history = await screen.findByRole('dialog', { name: 'Trazabilidad del gasto' });
    expect(within(history).getByText('Abono registrado')).toBeInTheDocument();
    expect(within(history).getByText('08 de sept de 2026')).toBeInTheDocument();
    expect(within(history).queryByText(/07 de sept de 2026/)).not.toBeInTheDocument();
  });

  it('mantiene la consulta visible sin exponer el abono a quien no tiene permiso', async () => {
    security.granted.delete('finance:treasury:manage');
    render(<AdminFinancePage />);
    fireEvent.click(screen.getByRole('button', { name: '3. Tesorería: Cobros y pagos' }));

    expect(await screen.findByText('Proveedor Empaques')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Registrar abono' })).not.toBeInTheDocument();
  });
});
