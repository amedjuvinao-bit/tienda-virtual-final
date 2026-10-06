import React from 'react';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
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
  default: ({ addHeaderMenuItem, setHeaderMenuItem, setPath }) => <>
    <button onClick={addHeaderMenuItem}>Añadir enlace</button>
    <button onClick={() => setHeaderMenuItem(0, { icon: 'gown', iconColor: '#754153' })}>Personalizar categoría</button>
    <button onClick={() => {
      setPath('header.surfaceShape', 'floating');
      setPath('header.cornerRadiusPx', 32);
      setPath('header.liquidGlassEnabled', true);
      setPath('header.glassStrength', 85);
      setPath('header.iconSet', 'satin');
    }}>Configurar vidrio</button>
    <button onClick={() => {
      setPath('header.iconSet', 'satin');
      setPath('header.iconOverrides.satin.favorites', 'https://res.cloudinary.com/tienda/image/upload/v1/corazon.webp');
    }}>Guardar icono propio</button>
    <button onClick={() => setPath('header.searchBgColor', '#254254')}>Cambiar fondo del buscador</button>
  </>,
}));
vi.mock('./appearance/banner/BannerPanel', () => ({ default: ({ theme, setPath }) => <button onClick={() => {
  setPath('banner.sliderIntervalMs', 6200);
  setPath('banner.sliderShowProgress', false);
}}>Ajustar slider ({theme.banner.sliderIntervalMs} ms)</button> }));
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

  it('mantiene la botonera de iconos en el borde de la pantalla y accesible por nombre', async () => {
    render(<AppearancePage />);
    await screen.findByText('Cambiar WhatsApp');
    const dock = screen.getByRole('group', { name: 'Acciones de apariencia' });
    expect(dock.parentElement).toBe(document.body);
    expect(dock).toHaveClass('appearance-action-dock');
    expect(dock.textContent).toBe('');
    expect(dock.querySelectorAll('.admin-premium-nav-icon--compact')).toHaveLength(3);
    expect(screen.getByRole('navigation', { name: 'Áreas de apariencia' }).parentElement).toHaveClass('appearance-workspace__header');
    expect(screen.queryByText('Todo está guardado')).not.toBeInTheDocument();
    expect(within(dock).getByRole('button', { name: 'Aplicar aquí' })).toHaveAttribute('data-tooltip', 'Aplicar aquí');
    expect(within(dock).getByRole('button', { name: 'Descartar cambios' })).toHaveAttribute('data-tooltip', 'Descartar cambios');
    expect(within(dock).getByRole('button', { name: 'Guardar cambios' })).toHaveAttribute('data-tooltip', 'Guardar cambios');
  });

  it('guarda solo secciones y no exige permisos de menús o tema general', async () => {
    const user = userEvent.setup();
    permissions.allowed = ['appearance:sections'];
    render(<AppearancePage />);
    await screen.findByText('Cambiar WhatsApp');
    expect(screen.getByRole('button', { name: 'Cambiar WhatsApp' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: /Secciones Página de inicio/ }));
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
      menus: { header: [{ title: 'Nuevo botón', type: 'url', ref: '/', icon: 'grid', children: [] }] },
    });
  });

  it('usa el intervalo que tenía la tienda y guarda la visibilidad del progreso', async () => {
    const user = userEvent.setup();
    fetchAppearanceSettings.mockResolvedValueOnce({ ...initial, theme: { banner: { autoplayMs: 4500, sliderShowProgress: true, slides: [{ image: '/portada.jpg' }] } } });
    render(<AppearancePage />);
    await screen.findByText('Cambiar WhatsApp');
    await user.click(screen.getByRole('button', { name: /Portada Imagen o video/ }));
    expect(screen.getByRole('button', { name: 'Ajustar slider (4500 ms)' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Ajustar slider (4500 ms)' }));
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    await waitFor(() => expect(saveSiteSettings).toHaveBeenCalledTimes(1));
    expect(saveSiteSettings.mock.calls[0][0].theme.banner.autoplayMs).toBe(6200);
    expect(saveSiteSettings.mock.calls[0][0].theme.banner.sliderShowProgress).toBe(false);
    expect(saveSiteSettings.mock.calls[0][0].theme.banner.sliderIntervalMs).toBeUndefined();
  });

  it('persiste el icono de moda y su color como datos del enlace', async () => {
    const user = userEvent.setup();
    permissions.allowed = ['appearance:menus'];
    render(<AppearancePage />);
    await screen.findByText('Cambiar WhatsApp');
    await user.click(screen.getByRole('button', { name: /Encabezado Logo y menú/ }));
    await user.click(screen.getByRole('button', { name: 'Añadir enlace' }));
    await user.click(screen.getByRole('button', { name: 'Personalizar categoría' }));
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    await waitFor(() => expect(saveSiteSettings).toHaveBeenCalledTimes(1));
    expect(saveSiteSettings.mock.calls[0][0].menus.header[0]).toMatchObject({ icon: 'gown', iconColor: '#754153' });
  });

  it('guarda la forma y el vidrio junto con el encabezado', async () => {
    const user = userEvent.setup();
    permissions.allowed = ['appearance:update'];
    render(<AppearancePage />);
    await screen.findByText('Cambiar WhatsApp');
    await user.click(screen.getByRole('button', { name: /Encabezado Logo y menú/ }));
    await user.click(screen.getByRole('button', { name: 'Configurar vidrio' }));
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    await waitFor(() => expect(saveSiteSettings).toHaveBeenCalledTimes(1));
    expect(saveSiteSettings.mock.calls[0][0].theme.header).toMatchObject({
      surfaceShape: 'floating', cornerRadiusPx: 32, liquidGlassEnabled: true, glassStrength: 85,
      iconSet: 'satin',
    });
  });

  it('guarda el icono reemplazado sin exigir imágenes para las otras acciones', async () => {
    const user = userEvent.setup();
    permissions.allowed = ['appearance:update'];
    render(<AppearancePage />);
    await screen.findByText('Cambiar WhatsApp');
    await user.click(screen.getByRole('button', { name: /Encabezado Logo y menú/ }));
    await user.click(screen.getByRole('button', { name: 'Guardar icono propio' }));
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    await waitFor(() => expect(saveSiteSettings).toHaveBeenCalledTimes(1));
    expect(saveSiteSettings.mock.calls[0][0].theme.header).toMatchObject({
      iconSet: 'satin',
      iconOverrides: { satin: { favorites: 'https://res.cloudinary.com/tienda/image/upload/v1/corazon.webp' } },
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

  it('guarda el color del buscador como parte del tema del encabezado', async () => {
    const user = userEvent.setup();
    permissions.allowed = ['appearance:update'];
    render(<AppearancePage />);
    await screen.findByText('Cambiar WhatsApp');
    await user.click(screen.getByRole('button', { name: /Encabezado Logo y menú/ }));
    await user.click(screen.getByRole('button', { name: 'Cambiar fondo del buscador' }));
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    await waitFor(() => expect(saveSiteSettings).toHaveBeenCalledTimes(1));
    expect(saveSiteSettings.mock.calls[0][0].theme.header.searchBgColor).toBe('#254254');
    expect(saveSiteSettings.mock.calls[0][0].theme.colors).toBeUndefined();
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
    expect(screen.queryByText('Todo está guardado')).not.toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Guardar cambios' })).toBeEnabled();
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    expect(screen.getByText('No hay cambios por guardar.')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveClass('appearance-feedback');
    expect(screen.getByRole('status').parentElement).toBe(document.body);
    expect(saveSiteSettings).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Descartar cambios' }));
    expect(screen.getByText('No hay cambios por descartar.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Aplicar aquí' }));
    expect(screen.getByText('La vista previa ya muestra la configuración guardada.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Cambiar WhatsApp' }));
    expect(screen.getByText('1 área pendiente por guardar')).toBeInTheDocument();
    expect(screen.getByTitle('Pendiente: General.')).toBeInTheDocument();
    const unloadEvent = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(unloadEvent);
    expect(unloadEvent.defaultPrevented).toBe(true);

    await user.click(screen.getByRole('button', { name: /Secciones Página de inicio/ }));
    await user.click(screen.getByRole('button', { name: 'Cambiar sección' }));
    expect(screen.getByText('2 áreas pendientes por guardar')).toBeInTheDocument();
    expect(screen.getByTitle('Pendiente: General, Secciones.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Guardar cambios' })).toBeEnabled();

    await user.click(screen.getByRole('button', { name: 'Descartar cambios' }));
    expect(screen.queryByText('1 área pendiente por guardar')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Guardar cambios' })).toBeEnabled();
    expect(saveSiteSettings).not.toHaveBeenCalled();
  });

  it('confirma el guardado en el panel y limpia el indicador pendiente', async () => {
    const user = userEvent.setup();
    render(<AppearancePage />);
    await screen.findByText('Cambiar WhatsApp');
    await user.click(screen.getByRole('button', { name: 'Cambiar WhatsApp' }));
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    expect(await screen.findByText('Cambios guardados. La tienda pública ya usa esta configuración.')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveClass('appearance-feedback');
    expect(screen.queryByText('1 área pendiente por guardar')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Guardar cambios' })).toBeEnabled();
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
    await waitFor(() => expect(screen.getByRole('button', { name: 'Guardar cambios' })).toBeEnabled());
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
