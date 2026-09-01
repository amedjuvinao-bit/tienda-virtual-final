import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../api/adminCustomersApi', () => ({
  createAdminCustomer: vi.fn(),
  createAdminCustomerFollowUp: vi.fn(),
  createAdminCustomerSavedSegment: vi.fn(),
  deleteAdminCustomerSavedSegment: vi.fn(),
  deleteAdminCustomerFollowUp: vi.fn(),
  getAdminCustomer: vi.fn(),
  getAdminCustomer360: vi.fn(),
  getAdminCustomerCrmAssignees: vi.fn(),
  getAdminCustomerCrmQueue: vi.fn(),
  getAdminCustomerFollowUps: vi.fn(),
  getAdminCustomerSavedSegments: vi.fn(),
  getAdminCustomers: vi.fn(),
  recordAdminCustomerFollowUpResult: vi.fn(),
  updateAdminCustomer: vi.fn(),
  updateAdminCustomerFollowUp: vi.fn(),
}));

import {
  getAdminCustomer,
  getAdminCustomer360,
  getAdminCustomerCrmAssignees,
  getAdminCustomerCrmQueue,
  getAdminCustomerFollowUps,
  getAdminCustomerSavedSegments,
  getAdminCustomers,
} from '../api/adminCustomersApi';
import AdminCustomersPageTabbed from './AdminCustomersPageTabbed';

function responseForPage(page) {
  return {
    ok: true,
    page,
    pages: 3,
    limit: 25,
    total: 60,
    summary: {
      totalCustomers: 60,
      totalSpent: 0,
      totalOrders: 0,
      posCustomers: 0,
      webCustomers: 0,
      withPurchases: 0,
      withEmail: 0,
    },
    customers: [
      {
        id: `customer-${page}`,
        customerCode: `CLI-${page}`,
        fullName: `Cliente página ${page}`,
        status: 'active',
        source: 'admin',
        stats: {},
      },
    ],
  };
}

afterEach(() => cleanup());

beforeEach(() => {
  vi.clearAllMocks();
  getAdminCustomers.mockImplementation(({ page }) =>
    Promise.resolve(responseForPage(page))
  );
  getAdminCustomer.mockImplementation((customerId) => Promise.resolve({
    ok: true,
    customer: {
      id: customerId,
      customerCode: 'CLI-1',
      fullName: 'Cliente página 1',
      status: 'active',
      source: 'admin',
      stats: {},
    },
    recentOrders: [],
  }));
  getAdminCustomerFollowUps.mockResolvedValue({ ok: true, followUps: [] });
  getAdminCustomerSavedSegments.mockResolvedValue({ ok: true, segments: [] });
  getAdminCustomerCrmAssignees.mockResolvedValue({ ok: true, assignees: [] });
  getAdminCustomerCrmQueue.mockResolvedValue({
    ok: true,
    page: 1,
    pages: 1,
    total: 0,
    summary: {
      pending: 0,
      overdue: 0,
      today: 0,
      upcoming: 0,
      unscheduled: 0,
    },
    followUps: [],
  });
  getAdminCustomer360.mockResolvedValue({
    ok: true,
    access: {
      orders: true,
      payments: true,
      billing: true,
      returns: true,
      shipping: true,
      carts: true,
      storeCredit: true,
      activity: true,
    },
    coverage: { totalOrders: 1, loadedOrders: 1, truncated: false },
    summary: {
      payments: {
        paid: 1,
        pending: 0,
        failed: 0,
        attempts: 1,
        declinedAttempts: 0,
        reconciliationRequired: 0,
      },
    },
    payments: [
      {
        id: 'order-1',
        orderId: 'order-1',
        orderNumber: 'ORD-360-001',
        status: 'paid',
        provider: 'wompi',
        amount: 120000,
        attempts: [],
      },
    ],
    activity: [],
  });
});

describe('AdminCustomersPageTabbed Etapa 1', () => {
  it('permite recorrer páginas posteriores a los primeros clientes', async () => {
    render(<AdminCustomersPageTabbed />);

    expect(await screen.findByText('Página 1 de 3')).toBeInTheDocument();
    expect(screen.getByText('Cliente página 1')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));

    await waitFor(() => {
      expect(getAdminCustomers).toHaveBeenLastCalledWith(
        expect.objectContaining({ page: 2, limit: 25 })
      );
    });
    expect(await screen.findByText('Cliente página 2')).toBeInTheDocument();
    expect(screen.getByText('Página 2 de 3')).toBeInTheDocument();
  });

  it('reinicia en la primera página al cambiar la búsqueda', async () => {
    render(<AdminCustomersPageTabbed />);
    expect(await screen.findByText('Página 1 de 3')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
    expect(await screen.findByText('Página 2 de 3')).toBeInTheDocument();

    fireEvent.change(
      screen.getByPlaceholderText('Buscar por nombre, celular, correo o documento'),
      { target: { value: 'María' } }
    );

    await waitFor(() => {
      expect(getAdminCustomers).toHaveBeenLastCalledWith(
        expect.objectContaining({ page: 1, q: 'María' })
      );
    });
  });

  it('carga bajo demanda la ficha 360 al abrir Pagos', async () => {
    render(<AdminCustomersPageTabbed />);

    expect(await screen.findByText('Cliente página 1')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Detalle' }));

    expect(await screen.findByText('Ficha comercial del cliente')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Pagos' }));

    expect(await screen.findByText('Pagos del cliente')).toBeInTheDocument();
    expect(screen.getByText('Orden ORD-360-001')).toBeInTheDocument();
    expect(getAdminCustomer360).toHaveBeenCalledWith(
      'customer-1',
      { historyLimit: 100 }
    );
  });

  it('solicita hasta 30 compras confirmadas y conserva el total comercial', async () => {
    getAdminCustomer.mockResolvedValueOnce({
      ok: true,
      customer: {
        id: 'customer-1',
        customerCode: 'CLI-1',
        fullName: 'Cliente página 1',
        status: 'active',
        source: 'admin',
        stats: { ordersCount: 11 },
      },
      recentOrders: Array.from({ length: 11 }, (_, index) => ({
        id: `order-${index + 1}`,
        orderNumber: String(index + 1).padStart(6, '0'),
        status: 'paid',
        total: 100000,
        items: [],
      })),
    });

    render(<AdminCustomersPageTabbed />);
    expect(await screen.findByText('Cliente página 1')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Detalle' }));

    await waitFor(() => {
      expect(getAdminCustomer).toHaveBeenCalledWith(
        'customer-1',
        { ordersLimit: 30 }
      );
    });

    fireEvent.click(screen.getByRole('button', { name: 'Compras' }));
    expect(await screen.findByText('11 compra(s)')).toBeInTheDocument();
  });

  it('bloquea la edición visual de PII cuando el backend entrega una ficha enmascarada', async () => {
    getAdminCustomer.mockResolvedValueOnce({
      ok: true,
      customer: {
        id: 'customer-1',
        customerCode: 'CLI-1',
        fullName: 'Cliente página 1',
        phone: '••••••4567',
        email: 'cl***@example.com',
        documentNumber: '••••6789',
        address: '[DIRECCIÓN PROTEGIDA]',
        status: 'active',
        source: 'admin',
        stats: {},
      },
      access: { sensitive: false, masked: true },
      recentOrders: [],
    });

    render(<AdminCustomersPageTabbed />);
    expect(await screen.findByText('Cliente página 1')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Detalle' }));
    expect(await screen.findByText('Ficha comercial del cliente')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Datos' }));

    expect(screen.getByDisplayValue('••••••4567')).toBeDisabled();
    expect(screen.getByDisplayValue('cl***@example.com')).toBeDisabled();
    expect(screen.getByText(/necesita `customers:sensitive`/i)).toBeInTheDocument();
  });
});
