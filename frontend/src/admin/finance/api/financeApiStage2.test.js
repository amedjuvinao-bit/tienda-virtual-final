import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
}));

vi.mock('../../../lib/api', () => ({ default: api }));

import {
  createFinanceBudget,
  createFinanceCostCenter,
  getFinanceBudgetControl,
  getFinanceCostCenters,
  updateFinanceBudget,
} from './financeApi';

describe('financeApi Nivel Plus · Etapa 2', () => {
  beforeEach(() => {
    api.get.mockReset();
    api.post.mockReset();
    api.put.mockReset();
  });

  it('consulta centros y control presupuestal con sus filtros', async () => {
    api.get
      .mockResolvedValueOnce({ data: { data: [{ _id: 'center-1' }] } })
      .mockResolvedValueOnce({ data: { data: { summary: { allocatedAmount: 1000 } } } });

    await expect(getFinanceCostCenters({ status: 'all' })).resolves.toEqual([{ _id: 'center-1' }]);
    await expect(getFinanceBudgetControl({ periodKey: '2026-09', branchId: 'branch-1' })).resolves.toEqual({ summary: { allocatedAmount: 1000 } });
    expect(api.get).toHaveBeenNthCalledWith(1, '/api/admin/finance/cost-centers', { params: { status: 'all' } });
    expect(api.get).toHaveBeenNthCalledWith(2, '/api/admin/finance/budget-control', { params: { periodKey: '2026-09', branchId: 'branch-1' } });
  });

  it('crea centros y presupuestos en endpoints separados', async () => {
    api.post
      .mockResolvedValueOnce({ data: { data: { _id: 'center-1' } } })
      .mockResolvedValueOnce({ data: { data: { _id: 'budget-1' } } });
    const center = { code: 'OPS', name: 'Operación' };
    const budget = { periodKey: '2026-09', costCenterId: 'center-1', amount: 50000 };

    await createFinanceCostCenter(center);
    await createFinanceBudget(budget);
    expect(api.post).toHaveBeenNthCalledWith(1, '/api/admin/finance/cost-centers', center);
    expect(api.post).toHaveBeenNthCalledWith(2, '/api/admin/finance/budgets', budget);
  });

  it('ajusta un presupuesto con cuerpo versionado', async () => {
    api.put.mockResolvedValue({ data: { data: { revision: 3 } } });
    const payload = { expectedRevision: 2, amount: 90000, changeReason: 'Ajuste mensual' };

    await expect(updateFinanceBudget('budget-1', payload)).resolves.toEqual({ revision: 3 });
    expect(api.put).toHaveBeenCalledWith('/api/admin/finance/budgets/budget-1', payload);
  });
});
