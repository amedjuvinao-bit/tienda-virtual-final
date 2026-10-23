import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import InstagramSettingsSection from './InstagramSection';
import api from '../../../lib/api';
vi.mock('../../../lib/api', () => ({ default: { get: vi.fn(), put: vi.fn(), post: vi.fn() } }));
const settings = { revision: 2, appId: '1234567', apiVersion: 'v24.0', redirectUri: 'https://api.example.com/api/instagram/callback', enabled: false, encryptionReady: true, hasAppSecret: true, connected: false };
afterEach(() => { cleanup(); vi.clearAllMocks(); });
const load = async (patch = {}) => { api.get.mockResolvedValue({ data: { settings: { ...settings, ...patch } } }); render(<InstagramSettingsSection />); await screen.findByRole('heading', { name: 'Conecta tu cuenta profesional' }); };
describe('Ajustes privados de Instagram', () => {
  it('organiza tres pestañas y no recupera credenciales', async () => {
    await load(); expect(screen.getByRole('button', { name: 'Conectar con Instagram' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'Credenciales', exact: true }));
    expect(screen.getByLabelText('Instagram App Secret')).toHaveValue('');
    expect(screen.getByLabelText('Instagram App Secret')).toHaveAttribute('type', 'password');
    expect(screen.getByRole('button', { name: 'Guardar ajustes' })).toBeDisabled();
  });
  it('guarda con revisión sin borrar el secreto conservado', async () => {
    await load(); api.put.mockResolvedValue({ data: { settings: { ...settings, appId: '7654321', revision: 3 } } });
    fireEvent.click(screen.getByRole('button', { name: 'Credenciales', exact: true }));
    fireEvent.change(screen.getByLabelText('Instagram App ID'), { target: { value: '7654321' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar ajustes' }));
    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/api/admin/instagram-settings', expect.objectContaining({ revision: 2, appId: '7654321', appSecret: '' })));
    expect(await screen.findByRole('status')).toHaveTextContent('guardadas');
  });
  it('verifica el token y vacía el campo tras enviarlo', async () => {
    await load(); api.post.mockResolvedValue({ data: { settings: { ...settings, connected: true, revision: 3, account: { username: 'rosa', mediaCount: 3, followers: 10 } } } });
    fireEvent.click(screen.getByRole('button', { name: 'Credenciales', exact: true }));
    fireEvent.click(screen.getByText('Ya tengo un token de acceso de Meta'));
    fireEvent.change(screen.getByLabelText('Token de acceso'), { target: { value: 'private-token' } });
    fireEvent.click(screen.getByRole('button', { name: 'Comprobar y conectar token' }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/admin/instagram-settings/connect-token', { revision: 2, accessToken: 'private-token' }));
    await waitFor(() => expect(screen.getByLabelText('Token de acceso')).toHaveValue(''));
  });
  it('bloquea conectar cuando falta cifrado del servidor', async () => {
    await load({ encryptionReady: false });
    expect(screen.getByRole('button', { name: 'Conectar con Instagram' })).toBeDisabled();
    expect(screen.getByText(/INSTAGRAM_ENCRYPTION_KEY/)).toBeInTheDocument();
  });
  it('requiere guardar cambios pendientes antes de OAuth', async () => {
    await load(); fireEvent.click(screen.getByRole('button', { name: 'Credenciales', exact: true }));
    fireEvent.change(screen.getByLabelText('Instagram App ID'), { target: { value: '9999999' } });
    fireEvent.click(screen.getByRole('button', { name: 'Cuenta', exact: true }));
    expect(screen.getByRole('button', { name: 'Conectar con Instagram' })).toBeDisabled();
  });
});
describe('recuperación de la carga de ajustes', () => {
  it('expone HTTP 404 y permite recuperar la carga sin mostrar un falso formulario guardable', async () => {
    api.get.mockRejectedValueOnce({ response: { status: 404, data: '<html>Cannot GET</html>' } }).mockResolvedValueOnce({ data: { settings } });
    render(<InstagramSettingsSection />);
    expect(await screen.findByRole('alert')).toHaveTextContent('HTTP 404');
    expect(screen.getByRole('link', {name:'Ver respuesta del servidor'})).toHaveAttribute('href', expect.stringContaining('/api/admin/instagram-settings'));
    expect(screen.queryByRole('button', {name:'Guardar ajustes'})).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', {name:'Reintentar'}));
    await screen.findByRole('button', {name:'Conectar con Instagram'});
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
  it('trata HTML 200 sin configuración como error en lugar de quedar cargando indefinidamente', async () => {
    api.get.mockResolvedValueOnce({data:'<html>Frontend</html>'});
    render(<InstagramSettingsSection />);
    expect(await screen.findByRole('alert')).toHaveTextContent('HTTP 200 · respuesta inesperada');
    expect(screen.queryByText('Cargando conexión de Instagram…')).not.toBeInTheDocument();
  });
});
