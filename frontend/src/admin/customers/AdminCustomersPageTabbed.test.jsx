import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../api/adminCustomersApi', () => ({
  createAdminCustomer: vi.fn(),
  createAdminCustomerFollowUp: vi.fn(),
  deleteAdminCustomerFollowUp: vi.fn(),
  getAdminCustomer: vi.fn(),
  getAdminCustomerFollowUps: vi.fn(),
  getAdminCustomers: vi.fn(),
  updateAdminCustomer: vi.fn(),
  updateAdminCustomerFollowUp: vi.fn(),
}));

import { getAdminCustomers } from '../api/adminCustomersApi';
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
});
