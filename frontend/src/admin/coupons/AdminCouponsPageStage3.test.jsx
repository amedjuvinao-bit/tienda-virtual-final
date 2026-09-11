import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  exportCouponRedemptions,
  fetchAdminCoupons,
  fetchCouponDashboard,
  fetchCouponOperations,
  fetchCouponRedemptions,
} from './api/adminCouponsApi';
import AdminCouponsPage from './AdminCouponsPage';

vi.mock('./api/adminCouponsApi', () => ({
  changeAdminCouponStatus: vi.fn(),
  createAdminCoupon: vi.fn(),
  deleteAdminCoupon: vi.fn(),
  exportCouponRedemptions: vi.fn(),
  fetchAdminCoupons: vi.fn(),
  fetchCouponCampaignMetadata: vi.fn().mockResolvedValue({ products: [], categories: [], customers: [], branches: [] }),
  fetchCouponDashboard: vi.fn(),
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

const coupon = {
  _id: '66b000000000000000000031', code: 'CUP-ETAPA3', name: 'Campaña trazable',
  type: 'fixed', value: 9000, minSubtotal: 0, status: 'active', active: true,
  effectiveStatus: 'active', usageCount: 7, usageLimit: 20, appliesTo: 'all',
};

beforeEach(() => {
  fetchAdminCoupons.mockResolvedValue({ rows: [coupon], total: 21, page: 1, limit: 20, pages: 2 });
  fetchCouponDashboard.mockResolvedValue({
    metrics: { active: 8, scheduled: 3, exhausted: 2, currentUses: 47 },
    alerts: [{ couponId: coupon._id, code: coupon.code, type: 'low_stock', remainingUses: 3 }],
  });
  fetchCouponOperations.mockResolvedValue({
    coupon, activity: { byStatus: { applied: { count: 1 }, reserved: { count: 0 }, released: { count: 0 }, cancelled: { count: 0 } }, totalDiscount: 9000 },
    audit: [{ id: 'audit-1', description: 'Editar cupón.', actor: 'propietario', success: true, createdAt: '2026-09-11T10:00:00.000Z' }],
  });
  fetchCouponRedemptions.mockResolvedValue({
    rows: [{
      id: 'redemption-1', status: 'applied', source: 'checkout', createdAt: '2026-09-11T10:15:00.000Z',
      order: { id: 'order-1', number: 'ORDER-251' }, customer: { id: 'customer-1', code: 'CLI-001' },
      branch: { id: 'branch-1', name: 'Sede Principal' }, totalDiscountAmount: 9000,
    }],
    total: 1, page: 1, limit: 10, pages: 1,
  });
  exportCouponRedemptions.mockResolvedValue({ filename: 'redenciones.csv' });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('Cupones Nivel Plus · Etapa 3', () => {
  it('muestra métricas y alertas globales calculadas por el servidor', async () => {
    render(<AdminCouponsPage />);
    expect(await screen.findByText('CUP-ETAPA3')).toBeInTheDocument();
    expect(screen.getByText('47')).toBeInTheDocument();
    expect(screen.getByText(/quedan 3 uso/)).toBeInTheDocument();
    expect(fetchCouponDashboard).toHaveBeenCalledTimes(1);
  });

  it('pagina en servidor y exporta respetando los filtros visibles', async () => {
    render(<AdminCouponsPage />);
    expect(await screen.findByText('CUP-ETAPA3')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Siguiente/ }));
    await waitFor(() => expect(fetchAdminCoupons).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2, limit: 20 })));
    fireEvent.click(screen.getByRole('button', { name: 'Exportar usos' }));
    await waitFor(() => expect(exportCouponRedemptions).toHaveBeenCalledWith(expect.objectContaining({ q: '', type: '', effectiveStatus: '' })));
  });

  it('abre la trazabilidad con orden, cliente, sede, descuento y auditoría', async () => {
    render(<AdminCouponsPage />);
    expect(await screen.findByText('CUP-ETAPA3')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Actividad' }));
    expect(await screen.findByRole('dialog', { name: 'Actividad del cupón' })).toBeInTheDocument();
    expect(await screen.findByText('ORDER-251')).toBeInTheDocument();
    expect(screen.getByText('CLI-001')).toBeInTheDocument();
    expect(screen.getByText('Sede Principal')).toBeInTheDocument();
    expect(screen.getByText('Editar cupón.')).toBeInTheDocument();
    expect(fetchCouponRedemptions).toHaveBeenCalledWith(coupon._id, expect.objectContaining({ page: 1, limit: 10 }));
  });
});
