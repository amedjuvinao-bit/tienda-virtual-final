import React from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ShippingProvidersCard from './ShippingProvidersCard';
import {
  getAdminShippingSettings,
  updateAdminShippingSettings,
} from '../../../api/adminShippingSettingsApi';

vi.mock('../../../api/adminShippingSettingsApi', () => ({
  activateAdminShippingProvider: vi.fn(),
  disableAdminShippingProvider: vi.fn(),
  getAdminShippingSettings: vi.fn(),
  registerAdminShippingWebhook: vi.fn(),
  testAdminShippingConnection: vi.fn(),
  updateAdminShippingSettings: vi.fn(),
}));

function response(overrides = {}) {
  return {
    settings: {
      defaultProvider: 'manual',
      enviaMode: 'sandbox',
      hasEnviaToken: false,
      hasWebhookSecret: false,
      enviaTokenHint: '',
      webhookSecretHint: '',
      lastTestStatus: 'none',
      ...overrides.settings,
    },
    meta: {
      encryptionConfigured: true,
      webhookUrl: 'https://api.tienda.test/api/shipping/webhooks/envia',
      readiness: {
        hasToken: false,
        hasWebhookSecret: false,
        tested: false,
        webhookRegistered: false,
        webhookUrlReady: true,
        canTest: false,
        canRegisterWebhook: false,
        canActivateSandbox: false,
        canActivateProduction: false,
        ...overrides.readiness,
      },
    },
  };
}

describe('ShippingProvidersCard', () => {
  afterEach(cleanup);

  beforeEach(() => {
    vi.clearAllMocks();
    getAdminShippingSettings.mockResolvedValue(response());
  });

  it('mantiene manual activo y nunca renderiza un secreto recibido', async () => {
    getAdminShippingSettings.mockResolvedValue(
      response({
        settings: {
          hasEnviaToken: true,
          enviaTokenHint: '••••1234',
        },
      })
    );
    render(<ShippingProvidersCard />);

    expect(await screen.findByText('Activo: Operación manual')).toBeInTheDocument();
    expect(screen.getByText(/Guardado: ••••1234/)).toBeInTheDocument();
    expect(screen.queryByDisplayValue('token-real')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Probar conexión' })).toBeDisabled();
  });

  it('guarda token y secreto como campos de escritura única', async () => {
    const user = userEvent.setup();
    updateAdminShippingSettings.mockResolvedValue({
      ...response({
        settings: {
          hasEnviaToken: true,
          hasWebhookSecret: true,
          enviaTokenHint: '••••OKEN',
          webhookSecretHint: '••••CRET',
        },
      }),
      message: 'Configuración guardada.',
    });
    render(<ShippingProvidersCard />);

    const inputs = await screen.findAllByLabelText(/Token de Envia|Secreto de firma/);
    await user.type(inputs[0], 'NUEVO-TOKEN');
    await user.type(inputs[1], 'NUEVO-SECRETO');
    await user.click(screen.getByRole('button', { name: 'Guardar configuración' }));

    await waitFor(() =>
      expect(updateAdminShippingSettings).toHaveBeenCalledWith({
        enviaMode: 'sandbox',
        enviaToken: 'NUEVO-TOKEN',
        webhookSecret: 'NUEVO-SECRETO',
      })
    );
    expect(inputs[0]).toHaveValue('');
    expect(inputs[1]).toHaveValue('');
  });
});
