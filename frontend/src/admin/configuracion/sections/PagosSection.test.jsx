import React from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import PagosSection from './PagosSection';
import {
  fetchPaymentSettings,
  savePaymentSettings,
  testWompiMerchant,
} from '../api/paymentSettingsApi';

vi.mock('../api/paymentSettingsApi', () => ({
  fetchPaymentSettings: vi.fn(),
  savePaymentSettings: vi.fn(),
  testWompiMerchant: vi.fn(),
}));

const SETTINGS = {
  active: true,
  provider: 'wompi',
  mode: 'sandbox',
  currency: 'COP',
  checkoutLabel: 'Paga con Wompi',
  successMessage: 'Recibimos tu pago.',
  enableWebhook: false,
  credentials: {
    wompi: { publicKey: 'pub_test_value', privateKey: '', integrityKey: '', webhookSecret: '' },
    payu: { merchantId: '', accountId: '', apiLogin: '', apiKey: '' },
    manual: { accountHolder: '', bankName: '', accountType: '', accountNumber: '', paymentInstructions: '' },
  },
};

function response(overrides = {}) {
  return {
    ok: true,
    settings: { ...SETTINGS, ...overrides },
    credentialStatus: {
      wompi: { privateKey: true, integrityKey: true, webhookSecret: false },
      payu: { apiLogin: false, apiKey: false },
      manual: { accountNumber: false },
    },
    readiness: {
      wompi: { ready: true, completed: 3, required: 3, missing: [] },
      payu: { ready: false, completed: 0, required: 4, missing: ['merchantId'] },
      manual: { ready: false, completed: 0, required: 4, missing: ['accountHolder'] },
    },
    revision: 3,
    updatedAt: '2026-09-16T10:00:00.000Z',
    updatedBy: 'owner',
  };
}

describe('PagosSection', () => {
  afterEach(cleanup);

  beforeEach(() => {
    vi.clearAllMocks();
    fetchPaymentSettings.mockResolvedValue(response());
    savePaymentSettings.mockResolvedValue(response({ checkoutLabel: 'Pago seguro' }));
    testWompiMerchant.mockResolvedValue({ ok: true, merchant: { name: 'Rosa Boutique' } });
  });

  it('muestra únicamente proveedores respaldados por el checkout', async () => {
    render(<PagosSection />);
    expect(await screen.findByText('Proveedor y ambiente')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Wompi/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /PayU/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Pago manual/i })).toBeInTheDocument();
    expect(screen.queryByText('Bold')).not.toBeInTheDocument();
    expect(screen.queryByText('Mercado Pago')).not.toBeInTheDocument();
  });

  it('reconoce secretos guardados sin exponer sus valores', async () => {
    const user = userEvent.setup();
    render(<PagosSection />);
    await screen.findByText('Proveedor y ambiente');
    await user.click(screen.getByRole('button', { name: 'Abrir Credenciales' }));

    expect(screen.getByLabelText('Llave privada')).toHaveValue('');
    expect(screen.getByLabelText('Llave privada')).toHaveAttribute('placeholder', '•••••••• configurado');
    expect(screen.getAllByText(/Configurado y protegido/i)).toHaveLength(2);
    expect(screen.queryByDisplayValue('prv_test_value')).not.toBeInTheDocument();
  });

  it('guarda por la ruta dedicada con la revisión vigente', async () => {
    const user = userEvent.setup();
    render(<PagosSection />);
    await screen.findByText('Proveedor y ambiente');
    await user.click(screen.getByRole('button', { name: 'Abrir Checkout' }));
    const label = screen.getByLabelText('Texto visible en checkout');
    await user.clear(label);
    await user.type(label, 'Pago seguro');
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    await waitFor(() => expect(savePaymentSettings).toHaveBeenCalledTimes(1));
    expect(savePaymentSettings).toHaveBeenCalledWith({
      settings: { ...SETTINGS, checkoutLabel: 'Pago seguro', confirmProduction: false },
      revision: 3,
    });
    expect(await screen.findByText(/configuración guardada/i)).toBeInTheDocument();
  });

  it('prueba Wompi con la llave pública sin enviar secretos', async () => {
    const user = userEvent.setup();
    render(<PagosSection />);
    await screen.findByText('Proveedor y ambiente');
    await user.click(screen.getByRole('button', { name: 'Abrir Credenciales' }));
    await user.click(screen.getByRole('button', { name: /Probar conexión/i }));

    await waitFor(() => expect(testWompiMerchant).toHaveBeenCalledWith({
      mode: 'sandbox',
      publicKey: 'pub_test_value',
    }));
    expect(await screen.findByText(/Conexión aprobada con Rosa Boutique/i)).toBeInTheDocument();
  });
});
