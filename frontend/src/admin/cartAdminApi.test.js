import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  api: {
    get: vi.fn(), post: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn(),
  },
}));

vi.mock('../lib/api', () => ({ default: state.api }));

import cartAdminApi from './cartAdminApi';

describe('contrato administrativo centralizado de carritos', () => {
  beforeEach(() => Object.values(state.api).forEach((mock) => mock.mockReset()));

  it('usa rutas de resumen, listado y detalle sin credenciales alternativas', async () => {
    state.api.get.mockResolvedValue({ data: {} });
    await cartAdminApi.list({ page: 1, q: '' });
    await cartAdminApi.summary({ lifecycle: 'active' });
    await cartAdminApi.detail('cart_safe');
    expect(state.api.get.mock.calls.map((call) => call[0])).toEqual([
      '/api/cart/admin', '/api/cart/admin/summary', '/api/cart/admin/cart_safe',
    ]);
    expect(JSON.stringify(state.api.get.mock.calls)).not.toMatch(/x-admin-token/i);
  });

  it('envia la version vigente en cada mutacion administrativa', async () => {
    state.api.patch.mockResolvedValue({ data: {} });
    await cartAdminApi.updateItems('cart_safe', '2026-08-04T00:00:00.000Z', []);
    expect(state.api.patch.mock.calls[0][2].headers).toEqual({
      'If-Match-Updated-At': '2026-08-04T00:00:00.000Z',
    });
  });

  it('exporta seleccionados por POST y solicita un blob', async () => {
    state.api.post.mockResolvedValue({ data: new Blob() });
    await cartAdminApi.export({ lifecycle: 'recoverable' }, ['cart_a']);
    expect(state.api.post).toHaveBeenCalledWith(
      '/api/cart/admin/export',
      { filters: { lifecycle: 'recoverable' }, sessionIds: ['cart_a'] },
      { responseType: 'blob' }
    );
  });

  it('recuperacion usa idempotencia sin incluir token administrativo', async () => {
    state.api.post.mockResolvedValue({ data: {} });
    await cartAdminApi.sendRecovery('cart_safe', { subject: 'Compra' }, 'idem-1');
    const serialized = JSON.stringify(state.api.post.mock.calls[0]);
    expect(serialized).toContain('Idempotency-Key');
    expect(serialized).not.toMatch(/authorization|x-admin-token/i);
  });
});
