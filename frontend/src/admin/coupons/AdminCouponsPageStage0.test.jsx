import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  changeAdminCouponStatus,
  fetchAdminCoupons,
} from './api/adminCouponsApi';
import AdminCouponsPage from './AdminCouponsPage';

const confirmAction = vi.hoisted(() => vi.fn());

vi.mock('./api/adminCouponsApi', () => ({
  changeAdminCouponStatus: vi.fn(),
  createAdminCoupon: vi.fn(),
  deleteAdminCoupon: vi.fn(),
  fetchAdminCoupons: vi.fn(),
  fetchCouponCampaignMetadata: vi.fn().mockResolvedValue({ products: [], categories: [], customers: [], branches: [] }),
  simulateAdminCoupon: vi.fn(),
  updateAdminCoupon: vi.fn(),
}));

vi.mock('../../components/AppConfirmProvider', () => ({
  useAppConfirm: () => confirmAction,
}));

const expiredCoupon = {
  _id: '66b000000000000000000001',
  code: 'CUP-VENCIDO',
  name: 'Cupón vencido',
  type: 'percentage',
  value: 10,
  minSubtotal: 0,
  maxDiscountAmount: null,
  status: 'active',
  active: true,
  effectiveStatus: 'expired',
  startsAt: '2026-08-01T00:00:00.000Z',
  endsAt: '2026-08-31T23:59:59.000Z',
  usageCount: 1,
  usageLimit: 10,
  perCustomerLimit: 1,
  appliesTo: 'all',
  categories: [],
  excludedCategories: [],
  tags: [],
};

const scheduledCoupon = {
  ...expiredCoupon,
  _id: '66b000000000000000000002',
  code: 'CUP-PROGRAMADO',
  name: 'Cupón programado',
  effectiveStatus: 'scheduled',
  startsAt: '2026-10-01T00:00:00.000Z',
  endsAt: '2026-10-31T23:59:59.000Z',
  usageCount: 0,
};

beforeEach(() => {
  confirmAction.mockResolvedValue(true);
  fetchAdminCoupons.mockResolvedValue({
    rows: [expiredCoupon, scheduledCoupon],
    total: 2,
    page: 1,
    limit: 80,
    pages: 1,
  });
  changeAdminCouponStatus.mockResolvedValue({
    ...scheduledCoupon,
    active: false,
    status: 'inactive',
    effectiveStatus: 'inactive',
  });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('Cupones Nivel Plus · Etapa 0', () => {
  it('consulta el estado efectivo seleccionado en el servidor', async () => {
    render(<AdminCouponsPage />);
    expect(await screen.findByText('CUP-VENCIDO')).toBeInTheDocument();

    fireEvent.change(screen.getByRole('combobox', { name: 'Filtrar por estado' }), {
      target: { value: 'expired' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Filtrar' }));

    await waitFor(() => {
      expect(fetchAdminCoupons).toHaveBeenLastCalledWith(
        expect.objectContaining({ effectiveStatus: 'expired' })
      );
    });
  });

  it('envía los vencidos a corregir vigencia en lugar de simular una reactivación', async () => {
    render(<AdminCouponsPage />);
    expect(await screen.findByText('CUP-VENCIDO')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Editar vigencia' }));
    expect(await screen.findByRole('heading', { name: 'CUP-VENCIDO' })).toBeInTheDocument();
    expect(changeAdminCouponStatus).not.toHaveBeenCalled();
  });

  it('permite desactivar correctamente un cupón programado', async () => {
    render(<AdminCouponsPage />);
    expect(await screen.findByText('CUP-PROGRAMADO')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Desactivar' }));
    await waitFor(() => {
      expect(changeAdminCouponStatus).toHaveBeenCalledWith(
        scheduledCoupon._id,
        { active: false, status: 'inactive' }
      );
    });
  });

  it('habilita cupones por producto porque la Etapa 2 ya dispone de selector autoritativo', async () => {
    render(<AdminCouponsPage />);
    expect(await screen.findByText('CUP-VENCIDO')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Nuevo cupón' }));
    expect(screen.getByRole('option', { name: 'Productos específicos' })).toBeEnabled();
  });
});
