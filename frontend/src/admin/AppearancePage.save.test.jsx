import React from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import AppearancePage from './AppearancePage';
import { fetchAppearanceSettings, saveSiteSettings } from '../lib/siteSettingsApi';

const permissions = vi.hoisted(() => ({ allowed: [] }));

vi.mock('../lib/siteSettingsApi', () => ({
  fetchAppearanceSettings: vi.fn(),
  saveSiteSettings: vi.fn(),
}));
vi.mock('../lib/api', () => ({ adminFetch: vi.fn().mockResolvedValue({ ok: true, json: async () => [] }) }));
vi.mock('../theme/applyTheme', () => ({ applyTheme: vi.fn() }));
vi.mock('./security/useAdminPermissions', () => ({
  default: () => ({ can: (permission) => permissions.allowed.includes(permission) }),
}));
vi.mock('./appearance/general/GeneralPanel', () => ({
  default: ({ setPath }) => <button onClick={() => setPath('global.whatsapp.phone', '573001234567')}>Cambiar WhatsApp</button>,
}));
vi.mock('./appearance/header/HeaderPanel', () => ({
  default: ({ addHeaderMenuItem }) => <button onClick={addHeaderMenuItem}>Añadir enlace</button>,
}));
vi.mock('./appearance/banner/BannerPanel', () => ({ default: () => null }));
vi.mock('./appearance/sections/SectionsPanel', () => ({
  default: ({ theme, setPath }) => <button onClick={() => setPath('sections', theme.sections.map((section) =>
    section.id === 'look' ? { ...section, title: 'Nuevos looks' } : section
  ))}>Cambiar sección</button>,
}));
vi.mock('./appearance/footer/FooterPanel', () => ({ default: () => null }));

const initial = {
  theme: {},
  menus: { header: [], footer: [], social: [] },
  appearanceRevision: 3,
};

describe('guardado seguro de Apariencia', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    permissions.allowed = ['appearance:update', 'appearance:sections', 'appearance:menus'];
    vi.stubGlobal('alert', vi.fn());
    fetchAppearanceSettings.mockResolvedValue(initial);
    saveSiteSettings.mockImplementation(async (payload) => ({
      theme: { ...initial.theme, ...payload.theme },
      menus: { ...initial.menus, ...payload.menus },
      appearanceRevision: 4,
    }));
  });
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

  it('guarda solo secciones y no exige permisos de menús o tema general', async () => {
    const user = userEvent.setup();
    permissions.allowed = ['appearance:sections'];
    render(<AppearancePage />);
    await screen.findByText('Cambiar WhatsApp');
    expect(screen.getByRole('button', { name: 'Cambiar WhatsApp' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: /Secciones Contenido de inicio/ }));
    expect(screen.getByRole('button', { name: 'Cambiar sección' })).toBeEnabled();
    await user.click(screen.getByRole('button', { name: 'Cambiar sección' }));
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    await waitFor(() => expect(saveSiteSettings).toHaveBeenCalledTimes(1));
    const payload = saveSiteSettings.mock.calls[0][0];
    expect(payload.appearanceRevision).toBe(3);
    expect(Object.keys(payload.theme)).toEqual(['sections']);
    expect(payload.theme.sections.find((section) => section.id === 'look').title).toBe('Nuevos looks');
    expect(payload.menus).toBeUndefined();
  });

  it('guarda solo el menú editado y no requiere permiso de secciones', async () => {
    const user = userEvent.setup();
    permissions.allowed = ['appearance:menus'];
    render(<AppearancePage />);
    await screen.findByText('Cambiar WhatsApp');
    expect(screen.getByRole('button', { name: 'Cambiar WhatsApp' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: /Encabezado Logo y menú/ }));
    await user.click(screen.getByRole('button', { name: 'Añadir enlace' }));
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    await waitFor(() => expect(saveSiteSettings).toHaveBeenCalledTimes(1));
    expect(saveSiteSettings.mock.calls[0][0]).toEqual({
      appearanceRevision: 3,
      menus: { header: [{ title: 'Nuevo botón', type: 'url', ref: '/', children: [] }] },
    });
  });

  it('guarda solo la configuración general modificada con su permiso', async () => {
    const user = userEvent.setup();
    permissions.allowed = ['appearance:update'];
    render(<AppearancePage />);
    await screen.findByText('Cambiar WhatsApp');
    await user.click(screen.getByRole('button', { name: 'Cambiar WhatsApp' }));
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    await waitFor(() => expect(saveSiteSettings).toHaveBeenCalledTimes(1));
    const payload = saveSiteSettings.mock.calls[0][0];
    expect(payload.appearanceRevision).toBe(3);
    expect(Object.keys(payload.theme)).toEqual(['global']);
    expect(payload.theme.global.whatsapp.phone).toBe('573001234567');
    expect(payload.menus).toBeUndefined();
  });

  it('deja consultar sin editar al perfil con permiso de lectura', async () => {
    permissions.allowed = [];
    render(<AppearancePage />);
    await screen.findByText('Cambiar WhatsApp');
    expect(screen.getByRole('button', { name: 'Cambiar WhatsApp' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Guardar cambios' })).toBeDisabled();
  });

  it('muestra las áreas pendientes, conserva los cambios al cambiar de área y permite descartarlos', async () => {
    const user = userEvent.setup();
    render(<AppearancePage />);
    await screen.findByText('Cambiar WhatsApp');
    expect(screen.getByText('Todo está guardado')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Guardar cambios' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Cambiar WhatsApp' }));
    expect(screen.getByText('1 área pendiente por guardar')).toBeInTheDocument();
    expect(screen.getByText('Pendiente: General.')).toBeInTheDocument();
    const unloadEvent = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(unloadEvent);
    expect(unloadEvent.defaultPrevented).toBe(true);

    await user.click(screen.getByRole('button', { name: /Secciones Contenido de inicio/ }));
    await user.click(screen.getByRole('button', { name: 'Cambiar sección' }));
    expect(screen.getByText('2 áreas pendientes por guardar')).toBeInTheDocument();
    expect(screen.getByText('Pendiente: General, Secciones.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Guardar cambios' })).toBeEnabled();

    await user.click(screen.getByRole('button', { name: 'Descartar cambios' }));
    expect(screen.getByText('Todo está guardado')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Guardar cambios' })).toBeDisabled();
    expect(saveSiteSettings).not.toHaveBeenCalled();
  });

  it('confirma el guardado en el panel y limpia el indicador pendiente', async () => {
    const user = userEvent.setup();
    render(<AppearancePage />);
    await screen.findByText('Cambiar WhatsApp');
    await user.click(screen.getByRole('button', { name: 'Cambiar WhatsApp' }));
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    expect(await screen.findByText('Cambios guardados. La tienda pública ya usa esta configuración.')).toBeInTheDocument();
    expect(screen.getByText('Todo está guardado')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Guardar cambios' })).toBeDisabled();
  });

  it('impide dos solicitudes de guardado simultáneas', async () => {
    const user = userEvent.setup();
    let complete;
    saveSiteSettings.mockImplementation(() => new Promise((resolve) => { complete = resolve; }));
    render(<AppearancePage />);
    await screen.findByText('Cambiar WhatsApp');
    await user.click(screen.getByRole('button', { name: 'Cambiar WhatsApp' }));
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    expect(screen.getByRole('button', { name: 'Guardando…' })).toBeDisabled();
    expect(saveSiteSettings).toHaveBeenCalledTimes(1);
    complete({ theme: initial.theme, menus: initial.menus, appearanceRevision: 4 });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Guardar cambios' })).toBeDisabled());
  });

  it('presenta el conflicto sin sobrescribir y ofrece recargar explícitamente', async () => {
    const user = userEvent.setup();
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      saveSiteSettings.mockRejectedValue({ response: { data: { error: 'APPEARANCE_REVISION_CONFLICT' } } });
      render(<AppearancePage />);
      await screen.findByText('Cambiar WhatsApp');
      await user.click(screen.getByRole('button', { name: 'Cambiar WhatsApp' }));
      await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));
      expect(await screen.findByRole('alert')).toHaveTextContent('La Apariencia guardada cambió');
      expect(screen.getByRole('button', { name: 'Guardar cambios' })).toBeDisabled();
      expect(fetchAppearanceSettings).toHaveBeenCalledTimes(1);
      await user.click(screen.getByRole('button', { name: 'Cargar versión actual y descartar mis cambios' }));
      await waitFor(() => expect(fetchAppearanceSettings).toHaveBeenCalledTimes(2));
    } finally {
      log.mockRestore();
    }
  });
});
