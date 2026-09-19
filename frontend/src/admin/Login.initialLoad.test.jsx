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

    expect(screen.getByLabelText('Preparando acceso administrativo')).toBeInTheDocument();
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
    expect(screen.queryByLabelText('Preparando acceso administrativo')).not.toBeInTheDocument();
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
