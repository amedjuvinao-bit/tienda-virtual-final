import { beforeEach, describe, expect, it, vi } from 'vitest';

import api from '../../lib/api';
import { reviewCashMovement } from './adminCashSessionApi';

vi.mock('../../lib/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
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
