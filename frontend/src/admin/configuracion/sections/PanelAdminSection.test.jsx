import React from 'react';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import PanelAdminSection from './PanelAdminSection';
import api from '../../../lib/api';

vi.mock('../../../lib/api', () => ({
  default: {
    get: vi.fn(),
    put: vi.fn(),
  },
}));

function settingsResponse({
  preset = 'roseLuxuryLight',
  sidebar = 'expanded',
  widgetTexture = 'softGlass',
} = {}) {
  return {
    data: {
      admin: {
        sidebar,
        theme: {
          preset,
          widgetTexture,
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
    api.get.mockResolvedValue(settingsResponse());
    api.put.mockImplementation(async (_url, body) => ({
      data: { admin: body.admin },
    }));
  });

  it('carga la configuración protegida y presenta controles claros sin guardar', async () => {
    render(<PanelAdminSection />);

    expect(await screen.findByText('Configuración sincronizada')).toBeInTheDocument();
    expect(api.get).toHaveBeenCalledWith('/api/site-settings/admin');
    expect(screen.getByRole('heading', { name: 'Diseña un panel cómodo para trabajar' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Rosa luxury/i })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /Amplio/i })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /Cristal suave/i })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getAllByRole('button', { pressed: false }).length).toBeGreaterThan(0);
    expect(api.put).not.toHaveBeenCalled();
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
    expect(api.put).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: /Guardar apariencia/i }));

    await waitFor(() => expect(api.put).toHaveBeenCalledTimes(1));
    expect(api.put).toHaveBeenCalledWith('/api/site-settings', {
      admin: expect.objectContaining({
        sidebar: 'compact',
        theme: expect.objectContaining({
          preset: 'goldBoutiqueLight',
          widgetTexture: 'liquidGlass',
          layout: expect.objectContaining({ density: 'compact', sidebarWidth: 220 }),
        }),
      }),
    });
    expect(await screen.findByText('Apariencia guardada y aplicada en todo el panel.')).toBeInTheDocument();
    expect(screen.getByText('Configuración sincronizada')).toBeInTheDocument();
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
});
