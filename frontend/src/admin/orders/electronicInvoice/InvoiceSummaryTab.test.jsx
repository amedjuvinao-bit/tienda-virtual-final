import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../lib/api', () => ({
  default: { patch: vi.fn(), get: vi.fn() },
}));

import api from '../../../lib/api';
import InvoiceSummaryTab from './InvoiceSummaryTab';
import buildInvoiceModalData from '../../billing/buildInvoiceModalData';

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

  it('muestra la copia fiscal de la factura aunque la ficha de la orden cambie después', async () => {
    const issuedInvoice = {
      ...invoice,
      id: 'invoice-1',
      orderId: order._id,
      customer: {
        firstName: 'Amed',
        lastName: 'Barros',
        documentNumber: '0000000000',
      },
    };
    const changedOrder = {
      ...order,
      billing: {
        firstName: 'Otro',
        lastName: 'Apellido',
        documentNumber: '0000000000',
      },
      electronicInvoice: { id: 'invoice-1', status: 'validated' },
    };
    api.get.mockResolvedValueOnce({ data: changedOrder });

    const modalData = await buildInvoiceModalData(issuedInvoice);
    expect(modalData.invoice).toBe(issuedInvoice);
    render(<InvoiceSummaryTab {...modalData} />);

    expect(screen.getByText('Amed Barros')).toBeInTheDocument();
    expect(screen.getByText('Comprador registrado al emitir la factura')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('datos actuales de la orden son diferentes');
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
          name: order.customer.name,
          lastname: order.customer.lastname,
          id: order.customer.id,
          email: 'actualizado@example.invalid',
          emailOrPhone: 'actualizado@example.invalid',
          phone: order.customer.phone,
          address: order.customer.address,
          city: order.customer.city,
          department: order.customer.department,
          country: order.customer.country,
        },
        billing: {
          firstName: order.customer.name,
          lastName: order.customer.lastname,
          documentNumber: order.customer.id,
          email: 'actualizado@example.invalid',
          phone: order.customer.phone,
          address: order.customer.address,
          city: order.customer.city,
          department: order.customer.department,
          country: order.customer.country,
        },
      }
    );
    expect(
      await screen.findByText(/Datos actuales de la orden guardados/)
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
