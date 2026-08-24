import React from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import EnviosSection from './EnviosSection';
import { fetchSiteSettings, saveSiteSettings } from '../../../lib/siteSettingsApi';

vi.mock('../../../lib/api', () => ({
  default: {
    get: vi.fn().mockResolvedValue({ data: [] }),
  },
}));

vi.mock('../../../lib/siteSettingsApi', () => ({
  fetchSiteSettings: vi.fn(),
  saveSiteSettings: vi.fn(),
}));

vi.mock('./envios/ShippingProvidersCard', () => ({
  default: () => <div data-testid="shipping-provider-card">Panel de transportadora</div>,
}));

function settings(overrides = {}) {
  return {
    theme: {
      global: {
        siteName: 'Rosa Boutique',
        envios: {
          active: true,
          mode: 'fixed',
          fixedPrice: 12000,
          estimatedTime: '2 a 5 días hábiles',
          freeShipping: { enabled: true, minimum: 200000 },
          fallback: { price: 20000, eta: '3 a 6 días hábiles' },
          zones: [],
          ...overrides,
        },
      },
    },
  };
}

describe('EnviosSection', () => {
  afterEach(cleanup);

  beforeEach(() => {
    vi.clearAllMocks();
    window.alert = vi.fn();
    fetchSiteSettings.mockResolvedValue(settings());
    saveSiteSettings.mockResolvedValue(settings());
  });

  it('separa el cobro del checkout de la configuración de la transportadora', async () => {
    const user = userEvent.setup();
    render(<EnviosSection />);

    expect(await screen.findByText('¿Cuánto cobrará la tienda?')).toBeInTheDocument();
    expect(screen.queryByTestId('shipping-provider-card')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Entrega del paquete/i }));
    expect(screen.getByTestId('shipping-provider-card')).toBeInTheDocument();
    expect(screen.queryByText('¿Cuánto cobrará la tienda?')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Cobro en checkout/i }));
    expect(screen.getByText('¿Cuánto cobrará la tienda?')).toBeInTheDocument();
  });

  it('permite configurar ciudades dentro de un panel compacto', async () => {
    const user = userEvent.setup();
    render(<EnviosSection />);

    await screen.findByText('¿Cuánto cobrará la tienda?');
    await user.click(screen.getByRole('button', { name: /Precio por ciudad/i }));
    await user.click(screen.getByRole('button', { name: '+ Agregar ciudad' }));

    expect(screen.getByText('Destino 1')).toBeInTheDocument();
    expect(screen.getByText('1 regla creada')).toBeInTheDocument();
    expect(screen.getByText('Si una ciudad no está en la lista')).toBeInTheDocument();
  });

  it('guarda las tarifas sin borrar las demás opciones globales', async () => {
    const user = userEvent.setup();
    render(<EnviosSection />);

    await screen.findByText('¿Cuánto cobrará la tienda?');
    await user.click(screen.getByRole('button', { name: 'Guardar tarifas' }));

    await waitFor(() => expect(saveSiteSettings).toHaveBeenCalledTimes(1));
    expect(saveSiteSettings.mock.calls[0][0].theme.global.siteName).toBe('Rosa Boutique');
    expect(saveSiteSettings.mock.calls[0][0].theme.global.envios).toMatchObject({
      active: true,
      mode: 'fixed',
      fixedPrice: 12000,
      estimatedTime: '2 a 5 días hábiles',
    });
  });
});
