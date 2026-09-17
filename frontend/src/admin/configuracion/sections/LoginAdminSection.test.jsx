import React from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import LoginAdminSection from './LoginAdminSection';
import {
  getAdminLoginSettings,
  updateAdminLoginSettings,
  uploadAdminLoginBackground,
} from '../../api/adminLoginSettingsApi';

vi.mock('../../api/adminLoginSettingsApi', () => ({
  getAdminLoginSettings: vi.fn(),
  updateAdminLoginSettings: vi.fn(),
  uploadAdminLoginBackground: vi.fn(),
}));

function response(overrides = {}) {
  return {
    ok: true,
    settings: {
      theme: 'orbit3d',
      layout: 'centeredCard',
      background: { mode: 'theme', color: '#fff7fb', image: '', imageOpacity: 0.35, overlay: 0.35 },
      ...overrides.settings,
    },
    revision: overrides.revision ?? 2,
    store: { name: 'Rosa Boutique', logo: '' },
    meta: {
      themes: [
        { value: 'orbit3d', label: 'Órbita 3D', description: 'Movimiento espacial.' },
      ],
      layouts: [
        { value: 'centeredCard', label: 'Tarjeta centrada', description: 'Acceso directo.' },
        { value: 'splitPanel', label: 'Panel dividido', description: 'Marca y acceso.' },
      ],
      backgroundModes: [
        { value: 'theme', label: 'Fondo del tema' },
        { value: 'color', label: 'Color sólido' },
        { value: 'image', label: 'Imagen personalizada' },
      ],
      defaults: {
        theme: 'orbit3d',
        layout: 'centeredCard',
        background: { mode: 'theme', color: '#fff7fb', image: '', imageOpacity: 0.35, overlay: 0.35 },
      },
    },
    message: overrides.message,
  };
}

describe('LoginAdminSection', () => {
  afterEach(cleanup);

  beforeEach(() => {
    vi.clearAllMocks();
    getAdminLoginSettings.mockResolvedValue(response());
    updateAdminLoginSettings.mockResolvedValue(response({
      revision: 3,
      settings: { theme: 'neonPortal' },
      message: 'Diseño guardado.',
    }));
    uploadAdminLoginBackground.mockResolvedValue('https://cdn.example.com/login.webp');
  });

  it('carga la identidad y configuración persistente de la tienda', async () => {
    render(<LoginAdminSection />);

    expect(await screen.findByRole('heading', { name: 'Login de Rosa Boutique' })).toBeInTheDocument();
    expect(screen.getByText('Sincronizado')).toBeInTheDocument();
    expect(screen.getByText('Órbita 3D · composición exclusiva')).toBeInTheDocument();
    expect(screen.getByText('Escoge el diseño')).toBeInTheDocument();
    expect(screen.getByText('Todo tu negocio.')).toBeInTheDocument();
    expect(screen.getByText('Versión 2 · se aplicará al login real después de guardar.')).toBeInTheDocument();
    expect(getAdminLoginSettings).toHaveBeenCalledTimes(1);
  });

  it('guarda usando la revisión vigente y no localStorage', async () => {
    const user = userEvent.setup();
    render(<LoginAdminSection />);
    await screen.findByRole('heading', { name: 'Login de Rosa Boutique' });

    await user.selectOptions(screen.getByLabelText('Tema visual'), 'neonPortal');
    await user.click(screen.getByRole('button', { name: 'Personalizar este tema' }));
    await user.click(screen.getByText('Cambiar textos del diseño'));
    await user.clear(screen.getByLabelText('Título principal'));
    await user.type(screen.getByLabelText('Título principal'), 'Mi negocio,');
    expect(screen.getByText('Cambios sin guardar')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Guardar diseño' }));

    await waitFor(() => expect(updateAdminLoginSettings).toHaveBeenCalledTimes(1));
    expect(updateAdminLoginSettings).toHaveBeenCalledWith(expect.objectContaining({
      revision: 2,
      settings: expect.objectContaining({
        theme: 'neonPortal',
        customizations: expect.objectContaining({
          neonPortal: expect.objectContaining({ headline: 'Mi negocio,' }),
        }),
      }),
    }));
    expect(await screen.findByText('Diseño guardado.')).toBeInTheDocument();
  });

  it('muestra solo los controles necesarios para el fondo elegido', async () => {
    const user = userEvent.setup();
    render(<LoginAdminSection />);
    await screen.findByRole('heading', { name: 'Login de Rosa Boutique' });

    expect(screen.queryByText('Imagen publicada')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Personalizar este tema' }));
    await user.click(screen.getByRole('button', { name: 'Imagen personalizada' }));
    expect(screen.getByText('Imagen publicada')).toBeInTheDocument();
    expect(screen.getByText('Subir imagen')).toBeInTheDocument();
  });
});
