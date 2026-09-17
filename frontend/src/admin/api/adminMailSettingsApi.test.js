import { beforeEach, describe, expect, it, vi } from 'vitest';

import api from '../../lib/api';
import {
  getAdminMailSettings,
  sendAdminMailTest,
  updateAdminMailSettings,
} from './adminMailSettingsApi';

vi.mock('../../lib/api', () => ({
  default: { get: vi.fn(), put: vi.fn(), post: vi.fn() },
}));

describe('adminMailSettingsApi', () => {
  beforeEach(() => vi.clearAllMocks());

  it('usa únicamente la ruta administrativa dedicada', async () => {
    const savePayload = { revision: 2, settings: { provider: 'gmail' } };
    const testPayload = { revision: 3, testEmail: 'owner@rosa.com' };
    api.get.mockResolvedValue({ data: { revision: 2 } });
    api.put.mockResolvedValue({ data: { revision: 3 } });
    api.post.mockResolvedValue({ data: { revision: 4 } });

    await expect(getAdminMailSettings()).resolves.toMatchObject({ revision: 2 });
    await expect(updateAdminMailSettings(savePayload)).resolves.toMatchObject({ revision: 3 });
    await expect(sendAdminMailTest(testPayload)).resolves.toMatchObject({ revision: 4 });

    expect(api.get).toHaveBeenCalledWith('/api/admin/mail-settings');
    expect(api.put).toHaveBeenCalledWith('/api/admin/mail-settings', savePayload);
    expect(api.post).toHaveBeenCalledWith('/api/admin/mail-settings/test', testPayload);
  });
});
