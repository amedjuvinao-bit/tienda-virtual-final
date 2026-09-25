import React from 'react';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import PanelAdminSection from './PanelAdminSection';
import api from '../../../lib/api';
import { applyAdminGlobalStyles } from '../../theme/adminGlobalStyles';

vi.mock('../../../lib/api', () => ({
  default: {
    get: vi.fn(),
    put: vi.fn(),
    post: vi.fn(),
  },
}));

function settingsResponse({
  preset = 'roseLuxuryLight',
  sidebar = 'expanded',
  widgetTexture = 'softGlass',
  fontPreset = 'modernElegant',
  background = { enabled: false, image: '' },
} = {}) {
  return {
    data: {
      admin: {
        sidebar,
        background,
        theme: {
          preset,
          widgetTexture,
          fontPreset,
          primary: '#ec4899',
          pageBg: '#fff1f7',
          cardBg: '#ffffff',
          cardText: '#111827',
          cardMutedText: '#6b7280',
          sidebarBg: '#fff7fb',
          layout: { radius: 18, sidebarWidth: 310, density: 'spacious' },
        },
      },
    },
  };
}

describe('PanelAdminSection Nivel Plus', () => {
  afterEach(cleanup);

  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    api.get.mockResolvedValue(settingsResponse());
    api.put.mockImplementation(async (_url, body) => ({
      data: { admin: body.admin },
    }));
    api.post.mockResolvedValue({
      data: {
        url: 'https://res.cloudinary.com/demo/image/upload/admin/panel.webp',
      },
    });
  });

  it('muestra cinco modelos y aplica la elección solo después de guardarla', async () => {
    const user = userEvent.setup();
    render(<PanelAdminSection />);
    await screen.findByText('Configuración sincronizada');

    const choices = screen.getByRole('group', { name: 'Modelos de loading del panel' });
    expect(within(choices).getAllByRole('button')).toHaveLength(5);
    expect(within(choices).getByRole('button', { name: 'Halo' })).toHaveAttribute('aria-pressed', 'true');

    await user.click(within(choices).getByRole('button', { name: 'Órbita' }));
    expect(within(choices).getByRole('button', { name: 'Órbita' })).toHaveAttribute('aria-pressed', 'true');
    expect(window.localStorage.getItem('rb_admin_loader_model')).toBeNull();
    expect(screen.getByText('Vista previa sin guardar')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Guardar apariencia/i }));
    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/api/site-settings', {
      admin: expect.objectContaining({ loader: { model: 'orbit' } }),
    }));
    expect(window.localStorage.getItem('rb_admin_loader_model')).toBe('orbit');
  });

  it('carga la configuración protegida y presenta controles claros sin guardar', async () => {
    render(<PanelAdminSection />);

    expect(await screen.findByText('Configuración sincronizada')).toBeInTheDocument();
    expect(api.get).toHaveBeenCalledWith('/api/site-settings/admin');
    expect(screen.getByRole('heading', { name: 'Diseña un panel cómodo para trabajar' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Rosa luxury/i })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /Amplio/i })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /Cristal suave/i })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /Moderna elegante/i })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Cómo debe ser la imagen')).toBeInTheDocument();
    expect(screen.getByText(/2560 × 1440 px/i)).toBeInTheDocument();
    expect(screen.getByText(/Peso máximo:/i)).toBeInTheDocument();
    expect(screen.getAllByRole('button', { pressed: false }).length).toBeGreaterThan(0);
    expect(api.put).not.toHaveBeenCalled();
  });

  it('sube el fondo a Cloudinary, lo previsualiza y lo guarda para todo el panel', async () => {
    const user = userEvent.setup();
    render(<PanelAdminSection />);
    await screen.findByText('Configuración sincronizada');

    const file = new File(['fondo-panel'], 'fondo-panel.webp', {
      type: 'image/webp',
    });
    await user.upload(
      screen.getByLabelText('Seleccionar imagen de fondo del panel'),
      file
    );

    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith(
        '/api/uploads?profile=admin-panel-background',
        expect.any(FormData),
        { timeout: 60000 }
      )
    );
    expect(await screen.findByText('Imagen lista para usar')).toBeInTheDocument();
    expect(document.documentElement.dataset.adminPanelBackground).toBe('image');
    expect(
      document.documentElement.style.getPropertyValue(
        '--admin-panel-background-image'
      )
    ).toContain('res.cloudinary.com');

    await user.click(screen.getByRole('button', { name: /Guardar apariencia/i }));

    await waitFor(() => expect(api.put).toHaveBeenCalledTimes(1));
    expect(api.put).toHaveBeenCalledWith('/api/site-settings', {
      admin: expect.objectContaining({
        background: {
          enabled: true,
          image: 'https://res.cloudinary.com/demo/image/upload/admin/panel.webp',
        },
      }),
    });
  });

  it('permite quitar una imagen guardada y volver al fondo del tema', async () => {
    const user = userEvent.setup();
    api.get.mockResolvedValueOnce(
      settingsResponse({
        background: {
          enabled: true,
          image: 'https://res.cloudinary.com/demo/image/upload/admin/existing.webp',
        },
      })
    );
    render(<PanelAdminSection />);
    await screen.findByText('Configuración sincronizada');

    await user.click(screen.getByRole('button', { name: /Quitar fondo/i }));

    expect(screen.getByText('Fondo del tema actual')).toBeInTheDocument();
    expect(document.documentElement.dataset.adminPanelBackground).toBe('theme');
    expect(screen.getByText(/El fondo se quitó de la vista previa/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Guardar apariencia/i }));
    await waitFor(() => expect(api.put).toHaveBeenCalledTimes(1));
    expect(api.put).toHaveBeenCalledWith('/api/site-settings', {
      admin: expect.objectContaining({
        background: { enabled: false, image: '' },
      }),
    });
  });

  it('mantiene los cambios como vista previa hasta que el usuario guarda', async () => {
    const user = userEvent.setup();
    render(<PanelAdminSection />);
    await screen.findByText('Configuración sincronizada');

    await user.click(screen.getByRole('button', { name: /Dorado boutique/i }));
    const sidebarControls = screen.getByRole('group', {
      name: 'Amplitud del menú lateral',
    });
    await user.click(within(sidebarControls).getByRole('button', { name: /Compacto/i }));
    const textureControls = screen.getByRole('group', {
      name: 'Textura de los widgets',
    });
    await user.click(within(textureControls).getByRole('button', { name: /Vidrio líquido/i }));

    expect(screen.getByText('Vista previa sin guardar')).toBeInTheDocument();
    expect(document.documentElement.dataset.adminWidgetTexture).toBe('liquidGlass');
    expect(
      document.documentElement.style.getPropertyValue('--admin-widget-surface-radius')
    ).toBe('30px');
    expect(
      document.documentElement.style.getPropertyValue('--admin-widget-surface-border-width')
    ).toBe('1px');
    expect(
      document.documentElement.style.getPropertyValue('--admin-widget-surface-bg')
    ).toContain('rgba(255,255,255,0.34)');
    expect(
      document.documentElement.style.getPropertyValue('--admin-widget-surface-contrast')
    ).toBe('1.06');
    expect(
      document.documentElement.style.getPropertyValue('--admin-card-bg')
    ).toBe('rgba(255, 255, 255, 0.46)');
    expect(
      document.documentElement.style.getPropertyValue('--admin-input-bg')
    ).toBe('rgba(255, 255, 255, 0.58)');
    expect(
      document.documentElement.style.getPropertyValue('--admin-modal-bg')
    ).toBe('rgba(255, 247, 252, 0.82)');
    expect(
      document.documentElement.style.getPropertyValue('--admin-modal-glass-bg')
    ).toContain('rgba(255,255,255,0.96)');
    expect(api.put).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: /Guardar apariencia/i }));

    await waitFor(() => expect(api.put).toHaveBeenCalledTimes(1));
    expect(api.put).toHaveBeenCalledWith('/api/site-settings', {
      admin: expect.objectContaining({
        sidebar: 'compact',
        theme: expect.objectContaining({
          preset: 'goldBoutiqueLight',
          widgetTexture: 'liquidGlass',
          fontPreset: 'modernElegant',
          layout: expect.objectContaining({ density: 'compact', sidebarWidth: 220 }),
        }),
      }),
    });
    expect(await screen.findByText('Apariencia guardada y aplicada en todo el panel.')).toBeInTheDocument();
    expect(screen.getByText('Configuración sincronizada')).toBeInTheDocument();
  });

  it('permite previsualizar y guardar una tipografía para todo el panel', async () => {
    const user = userEvent.setup();
    render(<PanelAdminSection />);
    await screen.findByText('Configuración sincronizada');

    const typographyControls = screen.getByRole('group', {
      name: 'Tipografía del panel',
    });
    await user.click(
      within(typographyControls).getByRole('button', { name: /Boutique editorial/i })
    );

    expect(document.documentElement.dataset.adminFontPreset).toBe('boutiqueEditorial');
    expect(
      document.documentElement.style.getPropertyValue('--admin-font-heading')
    ).toContain('Cormorant Garamond');
    expect(screen.getByText('Vista previa sin guardar')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Guardar apariencia/i }));

    await waitFor(() => expect(api.put).toHaveBeenCalledTimes(1));
    expect(api.put).toHaveBeenCalledWith('/api/site-settings', {
      admin: expect.objectContaining({
        theme: expect.objectContaining({ fontPreset: 'boutiqueEditorial' }),
      }),
    });
  });

  it('previsualiza y guarda Horizonte azul con su fondo integrado', async () => {
    const user = userEvent.setup();
    render(<PanelAdminSection />);
    await screen.findByText('Configuración sincronizada');

    await user.click(screen.getByRole('button', { name: /Horizonte azul/i }));

    expect(screen.getByRole('button', { name: /Horizonte azul/i })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    expect(document.documentElement.dataset.adminThemeMode).toBe('light');
    expect(document.documentElement.dataset.adminThemeStyle).toBe('azure');
    expect(
      document.documentElement.style.getPropertyValue('--admin-theme-background-image')
    ).toContain('azure-horizon-dashboard');
    expect(screen.getByText('Horizonte cristalino')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Guardar apariencia/i }));

    await waitFor(() => expect(api.put).toHaveBeenCalledTimes(1));
    expect(api.put).toHaveBeenCalledWith('/api/site-settings', {
      admin: expect.objectContaining({
        theme: expect.objectContaining({
          preset: 'azureHorizonLight',
          primary: '#2563eb',
        }),
      }),
    });
  });

  it('cancela una vista previa y recupera la selección guardada', async () => {
    const user = userEvent.setup();
    render(<PanelAdminSection />);
    await screen.findByText('Configuración sincronizada');

    await user.click(screen.getByRole('button', { name: /Minimal pro/i }));
    await user.click(screen.getByRole('button', { name: /Perlado/i }));
    expect(screen.getByRole('button', { name: /Minimal pro/i })).toHaveAttribute('aria-pressed', 'true');
    await user.click(screen.getByRole('button', { name: /^Cancelar/i }));

    expect(screen.getByRole('button', { name: /Rosa luxury/i })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /Cristal suave/i })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Vista previa descartada.')).toBeInTheDocument();
    expect(document.documentElement.style.getPropertyValue('--admin-card-bg')).toBe('#ffffff');
    expect(api.put).not.toHaveBeenCalled();
  });

  it('revierte la interfaz al último estado persistido cuando falla el guardado', async () => {
    const user = userEvent.setup();
    api.put.mockRejectedValueOnce({
      response: { data: { message: 'No tienes permiso para modificar el panel.' } },
    });
    render(<PanelAdminSection />);
    await screen.findByText('Configuración sincronizada');

    await user.click(screen.getByRole('button', { name: /Oscuro cyber/i }));
    await user.click(screen.getByRole('button', { name: /Guardar apariencia/i }));

    expect(await screen.findByText('No tienes permiso para modificar el panel.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Rosa luxury/i })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Configuración sincronizada')).toBeInTheDocument();
  });

  it('restaura el diseño predeterminado como borrador y exige confirmación', async () => {
    const user = userEvent.setup();
    render(<PanelAdminSection />);
    await screen.findByText('Configuración sincronizada');

    await user.click(screen.getByRole('button', { name: /Restaurar predeterminado/i }));

    expect(screen.getByRole('button', { name: /Clásico del sistema/i })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /Cristal suave/i })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Configuración predeterminada preparada. Guárdala para aplicarla.')).toBeInTheDocument();
    expect(api.put).not.toHaveBeenCalled();
  });

  it('extiende la textura seleccionada a contenedores propios de todos los módulos', () => {
    applyAdminGlobalStyles();

    const globalStyles = document.getElementById('admin-global-glass-styles');
    expect(globalStyles).not.toBeNull();
    expect(globalStyles.textContent).toContain('[class$="-hero"]');
    expect(globalStyles.textContent).toContain('[class$="-shell"]');
    expect(globalStyles.textContent).toContain('[class$="__shell"]');
    expect(globalStyles.textContent).toContain('[class$="-workspace"]');
    expect(globalStyles.textContent).toContain('[class$="-overview"]');
    expect(globalStyles.textContent).toContain('[class$="-summary"]');
    expect(globalStyles.textContent).toContain('[class$="-surface"]');
    expect(globalStyles.textContent).toContain('[class$="-stats"]');
    expect(globalStyles.textContent).toContain('[class$="-alerts"]');
    expect(globalStyles.textContent).toContain('border-style: solid !important');
    expect(globalStyles.textContent).toContain('background-attachment: fixed !important');
    expect(globalStyles.textContent).toContain('.cart-admin-page');
    expect(globalStyles.textContent).toContain('.favorites-admin-page');
    expect(globalStyles.textContent).toContain('.coupon-form-dialog');
    expect(globalStyles.textContent).toContain('.order-detail-professional-shell');
    expect(globalStyles.textContent).toMatch(
      /:is\(\s*\.store-panel,\s*\.payments-panel\s*\)\s*\{[^}]*background: transparent !important;[^}]*border: 0 !important;[^}]*box-shadow: none !important;[^}]*outline: none !important;/s,
    );
  });
});
