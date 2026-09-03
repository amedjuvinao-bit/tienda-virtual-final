import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getPosShiftSummary } from '../api/adminPosApi';
import PosShiftReportPanel from './PosShiftReportPanel';

vi.mock('../api/adminPosApi', () => ({
  getPosShiftSummary: vi.fn(),
}));

const report = {
  generatedAt: '2026-09-03T20:00:00.000Z',
  branch: { id: 'branch-1', name: 'Sede Principal', code: 'PRINCIPAL' },
  cashRegisterCode: 'CAJA POS',
  period: {
    start: '2026-09-03T13:00:00.000Z',
    end: '2026-09-03T20:00:00.000Z',
    timezone: 'America/Bogota',
    fallback: false,
  },
  status: 'attention',
  metrics: {
    ordersCount: 2,
    itemsCount: 3,
    grossSales: 80000,
    discounts: 1500,
    refunds: 10000,
    refundedOrdersCount: 1,
    netSales: 68500,
    averageTicket: 34250,
    cancelledOrdersCount: 0,
  },
  paymentBreakdown: { cash: 48500, card: 30000, total: 78500 },
  cashSession: { sessionCode: 'CAJA-20260903-ABC123' },
  reconciliation: {
    status: 'pending_count',
    openingAmount: 50000,
    cashSales: 44500,
    cashIn: 5000,
    cashOut: 2000,
    expectedCash: 97500,
  },
  heldSales: { activeCount: 1 },
  alerts: [{
    code: 'held_sales',
    severity: 'attention',
    title: '1 venta todavía en espera',
    message: 'Recupérala o descártala para mantener limpia la jornada.',
  }],
};

function renderPanel() {
  return render(
    <MemoryRouter>
      <PosShiftReportPanel branchId="branch-1" />
    </MemoryRouter>
  );
}

beforeEach(() => {
  getPosShiftSummary.mockResolvedValue({ report });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('PosShiftReportPanel', () => {
  it('presenta ventas, pagos, conciliación y control operativo del servidor', async () => {
    renderPanel();

    expect(await screen.findByText('Sede Principal · CAJA POS')).toBeInTheDocument();
    expect(screen.getByText('Venta neta')).toBeInTheDocument();
    expect(screen.getByText('Medios de pago')).toBeInTheDocument();
    expect(screen.getByText('Conciliación de caja actual')).toBeInTheDocument();
    expect(screen.getByText('1 venta todavía en espera')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /gestionar caja/i })).toHaveAttribute('href', '/admin/caja');
    expect(screen.getByRole('link', { name: /abrir finanzas/i })).toHaveAttribute('href', '/admin/finanzas');
  });

  it('solicita nuevamente el servidor cuando cambia el rango', async () => {
    renderPanel();
    await screen.findByText('Sede Principal · CAJA POS');

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'last_7_days' } });

    await waitFor(() => {
      expect(getPosShiftSummary).toHaveBeenLastCalledWith({
        branchId: 'branch-1',
        range: 'last_7_days',
      });
    });
  });

  it('muestra un error recuperable si el servidor no responde', async () => {
    getPosShiftSummary.mockRejectedValueOnce(new Error('Servicio temporalmente no disponible'));
    renderPanel();

    expect(await screen.findByText('No se pudo consultar la jornada')).toBeInTheDocument();
    expect(screen.getByText('Servicio temporalmente no disponible')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
  });
});
