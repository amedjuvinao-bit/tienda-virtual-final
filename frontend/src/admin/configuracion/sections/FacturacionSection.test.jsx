import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
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

const initialBilling = {
  fiscalInfo: {
    businessName: 'Tienda inicial',
    nit: '900123456',
    dv: '7',
    billingEmail: 'facturacion@tienda.com',
    address: 'Calle 1 # 2-3',
    municipalityCode: '47980',
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
  legalTexts: {
    invoiceLegalText: 'Texto anterior',
    internalReceiptNote: 'Nota anterior',
  },
  taxes: {},
};

describe('FacturacionSection', () => {
  let persistedBilling;
  let billingRevision;

  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    persistedBilling = structuredClone(initialBilling);
    billingRevision = 4;

    api.get.mockImplementation((url) => {
      if (url.startsWith('/api/site-settings/admin')) {
        return Promise.resolve({
          data: {
            billing: structuredClone(persistedBilling),
            _billingRevision: billingRevision,
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

    api.put.mockImplementation((_url, payload) => {
      persistedBilling = structuredClone(payload.billing);
      billingRevision += 1;
      return Promise.resolve({
        data: {
          ok: true,
        },
      });
    });
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

    await user.click(screen.getByRole('button', { name: 'Siguiente' }));

    await waitFor(() => {
      expect(api.put).toHaveBeenCalledTimes(1);
      expect(
        api.get.mock.calls.filter(([url]) =>
          url.startsWith('/api/site-settings/admin?refresh=')
        )
      ).toHaveLength(1);
      expect(
        screen.queryByText('Tienes cambios sin guardar.')
      ).not.toBeInTheDocument();
    });

    expect(
      screen.getByText(
        'Datos fiscales fue validado y guardado correctamente.'
      )
    ).toBeInTheDocument();
    expect(screen.getByText('Paso 2 de 7')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Guardar cambios' })
    ).not.toBeInTheDocument();
  });

  it('guarda los textos legales y los conserva después de recargar', async () => {
    const user = userEvent.setup();
    const view = render(<FacturacionSection />);

    await user.click(
      await screen.findByRole('button', { name: '6. Textos legales' })
    );

    const invoiceLegalText = screen.getByLabelText(
      'Texto legal para factura'
    );
    const internalReceiptNote = screen.getByLabelText(
      'Nota para comprobantes o documentos internos'
    );

    await user.clear(invoiceLegalText);
    await user.type(invoiceLegalText, 'Nuevo texto legal confirmado');
    await user.clear(internalReceiptNote);
    await user.type(internalReceiptNote, 'Nueva nota interna confirmada');
    await user.click(screen.getByRole('button', { name: 'Siguiente' }));

    await waitFor(() => {
      expect(api.put).toHaveBeenCalledWith(
        '/api/site-settings',
        expect.objectContaining({
          billing: expect.objectContaining({
            legalTexts: {
              invoiceLegalText: 'Nuevo texto legal confirmado',
              internalReceiptNote: 'Nueva nota interna confirmada',
            },
          }),
        })
      );
      expect(
        screen.queryByText('Tienes cambios sin guardar.')
      ).not.toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: 'Finalizar configuración' })
      ).toBeInTheDocument();
    });

    view.unmount();
    render(<FacturacionSection />);
    await user.click(
      await screen.findByRole('button', { name: '6. Textos legales' })
    );

    expect(
      screen.getByDisplayValue('Nuevo texto legal confirmado')
    ).toBeInTheDocument();
    expect(
      screen.getByDisplayValue('Nueva nota interna confirmada')
    ).toBeInTheDocument();
  });

  it('no avanza ni guarda cuando la etapa actual tiene errores', async () => {
    const user = userEvent.setup();
    render(<FacturacionSection />);

    const businessName = await screen.findByDisplayValue('Tienda inicial');
    await user.clear(businessName);
    await user.click(screen.getByRole('button', { name: 'Siguiente' }));

    expect(api.put).not.toHaveBeenCalled();
    expect(
      screen.getByText('Revisa el paso 1: Datos fiscales.')
    ).toBeInTheDocument();
    expect(
      screen.getByText('Completa: Razón social.')
    ).toBeInTheDocument();
    expect(
      screen.getByText('Paso 1 de 7')
    ).toBeInTheDocument();
  });

  it('realiza la validación completa antes de finalizar', async () => {
    const user = userEvent.setup();
    render(<FacturacionSection />);

    await user.click(
      await screen.findByRole('button', { name: '7. Resumen' })
    );
    await user.click(
      screen.getByRole('button', { name: 'Finalizar configuración' })
    );

    expect(
      screen.getByText(
        'Revisión final completada. La configuración de facturación quedó guardada.'
      )
    ).toBeInTheDocument();
    expect(api.put).not.toHaveBeenCalled();
  });
});
