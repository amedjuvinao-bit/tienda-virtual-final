import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getPosBootstrap } from '../api/adminPosApi';
import {
  closeCashSession,
  getCurrentCashSession,
  listCashSessions,
  reviewCashClosing,
} from '../api/adminCashSessionApi';
import CashSessionsPageReport from './CashSessionsPageReport';

vi.mock('../api/adminPosApi', () => ({ getPosBootstrap: vi.fn() }));
vi.mock('../api/adminCashSessionApi', () => ({
  addCashMovement: vi.fn(), certifyCashJourney: vi.fn(), closeCashSession: vi.fn(), getCashSessionById: vi.fn(),
  getCurrentCashSession: vi.fn(), listCashSessions: vi.fn(), openCashSession: vi.fn(),
  reviewCashClosing: vi.fn(), reviewCashMovement: vi.fn(),
}));

const branch = { id: 'branch-stage2', name: 'Sede Principal', code: 'PRINCIPAL', settings: { requireCashSessionForPos: true } };
const baseSession = {
  id: 'cash-stage2', sessionCode: 'CAJA-20260904-STAGE2', status: 'open', branch: branch.id,
  branchSnapshot: { name: branch.name, code: branch.code }, cashRegisterCode: 'CAJA POS',
  cashierSnapshot: { displayName: 'Cajero Etapa 2' }, openedAt: '2026-09-04T12:00:00.000Z',
  openingAmount: 50000, expectedCash: null, countedCash: null, differenceAmount: null,
  salesSummary: { ordersCount: 0, netSales: null, paymentTotals: { cash: null, transfer: null, card: null, mixed: null, other: null } },
  cashMovements: [], closingReviews: [],
  cashControl: { blindCountActive: true, canSupervise: false, canReviewMovements: false, pendingMovementsCount: 0, closingLocked: false, canReviewClosing: false, varianceTolerance: 1000 },
};

beforeEach(() => {
  getPosBootstrap.mockResolvedValue({ branches: [branch], defaultBranch: branch });
  getCurrentCashSession.mockResolvedValue({ session: baseSession });
  listCashSessions.mockResolvedValue({ sessions: [] });
  closeCashSession.mockResolvedValue({ requiresApproval: true, session: baseSession, message: 'Arqueo enviado a supervisión.' });
  reviewCashClosing.mockResolvedValue({ session: null, message: 'Arqueo aprobado y caja cerrada correctamente.' });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('CashSessionsPageReport Etapa 2', () => {
  it('calcula y envía el arqueo por denominaciones', async () => {
    render(<CashSessionsPageReport />);
    fireEvent.click(await screen.findByRole('button', { name: /Realizar arqueo/i }));
    expect(await screen.findByText('Arqueo por denominaciones')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/Cantidad de.*50\.000/), { target: { value: '2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar caja' }));
    await waitFor(() => expect(closeCashSession).toHaveBeenCalled());
    const [, payload] = closeCashSession.mock.calls[0];
    expect(payload.countedCash).toBe(100000);
    expect(payload.denominations.find((entry) => entry.value === 50000)).toEqual(expect.objectContaining({ quantity: 2, subtotal: 100000 }));
  });

  it('congela la operación y permite al supervisor aprobar con observación', async () => {
    const pendingReview = {
      _id: 'review-stage2', status: 'pending', countedCash: 40000,
      expectedCash: 50000, differenceAmount: -10000, toleranceAmount: 1000,
    };
    const supervisorSession = {
      ...baseSession,
      expectedCash: 50000,
      closingReviews: [pendingReview],
      cashControl: { ...baseSession.cashControl, blindCountActive: false, canSupervise: true, canReviewMovements: true, canReviewClosing: true, closingLocked: true },
    };
    getCurrentCashSession.mockResolvedValue({ session: supervisorSession });
    render(<CashSessionsPageReport />);
    expect(await screen.findByText('Arqueo extraordinario pendiente')).toBeInTheDocument();
    expect(screen.queryByText('Arqueo por denominaciones')).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Observación de supervisión'), { target: { value: 'Faltante verificado' } });
    fireEvent.click(screen.getByRole('button', { name: 'Aprobar y cerrar' }));
    await waitFor(() => expect(reviewCashClosing).toHaveBeenCalledWith('cash-stage2', 'review-stage2', {
      decision: 'approve', reviewNotes: 'Faltante verificado',
    }));
  });
});
