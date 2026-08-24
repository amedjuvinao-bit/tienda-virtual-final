import React from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ShippingProvidersCard from './ShippingProvidersCard';
import {
  confirmAdminShippingWebhook,
  getAdminShippingSettings,
  updateAdminShippingSettings,
} from '../../../api/adminShippingSettingsApi';

vi.mock('../../../api/adminShippingSettingsApi', () => ({
  activateAdminShippingProvider: vi.fn(),
  confirmAdminShippingWebhook: vi.fn(),
  disableAdminShippingProvider: vi.fn(),
  getAdminShippingSettings: vi.fn(),
  testAdminShippingConnection: vi.fn(),
  updateAdminShippingSettings: vi.fn(),
}));

function response(overrides = {}) {
  return {
    settings: {
      defaultProvider: 'manual',
      enviaMode: 'sandbox',
      hasEnviaToken: false,
      hasSandboxWebhookToken: false,
      hasWebhookSecret: false,
      enviaTokenHint: '',
      sandboxWebhookTokenHint: '',
      webhookSecretHint: '',
      lastTestStatus: 'none',
      ...overrides.settings,
    },
    meta: {
      encryptionConfigured: true,
      webhookUrl: 'https://api.tienda.test/api/shipping/webhooks/envia',
      webhookDashboardUrl: 'https://shipping-test.envia.com/settings/developers',
      readiness: {
        hasToken: false,
        hasSandboxWebhookToken: false,
        hasWebhookSecret: false,
        tested: false,
        webhookRegistered: false,
        webhookVerified: false,
        webhookUrlReady: true,
        webhookUrlPermanent: true,
        temporaryWebhookUrl: false,
        canTest: false,
        canRegisterWebhook: false,
        canConfirmWebhook: false,
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

  it('guarda token API y credencial Sandbox como campos de escritura única', async () => {
    const user = userEvent.setup();
    updateAdminShippingSettings.mockResolvedValue({
      ...response({
        settings: {
          hasEnviaToken: true,
          hasSandboxWebhookToken: true,
          enviaTokenHint: '••••OKEN',
          sandboxWebhookTokenHint: '••••CRET',
        },
      }),
      message: 'Configuración guardada.',
    });
    render(<ShippingProvidersCard />);

    const inputs = await screen.findAllByLabelText(
      /Token de Envia|Credencial de autorización del webhook Sandbox/
    );
    await user.type(inputs[0], 'NUEVO-TOKEN');
    await user.type(inputs[1], 'NUEVO-SECRETO');
    await user.click(screen.getByRole('button', { name: 'Guardar configuración' }));

    await waitFor(() =>
      expect(updateAdminShippingSettings).toHaveBeenCalledWith({
        enviaMode: 'sandbox',
        enviaToken: 'NUEVO-TOKEN',
        internationalDutiesPaymentEntity: 'recipient',
        sandboxWebhookToken: 'NUEVO-SECRETO',
      })
    );
    expect(inputs[0]).toHaveValue('');
    expect(inputs[1]).toHaveValue('');
  });

  it('guarda la credencial visible aunque el navegador llene el campo sin actualizar el estado React', async () => {
    const user = userEvent.setup();
    updateAdminShippingSettings.mockResolvedValue({
      ...response({
        settings: {
          hasEnviaToken: true,
          hasSandboxWebhookToken: true,
          enviaTokenHint: '••••OKEN',
          sandboxWebhookTokenHint: '••••A968',
        },
      }),
      message: 'Configuración guardada.',
    });
    render(<ShippingProvidersCard />);

    const input = await screen.findByLabelText(
      'Credencial de autorización del webhook Sandbox'
    );
    const nativeValueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      'value'
    ).set;
    nativeValueSetter.call(input, 'CREDENCIAL-PORTAL-A968');

    await user.click(screen.getByRole('button', { name: 'Guardar configuración' }));

    await waitFor(() =>
      expect(updateAdminShippingSettings).toHaveBeenCalledWith({
        enviaMode: 'sandbox',
        internationalDutiesPaymentEntity: 'recipient',
        sandboxWebhookToken: 'CREDENCIAL-PORTAL-A968',
      })
    );
  });

  it('registra la URL y deja claro que aún falta recibir la prueba real de Envia', async () => {
    const user = userEvent.setup();
    getAdminShippingSettings.mockResolvedValue(
      response({
        settings: { hasEnviaToken: true },
        readiness: {
          hasToken: true,
          hasSandboxWebhookToken: true,
          tested: true,
          canConfirmWebhook: true,
          canRegisterWebhook: true,
        },
      })
    );
    confirmAdminShippingWebhook.mockResolvedValue({
      ...response({
        settings: { hasEnviaToken: true },
        readiness: {
          hasToken: true,
          hasSandboxWebhookToken: true,
          tested: true,
          webhookRegistered: true,
          webhookVerified: false,
          canConfirmWebhook: true,
        },
      }),
      message: 'Registro anotado. Ahora pulsa “Probar” en Envia.',
    });

    render(<ShippingProvidersCard />);

    const portal = await screen.findByRole('link', { name: 'Abrir portal de Envia' });
    expect(portal).toHaveAttribute(
      'href',
      'https://shipping-test.envia.com/settings/developers'
    );
    await user.click(screen.getByRole('button', { name: 'Ya registré la URL' }));
    await waitFor(() => expect(confirmAdminShippingWebhook).toHaveBeenCalledTimes(1));
    expect(
      (await screen.findAllByText('Esperando prueba de Envia')).length
    ).toBeGreaterThan(0);
  });

  it('muestra la confirmación únicamente cuando Envia ya comprobó el webhook', async () => {
    getAdminShippingSettings.mockResolvedValue(
      response({
        settings: { hasEnviaToken: true },
        readiness: {
          hasToken: true,
          tested: true,
          webhookRegistered: true,
          webhookVerified: true,
        },
      })
    );

    render(<ShippingProvidersCard />);

    expect(
      await screen.findByText('Webhook comprobado por Envia')
    ).toBeInTheDocument();
  });

  it('mantiene manual activo cuando Envia está seleccionada pero el webhook sigue pendiente', async () => {
    getAdminShippingSettings.mockResolvedValue(
      response({
        settings: {
          defaultProvider: 'envia',
          hasEnviaToken: true,
          hasSandboxWebhookToken: true,
        },
        readiness: {
          hasToken: true,
          hasSandboxWebhookToken: true,
          tested: true,
          webhookRegistered: true,
          webhookVerified: false,
          canActivateSandbox: false,
        },
      })
    );

    render(<ShippingProvidersCard />);

    expect(await screen.findByText('Pendiente: Envia Sandbox')).toBeInTheDocument();
    expect(screen.getByText('Activa por seguridad')).toBeInTheDocument();
    expect(
      screen.getByText(/Envia está seleccionada, pero todavía no opera/i)
    ).toBeInTheDocument();
    expect(screen.queryByText('Activo: Envia Sandbox')).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Cancelar Envia y seguir manual' })
    ).toBeInTheDocument();
  });

  it('muestra Envia como activa solo después de comprobar todas las condiciones', async () => {
    getAdminShippingSettings.mockResolvedValue(
      response({
        settings: {
          defaultProvider: 'envia',
          hasEnviaToken: true,
          hasSandboxWebhookToken: true,
        },
        readiness: {
          hasToken: true,
          hasSandboxWebhookToken: true,
          tested: true,
          webhookRegistered: true,
          webhookVerified: true,
          canActivateSandbox: true,
        },
      })
    );

    render(<ShippingProvidersCard />);

    expect(await screen.findByText('Activo: Envia Sandbox')).toBeInTheDocument();
    expect(screen.queryByText('Activa por seguridad')).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Desactivar API y volver a manual' })
    ).toBeInTheDocument();
  });

  it('bloquea Producción cuando BACKEND_URL pertenece a trycloudflare', async () => {
    getAdminShippingSettings.mockResolvedValue(
      response({
        settings: {
          enviaMode: 'production',
          hasEnviaToken: true,
          hasWebhookSecret: true,
        },
        readiness: {
          hasToken: true,
          hasWebhookSecret: true,
          tested: true,
          webhookRegistered: true,
          webhookVerified: true,
          webhookUrlReady: true,
          webhookUrlPermanent: false,
          temporaryWebhookUrl: true,
          canActivateProduction: false,
        },
      })
    );

    render(<ShippingProvidersCard />);

    expect(
      await screen.findByText(/trycloudflare\.com es temporal/i)
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Activar Producción' })
    ).toBeDisabled();
  });
});
