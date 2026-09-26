import React from 'react';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import AdminUsersPage from './AdminUsersPage';
import { buildFormFromUser, buildUserEditPayload, getNewBranchAssignment } from './adminUsersHelpers';
import { getAdminUserActivity, getAdminUsers, getAdminUsersMeta, updateAdminUser } from '../api/adminUsersApi';

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ adminUser: { id: 'owner-id', adminRole: 'owner', permissions: ['*'] } }),
}));
vi.mock('../api/adminUsersApi', () => ({
  createAdminUser: vi.fn(), deleteAdminUser: vi.fn(), getAdminUsers: vi.fn(),
  getAdminUsersMeta: vi.fn(), updateAdminUser: vi.fn(),
  updateAdminUserPassword: vi.fn(), updateAdminUserStatus: vi.fn(),
  updateAdminUserTwoFactor: vi.fn(),
  getAdminUserActivity: vi.fn(),
}));

const branches = [
  { _id: 'branch-a', name: 'Principal', code: 'P', isMain: true },
  { _id: 'branch-b', name: 'Norte', code: 'N' },
];
const user = {
  _id: 'user-a', username: 'ana', role: 'seller', status: 'active',
  branches: [
    { branch: 'branch-a', isDefault: true, canSell: true, canInvoice: false },
    { branch: 'branch-b', isDefault: false, canSell: false, canInvoice: true },
  ], defaultBranch: 'branch-a',
};

beforeEach(() => {
  vi.clearAllMocks();
  getAdminUsersMeta.mockResolvedValue({ data: { roles: [{ code: 'seller', name: 'Vendedor' }], branches } });
  getAdminUsers.mockImplementation(async ({ page, q, status }) => ({
    page, total: q ? 1 : status === 'inactive' ? 0 : 21,
    totalPages: q || status === 'inactive' ? 1 : 2,
    data: status === 'inactive' ? [] : [{ ...user, _id: page === 2 ? 'user-b' : user._id,
      username: page === 2 ? 'beatriz' : user.username }],
  }));
});
afterEach(cleanup);

it('consulta otra página y aplica búsqueda y estado en el servidor', async () => {
  const interaction = userEvent.setup();
  render(<AdminUsersPage />);
  expect(await screen.findByText('@ana')).toBeInTheDocument();
  await interaction.click(screen.getByRole('button', { name: 'Siguiente' }));
  expect(await screen.findByText('@beatriz')).toBeInTheDocument();
  expect(getAdminUsers).toHaveBeenCalledWith(expect.objectContaining({ page: 2, limit: 20 }));
  await interaction.type(screen.getByPlaceholderText(/Nombre, usuario/i), 'ana');
  await waitFor(() => expect(getAdminUsers).toHaveBeenCalledWith(
    expect.objectContaining({ page: 1, q: 'ana' })
  ));
  await interaction.selectOptions(screen.getByRole('combobox', { name: /filtrar usuarios por estado/i }), 'inactive');
  await waitFor(() => expect(getAdminUsers).toHaveBeenCalledWith(
    expect.objectContaining({ page: 1, q: 'ana', status: 'inactive' })
  ));
});

it('filtra por perfil y sede, y muestra la trazabilidad de la cuenta', async () => {
  const interaction = userEvent.setup();
  getAdminUserActivity.mockImplementation(async (_id, scope) => ({
    data: scope === 'account'
      ? [{ _id: 'event-2', description: 'Perfil actualizado por propietario', adminUsername: 'owner', success: true }]
      : [{ _id: 'event-1', description: 'Crear orden administrativa', module: 'orders', success: true }],
    pagination: { page: 1, pages: 1 }, scope,
  }));
  render(<AdminUsersPage />);
  await screen.findByText('@ana');
  await interaction.selectOptions(screen.getByRole('combobox', { name: /filtrar usuarios por perfil/i }), 'seller');
  await interaction.selectOptions(screen.getByRole('combobox', { name: /filtrar usuarios por sede/i }), 'branch-b');
  await waitFor(() => expect(getAdminUsers).toHaveBeenCalledWith(
    expect.objectContaining({ role: 'seller', branchId: 'branch-b' })
  ));
  await interaction.click(screen.getByRole('button', { name: 'Más' }));
  await interaction.click(screen.getByRole('button', { name: 'Ver actividad' }));
  expect(await screen.findByRole('dialog', { name: /Actividad de @ana/i })).toBeInTheDocument();
  expect(await screen.findByText(/Crear orden administrativa/)).toBeInTheDocument();
  expect(getAdminUserActivity).toHaveBeenCalledWith('user-a', 'actions', 1);
  await interaction.click(screen.getByRole('tab', { name: 'Cambios en la cuenta' }));
  expect(await screen.findByText(/Perfil actualizado por propietario/)).toBeInTheDocument();
  expect(getAdminUserActivity).toHaveBeenCalledWith('user-a', 'account', 1);
});

it('al cambiar la sede principal conserva permisos individuales de ambas sedes', () => {
  const form = buildFormFromUser(user, branches);
  expect(buildUserEditPayload({ ...form, branchId: 'branch-b' }, user, branches))
    .toMatchObject({
      defaultBranch: 'branch-b',
      branches: [
        { branch: 'branch-a', isDefault: false, canSell: true, canInvoice: false },
        { branch: 'branch-b', isDefault: true, canSell: false, canInvoice: true },
      ],
    });
});

it('al asignar sede con alcance limitado no concede capacidades ajenas', () => {
  expect(getNewBranchAssignment('branch-a', 'manager', [
    { branch: 'branch-a', canSell: true, canInvoice: false, canManageInventory: false },
  ], false)).toEqual({
    branch: 'branch-a', canSell: true, canInvoice: false, canManageInventory: false,
  });
});

it('edita visualmente dos sedes sin borrar sus capacidades existentes', async () => {
  const interaction = userEvent.setup();
  updateAdminUser.mockResolvedValue({ ok: true });
  render(<AdminUsersPage />);
  await interaction.click(await screen.findByRole('button', { name: 'Editar' }));
  const assigned = within(screen.getByRole('group', { name: /sedes autorizadas/i }));
  expect(assigned.getByRole('checkbox', { name: /Principal \(P\)/i })).toBeChecked();
  expect(assigned.getByRole('checkbox', { name: /Norte \(N\)/i })).toBeChecked();
  await interaction.click(assigned.getAllByRole('radio')[1]);
  await interaction.click(screen.getByRole('button', { name: 'Guardar cambios' }));
  await waitFor(() => expect(updateAdminUser).toHaveBeenCalledWith('user-a',
    expect.objectContaining({ defaultBranch: 'branch-b', branches: [
      expect.objectContaining({ branch: 'branch-a', canSell: true, isDefault: false }),
      expect.objectContaining({ branch: 'branch-b', canInvoice: true, isDefault: true }),
    ] })
  ));
});
