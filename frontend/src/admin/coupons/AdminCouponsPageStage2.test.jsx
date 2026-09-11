import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createAdminCoupon,
  fetchAdminCoupons,
  fetchCouponCampaignMetadata,
  simulateAdminCoupon,
} from './api/adminCouponsApi';
import AdminCouponsPage from './AdminCouponsPage';

vi.mock('./api/adminCouponsApi', () => ({
  changeAdminCouponStatus: vi.fn(),
  createAdminCoupon: vi.fn(),
  deleteAdminCoupon: vi.fn(),
  fetchAdminCoupons: vi.fn(),
  fetchCouponCampaignMetadata: vi.fn(),
  simulateAdminCoupon: vi.fn(),
  updateAdminCoupon: vi.fn(),
}));

vi.mock('../../components/AppConfirmProvider', () => ({
  useAppConfirm: () => vi.fn().mockResolvedValue(true),
}));

const productId = '66b000000000000000000011';
const customerId = '66b000000000000000000012';
const branchId = '66b000000000000000000013';

beforeEach(() => {
  fetchAdminCoupons.mockResolvedValue({ rows: [], total: 0, page: 1, limit: 80, pages: 1 });
  fetchCouponCampaignMetadata.mockResolvedValue({
    products: [{ id: productId, title: 'Vestido Rosa', sku: 'VR-01', category: 'Vestidos', price: 100000 }],
    categories: ['Vestidos'],
    customers: [{ id: customerId, name: 'María Prueba', customerCode: 'CLI-001', documentNumber: '123456', ordersCount: 0 }],
    branches: [{ id: branchId, name: 'Sede Principal', code: 'PRINCIPAL', type: 'store' }],
  });
  simulateAdminCoupon.mockResolvedValue({
    validation: { valid: true, discount: { totalDiscountAmount: 10000 } },
    cart: { subtotal: 100000 },
  });
  createAdminCoupon.mockResolvedValue({ id: 'coupon-1' });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('Cupones Nivel Plus · Etapa 2', () => {
  it('selecciona productos, clientes, canales y sedes con opciones autoritativas', async () => {
    render(<AdminCouponsPage />);
    await screen.findByText('No hay cupones registrados');
    await waitFor(() => expect(fetchCouponCampaignMetadata).toHaveBeenCalled());
    fireEvent.click(screen.getByRole('button', { name: 'Nuevo cupón' }));
    fireEvent.change(screen.getByLabelText('Aplicar a'), { target: { value: 'products' } });

    fireEvent.click(screen.getAllByRole('checkbox', { name: /Vestido Rosa/ })[0]);
    fireEvent.click(screen.getByRole('checkbox', { name: /María Prueba/ }));
    fireEvent.click(screen.getByRole('checkbox', { name: /Sede Principal/ }));

    expect(screen.getAllByText('1 seleccionado(s)').length).toBeGreaterThan(0);
    expect(screen.getByText('Clientes, canales y sedes')).toBeInTheDocument();
  });

  it('simula con producto y reglas actuales sin guardar el cupón', async () => {
    render(<AdminCouponsPage />);
    await screen.findByText('No hay cupones registrados');
    await waitFor(() => expect(fetchCouponCampaignMetadata).toHaveBeenCalled());
    fireEvent.click(screen.getByRole('button', { name: 'Nuevo cupón' }));
    fireEvent.change(screen.getByLabelText('Producto de prueba'), { target: { value: productId } });
    fireEvent.click(screen.getByRole('button', { name: 'Probar reglas' }));

    await waitFor(() => expect(simulateAdminCoupon).toHaveBeenCalledWith(expect.objectContaining({
      items: [{ productId, quantity: 1 }],
      channel: 'web',
    })));
    expect(await screen.findByText(/Aplicable · descuento/)).toBeInTheDocument();
    expect(createAdminCoupon).not.toHaveBeenCalled();
  });
});
