import { afterEach, describe, expect, it } from 'vitest';
import { AxiosError } from 'axios';
import api, { setAdminSessionActive } from './api';

const originalAdapter = api.defaults.adapter;

afterEach(() => {
  api.defaults.adapter = originalAdapter;
  setAdminSessionActive(false);
});

describe('renovación de cookie administrativa', () => {
  it('envía un objeto JSON válido antes de reintentar una lectura protegida', async () => {
    let refreshBody;
    let protectedReads = 0;
    api.defaults.adapter = async (config) => {
      if (config.url === '/api/admin/auth/refresh') {
        refreshBody = config.data;
        return { config, data: { ok: true }, status: 200, statusText: 'OK', headers: {} };
      }
      protectedReads += 1;
      if (protectedReads === 1) {
        throw new AxiosError('Sesión expirada', 'ERR_BAD_RESPONSE', config, null, {
          config, data: {}, status: 401, statusText: 'Unauthorized', headers: {},
        });
      }
      return { config, data: { ok: true }, status: 200, statusText: 'OK', headers: {} };
    };

    setAdminSessionActive(true);
    const response = await api.get('/api/admin/dashboard');
    expect(response.data.ok).toBe(true);
    expect(protectedReads).toBe(2);
    expect(JSON.parse(refreshBody)).toEqual({});
  });
});
