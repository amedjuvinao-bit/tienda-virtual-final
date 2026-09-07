import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
  delete: vi.fn(),
  post: vi.fn(),
}));

vi.mock('../../../lib/api', () => ({ default: api }));

import {
  cancelFinanceExpense,
  reviewFinanceExpense,
} from './financeApi';

describe('financeApi Nivel Plus · Etapa 1', () => {
  beforeEach(() => {
    api.delete.mockReset();
    api.post.mockReset();
  });

  it('envía decisiones con versión y nota al endpoint protegido', async () => {
    api.post.mockResolvedValue({ data: { data: { status: 'paid' } } });
    const payload = {
      decision: 'approve',
      expectedRevision: 2,
      reviewNotes: 'Soporte verificado',
    };

    await expect(reviewFinanceExpense('expense-a', payload)).resolves.toEqual({ status: 'paid' });
    expect(api.post).toHaveBeenCalledWith(
      '/api/admin/finance/expenses/expense-a/review',
      payload
    );
  });

  it('envía motivo y versión al anular un gasto', async () => {
    api.delete.mockResolvedValue({ data: { data: { status: 'cancelled' } } });
    const payload = {
      expectedRevision: 4,
      cancellationReason: 'Cobro reversado',
    };

    await expect(cancelFinanceExpense('expense-b', payload)).resolves.toEqual({ status: 'cancelled' });
    expect(api.delete).toHaveBeenCalledWith(
      '/api/admin/finance/expenses/expense-b',
      { data: payload }
    );
  });
});
