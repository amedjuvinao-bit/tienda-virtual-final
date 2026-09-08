import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
}));

vi.mock('../../../lib/api', () => ({ default: api }));

import {
  getFinanceTreasury,
  registerFinancePayablePayment,
} from './financeApi';

describe('financeApi Nivel Plus · Etapa 3', () => {
  beforeEach(() => {
    api.get.mockReset();
    api.post.mockReset();
  });

  it('consulta tesorería dentro de la sede seleccionada', async () => {
    api.get.mockResolvedValue({
      data: { data: { summary: { accountsReceivable: 85000 } } },
    });

    await expect(getFinanceTreasury({ branchId: 'branch-1' })).resolves.toEqual({
      summary: { accountsReceivable: 85000 },
    });
    expect(api.get).toHaveBeenCalledWith('/api/admin/finance/treasury', {
      params: { branchId: 'branch-1' },
    });
  });

  it('registra abonos mediante el endpoint versionado de tesorería', async () => {
    api.post.mockResolvedValue({ data: { data: { revision: 4 } } });
    const payload = {
      expectedRevision: 3,
      requestKey: 'treasury-request-1',
      amount: 25000,
      paymentMethod: 'transfer',
      reference: 'TRX-9088',
    };

    await expect(
      registerFinancePayablePayment('expense-1', payload)
    ).resolves.toEqual({ revision: 4 });
    expect(api.post).toHaveBeenCalledWith(
      '/api/admin/finance/payables/expense-1/payments',
      payload
    );
  });
});
