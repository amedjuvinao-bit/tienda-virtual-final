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
  id: 'branch-1',
  name: 'Sede Principal',
  code: 'PRINCIPAL',
  settings: { requireCashSessionForPos: true },
};

const openSession = {
  id: 'cash-session-1',
  sessionCode: 'CAJA-20260903-STAGE0',
  status: 'open',
  branch: branch.id,
  branchSnapshot: { name: branch.name, code: branch.code },
  cashRegisterCode: 'CAJA POS',
  cashierSnapshot: { displayName: 'Cajero Etapa 0' },
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
  cashMovements: [],
};

beforeEach(() => {
  getPosBootstrap.mockResolvedValue({ branches: [branch], defaultBranch: branch });
  getCurrentCashSession.mockResolvedValue({ session: null });
  listCashSessions.mockResolvedValue({ sessions: [] });
  openCashSession.mockResolvedValue({ session: openSession });
  addCashMovement.mockResolvedValue({ session: openSession });
  closeCashSession.mockResolvedValue({
    session: { ...openSession, status: 'closed', countedCash: 78500, differenceAmount: 0 },
  });
  getCashSessionById.mockResolvedValue({ session: openSession });
  reviewCashMovement.mockResolvedValue({ session: openSession });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('CashSessionsPageReport Etapa 0', () => {
  it('abre una caja usando la sede y el monto indicados', async () => {
    render(<CashSessionsPageReport />);

    const openButton = await screen.findByRole('button', { name: /abrir caja/i });
    await waitFor(() => expect(openButton).toBeEnabled());
    fireEvent.change(screen.getByLabelText('Monto inicial'), { target: { value: '60000' } });
    fireEvent.click(openButton);

    await waitFor(() => {
      expect(openCashSession).toHaveBeenCalledWith(expect.objectContaining({
        branchId: branch.id,
        cashRegisterCode: 'CAJA POS',
        openingAmount: 60000,
      }));
    });
  });

  it('registra el retiro como opción React nativa', async () => {
    getCurrentCashSession.mockResolvedValue({ session: openSession });
    render(<CashSessionsPageReport />);

    expect(await screen.findByText(openSession.sessionCode)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Registrar movimiento/i }));
    const typeSelect = screen.getByLabelText('Tipo');
    expect(screen.getByRole('option', { name: 'Retiro de efectivo' })).toBeInTheDocument();
    fireEvent.change(typeSelect, { target: { value: 'withdrawal' } });
    fireEvent.change(screen.getByLabelText('Monto'), { target: { value: '10000' } });
    fireEvent.change(screen.getByLabelText('Motivo'), { target: { value: 'Traslado a bóveda' } });
    fireEvent.click(screen.getByRole('button', { name: 'Registrar' }));

    await waitFor(() => {
      expect(addCashMovement).toHaveBeenCalledWith(openSession.id, expect.objectContaining({
        type: 'withdrawal',
        amount: '10000',
        reason: 'Traslado a bóveda',
      }));
    });
  });

  it('impide cerrar sin ingresar el efectivo contado', async () => {
    getCurrentCashSession.mockResolvedValue({ session: openSession });
    render(<CashSessionsPageReport />);

    await screen.findByText(openSession.sessionCode);
    fireEvent.click(screen.getByRole('button', { name: /Realizar arqueo/i }));
    fireEvent.change(screen.getByLabelText('Efectivo contado'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: /cerrar caja/i }));

    expect(await screen.findByText('Debes ingresar el efectivo contado antes de cerrar la caja.')).toBeInTheDocument();
    expect(closeCashSession).not.toHaveBeenCalled();
  });

  it('presenta el reporte como un diálogo accesible', async () => {
    getCurrentCashSession.mockResolvedValue({
      session: {
        ...openSession,
        cashMovements: [{
          _id: 'movement-approved',
          type: 'withdrawal',
          direction: 'out',
          amount: 50000,
          approvalStatus: 'approved',
          reason: 'Salida aprobada',
        }],
      },
    });
    render(<CashSessionsPageReport />);

    await screen.findByText(openSession.sessionCode);
    fireEvent.click(screen.getByRole('button', { name: /ver reporte actual/i }));

    const reportDialog = screen.getByRole('dialog', { name: 'Reporte de cierre de caja' });
    expect(reportDialog).toBeInTheDocument();
    expect(reportDialog.parentElement).toBe(document.body);
    expect(screen.getByText(/Entradas \+\$\s*0/)).toBeInTheDocument();
    expect(screen.getByText(/Salidas -\$\s*50[.]000/)).toBeInTheDocument();
  });

  it('mantiene visible y operativo el acceso al reporte desde el histórico', async () => {
    const closedSession = {
      ...openSession,
      id: 'cash-session-closed',
      status: 'closed',
      countedCash: 78500,
      differenceAmount: 0,
    };
    listCashSessions.mockResolvedValue({ sessions: [closedSession] });
    getCashSessionById.mockResolvedValue({ session: closedSession });
    render(<CashSessionsPageReport />);

    fireEvent.click(await screen.findByRole('button', { name: /Histórico/i }));
    const reportButton = await screen.findByRole('button', { name: 'Ver reporte' });
    fireEvent.click(reportButton);

    await waitFor(() => {
      expect(getCashSessionById).toHaveBeenCalledWith(closedSession.id);
    });
    expect(screen.getByRole('dialog', { name: 'Reporte de cierre de caja' })).toBeInTheDocument();
  });
});
