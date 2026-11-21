import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../../lib/api', () => ({ default: { get: vi.fn() } }));
import api from '../../lib/api';
import { getAdminSubscription, getAdminSubscriptions } from './adminSubscriptionsApi';

beforeEach(() => vi.resetAllMocks());
describe('API de consulta de suscripciones', () => {
  it('codifica el correo y transmite filtros, paginación y cancelación', async () => {
    api.get.mockResolvedValue({ data: { ok: true, subscribers: [] } });
    const signal = new AbortController().signal;
    await getAdminSubscriptions({ q: ' persona+ventas@example.com ', status: 'withdrawn', page: 2 }, { signal });
    const [url, options] = api.get.mock.calls[0];
    expect(url.split('?')[0]).toBe('/api/admin/customers/subscriptions');
    expect(Object.fromEntries(new URLSearchParams(url.split('?')[1])))
      .toEqual({ q: 'persona+ventas@example.com', status: 'withdrawn', page: '2', limit: '20' });
    expect(options.signal).toBe(signal);
  });
  it('consulta el detalle y conserva los mensajes seguros del backend', async () => {
    api.get.mockRejectedValue({ response: { data: { message: 'Suscripción no encontrada.' } } });
    await expect(getAdminSubscription('id/otra', { page: 3 })).rejects.toThrow('Suscripción no encontrada.');
    expect(api.get).toHaveBeenCalledWith('/api/admin/customers/subscriptions/id%2Fotra?page=3', { signal: undefined });
  });
});
