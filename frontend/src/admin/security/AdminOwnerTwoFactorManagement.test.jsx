import React from 'react';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import AdminUsersPage from '../users/AdminUsersPage';
import {
  getAdminUsers,
  getAdminUsersMeta,
  updateAdminUserTwoFactor,
} from '../api/adminUsersApi';

const authState = vi.hoisted(() => ({
  adminUser: {
    id: 'owner-id',
    username: 'owner',
    adminRole: 'owner',
    twoFactorEnabled: true,
  },
}));

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ adminUser: authState.adminUser }),
}));

vi.mock('../api/adminUsersApi', () => ({
  createAdminUser: vi.fn(),
  deleteAdminUser: vi.fn(),
  getAdminUsers: vi.fn(),
  getAdminUsersMeta: vi.fn(),
  updateAdminUser: vi.fn(),
  updateAdminUserPassword: vi.fn(),
  updateAdminUserStatus: vi.fn(),
  updateAdminUserTwoFactor: vi.fn(),
}));

const users = [
  {
    _id: 'owner-id',
    username: 'owner',
    displayName: 'Propietario',
    email: 'owner@example.com',
    role: 'owner',
    status: 'active',
    twoFactorEnabled: true,
    twoFactorRequired: true,
    branches: [],
  },
  {
    _id: 'admin-id',
    username: 'admin.ventas',
    displayName: 'Administradora de ventas',
    email: 'admin@example.com',
    role: 'admin',
    status: 'active',
    twoFactorEnabled: false,
    twoFactorRequired: false,
    branches: [],
  },
];

describe('Administración 2FA exclusiva del owner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authState.adminUser = {
      id: 'owner-id',
      username: 'owner',
      adminRole: 'owner',
      twoFactorEnabled: true,
    };
    getAdminUsers.mockResolvedValue({ ok: true, data: users });
    getAdminUsersMeta.mockResolvedValue({
      ok: true,
      data: {
        roles: [
          { code: 'owner', name: 'Propietario', permissions: [] },
          { code: 'admin', name: 'Administrador', permissions: [] },
        ],
        branches: [],
      },
    });
    updateAdminUserTwoFactor.mockResolvedValue({
      ok: true,
      message: 'El usuario deberá configurar 2FA.',
      currentUserChanged: false,
      data: { twoFactorRequired: true, twoFactorSetupRequired: true },
    });
  });

  afterEach(cleanup);

  it('permite al owner exigir 2FA a otro usuario con reautenticación y motivo', async () => {
    const user = userEvent.setup();
    render(<AdminUsersPage />);

    expect(await screen.findByText('Administradora de ventas')).toBeInTheDocument();
    const adminCard = screen.getByText('Administradora de ventas').closest('article');
    await user.click(within(adminCard).getByRole('button', { name: 'Más' }));
    await user.click(within(adminCard).getByRole('button', { name: 'Administrar 2FA' }));

    expect(screen.getByRole('dialog', { name: 'Seguridad 2FA de @admin.ventas' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Exigir 2FA/ }));
    await user.type(screen.getByLabelText('Motivo del cambio'), 'Política de seguridad interna');
    await user.type(screen.getByLabelText('Tu contraseña de propietario'), 'Password!123');
    await user.type(screen.getByLabelText('Tu código 2FA o de recuperación'), '123456');
    await user.click(screen.getByRole('button', { name: 'Confirmar cambio' }));

    await waitFor(() => {
      expect(updateAdminUserTwoFactor).toHaveBeenCalledWith('admin-id', {
        action: 'require',
        reason: 'Política de seguridad interna',
        currentPassword: 'Password!123',
        code: '123456',
      });
    });
  });

  it('oculta la administración 2FA a perfiles distintos de owner', async () => {
    authState.adminUser = {
      id: 'admin-id',
      username: 'admin.ventas',
      adminRole: 'admin',
      twoFactorEnabled: true,
    };
    const user = userEvent.setup();
    render(<AdminUsersPage />);

    expect(await screen.findByText('Administradora de ventas')).toBeInTheDocument();
    const adminCard = screen.getByText('Administradora de ventas').closest('article');
    await user.click(within(adminCard).getByRole('button', { name: 'Más' }));
    expect(within(adminCard).queryByRole('button', { name: 'Administrar 2FA' })).not.toBeInTheDocument();
  });

  it('permite al owner desactivar su propio 2FA con reautenticación', async () => {
    const user = userEvent.setup();
    updateAdminUserTwoFactor.mockResolvedValueOnce({
      ok: true,
      message: 'Segundo factor desactivado.',
      currentUserChanged: true,
      data: { twoFactorRequired: false, twoFactorSetupRequired: false },
    });
    render(<AdminUsersPage />);

    expect(await screen.findByText('@owner')).toBeInTheDocument();
    const ownerCard = screen.getByText('@owner').closest('article');
    await user.click(within(ownerCard).getByRole('button', { name: 'Más' }));
    await user.click(within(ownerCard).getByRole('button', { name: 'Administrar 2FA' }));
    await user.click(screen.getByRole('button', { name: /Desactivar 2FA/ }));
    await user.type(screen.getByLabelText('Motivo del cambio'), 'Pausa temporal solicitada');
    await user.type(screen.getByLabelText('Tu contraseña de propietario'), 'Password!123');
    await user.type(screen.getByLabelText('Tu código 2FA o de recuperación'), '654321');
    await user.click(screen.getByRole('button', { name: 'Confirmar cambio' }));

    await waitFor(() => {
      expect(updateAdminUserTwoFactor).toHaveBeenCalledWith('owner-id', {
        action: 'disable',
        reason: 'Pausa temporal solicitada',
        currentPassword: 'Password!123',
        code: '654321',
      });
    });
  });
});
