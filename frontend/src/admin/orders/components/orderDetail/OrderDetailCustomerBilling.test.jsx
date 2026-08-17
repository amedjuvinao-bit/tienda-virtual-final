import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../../lib/api', () => ({
  default: {
    get: vi.fn(),
  },
}));

import api from '../../../../lib/api';
import OrderDetailCustomerBilling from './OrderDetailCustomerBilling';

afterEach(() => cleanup());

beforeEach(() => {
  api.get.mockImplementation((url) => {
    if (url === '/api/geo/regions') {
      return Promise.resolve({
        data: [{ code: '47', name: 'Magdalena' }],
      });
    }

    if (url === '/api/geo/cities') {
      return Promise.resolve({
        data: [{ code: '47980', name: 'Zona Bananera' }],
      });
    }

    return Promise.resolve({ data: [] });
  });
});

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
    city: 'Zona Bananera',
    municipalityCode: '47980',
    municipalityId: '47980',
    department: 'Magdalena',
    departmentCode: '47',
    countryCode: 'CO',
  },
  billing: {
    personType: 'natural',
    documentType: 'CC',
    documentNumber: '123456789',
    email: 'maria@example.co',
    phone: '3001234567',
    address: 'Calle 1',
    city: 'Zona Bananera',
    cityCode: '47980',
    municipalityCode: '47980',
    department: 'Magdalena',
    departmentCode: '47',
    country: 'Colombia',
    countryCode: 'CO',
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

  it('recupera y guarda departamento y municipio con códigos DIVIPOLA', async () => {
    const onSaveCustomerData = vi.fn().mockResolvedValue({});
    const legacyOrder = {
      ...baseOrder,
      customer: {
        ...baseOrder.customer,
        municipalityCode: '',
        municipalityId: '',
        departmentCode: '',
      },
      billing: {
        ...baseOrder.billing,
        cityCode: '',
        municipalityCode: '',
        departmentCode: '',
      },
    };

    render(
      <OrderDetailCustomerBilling
        order={legacyOrder}
        onSaveCustomerData={onSaveCustomerData}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Corregir datos' }));

    await waitFor(() => {
      expect(screen.getByLabelText('Departamento fiscal')).toHaveValue('47');
      expect(screen.getByLabelText('Municipio fiscal')).toHaveValue('47980');
    });

    fireEvent.click(screen.getByRole('button', { name: 'Guardar corrección' }));

    await waitFor(() => expect(onSaveCustomerData).toHaveBeenCalledTimes(1));
    expect(onSaveCustomerData.mock.calls[0][0]).toMatchObject({
      billing: {
        department: 'Magdalena',
        departmentCode: '47',
        city: 'Zona Bananera',
        cityCode: '47980',
        municipalityCode: '47980',
      },
    });
  });
});
