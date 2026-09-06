import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
  get: vi.fn(),
}));

vi.mock('../../../lib/api', () => ({ default: api }));

import { getAdminBranches } from './financeApi';

describe('financeApi Nivel Plus · Etapa 0', () => {
  beforeEach(() => {
    api.get.mockReset();
  });

  it('consulta el catálogo de sedes protegido por Finanzas', async () => {
    api.get.mockResolvedValue({
      data: {
        data: [{ _id: 'branch-a', name: 'Sede A' }],
      },
    });

    await expect(getAdminBranches()).resolves.toEqual([
      { _id: 'branch-a', name: 'Sede A' },
    ]);
    expect(api.get).toHaveBeenCalledWith('/api/admin/finance/branches', {
      params: { limit: 100, status: 'active' },
    });
  });
});
