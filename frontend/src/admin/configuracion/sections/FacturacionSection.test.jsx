import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FacturacionSection from './FacturacionSection';
import api from '../../../lib/api';

vi.mock('../../../lib/api', () => ({
  default: {
    get: vi.fn(),
    put: vi.fn(),
    post: vi.fn(),
  },
}));

const storedBilling = {
  fiscalInfo: {
    businessName: 'Tienda inicial',
    nit: '900123456',
    dv: '7',
  },
  dianResolution: {},
  dian: {
    enabled: false,
    mode: 'internal',
    environment: '2',
  },
  electronicProvider: {
    provider: 'mock',
  },
  legalTexts: {},
  taxes: {},
};

describe('FacturacionSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.get.mockImplementation((url) => {
      if (url === '/api/site-settings/admin') {
        return Promise.resolve({
          data: {
            billing: storedBilling,
            _billingRevision: 4,
          },
        });
      }

      if (url === '/api/site-settings/billing-history') {
        return Promise.resolve({
          data: {
            versions: [],
            updatedAt: null,
            updatedBy: '',
          },
        });
      }

      return Promise.reject(new Error(`GET inesperado: ${url}`));
    });

    api.put.mockImplementation((_url, payload) =>
      Promise.resolve({
        data: {
          billing: payload.billing,
          _billingRevision: 5,
        },
      })
    );
  });

  it('elimina el aviso después de editar y guardar correctamente', async () => {
    const user = userEvent.setup();
    render(<FacturacionSection />);

    const businessName = await screen.findByDisplayValue('Tienda inicial');
    expect(
      screen.queryByText('Tienes cambios sin guardar.')
    ).not.toBeInTheDocument();

    await user.clear(businessName);
    await user.type(businessName, 'Tienda actualizada');

    expect(
      screen.getByText('Tienes cambios sin guardar.')
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole('button', { name: '7. Resumen' })
    );
    await user.click(
      screen.getByRole('button', { name: 'Guardar configuración' })
    );

    await waitFor(() => {
      expect(api.put).toHaveBeenCalledTimes(1);
      expect(
        screen.queryByText('Tienes cambios sin guardar.')
      ).not.toBeInTheDocument();
    });

    expect(
      screen.getByText('Configuración de facturación guardada correctamente.')
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Guardar configuración' })
    ).toBeDisabled();
  });
});
