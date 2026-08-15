import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import OrderDetailCustomerBilling from './OrderDetailCustomerBilling';

afterEach(() => cleanup());

const baseOrder = {
  _id: 'order-customer-1',
  source: 'online',
  tags: [],
  customer: {
    name: 'María',
    lastname: 'Pérez',
    id: '123456789',
    documentType: 'CC',
    email: 'maria@example.co',
    phone: '3001234567',
    address: 'Calle 1',
    city: 'Bogotá',
  },
  billing: {
    personType: 'natural',
    documentType: 'CC',
    documentNumber: '123456789',
    email: 'maria@example.co',
    phone: '3001234567',
    address: 'Calle 1',
    city: 'Bogotá',
    country: 'Colombia',
  },
};

describe('OrderDetailCustomerBilling', () => {
  it('corrige el celular únicamente en la orden por defecto', async () => {
    const onSaveCustomerData = vi.fn().mockResolvedValue({});
    render(
      <OrderDetailCustomerBilling
        order={baseOrder}
        onSaveCustomerData={onSaveCustomerData}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Corregir datos' }));
    fireEvent.change(screen.getByLabelText('Celular'), {
      target: { value: '3109876543' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar corrección' }));

    await waitFor(() => expect(onSaveCustomerData).toHaveBeenCalledTimes(1));
    expect(onSaveCustomerData.mock.calls[0][0]).toMatchObject({
      customer: { phone: '3109876543' },
      syncCustomer: false,
    });
  });

  it('permite sincronizar una orden real con la ficha del cliente', async () => {
    const onSaveCustomerData = vi.fn().mockResolvedValue({});
    render(
      <OrderDetailCustomerBilling
        order={baseOrder}
        onSaveCustomerData={onSaveCustomerData}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Corregir datos' }));
    fireEvent.click(
      screen.getByRole('button', { name: 'Esta orden y ficha del cliente' })
    );
    fireEvent.click(screen.getByRole('button', { name: 'Guardar corrección' }));

    await waitFor(() => expect(onSaveCustomerData).toHaveBeenCalledTimes(1));
    expect(onSaveCustomerData.mock.calls[0][0].syncCustomer).toBe(true);
  });

  it('mantiene una orden DEMO fuera del CRM sin exponer mensajes técnicos', () => {
    render(
      <OrderDetailCustomerBilling
        order={{
          ...baseOrder,
          source: 'system',
          tags: ['demo', 'orders-trace'],
        }}
        onSaveCustomerData={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Corregir datos' }));
    expect(
      screen.getByRole('button', { name: 'Esta orden y ficha del cliente' })
    ).toBeDisabled();
    expect(screen.queryByText(/orden DEMO/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/probar WhatsApp/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/cliente real/i)).not.toBeInTheDocument();
  });
});
