import React from 'react';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import PerfilesSection from './PerfilesSection';
import { getAdminRoles, getAdminRolesMeta } from '../../api/adminRolesApi';

const auth = vi.hoisted(() => ({
  user: { adminRole: 'manager', roleRef: { level: 30, scope: 'branch' }, permissions: ['roles:view', 'roles:create', 'roles:update', 'roles:disable'] },
}));
vi.mock('../../../context/AuthContext', () => ({ useAuth: () => ({ adminUser: auth.user }) }));
vi.mock('../../api/adminRolesApi', () => ({
  getAdminRoles: vi.fn(), getAdminRolesMeta: vi.fn(),
  createAdminRole: vi.fn(), updateAdminRole: vi.fn(),
  updateAdminRoleStatus: vi.fn(), deleteAdminRole: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
  auth.user = { adminRole: 'manager', roleRef: { level: 30, scope: 'branch' }, permissions: ['roles:view', 'roles:create', 'roles:update', 'roles:disable'] };
  getAdminRolesMeta.mockResolvedValue({ data: { permissions: ['roles:view'] } });
  getAdminRoles.mockImplementation(async ({ page, q }) => ({
    total: q ? 1 : 21, totalPages: q ? 1 : 2,
    data: page === 2 ? [{ _id: 'second', name: 'Perfil segundo', code: 'second', usersCount: 0 }]
      : [{ _id: 'first', name: 'Cajero', code: 'cashier', usersCount: 2, permissions: ['roles:view'], scope: 'branch', level: 50 }],
  }));
});
afterEach(cleanup);

it('muestra ocupación real y bloquea eliminación y desactivación de un perfil asignado', async () => {
  render(<PerfilesSection />);
  const card = (await screen.findByText('Cajero')).closest('article');
  expect(within(card).getByText('2')).toBeInTheDocument();
  expect(within(card).getByRole('button', { name: 'Eliminar' })).toBeDisabled();
  expect(within(card).getByRole('button', { name: 'Desactivar' })).toBeDisabled();
  expect(within(card).getByRole('button', { name: 'Editar' })).toBeEnabled();
});

it('consulta las demás páginas y busca desde el servidor', async () => {
  const user = userEvent.setup();
  render(<PerfilesSection />);
  await screen.findByText('Cajero');
  await user.click(screen.getByRole('button', { name: 'Siguiente' }));
  expect(await screen.findByText('Perfil segundo')).toBeInTheDocument();
  expect(getAdminRoles).toHaveBeenCalledWith(expect.objectContaining({ page: 2, limit: 20 }));
  await user.type(screen.getByRole('textbox', { name: 'Buscar perfiles' }), 'caja');
  await waitFor(() => expect(getAdminRoles).toHaveBeenCalledWith(
    expect.objectContaining({ page: 1, q: 'caja' })
  ));
});

it('no trata a un encargado como propietario', async () => {
  getAdminRoles.mockResolvedValueOnce({ total: 1, totalPages: 1, data: [
    { _id: 'system', name: 'Sistema', code: 'admin', isSystem: true, usersCount: 0 },
  ] });
  render(<PerfilesSection />);
  const card = (await screen.findByRole('heading', { name: 'Sistema' })).closest('article');
  expect(within(card).getByRole('button', { name: 'Editar' })).toBeDisabled();
});
