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
      theme: 'liquidGlass',
      layout: 'centeredCard',
      background: { mode: 'theme', color: '#16324a', image: '', imageOpacity: 0.35, overlay: 0.35 },
      ...overrides.settings,
    },
    revision: overrides.revision ?? 2,
    store: { name: 'Rosa Boutique', logo: 'https://cdn.example.com/logo.png' },
    meta: {
      themes: [
        { value: 'liquidGlass', label: 'Cristal Líquido', description: 'Cristal luminoso.' },
        { value: 'immersiveGallery', label: 'Galería Inmersiva', description: 'Imagen protagonista.' },
        { value: 'smokeGlass', label: 'Cristal Humo', description: 'Vidrio oscuro.' },
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
        theme: 'liquidGlass',
        layout: 'centeredCard',
        background: { mode: 'theme', color: '#16324a', image: '', imageOpacity: 0.35, overlay: 0.35 },
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
      settings: { theme: 'smokeGlass' },
      message: 'Diseño guardado.',
    }));
    uploadAdminLoginBackground.mockResolvedValue('https://cdn.example.com/login.webp');
  });

  it('carga la identidad y configuración persistente de la tienda', async () => {
    render(<LoginAdminSection />);

    expect(await screen.findByRole('heading', { name: 'Login de Rosa Boutique' })).toBeInTheDocument();
    expect(screen.getByText('Sincronizado')).toBeInTheDocument();
    expect(screen.getByText('Cristal Líquido · composición exclusiva')).toBeInTheDocument();
    expect(screen.getByText('Escoge el diseño')).toBeInTheDocument();
    expect(screen.getByText('Claridad que fluye.')).toBeInTheDocument();
    expect(screen.getAllByAltText('Logo de Rosa Boutique').length).toBeGreaterThan(0);
    expect(screen.getAllByRole('option')).toHaveLength(3);
    expect(screen.getByText('Versión 2 · se aplicará al login real después de guardar.')).toBeInTheDocument();
    expect(getAdminLoginSettings).toHaveBeenCalledTimes(1);
  });

  it('guarda usando la revisión vigente y no localStorage', async () => {
    const user = userEvent.setup();
    render(<LoginAdminSection />);
    await screen.findByRole('heading', { name: 'Login de Rosa Boutique' });

    await user.selectOptions(screen.getByLabelText('Tema visual'), 'smokeGlass');
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
        theme: 'smokeGlass',
        customizations: expect.objectContaining({
          smokeGlass: expect.objectContaining({ headline: 'Mi negocio,' }),
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

  it('permite cambiar la imagen terminada de Galería Inmersiva', async () => {
    const user = userEvent.setup();
    const { container } = render(<LoginAdminSection />);
    await screen.findByRole('heading', { name: 'Login de Rosa Boutique' });

    await user.selectOptions(screen.getByLabelText('Tema visual'), 'immersiveGallery');
    await user.click(screen.getByRole('button', { name: 'Personalizar este tema' }));
    expect(screen.getByText('Color real de la imagen')).toBeInTheDocument();
    const previewImage = container.querySelector('.login-settings-preview-image');
    const blackBackground = previewImage.style.backgroundImage;
    await user.click(screen.getByRole('button', { name: 'Usar tonalidad Rosa y dorado' }));
    expect(screen.getByRole('button', { name: 'Usar tonalidad Rosa y dorado' })).toHaveAttribute('aria-pressed', 'true');
    expect(previewImage.style.backgroundImage).not.toBe(blackBackground);
    expect(previewImage.style.backgroundImage).toContain('gallery-immersive-rose-gold');

    await user.click(screen.getByRole('button', { name: 'Guardar diseño' }));
    await waitFor(() => expect(updateAdminLoginSettings).toHaveBeenCalledTimes(1));
    expect(updateAdminLoginSettings).toHaveBeenCalledWith(expect.objectContaining({
      settings: expect.objectContaining({
        customizations: expect.objectContaining({
          immersiveGallery: expect.objectContaining({ imageTone: 'roseGold' }),
        }),
      }),
    }));
  });
});
