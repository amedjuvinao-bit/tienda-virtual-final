import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
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
    updateAdminLoginSettings.mockImplementation(async ({ settings }) => response({
      revision: 3,
      settings,
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

  it('no anuncia éxito si el servidor devuelve otra transparencia', async () => {
    const user = userEvent.setup();
    updateAdminLoginSettings.mockResolvedValueOnce(response({
      revision: 3,
      settings: {
        theme: 'smokeGlass',
        background: { mode: 'image', color: '#07132f', image: 'https://cdn.example.com/perla.webp', imageOpacity: 1, overlay: 0, glassTransparency: 0.35 },
      },
    }));
    render(<LoginAdminSection />);
    await screen.findByRole('heading', { name: 'Login de Rosa Boutique' });

    await user.selectOptions(screen.getByLabelText('Tema visual'), 'smokeGlass');
    await user.click(screen.getByRole('button', { name: 'Personalizar este tema' }));
    await user.click(screen.getByRole('button', { name: 'Imagen personalizada' }));
    await user.type(screen.getByPlaceholderText('https://...'), 'https://cdn.example.com/perla.webp');
    fireEvent.change(screen.getByRole('slider', { name: 'Transparencia del contenedor' }), { target: { value: '0.8' } });
    await user.click(screen.getByRole('button', { name: 'Guardar diseño' }));

    expect(await screen.findByText('El servidor no confirmó todos los cambios. Reinicia el backend y vuelve a guardar.')).toBeInTheDocument();
  });

  it('reemplaza los paneles de Cristal Perla por un vidrio único al usar una imagen', async () => {
    getAdminLoginSettings.mockResolvedValueOnce(response({
      settings: {
        theme: 'smokeGlass',
        background: {
          mode: 'image',
          color: '#16324a',
          image: 'https://cdn.example.com/login.webp',
          imageOpacity: 0.8,
          overlay: 0.2,
        },
      },
    }));
    const { container } = render(<LoginAdminSection />);
    await screen.findByRole('heading', { name: 'Login de Rosa Boutique' });

    const preview = container.querySelector('[data-preview-theme="smokeGlass"]');
    expect(preview).toHaveAttribute('data-custom-image', 'true');
    expect(preview.querySelectorAll('.login-settings-theme-motion i')).toHaveLength(0);
  });

  it('aplica el vidrio completo y la transparencia independiente a Cristal Líquido', async () => {
    getAdminLoginSettings.mockResolvedValueOnce(response({
      settings: {
        theme: 'liquidGlass',
        background: {
          mode: 'image',
          color: '#16324a',
          image: 'https://cdn.example.com/liquido.webp',
          imageOpacity: 0.9,
          overlay: 0.1,
          glassTransparency: 0.6,
        },
      },
    }));
    const user = userEvent.setup();
    const { container } = render(<LoginAdminSection />);
    await screen.findByRole('heading', { name: 'Login de Rosa Boutique' });

    let preview = container.querySelector('[data-preview-theme="liquidGlass"]');
    expect(preview).toHaveAttribute('data-custom-image', 'true');
    expect(preview.querySelectorAll('.login-settings-theme-motion i')).toHaveLength(0);
    expect(preview.style.getPropertyValue('--liquid-glass-opacity')).toBe('0.4');

    await user.click(screen.getByRole('button', { name: 'Personalizar este tema' }));
    fireEvent.change(screen.getByRole('slider', { name: 'Transparencia del contenedor' }), { target: { value: '0.8' } });
    preview = container.querySelector('[data-preview-theme="liquidGlass"]');
    expect(preview.style.getPropertyValue('--liquid-glass-opacity')).toBeCloseTo(0.2);

    await user.click(screen.getByRole('button', { name: 'Guardar diseño' }));
    await waitFor(() => expect(updateAdminLoginSettings).toHaveBeenCalledTimes(1));
    expect(updateAdminLoginSettings).toHaveBeenCalledWith(expect.objectContaining({
      settings: expect.objectContaining({
        backgrounds: expect.objectContaining({
          liquidGlass: expect.objectContaining({ glassTransparency: 0.8 }),
        }),
      }),
    }));
  });

  it('mantiene el fondo de cada tema independiente y controla la transparencia del vidrio', async () => {
    getAdminLoginSettings.mockResolvedValueOnce(response({
      settings: {
        theme: 'smokeGlass',
        background: {
          mode: 'image',
          color: '#16324a',
          image: 'https://cdn.example.com/perla.webp',
          imageOpacity: 0.8,
          overlay: 0.2,
          glassTransparency: 0.25,
        },
        backgrounds: {
          liquidGlass: { mode: 'theme', color: '#07132f', image: '', imageOpacity: 0.35, overlay: 0.35, glassTransparency: 0.35 },
          immersiveGallery: { mode: 'theme', color: '#07132f', image: '', imageOpacity: 0.35, overlay: 0.35, glassTransparency: 0.35 },
          smokeGlass: { mode: 'image', color: '#16324a', image: 'https://cdn.example.com/perla.webp', imageOpacity: 0.8, overlay: 0.2, glassTransparency: 0.25 },
        },
      },
    }));
    const user = userEvent.setup();
    const { container } = render(<LoginAdminSection />);
    await screen.findByRole('heading', { name: 'Login de Rosa Boutique' });

    let preview = container.querySelector('[data-preview-theme="smokeGlass"]');
    expect(container.querySelector('.login-settings-preview-image').style.backgroundImage).toContain('perla.webp');
    expect(preview.style.getPropertyValue('--smoke-glass-opacity')).toBe('0.75');
    expect(preview.style.getPropertyValue('--smoke-glass-blur')).toBe('7.5px');

    await user.click(screen.getByRole('button', { name: 'Personalizar este tema' }));
    const transparency = screen.getByRole('slider', { name: 'Transparencia del contenedor' });
    fireEvent.change(transparency, { target: { value: '0.7' } });
    preview = container.querySelector('[data-preview-theme="smokeGlass"]');
    expect(preview.style.getPropertyValue('--smoke-glass-opacity')).toBeCloseTo(0.3);
    expect(preview.style.getPropertyValue('--smoke-glass-blur')).toBe('3px');

    await user.selectOptions(screen.getByLabelText('Tema visual'), 'liquidGlass');
    preview = container.querySelector('[data-preview-theme="liquidGlass"]');
    expect(preview).not.toHaveAttribute('data-custom-image');
    expect(container.querySelector('.login-settings-preview-image').style.backgroundImage).not.toContain('perla.webp');

    await user.click(screen.getByRole('button', { name: 'Guardar diseño' }));
    await waitFor(() => expect(updateAdminLoginSettings).toHaveBeenCalledTimes(1));
    expect(updateAdminLoginSettings).toHaveBeenCalledWith(expect.objectContaining({
      settings: expect.objectContaining({
        backgrounds: expect.objectContaining({
          liquidGlass: expect.objectContaining({ mode: 'theme', image: '' }),
          smokeGlass: expect.objectContaining({
            image: 'https://cdn.example.com/perla.webp',
            glassTransparency: 0.7,
          }),
        }),
      }),
    }));
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
