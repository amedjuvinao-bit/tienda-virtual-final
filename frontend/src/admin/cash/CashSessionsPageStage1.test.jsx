import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getPosBootstrap } from '../api/adminPosApi';
import {
  addCashMovement,
  closeCashSession,
  getCashSessionById,
  getCurrentCashSession,
  listCashSessions,
  openCashSession,
  reviewCashMovement,
} from '../api/adminCashSessionApi';
import CashSessionsPageReport from './CashSessionsPageReport';

vi.mock('../api/adminPosApi', () => ({
  getPosBootstrap: vi.fn(),
}));

vi.mock('../api/adminCashSessionApi', () => ({
  addCashMovement: vi.fn(),
  certifyCashJourney: vi.fn(),
  closeCashSession: vi.fn(),
  getCashSessionById: vi.fn(),
  getCurrentCashSession: vi.fn(),
  listCashSessions: vi.fn(),
  openCashSession: vi.fn(),
  reviewCashMovement: vi.fn(),
}));

const branch = {
  id: 'branch-stage1',
  name: 'Sede Principal',
  code: 'PRINCIPAL',
  settings: { requireCashSessionForPos: true },
};

const pendingMovement = {
  _id: 'movement-pending-1',
  type: 'withdrawal',
  amount: 10000,
  direction: 'out',
  reason: 'Traslado a bóveda',
  reference: 'RET-001',
  approvalRequired: true,
  approvalStatus: 'pending',
  createdAt: '2026-09-03T14:10:00.000Z',
  createdBySnapshot: { displayName: 'Cajero Etapa 1' },
};

const supervisorSession = {
  id: 'cash-stage1',
  sessionCode: 'CAJA-20260903-STAGE1',
  status: 'open',
  branch: branch.id,
  branchSnapshot: { name: branch.name, code: branch.code },
  cashRegisterCode: 'CAJA POS',
  cashierSnapshot: { displayName: 'Cajero Etapa 1' },
  openedAt: '2026-09-03T14:00:00.000Z',
  openingAmount: 50000,
  expectedCash: 78500,
  countedCash: 0,
  differenceAmount: 0,
  salesSummary: {
    ordersCount: 1,
    itemsCount: 1,
    netSales: 28500,
    paymentTotals: { cash: 28500, transfer: 0, card: 0, mixed: 0, other: 0 },
  },
  cashMovements: [pendingMovement],
  cashControl: {
    blindCountActive: false,
    canSupervise: true,
    canReviewMovements: true,
    pendingMovementsCount: 1,
  },
};

const blindSession = {
  ...supervisorSession,
  expectedCash: null,
  countedCash: null,
  differenceAmount: null,
  salesSummary: {
    ...supervisorSession.salesSummary,
    netSales: null,
    paymentTotals: { cash: null, transfer: null, card: null, mixed: null, other: null },
  },
  cashControl: {
    blindCountActive: true,
    canSupervise: false,
    canReviewMovements: false,
    pendingMovementsCount: 1,
  },
};

beforeEach(() => {
  getPosBootstrap.mockResolvedValue({ branches: [branch], defaultBranch: branch });
  getCurrentCashSession.mockResolvedValue({ session: supervisorSession });
  listCashSessions.mockResolvedValue({ sessions: [] });
  openCashSession.mockResolvedValue({ session: supervisorSession });
  addCashMovement.mockResolvedValue({
    session: supervisorSession,
    requiresApproval: true,
    message: 'Movimiento enviado a aprobación. Todavía no afecta el efectivo esperado.',
  });
  reviewCashMovement.mockResolvedValue({
    session: {
      ...supervisorSession,
      cashMovements: [{
        ...pendingMovement,
        approvalStatus: 'approved',
        reviewedAt: '2026-09-03T14:20:00.000Z',
        reviewedBySnapshot: { displayName: 'Supervisor Etapa 1' },
      }],
      cashControl: { ...supervisorSession.cashControl, pendingMovementsCount: 0 },
    },
    message: 'Movimiento aprobado y aplicado a la caja.',
  });
  closeCashSession.mockResolvedValue({ session: null });
  getCashSessionById.mockResolvedValue({ session: supervisorSession });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('CashSessionsPageReport Etapa 1', () => {
  it('presenta el arqueo ciego sin precargar ni revelar cifras monetarias', async () => {
    getCurrentCashSession.mockResolvedValue({ session: blindSession });
    render(<CashSessionsPageReport />);

    expect(await screen.findByText('Conteo ciego activo')).toBeInTheDocument();
    expect(screen.getAllByText('Oculto').length).toBeGreaterThan(0);
    expect(screen.getByLabelText('Efectivo contado')).toHaveValue(null);
    expect(screen.queryByText('$ 78.500')).not.toBeInTheDocument();
  });

  it('bloquea el cierre mientras haya movimientos pendientes', async () => {
    getCurrentCashSession.mockResolvedValue({ session: blindSession });
    render(<CashSessionsPageReport />);

    const closeButton = await screen.findByRole('button', { name: 'Cierre bloqueado' });
    expect(closeButton).toBeDisabled();
    expect(screen.getByText(/la caja no podrá cerrarse hasta resolverlos/i)).toBeInTheDocument();
  });

  it('permite al supervisor aprobar una solicitud desde un diálogo accesible', async () => {
    render(<CashSessionsPageReport />);

    fireEvent.click(await screen.findByRole('button', { name: 'Aprobar' }));
    expect(screen.getByRole('dialog', { name: 'Aprobar movimiento de caja' })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Nota de aprobación (opcional)'), { target: { value: 'Soporte verificado' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar aprobación' }));

    await waitFor(() => {
      expect(reviewCashMovement).toHaveBeenCalledWith(
        supervisorSession.id,
        pendingMovement._id,
        { decision: 'approve', reviewNotes: 'Soporte verificado' }
      );
    });
  });

  it('exige un motivo antes de confirmar el rechazo', async () => {
    render(<CashSessionsPageReport />);

    fireEvent.click(await screen.findByRole('button', { name: 'Rechazar' }));
    const confirmButton = screen.getByRole('button', { name: 'Confirmar rechazo' });
    expect(confirmButton).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Motivo del rechazo'), { target: { value: 'Falta soporte' } });
    expect(confirmButton).toBeEnabled();
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(reviewCashMovement).toHaveBeenCalledWith(
        supervisorSession.id,
        pendingMovement._id,
        { decision: 'reject', reviewNotes: 'Falta soporte' }
      );
    });
  });

  it('envía un ajuste negativo nativo a aprobación', async () => {
    getCurrentCashSession.mockResolvedValue({ session: blindSession });
    render(<CashSessionsPageReport />);

    await screen.findByText('Conteo ciego activo');
    fireEvent.change(screen.getByLabelText('Tipo'), { target: { value: 'adjustment_out' } });
    fireEvent.change(screen.getByLabelText('Monto'), { target: { value: '10000' } });
    fireEvent.change(screen.getByLabelText('Motivo'), { target: { value: 'Traslado a bóveda' } });
    fireEvent.click(screen.getByRole('button', { name: 'Registrar' }));

    expect(await screen.findByText('Movimiento enviado a aprobación. Todavía no afecta el efectivo esperado.')).toBeInTheDocument();
    expect(addCashMovement).toHaveBeenCalledWith(blindSession.id, expect.objectContaining({
      type: 'adjustment',
      direction: 'out',
      amount: '10000',
    }));
  });
});
