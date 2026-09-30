import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import BackupMaintenanceNotice from './BackupMaintenanceNotice';
import api from '../lib/api';

vi.mock('../lib/api', () => ({ default: { post: vi.fn() } }));

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it('muestra mantenimiento al comprador mientras la API está pausada', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ maintenance: true }) }));
  render(<MemoryRouter initialEntries={['/producto/1']}><BackupMaintenanceNotice /></MemoryRouter>);
  expect(await screen.findByText('Tienda en mantenimiento')).toBeInTheDocument();
});

it('deja visible el panel de respaldos del propietario', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ maintenance: true }) }));
  render(<MemoryRouter initialEntries={['/admin/configuracion/respaldos']}>
    <BackupMaintenanceNotice adminPanelReady />
  </MemoryRouter>);
  await vi.waitFor(() => expect(fetch).toHaveBeenCalled());
  expect(screen.queryByText('Tienda en mantenimiento')).not.toBeInTheDocument();
});

it('permite al propietario reabrir después de reiniciar el backend con sesión vigente', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ maintenance: true, phase: 'requiere_revision', recoverable: true }) }));
  vi.mocked(api.post).mockResolvedValueOnce({ data: { maintenance: false, phase: 'fallido' } });
  render(<MemoryRouter initialEntries={['/admin/configuracion/respaldos']}><BackupMaintenanceNotice /></MemoryRouter>);
  fireEvent.change(await screen.findByLabelText('Contraseña del propietario'), { target: { value: 'secret' } });
  fireEvent.change(screen.getByLabelText('Código de 6 dígitos'), { target: { value: '123456' } });
  fireEvent.submit(screen.getByRole('button', { name: 'Reabrir tienda' }).closest('form'));
  await vi.waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/admin/backup-preferences/recover',
    { currentPassword: 'secret', twoFactorCode: '123456' }, { skipAdminRefresh: true }));
  await vi.waitFor(() => expect(screen.queryByText('Tienda en mantenimiento')).not.toBeInTheDocument());
});
