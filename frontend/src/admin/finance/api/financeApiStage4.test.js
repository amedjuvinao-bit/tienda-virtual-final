import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
}));

vi.mock('../../../lib/api', () => ({ default: api }));

import {
  certifyFinancePeriod,
  exportFinanceClosingCsv,
  getFinanceClosingControl,
} from './financeApi';

describe('financeApi Nivel Plus · Etapa 4', () => {
  beforeEach(() => {
    api.get.mockReset();
    api.post.mockReset();
  });

  it('consulta los controles de cierre para un periodo y una sede', async () => {
    const params = { periodKey: '2026-08', branchId: 'branch-1' };
    api.get.mockResolvedValue({ data: { data: { snapshotHash: 'a'.repeat(64) } } });

    await expect(getFinanceClosingControl(params)).resolves.toEqual({
      snapshotHash: 'a'.repeat(64),
    });
    expect(api.get).toHaveBeenCalledWith('/api/admin/finance/closing-control', { params });
  });

  it('certifica el corte con versión e idempotencia', async () => {
    const payload = {
      periodKey: '2026-08',
      branchId: 'branch-1',
      expectedRevision: 2,
      requestKey: 'finance-close-request-001',
      notes: 'Se conciliaron las diferencias.',
    };
    api.post.mockResolvedValue({ data: { data: { revision: 3 } } });

    await expect(certifyFinancePeriod(payload)).resolves.toEqual({ revision: 3 });
    expect(api.post).toHaveBeenCalledWith('/api/admin/finance/period-closes', payload);
  });

  it('descarga el informe ejecutivo como archivo', async () => {
    const params = { periodKey: '2026-08', branchId: 'branch-1' };
    const report = new Blob(['reporte'], { type: 'text/csv' });
    api.get.mockResolvedValue({ data: report });

    await expect(exportFinanceClosingCsv(params)).resolves.toBe(report);
    expect(api.get).toHaveBeenCalledWith('/api/admin/finance/closing-export', {
      params,
      responseType: 'blob',
    });
  });
});
