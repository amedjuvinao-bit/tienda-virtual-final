import { beforeEach, describe, expect, it, vi } from 'vitest';

import api from '../../lib/api';
import {
  getAdminLoginSettings,
  updateAdminLoginSettings,
  uploadAdminLoginBackground,
} from './adminLoginSettingsApi';

vi.mock('../../lib/api', () => ({
  default: { get: vi.fn(), put: vi.fn(), post: vi.fn() },
}));

describe('adminLoginSettingsApi', () => {
  beforeEach(() => vi.clearAllMocks());

  it('usa la ruta protegida y conserva la revisión', async () => {
    const payload = { revision: 2, settings: { theme: 'minimalPro' } };
    api.get.mockResolvedValue({ data: { revision: 2 } });
    api.put.mockResolvedValue({ data: { revision: 3 } });

    await expect(getAdminLoginSettings()).resolves.toMatchObject({ revision: 2 });
    await expect(updateAdminLoginSettings(payload)).resolves.toMatchObject({ revision: 3 });
    expect(api.get).toHaveBeenCalledWith('/api/admin/login-settings');
    expect(api.put).toHaveBeenCalledWith('/api/admin/login-settings', payload);
  });

  it('sube el fondo mediante el backend autorizado', async () => {
    api.post.mockResolvedValue({ data: { url: 'https://cdn.example.com/login.webp' } });
    const file = new File(['image'], 'login.webp', { type: 'image/webp' });

    await expect(uploadAdminLoginBackground(file)).resolves.toBe('https://cdn.example.com/login.webp');
    expect(api.post).toHaveBeenCalledWith('/api/uploads', expect.any(FormData));
  });
});
