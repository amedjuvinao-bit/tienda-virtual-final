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
  exportCouponRedemptions: vi.fn(),
  fetchAdminCoupons: vi.fn(),
  fetchCouponDashboard: vi.fn().mockResolvedValue({ metrics: {}, alerts: [] }),
  fetchCouponCampaignMetadata: vi.fn(),
  fetchCouponOperations: vi.fn(),
  fetchCouponRedemptions: vi.fn(),
  simulateAdminCoupon: vi.fn(),
  updateAdminCoupon: vi.fn(),
}));

vi.mock('../../components/AppConfirmProvider', () => ({
  useAppConfirm: () => vi.fn().mockResolvedValue(true),
}));

vi.mock('../security/useAdminPermissions', () => ({
  default: () => ({ can: () => true }),
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
    fireEvent.change(screen.getByLabelText(/Nombre de la campaña/), { target: { value: 'Campaña dirigida' } });
    fireEvent.click(screen.getByRole('button', { name: /Siguiente: productos/ }));
    fireEvent.click(screen.getByRole('radio', { name: /Productos concretos/ }));

    fireEvent.click(screen.getAllByRole('checkbox', { name: /Vestido Rosa/ })[0]);
    fireEvent.click(screen.getByRole('button', { name: /Siguiente: público/ }));
    fireEvent.click(screen.getByRole('radio', { name: /Clientes concretos/ }));
    fireEvent.click(screen.getByRole('checkbox', { name: /María Prueba/ }));
    fireEvent.click(screen.getByRole('checkbox', { name: /Limitar a sedes concretas/ }));
    fireEvent.click(screen.getByRole('checkbox', { name: /Sede Principal/ }));

    expect(screen.getByText('1 cliente(s) seleccionado(s)')).toBeInTheDocument();
    expect(screen.getByText('Clientes, canales y sedes')).toBeInTheDocument();
  });

  it('simula con producto y reglas actuales sin guardar el cupón', async () => {
    render(<AdminCouponsPage />);
    await screen.findByText('No hay cupones registrados');
    await waitFor(() => expect(fetchCouponCampaignMetadata).toHaveBeenCalled());
    fireEvent.click(screen.getByRole('button', { name: 'Nuevo cupón' }));
    fireEvent.change(screen.getByLabelText(/Nombre de la campaña/), { target: { value: 'Campaña simulada' } });
    fireEvent.click(screen.getByRole('button', { name: /Siguiente: productos/ }));
    fireEvent.click(screen.getByRole('button', { name: /Siguiente: público/ }));
    fireEvent.click(screen.getByRole('button', { name: /Siguiente: revisar/ }));
    fireEvent.change(screen.getByLabelText('Producto de prueba'), { target: { value: productId } });
    fireEvent.click(screen.getByRole('button', { name: 'Comprobar cupón' }));

    await waitFor(() => expect(simulateAdminCoupon).toHaveBeenCalledWith(expect.objectContaining({
      items: [{ productId, quantity: 1 }],
      channel: 'web',
    })));
    expect(await screen.findByText(/Sí aplica · descuento/)).toBeInTheDocument();
    expect(createAdminCoupon).not.toHaveBeenCalled();
  });

  it('muestra un recorrido guiado y oculta las exclusiones hasta que se solicitan', async () => {
    render(<AdminCouponsPage />);
    await screen.findByText('No hay cupones registrados');
    fireEvent.click(screen.getByRole('button', { name: 'Nuevo cupón' }));

    expect(screen.getByText('¿Qué beneficio recibirá el cliente?')).toBeInTheDocument();
    expect(screen.queryByText('Productos que nunca participan')).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Nombre de la campaña/), { target: { value: 'Campaña clara' } });
    fireEvent.click(screen.getByRole('button', { name: /Siguiente: productos/ }));
    expect(screen.getByText('¿En qué productos funcionará?')).toBeInTheDocument();
    expect(screen.queryByText('Productos que nunca participan')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Necesito excluir/ }));
    expect(screen.getByText('Productos que nunca participan')).toBeInTheDocument();
  });
});
