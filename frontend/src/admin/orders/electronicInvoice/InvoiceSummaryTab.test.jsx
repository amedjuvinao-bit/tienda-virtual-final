import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../lib/api', () => ({
  default: { patch: vi.fn() },
}));

import api from '../../../lib/api';
import InvoiceSummaryTab from './InvoiceSummaryTab';

const order = {
  _id: 'order-invoice-summary-1',
  subtotal: 100000,
  shipping: 15000,
  total: 115000,
  taxes: { iva: { amount: 0 } },
  payment: {
    provider: 'wompi',
    providerLabel: 'Wompi',
    currency: 'COP',
  },
  customer: {
    name: 'Cliente',
    lastname: 'Prueba',
    id: '0000000000',
    email: 'cliente@example.invalid',
    emailOrPhone: 'cliente@example.invalid',
    phone: '3000000000',
    address: 'Dirección ficticia',
    city: 'Bogotá',
    department: 'Bogotá, D.C.',
    country: 'Colombia',
  },
};

const invoice = {
  status: 'validated',
  invoiceNumber: 'FV-DEMO-1',
  cufe: 'CUFE-DEMO-1',
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

beforeEach(() => {
  api.patch.mockReset();
  api.patch.mockResolvedValue({ data: { ok: true } });
});

describe('InvoiceSummaryTab composition', () => {
  it('conserva las tarjetas fiscales, el cliente y el resumen económico', () => {
    render(<InvoiceSummaryTab order={order} invoice={invoice} />);

    expect(screen.getByText('Validada')).toBeInTheDocument();
    expect(screen.getByText('FV-DEMO-1')).toBeInTheDocument();
    expect(screen.getByText('CUFE-DEMO-1')).toBeInTheDocument();
    expect(screen.getByText('Cliente Prueba')).toBeInTheDocument();
    expect(screen.getByText('Resumen económico')).toBeInTheDocument();
    expect(screen.getByText('Wompi')).toBeInTheDocument();
  });

  it('conserva el endpoint y la fotografía customer/billing al guardar', async () => {
    render(<InvoiceSummaryTab order={order} invoice={invoice} />);

    fireEvent.click(screen.getByRole('button', { name: 'Corregir datos' }));
    fireEvent.change(screen.getByLabelText('Correo'), {
      target: { value: 'actualizado@example.invalid' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    await waitFor(() => expect(api.patch).toHaveBeenCalledTimes(1));
    expect(api.patch).toHaveBeenCalledWith(
      '/api/orders/order-invoice-summary-1/customer-data',
      {
        customer: {
          ...order.customer,
          email: 'actualizado@example.invalid',
          emailOrPhone: 'actualizado@example.invalid',
        },
        billing: {
          ...order.customer,
          email: 'actualizado@example.invalid',
          emailOrPhone: 'actualizado@example.invalid',
        },
      }
    );
    expect(
      await screen.findByText('Datos de facturación actualizados correctamente.')
    ).toBeInTheDocument();
  });

  it('mantiene el error seguro cuando la orden no tiene identificador', async () => {
    render(<InvoiceSummaryTab order={{ ...order, _id: '' }} invoice={invoice} />);

    fireEvent.click(screen.getByRole('button', { name: 'Corregir datos' }));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    expect(
      await screen.findByText('No se encontró el ID de la orden.')
    ).toBeInTheDocument();
    expect(api.patch).not.toHaveBeenCalled();
  });

  it('conserva el mensaje funcional del backend cuando falla la corrección', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    api.patch.mockRejectedValueOnce({
      response: { data: { message: 'La corrección fiscal fue rechazada.' } },
    });
    render(<InvoiceSummaryTab order={order} invoice={invoice} />);

    fireEvent.click(screen.getByRole('button', { name: 'Corregir datos' }));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    expect(
      await screen.findByText('La corrección fiscal fue rechazada.')
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Guardar cambios' })).toBeEnabled();
    consoleError.mockRestore();
  });
});
