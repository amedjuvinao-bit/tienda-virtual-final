import React from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import EnviosSection from './EnviosSection';
import {
  fetchShippingRates,
  saveShippingRates,
} from '../api/shippingRatesApi';

vi.mock('../../../lib/api', () => ({
  default: {
    get: vi.fn().mockResolvedValue({ data: [] }),
  },
}));

vi.mock('../api/shippingRatesApi', () => ({
  fetchShippingRates: vi.fn(),
  saveShippingRates: vi.fn(),
}));

vi.mock('./envios/ShippingProvidersCard', () => ({
  default: () => <div data-testid="shipping-provider-card">Panel de transportadora</div>,
}));

function settings(overrides = {}) {
  return {
    ok: true,
    revision: 4,
    readiness: { ready: true, ratesReady: true, originReady: true, zoneCount: 0 },
    store: {
      name: 'Rosa Boutique',
      address: 'Calle 12',
      city: 'Ciénaga',
      department: 'Magdalena',
    },
    settings: {
      active: true,
      mode: 'fixed',
      fixedPrice: 12000,
      estimatedTime: '2 a 5 días hábiles',
      freeShipping: { enabled: true, minimum: 200000 },
      fallback: { price: 20000, eta: '3 a 6 días hábiles' },
      zones: [],
      ...overrides,
    },
  };
}

describe('EnviosSection', () => {
  afterEach(cleanup);

  beforeEach(() => {
    vi.clearAllMocks();
    fetchShippingRates.mockResolvedValue(settings());
    saveShippingRates.mockResolvedValue({
      ...settings({ fixedPrice: 13000 }),
      revision: 5,
      message: 'Tarifas guardadas.',
    });
  });

  it('separa el cobro del checkout de la configuración de la transportadora', async () => {
    const user = userEvent.setup();
    render(<EnviosSection />);

    expect(await screen.findByText('¿Cuánto cobrará la tienda?')).toBeInTheDocument();
    expect(screen.queryByTestId('shipping-provider-card')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Cobro en checkout/i })).toHaveClass(
      'shipping-nav-option'
    );
    expect(screen.getByRole('button', { name: /Cobro en checkout/i })).toHaveAttribute(
      'data-active',
      'true'
    );

    await user.click(screen.getByRole('button', { name: /Entrega del paquete/i }));
    expect(screen.getByTestId('shipping-provider-card')).toBeInTheDocument();
    expect(screen.queryByText('¿Cuánto cobrará la tienda?')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Entrega del paquete/i })).toHaveAttribute(
      'data-active',
      'true'
    );

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

  it('guarda mediante el endpoint protegido con control de versión', async () => {
    const user = userEvent.setup();
    render(<EnviosSection />);

    await screen.findByText('¿Cuánto cobrará la tienda?');
    const fixedPrice = screen.getByLabelText('Tarifa fija general');
    await user.clear(fixedPrice);
    await user.type(fixedPrice, '13000');
    await user.click(screen.getByRole('button', { name: 'Guardar tarifas' }));

    await waitFor(() => expect(saveShippingRates).toHaveBeenCalledTimes(1));
    const payload = saveShippingRates.mock.calls[0][0];
    expect(payload.revision).toBe(4);
    expect(payload.settings).toMatchObject({
      active: true,
      mode: 'fixed',
      fixedPrice: 13000,
      estimatedTime: '2 a 5 días hábiles',
    });
    expect(await screen.findByText('Tarifas guardadas.')).toBeInTheDocument();
    expect(screen.getAllByText('Versión 5')).toHaveLength(2);
  });

  it('bloquea el envío gratis accidental cuando no hay compra mínima', async () => {
    const user = userEvent.setup();
    fetchShippingRates.mockResolvedValue(settings({
      freeShipping: { enabled: false, minimum: null },
    }));
    render(<EnviosSection />);

    await screen.findByText('¿Cuánto cobrará la tienda?');
    await user.click(screen.getByRole('checkbox', { name: /Envío gratis/i }));
    await user.click(screen.getByRole('button', { name: 'Guardar tarifas' }));

    expect(await screen.findByText('Define una compra mínima mayor que cero.')).toBeInTheDocument();
    expect(saveShippingRates).not.toHaveBeenCalled();
  });
});
