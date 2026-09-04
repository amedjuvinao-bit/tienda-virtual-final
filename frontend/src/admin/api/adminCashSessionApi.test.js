import { beforeEach, describe, expect, it, vi } from 'vitest';

import api from '../../lib/api';
import { closeCashSession, getCashJourneySummary, reviewCashClosing, reviewCashMovement } from './adminCashSessionApi';

vi.mock('../../lib/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('adminCashSessionApi Etapa 2', () => {
  it('envía cantidades de denominaciones sin confiar en subtotales', async () => {
    api.post.mockResolvedValueOnce({ data: { ok: true, requiresApproval: false } });
    await closeCashSession(' cash-2 ', {
      countedCash: 100000,
      denominations: [{ value: 50000, quantity: 2, subtotal: 100000 }],
      closingNotes: ' Conteo exacto ',
    });
    expect(api.post).toHaveBeenCalledWith('/api/admin/cash-sessions/cash-2/close', {
      countedCash: 100000,
      denominations: [{ value: 50000, quantity: 2 }],
      closingNotes: 'Conteo exacto',
    });
  });

  it('envía la decisión de supervisión al arqueo exacto', async () => {
    api.post.mockResolvedValueOnce({ data: { ok: true } });
    await reviewCashClosing(' cash-2 ', ' review-2 ', {
      decision: ' approve ', reviewNotes: ' Diferencia verificada ',
    });
    expect(api.post).toHaveBeenCalledWith(
      '/api/admin/cash-sessions/cash-2/closing-reviews/review-2/review',
      { decision: 'approve', reviewNotes: 'Diferencia verificada' }
    );
  });
});

describe('adminCashSessionApi Etapa 3', () => {
  it('consulta el consolidado por sede y período', async () => {
    api.get.mockResolvedValueOnce({ data: { ok: true, summary: { status: 'healthy' } } });
    await expect(getCashJourneySummary({ branchId: ' branch-3 ', range: ' last_7_days ' }))
      .resolves.toMatchObject({ ok: true });
    expect(api.get).toHaveBeenCalledWith('/api/admin/cash-sessions/journey-summary?branchId=branch-3&range=last_7_days');
  });
});

describe('adminCashSessionApi Etapa 1', () => {
  it('envía una decisión normalizada al endpoint protegido del movimiento', async () => {
    api.post.mockResolvedValueOnce({
      data: { ok: true, movement: { approvalStatus: 'approved' } },
    });

    await expect(reviewCashMovement(' session-1 ', ' movement-1 ', {
      decision: ' approve ',
      reviewNotes: ' Soporte verificado ',
    })).resolves.toMatchObject({ ok: true });

    expect(api.post).toHaveBeenCalledWith(
      '/api/admin/cash-sessions/session-1/movements/movement-1/review',
      { decision: 'approve', reviewNotes: 'Soporte verificado' }
    );
  });

  it('conserva el código y detalle del error del servidor', async () => {
    api.post.mockRejectedValueOnce({
      response: {
        data: {
          error: 'CASH_MOVEMENT_ALREADY_REVIEWED',
          message: 'Este movimiento ya fue revisado.',
          details: { approvalStatus: 'rejected' },
        },
      },
    });

    await expect(reviewCashMovement('session-1', 'movement-1', {
      decision: 'approve',
    })).rejects.toMatchObject({
      message: 'Este movimiento ya fue revisado.',
      code: 'CASH_MOVEMENT_ALREADY_REVIEWED',
      details: { approvalStatus: 'rejected' },
    });
  });
});
