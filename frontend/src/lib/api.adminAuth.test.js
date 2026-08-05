import { beforeEach, describe, expect, it, vi } from 'vitest';
import api from './api';

function requestWithCapturedConfig(pathname = '/api/cart/admin') {
  let captured = null;
  return api.get(pathname, {
    adapter: async (config) => {
      captured = config;
      return {
        data: { ok: true },
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
      };
    },
  }).then(() => captured);
}

describe('autenticacion administrativa centralizada', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('envia exclusivamente Bearer cuando existe una sesion legitima', async () => {
    const token = 'header.payload.valid-admin-signature';
    localStorage.setItem('admin_token', token);

    const config = await requestWithCapturedConfig();
    const headers = config.headers.toJSON();

    expect(headers.Authorization).toBe(`Bearer ${token}`);
    expect(headers['x-admin-token']).toBeUndefined();
    expect(headers['x-admin-user']).toBeUndefined();
    expect(config.url).toBe('/api/cart/admin');
    expect(JSON.stringify(config.data || '')).not.toContain(token);
  });

  it('sin sesion no fabrica ni envia credenciales administrativas', async () => {
    const config = await requestWithCapturedConfig();
    const headers = config.headers.toJSON();

    expect(headers.Authorization).toBeUndefined();
    expect(headers['x-admin-token']).toBeUndefined();
    expect(headers['x-admin-user']).toBeUndefined();
  });

  it('el token legitimo no aparece en URL, query, body o logs', async () => {
    const token = 'header.payload.valid-admin-signature';
    localStorage.setItem('admin_token', token);
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});

    const config = await requestWithCapturedConfig('/api/cart/admin?page=1');

    expect(config.url).not.toContain(token);
    expect(JSON.stringify(config.params || {})).not.toContain(token);
    expect(JSON.stringify(config.data || '')).not.toContain(token);
    expect(consoleSpy).not.toHaveBeenCalled();
    expect(debugSpy).not.toHaveBeenCalled();
  });
});
