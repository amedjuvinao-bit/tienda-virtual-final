import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  cancelFinanceExpense,
  createFinanceExpense,
  getAdminBranches,
  getFinanceCash,
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
    'finance:expenses:cancel',
    'finance:export',
  ]),
  user: { id: '64b000000000000000000001', adminRole: 'manager' },
  role: 'manager',
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
  reviewFinanceExpense: vi.fn(),
  updateFinanceExpense: vi.fn(),
}));

vi.mock('../security/useAdminPermissions', () => ({
  default: () => ({
    can: (permission) => security.granted.has(permission),
    adminUser: security.user,
    role: security.role,
  }),
}));

const pendingExpense = {
  _id: 'expense-pending',
  date: '2026-09-07T12:00:00.000Z',
  amount: 45000,
  type: 'operating',
  category: 'Transporte',
  description: 'Traslado de mercancía entre sedes',
  paymentMethod: 'transfer',
  status: 'pending',
  revision: 3,
  createdBy: '64b000000000000000000009',
  createdBySnapshot: {
    username: 'solicitante',
    displayName: 'Solicitante Finanzas',
  },
  reviewedBySnapshot: {},
  workflow: [
    {
      _id: 'event-submitted',
      action: 'submitted',
      toStatus: 'pending',
      revision: 0,
      at: '2026-09-07T12:00:00.000Z',
      actorSnapshot: { displayName: 'Solicitante Finanzas' },
      notes: 'Solicitud de gasto enviada a aprobación.',
    },
  ],
};

const summary = {
  dateRange: {
    fromISO: '2026-09-01T00:00:00.000Z',
    toISO: '2026-09-30T23:59:59.999Z',
  },
  kpis: {
    grossRevenue: 100000,
    refunds: 0,
    revenue: 100000,
    cogs: 40000,
    grossProfit: 60000,
    grossMarginPercent: 60,
    operatingExpenses: 10000,
    manualExpenses: 10000,
    cashOperatingExpenses: 0,
    netProfit: 50000,
    netMarginPercent: 50,
    costQuality: {},
  },
  sales: { bySource: [], byPaymentMethod: [] },
  profit: { byProduct: [] },
  cash: { paymentTotals: {}, movements: {} },
  expenses: {
    manualTotal: 10000,
    manualCount: 1,
    workflow: {
      pending: { count: 1, amount: 45000 },
      paid: { count: 1, amount: 10000 },
      rejected: { count: 0, amount: 0 },
      cancelled: { count: 0, amount: 0 },
    },
  },
};

beforeEach(() => {
  security.granted = new Set([
    'finance:expenses',
    'finance:expenses:approve',
    'finance:expenses:cancel',
    'finance:export',
  ]);
  security.user = { id: '64b000000000000000000001', adminRole: 'manager' };
  security.role = 'manager';
  getFinanceSummary.mockResolvedValue(summary);
  getFinanceSales.mockResolvedValue({ bySource: [], byPaymentMethod: [] });
  getFinanceProfit.mockResolvedValue({ byProduct: [] });
  getFinanceCash.mockResolvedValue({ paymentTotals: {}, movements: {} });
  getFinanceExpenses.mockResolvedValue({
    data: [pendingExpense],
    manualTotal: 10000,
    workflow: summary.expenses.workflow,
  });
  getAdminBranches.mockResolvedValue([]);
  createFinanceExpense.mockResolvedValue({ _id: 'expense-created' });
  cancelFinanceExpense.mockResolvedValue({ ...pendingExpense, status: 'cancelled' });
  reviewFinanceExpense.mockResolvedValue({ ...pendingExpense, status: 'paid' });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('Finanzas Nivel Plus · Etapa 1', () => {
  it('separa pendientes, aprobados, rechazados y anulados en un único control', async () => {
    render(<AdminFinancePage />);

    expect(await screen.findByText('Solicitudes y aprobaciones')).toBeInTheDocument();
    expect(screen.getAllByText('Pendientes').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Aprobados').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Rechazados').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Anulados').length).toBeGreaterThan(0);
    expect(screen.getByText('Solo los gastos aprobados se incluyen en la utilidad neta.')).toBeInTheDocument();
  });

  it('envía un gasto nuevo como solicitud idempotente de aprobación', async () => {
    render(<AdminFinancePage />);

    fireEvent.click(await screen.findByRole('button', { name: 'Nuevo gasto' }));
    fireEvent.change(screen.getByLabelText('Valor'), { target: { value: '32000' } });
    fireEvent.change(screen.getByLabelText('Categoría'), { target: { value: 'Mensajería' } });
    fireEvent.change(screen.getByLabelText('Descripción'), { target: { value: 'Entrega urgente de pedido' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar a aprobación' }));

    await waitFor(() => expect(createFinanceExpense).toHaveBeenCalledTimes(1));
    const payload = createFinanceExpense.mock.calls[0][0];
    expect(payload.amount).toBe(32000);
    expect(payload.description).toBe('Entrega urgente de pedido');
    expect(payload.requestKey.length).toBeGreaterThanOrEqual(8);
    expect(payload.status).toBeUndefined();
  });

  it('aprueba con la versión vigente y conserva la nota de revisión', async () => {
    render(<AdminFinancePage />);

    fireEvent.click(await screen.findByRole('button', { name: 'Aprobar' }));
    fireEvent.change(screen.getByLabelText('Nota de aprobación'), {
      target: { value: 'Factura y valor verificados' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar aprobación' }));

    await waitFor(() =>
      expect(reviewFinanceExpense).toHaveBeenCalledWith('expense-pending', {
        expectedRevision: 3,
        decision: 'approve',
        reviewNotes: 'Factura y valor verificados',
      })
    );
  });

  it('identifica la autoaprobación del propietario y exige justificación', async () => {
    security.user = { id: pendingExpense.createdBy, adminRole: 'owner' };
    security.role = 'owner';
    render(<AdminFinancePage />);

    fireEvent.click(await screen.findByRole('button', { name: 'Aprobar' }));
    expect(screen.getByText(/excepción de control/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Confirmar aprobación' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Justificación de la excepción'), {
      target: { value: 'Operación administrativa unipersonal' },
    });
    expect(screen.getByRole('button', { name: 'Confirmar aprobación' })).toBeEnabled();
  });

  it('impide que un solicitante común revise su propia solicitud', async () => {
    security.user = { id: pendingExpense.createdBy, adminRole: 'manager' };
    render(<AdminFinancePage />);

    expect(await screen.findByText('Debe revisarlo otra persona autorizada.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Aprobar' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Rechazar' })).not.toBeInTheDocument();
  });

  it('exige motivo para rechazar y conserva la versión enviada', async () => {
    render(<AdminFinancePage />);

    fireEvent.click(await screen.findByRole('button', { name: 'Rechazar' }));
    expect(screen.getByRole('button', { name: 'Confirmar rechazo' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Motivo del rechazo'), {
      target: { value: 'El soporte no identifica al proveedor' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar rechazo' }));

    await waitFor(() =>
      expect(reviewFinanceExpense).toHaveBeenCalledWith('expense-pending', {
        expectedRevision: 3,
        decision: 'reject',
        reviewNotes: 'El soporte no identifica al proveedor',
      })
    );
  });

  it('anula únicamente con motivo y versión vigente', async () => {
    render(<AdminFinancePage />);

    fireEvent.click(await screen.findByRole('button', { name: 'Anular' }));
    expect(screen.getByRole('button', { name: 'Confirmar anulación' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Motivo de anulación'), {
      target: { value: 'El proveedor reversó el cobro' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar anulación' }));

    await waitFor(() =>
      expect(cancelFinanceExpense).toHaveBeenCalledWith('expense-pending', {
        expectedRevision: 3,
        cancellationReason: 'El proveedor reversó el cobro',
      })
    );
  });

  it('muestra la trazabilidad completa sin depender de confirmaciones del navegador', async () => {
    render(<AdminFinancePage />);

    fireEvent.click(await screen.findByRole('button', { name: 'Historial' }));
    expect(screen.getByRole('dialog', { name: 'Trazabilidad del gasto' })).toBeInTheDocument();
    expect(screen.getByText('Solicitud enviada')).toBeInTheDocument();
    expect(screen.getAllByText('Solicitante Finanzas').length).toBeGreaterThan(0);
    expect(screen.getByText('Solicitud de gasto enviada a aprobación.')).toBeInTheDocument();
  });
});
