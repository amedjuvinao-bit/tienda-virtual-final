import React from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import LogsSection from './LogsSection';
import api from '../../../lib/api';

const auth = vi.hoisted(() => ({ user: { role: 'viewer', permissions: ['logs:view'] } }));
vi.mock('../../../context/AuthContext', () => ({ useAuth: () => ({ adminUser: auth.user }) }));
vi.mock('../../../lib/api', () => ({ default: { get: vi.fn() } }));

beforeEach(() => {
  vi.clearAllMocks();
  auth.user = { role: 'viewer', permissions: ['logs:view'] };
  api.get.mockImplementation(async (path, config) => {
    if (path.endsWith('/export')) return { data: new Blob(['csv']) };
    const page = config.params.page;
    return { data: {
      data: [{ _id: String(page), createdAt: '2026-09-01T12:00:00Z',
        username: `usuario${page}`, status: 'failed', reason: 'Cambio de perfil',
        module: 'admin-users', resourceId: 'usuario-id' }],
      pagination: { page, pages: 2, total: 26 },
    } };
  });
});
afterEach(cleanup);

it('filtra, pagina y muestra el recurso sin conceder exportación al lector', async () => {
  const user = userEvent.setup();
  render(<LogsSection />);
  expect((await screen.findAllByText('usuario1')).length).toBeGreaterThan(0);
  expect(screen.queryByRole('button', { name: /Exportar CSV/ })).not.toBeInTheDocument();

  await user.click(screen.getByRole('tab', { name: 'Operaciones' }));
  expect((await screen.findAllByText(/usuario-id/)).length).toBeGreaterThan(0);
  await user.selectOptions(screen.getByRole('combobox', { name: 'Módulo' }), 'admin-users');
  await user.selectOptions(screen.getByRole('combobox', { name: 'Estado' }), 'failed');
  await user.type(screen.getByRole('textbox', { name: 'Usuario' }), 'operador');
  await user.click(screen.getByRole('button', { name: 'Buscar' }));
  await waitFor(() => expect(api.get).toHaveBeenCalledWith('/api/admin/audit-logs', {
    params: expect.objectContaining({ scope: 'operations', module: 'admin-users', status: 'failed',
      username: 'operador', page: 1, limit: 25 }),
  }));
  await user.click(screen.getByRole('button', { name: 'Siguiente' }));
  expect((await screen.findAllByText('usuario2')).length).toBeGreaterThan(0);
  expect(api.get).toHaveBeenCalledWith('/api/admin/audit-logs', {
    params: expect.objectContaining({ page: 2, module: 'admin-users' }),
  });
});

it('exporta el mismo filtro únicamente con permiso de exportación', async () => {
  const user = userEvent.setup();
  auth.user = { role: 'viewer', permissions: ['logs:view', 'logs:export'] };
  URL.createObjectURL = vi.fn(() => 'blob:test');
  URL.revokeObjectURL = vi.fn();
  const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  try {
    render(<LogsSection />);
    await screen.findAllByText('usuario1');
    await user.click(screen.getByRole('tab', { name: 'Operaciones' }));
    await screen.findAllByText(/usuario-id/);
    await user.selectOptions(screen.getByRole('combobox', { name: 'Módulo' }), 'roles');
    await user.click(screen.getByRole('button', { name: 'Buscar' }));
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/api/admin/audit-logs', {
      params: expect.objectContaining({ module: 'roles' }),
    }));
    await user.click(screen.getByRole('button', { name: 'Exportar CSV' }));
    expect(api.get).toHaveBeenCalledWith('/api/admin/audit-logs/export', {
      params: expect.objectContaining({ scope: 'operations', module: 'roles', limit: 5000 }),
      responseType: 'blob',
    });
  } finally {
    click.mockRestore();
    delete URL.createObjectURL;
    delete URL.revokeObjectURL;
  }
});
