import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getPosBootstrap } from '../api/adminPosApi';
import {
  getCashJourneySummary,
  getCurrentCashSession,
  listCashSessions,
} from '../api/adminCashSessionApi';
import CashSessionsPageReport from './CashSessionsPageReport';

vi.mock('../api/adminPosApi', () => ({ getPosBootstrap: vi.fn() }));
vi.mock('../api/adminCashSessionApi', () => ({
  addCashMovement: vi.fn(), closeCashSession: vi.fn(), getCashJourneySummary: vi.fn(),
  getCashSessionById: vi.fn(), getCurrentCashSession: vi.fn(), listCashSessions: vi.fn(),
  openCashSession: vi.fn(), reviewCashClosing: vi.fn(), reviewCashMovement: vi.fn(),
}));

const branch = { id: 'branch-stage3', name: 'Sede Principal', code: 'PRINCIPAL', settings: { requireCashSessionForPos: true } };
const summary = {
  status: 'attention',
  totals: {
    sessionsCount: 2, openSessionsCount: 1, closedSessionsCount: 1,
    ordersCount: 3, netSales: 120000, expectedCash: 170000, countedCash: 160000,
    differenceAmount: -10000, shortages: 10000, overages: 0,
    paymentTotals: { cash: 70000, transfer: 30000, card: 20000, mixed: 0, other: 0, total: 120000 },
  },
  alerts: [{ code: 'shortages', severity: 'attention', message: 'Faltantes acumulados por 10000 COP.' }],
  sessions: [{
    id: 'cash-stage3', sessionCode: 'CAJA-20260904-STAGE3', status: 'closed',
    cashierSnapshot: { displayName: 'Cajero Etapa 3' }, openedAt: '2026-09-04T12:00:00.000Z',
    ordersCount: 3, netSales: 120000, expectedCash: 170000, countedCash: 160000,
    differenceAmount: -10000, reconciliationStatus: 'attention',
  }],
};

beforeEach(() => {
  getPosBootstrap.mockResolvedValue({ branches: [branch], defaultBranch: branch });
  getCurrentCashSession.mockResolvedValue({ session: null, access: { canSupervise: true } });
  listCashSessions.mockResolvedValue({ sessions: [] });
  getCashJourneySummary.mockResolvedValue({ summary });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('CashSessionsPageReport Etapa 3', () => {
  it('presenta el consolidado autoritativo al supervisor', async () => {
    render(<CashSessionsPageReport />);
    expect(await screen.findByText('Conciliación automática de caja')).toBeInTheDocument();
    expect(screen.getAllByText('$ 120.000').length).toBeGreaterThan(0);
    expect(screen.getByText('CAJA-20260904-STAGE3')).toBeInTheDocument();
    expect(screen.getByText('Faltantes acumulados por 10000 COP.')).toBeInTheDocument();
    expect(getCashJourneySummary).toHaveBeenCalledWith({ branchId: branch.id, range: 'today' });
  });

  it('permite consultar los últimos siete días', async () => {
    render(<CashSessionsPageReport />);
    await screen.findByText('Conciliación automática de caja');
    const rangeButton = screen.getByRole('button', { name: 'Últimos 7 días' });
    await waitFor(() => expect(rangeButton).not.toBeDisabled());
    fireEvent.click(rangeButton);
    await waitFor(() => expect(getCashJourneySummary).toHaveBeenCalledWith({ branchId: branch.id, range: 'last_7_days' }));
  });

  it('no consulta ni expone el consolidado al cajero', async () => {
    getCurrentCashSession.mockResolvedValue({ session: null, access: { canSupervise: false } });
    render(<CashSessionsPageReport />);
    await screen.findByRole('heading', { name: 'Abrir caja' });
    expect(getCashJourneySummary).not.toHaveBeenCalled();
    expect(screen.queryByText('Conciliación automática de caja')).not.toBeInTheDocument();
  });
});
