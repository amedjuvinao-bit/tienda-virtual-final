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
      theme: 'roseLuxuryLight',
      layout: 'centeredCard',
      background: { mode: 'theme', color: '#fff7fb', image: '', imageOpacity: 0.35, overlay: 0.35 },
      ...overrides.settings,
    },
    revision: overrides.revision ?? 2,
    store: { name: 'Rosa Boutique', logo: '' },
    meta: {
      themes: [
        { value: 'roseLuxuryLight', label: 'Rosa luxury claro', description: 'Claro y boutique.' },
        { value: 'minimalPro', label: 'Minimal profesional', description: 'Limpio y corporativo.' },
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
        theme: 'roseLuxuryLight',
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
      settings: { theme: 'minimalPro' },
      message: 'Diseño guardado.',
    }));
    uploadAdminLoginBackground.mockResolvedValue('https://cdn.example.com/login.webp');
  });

  it('carga la identidad y configuración persistente de la tienda', async () => {
    render(<LoginAdminSection />);

    expect(await screen.findByRole('heading', { name: 'Login de Rosa Boutique' })).toBeInTheDocument();
    expect(screen.getByText('Sincronizado')).toBeInTheDocument();
    expect(screen.getByText('Versión 2 · se aplicará al login real después de guardar.')).toBeInTheDocument();
    expect(getAdminLoginSettings).toHaveBeenCalledTimes(1);
  });

  it('guarda usando la revisión vigente y no localStorage', async () => {
    const user = userEvent.setup();
    render(<LoginAdminSection />);
    await screen.findByRole('heading', { name: 'Login de Rosa Boutique' });

    await user.selectOptions(screen.getByLabelText('Tema visual'), 'minimalPro');
    expect(screen.getByText('Cambios sin guardar')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Guardar diseño' }));

    await waitFor(() => expect(updateAdminLoginSettings).toHaveBeenCalledTimes(1));
    expect(updateAdminLoginSettings).toHaveBeenCalledWith(expect.objectContaining({
      revision: 2,
      settings: expect.objectContaining({ theme: 'minimalPro' }),
    }));
    expect(await screen.findByText('Diseño guardado.')).toBeInTheDocument();
  });

  it('muestra solo los controles necesarios para el fondo elegido', async () => {
    const user = userEvent.setup();
    render(<LoginAdminSection />);
    await screen.findByRole('heading', { name: 'Login de Rosa Boutique' });

    expect(screen.queryByText('Imagen publicada')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Imagen personalizada' }));
    expect(screen.getByText('Imagen publicada')).toBeInTheDocument();
    expect(screen.getByText('Subir imagen')).toBeInTheDocument();
  });
});
