import React from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import SedesSection from './SedesSection';
import { getAdminBranches, getAdminBranchesMeta } from '../../api/adminBranchesApi';

const auth = vi.hoisted(() => ({ user: { role: 'viewer', permissions: ['branches:view'] } }));
vi.mock('../../../context/AuthContext', () => ({ useAuth: () => ({ adminUser: auth.user }) }));
vi.mock('../../../lib/api', () => ({ default: { get: vi.fn().mockResolvedValue({ data: [] }) } }));
vi.mock('../../api/adminBranchesApi', () => ({
  getAdminBranches: vi.fn(), getAdminBranchesMeta: vi.fn(),
  createAdminBranch: vi.fn(), deleteAdminBranch: vi.fn(),
  markAdminBranchAsMain: vi.fn(), markAdminBranchAsOnlineDefault: vi.fn(),
  updateAdminBranch: vi.fn(), updateAdminBranchStatus: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
  auth.user = { role: 'viewer', permissions: ['branches:view'] };
  getAdminBranchesMeta.mockResolvedValue({ data: {} });
  getAdminBranches.mockImplementation(async ({ page }) => ({
    total: 21,
    data: [{ _id: String(page), name: `Sede ${page}`, code: `S${page}`,
      type: 'warehouse', status: 'active', active: true }],
  }));
});
afterEach(cleanup);

it('permite ver y paginar sedes sin mostrar controles de escritura al lector', async () => {
  const user = userEvent.setup();
  render(<SedesSection />);
  expect(await screen.findByText('Sede 1')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Nueva sede' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Desactivar Sede 1' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Editar Sede 1' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Eliminar Sede 1' })).not.toBeInTheDocument();

  await user.click(screen.getByRole('button', { name: 'Siguiente' }));
  expect(await screen.findByText('Sede 2')).toBeInTheDocument();
  expect(getAdminBranches).toHaveBeenCalledWith(expect.objectContaining({ page: 2, limit: 20 }));
});

it('deja editar datos de la sede sin conceder cambio de estado', async () => {
  const user = userEvent.setup();
  auth.user = { role: 'editor', permissions: ['branches:view', 'branches:update'] };
  render(<SedesSection />);
  await screen.findByText('Sede 1');
  expect(screen.getByRole('button', { name: 'Editar Sede 1' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Eliminar Sede 1' })).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Editar Sede 1' }));
  await waitFor(() => expect(screen.getByRole('dialog', { name: 'Editar sede' })).toBeInTheDocument());
  expect(screen.getByRole('combobox', { name: 'Estado' })).toBeDisabled();
});

it('muestra las acciones poco frecuentes solo cuando se abren las opciones', async () => {
  const user = userEvent.setup();
  auth.user = { role: 'owner' };
  render(<SedesSection />);
  await screen.findByText('Sede 1');
  expect(screen.queryByRole('button', { name: 'Desactivar Sede 1' })).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Opciones de Sede 1' }));
  expect(screen.getByRole('button', { name: 'Desactivar Sede 1' })).toBeVisible();
  expect(screen.getByRole('button', { name: 'Eliminar Sede 1' })).toBeVisible();
  expect(screen.getByRole('button', { name: 'Hacer sede principal' })).toBeVisible();
});
