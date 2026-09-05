import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getPosBootstrap } from '../api/adminPosApi';
import {
  certifyCashJourney,
  getCashJourneySummary,
  getCurrentCashSession,
  listCashSessions,
} from '../api/adminCashSessionApi';
import CashSessionsPageReport from './CashSessionsPageReport';

vi.mock('../api/adminPosApi', () => ({ getPosBootstrap: vi.fn() }));
vi.mock('../api/adminCashSessionApi', () => ({
  addCashMovement: vi.fn(), certifyCashJourney: vi.fn(), closeCashSession: vi.fn(),
  getCashJourneySummary: vi.fn(), getCashSessionById: vi.fn(), getCurrentCashSession: vi.fn(),
  listCashSessions: vi.fn(), openCashSession: vi.fn(), reviewCashClosing: vi.fn(), reviewCashMovement: vi.fn(),
}));

const branch = { id: 'branch-stage4', name: 'Sede Principal', code: 'PRINCIPAL', settings: { requireCashSessionForPos: true } };
const baseSummary = {
  status: 'healthy', issueCounts: { critical: 0, attention: 0 }, journeyClose: null,
  totals: {
    sessionsCount: 2, openSessionsCount: 0, closedSessionsCount: 2, pendingReviewCount: 0,
    ordersCount: 3, netSales: 120000, expectedCash: 170000, countedCash: 170000,
    differenceAmount: 0, shortages: 0, overages: 0,
    paymentTotals: { cash: 70000, transfer: 30000, card: 20000, mixed: 0, other: 0, total: 120000 },
  }, alerts: [], sessions: [],
};
const certificate = {
  id: 'close-stage4', businessDate: '2026-09-05', status: 'certified',
  contentDigest: '1234567890abcdef1234567890abcdef', notes: 'Jornada revisada',
  certifiedAt: '2026-09-05T20:00:00.000Z', certifiedBySnapshot: { displayName: 'Supervisor Etapa 4' },
};

beforeEach(() => {
  getPosBootstrap.mockResolvedValue({ branches: [branch], defaultBranch: branch });
  getCurrentCashSession.mockResolvedValue({ session: null, access: { canSupervise: true } });
  listCashSessions.mockResolvedValue({ sessions: [] });
  getCashJourneySummary.mockResolvedValue({ summary: baseSummary });
  certifyCashJourney.mockResolvedValue({ journeyClose: certificate, message: 'Jornada certificada.' });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('CashSessionsPageReport Etapa 4', () => {
  it('permite al supervisor certificar una jornada completamente conciliada', async () => {
    render(<CashSessionsPageReport />);
    const button = await screen.findByRole('button', { name: 'Certificar jornada' });
    await waitFor(() => expect(button).not.toBeDisabled());
    fireEvent.change(screen.getByPlaceholderText('Ejemplo: jornada revisada sin novedades'), { target: { value: 'Jornada revisada' } });
    fireEvent.click(button);
    await waitFor(() => expect(certifyCashJourney).toHaveBeenCalledWith({ branchId: branch.id, notes: 'Jornada revisada' }));
  });

  it('muestra la certificación y su huella auditable', async () => {
    getCashJourneySummary.mockResolvedValue({ summary: { ...baseSummary, journeyClose: certificate } });
    render(<CashSessionsPageReport />);
    expect(await screen.findByText('Jornada certificada')).toBeInTheDocument();
    expect(screen.getByText('Huella: 1234567890abcdef')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Certificar jornada' })).not.toBeInTheDocument();
  });

  it('bloquea la certificación mientras exista una caja abierta', async () => {
    getCashJourneySummary.mockResolvedValue({
      summary: { ...baseSummary, status: 'attention', totals: { ...baseSummary.totals, openSessionsCount: 1 } },
    });
    render(<CashSessionsPageReport />);
    const button = await screen.findByRole('button', { name: 'Certificar jornada' });
    expect(button).toBeDisabled();
    expect(screen.getByText('Cierra todas las cajas.')).toBeInTheDocument();
  });
});
