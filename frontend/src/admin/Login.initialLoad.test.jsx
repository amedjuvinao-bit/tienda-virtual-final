import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import Login from './Login';
import { fetchSiteSettings } from '../lib/siteSettingsApi';

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ login: vi.fn() }),
}));

vi.mock('../lib/siteSettingsApi', () => ({
  fetchSiteSettings: vi.fn(),
}));

describe('Login durante la carga inicial', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
  });

  afterEach(cleanup);

  it('espera al backend sin mostrar un login genérico tras fallar la configuración', async () => {
    fetchSiteSettings.mockRejectedValueOnce(new Error('backend no disponible'));
    const { container } = render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>,
    );

    expect(await screen.findByRole('status', { name: 'Esperando configuración del servidor…' })).toBeInTheDocument();
    expect(screen.queryByText('Hola de nuevo')).not.toBeInTheDocument();
    expect(container.querySelector('[data-login-theme]')).not.toBeInTheDocument();
  });

  it('no muestra el tema predeterminado antes de recibir el tema guardado', async () => {
    let resolveSettings;
    fetchSiteSettings.mockReturnValueOnce(new Promise((resolve) => {
      resolveSettings = resolve;
    }));

    const { container } = render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>,
    );

    expect(screen.getByRole('status', { name: 'Preparando acceso seguro…' })).toBeInTheDocument();
    expect(container.querySelector('[data-login-theme]')).not.toBeInTheDocument();
    expect(screen.queryByText('Hola de nuevo')).not.toBeInTheDocument();

    await act(async () => {
      resolveSettings({
        loginAdmin: { theme: 'smokeGlass', layout: 'centeredCard' },
        store: { name: 'Rosa Boutique' },
      });
    });

    await waitFor(() => {
      expect(container.querySelector('[data-login-theme="smokeGlass"]')).toBeInTheDocument();
    });
    expect(screen.queryByRole('status', { name: 'Preparando acceso seguro…' })).not.toBeInTheDocument();
  });

  it('usa los ajustes que ya cargó la aplicación sin hacer otra petición', async () => {
    const { container } = render(
      <MemoryRouter>
        <Login initialSettings={{
          loginAdmin: { theme: 'smokeGlass', layout: 'centeredCard' },
          store: { name: 'Rosa Boutique' },
        }} loaderModel="orbit" />
      </MemoryRouter>,
    );

    await waitFor(() => expect(container.querySelector('[data-login-theme="smokeGlass"]')).toBeInTheDocument());
    expect(fetchSiteSettings).not.toHaveBeenCalled();
  });

  it('muestra y comunica el estado del control Recordar usuario', async () => {
    fetchSiteSettings.mockResolvedValueOnce({
      loginAdmin: { theme: 'liquidGlass', layout: 'centeredCard' },
      store: { name: 'Rosa Boutique' },
    });

    const { container } = render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>,
    );

    const rememberButton = await screen.findByRole('button', { name: 'Recordar usuario' });
    const indicator = container.querySelector('.rb-curated-auth__check');
    expect(rememberButton).toHaveAttribute('aria-pressed', 'false');
    expect(indicator).not.toHaveClass('active');

    fireEvent.click(rememberButton);

    expect(rememberButton).toHaveAttribute('aria-pressed', 'true');
    expect(indicator).toHaveClass('active');
  });
});
