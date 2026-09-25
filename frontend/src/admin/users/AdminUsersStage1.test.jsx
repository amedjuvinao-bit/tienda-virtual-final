import React from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import AdminUsersPage from './AdminUsersPage';
import { buildUserEditPayload, buildFormFromUser } from './adminUsersHelpers';
import { getAdminUsers, getAdminUsersMeta } from '../api/adminUsersApi';

const state = vi.hoisted(() => ({
  adminUser: { id: 'viewer-id', adminRole: 'viewer', permissions: ['admin-users:view'] },
}));

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ adminUser: state.adminUser }),
}));

vi.mock('../api/adminUsersApi', () => ({
  createAdminUser: vi.fn(), deleteAdminUser: vi.fn(),
  getAdminUsers: vi.fn(), getAdminUsersMeta: vi.fn(),
  updateAdminUser: vi.fn(), updateAdminUserPassword: vi.fn(),
  updateAdminUserStatus: vi.fn(), updateAdminUserTwoFactor: vi.fn(),
}));

const branches = [{ _id: 'branch-a', name: 'Principal', code: 'P', isMain: true }];
const roles = [{ code: 'seller', name: 'Vendedor', level: 55, scope: 'branch' }];
const managedUser = {
  _id: 'seller-id', username: 'cajero', displayName: 'Cajero',
  firstName: 'Ana', email: 'ana@example.com', role: 'seller', status: 'active',
  branches: [
    { branch: 'branch-a', isDefault: true },
    { branch: 'branch-b', isDefault: false },
  ],
  defaultBranch: 'branch-a',
};

beforeEach(() => {
  vi.clearAllMocks();
  state.adminUser = { id: 'viewer-id', adminRole: 'viewer', permissions: ['admin-users:view'] };
  getAdminUsers.mockResolvedValue({ ok: true, data: [managedUser] });
  getAdminUsersMeta.mockResolvedValue({ ok: true, data: { branches, roles } });
});
afterEach(cleanup);

describe('Usuarios: separación de acciones', () => {
  it('con acceso de lectura oculta todas las acciones de escritura', async () => {
    render(<AdminUsersPage />);
    expect(await screen.findByText('@cajero')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Nuevo usuario' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Editar' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Más' })).not.toBeInTheDocument();
  });

  it('con permiso de edición puede cambiar datos, pero no el perfil, la sede o el estado', async () => {
    state.adminUser = {
      id: 'editor-id', adminRole: 'viewer',
      permissions: ['admin-users:view', 'admin-users:update'],
      branches: [{ branch: 'branch-a' }, { branch: 'branch-b' }],
    };
    render(<AdminUsersPage />);
    const editor = await screen.findByRole('button', { name: 'Editar' });
    await userEvent.setup().click(editor);
    expect(await screen.findByRole('combobox', { name: /perfil administrativo/i })).toBeDisabled();
    expect(screen.getByRole('group', { name: /sedes autorizadas/i })).toBeDisabled();
    expect(screen.getByRole('combobox', { name: /^estado$/i })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Más' })).not.toBeInTheDocument();
  });

  it('no ofrece cambios a un usuario que también pertenece a otra sede', async () => {
    state.adminUser = {
      id: 'editor-id', adminRole: 'viewer',
      permissions: ['admin-users:view', 'admin-users:update', 'admin-users:disable'],
      branches: [{ branch: 'branch-a' }],
    };
    render(<AdminUsersPage />);
    expect(await screen.findByText('@cajero')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Editar' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Más' })).not.toBeInTheDocument();
  });

  it('una edición de datos conserva perfil, estado y sedes múltiples', () => {
    const form = buildFormFromUser(managedUser, branches, roles);
    const payload = buildUserEditPayload({ ...form, firstName: 'María' }, managedUser, branches, roles);
    expect(payload).toEqual({ firstName: 'María' });
    expect(buildUserEditPayload({ ...form, role: 'cashier' }, managedUser, branches, roles))
      .toMatchObject({ role: 'cashier' });
  });
});
