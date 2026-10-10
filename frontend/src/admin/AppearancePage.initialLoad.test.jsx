import React from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import AppearancePage from './AppearancePage';
import { fetchAppearanceSettings, saveSiteSettings } from '../lib/siteSettingsApi';

vi.mock('../lib/siteSettingsApi', () => ({
  fetchAppearanceSettings: vi.fn(),
  saveSiteSettings: vi.fn(),
}));
vi.mock('../lib/api', () => ({ adminFetch: vi.fn().mockResolvedValue({ ok: true, json: async () => [] }) }));
vi.mock('../theme/applyTheme', () => ({ applyTheme: vi.fn() }));
vi.mock('./security/useAdminPermissions', () => ({ default: () => ({ can: () => true }) }));
vi.mock('./appearance/general/GeneralPanel', () => ({ default: () => <div>Editor general</div> }));
vi.mock('./appearance/header/HeaderPanel', () => ({ default: () => null }));
vi.mock('./appearance/banner/BannerPanel', () => ({ default: () => null }));
vi.mock('./appearance/sections/SectionsPanel', () => ({ default: () => null }));
vi.mock('./appearance/footer/FooterPanel', () => ({ default: () => null }));

describe('carga inicial de Apariencia', () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(cleanup);

  it('usa el loader configurado para el panel mientras carga la configuración', async () => {
    let complete;
    fetchAppearanceSettings.mockImplementation(() => new Promise((resolve) => { complete = resolve; }));
    localStorage.setItem('rb_admin_loader_model', 'orbit');
    try {
      render(<AppearancePage />);
      expect(screen.getByRole('status', { name: 'Cargando Apariencia…' })).toHaveClass('admin-loading--orbit');
      expect(screen.queryByText('Cargando apariencia…')).not.toBeInTheDocument();
      complete({ theme: {}, menus: { header: [], footer: [], social: [] }, appearanceRevision: 0 });
      await waitFor(() => expect(screen.getByRole('heading', { name: 'Apariencia de la tienda' })).toBeInTheDocument());
    } finally {
      localStorage.removeItem('rb_admin_loader_model');
    }
  });

  it('impide guardar valores iniciales si la carga falla y permite reintentar', async () => {
    const user = userEvent.setup();
    fetchAppearanceSettings
      .mockRejectedValueOnce(new Error('Red no disponible'))
      .mockResolvedValueOnce({ theme: {}, menus: { header: [], footer: [], social: [] }, appearanceRevision: 0 });
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      render(<AppearancePage />);

      expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo cargar Apariencia');
      expect(screen.queryByRole('button', { name: 'Guardar cambios' })).not.toBeInTheDocument();
      expect(saveSiteSettings).not.toHaveBeenCalled();

      await user.click(screen.getByRole('button', { name: 'Reintentar carga' }));
      expect(await screen.findByText('Editor general')).toBeInTheDocument();
      expect(fetchAppearanceSettings).toHaveBeenCalledTimes(2);
      expect(screen.getByRole('heading', { name: 'Apariencia de la tienda' })).toBeInTheDocument();
      expect(screen.queryByText('Área seleccionada')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Guardar cambios' })).toBeEnabled();
    } finally {
      consoleError.mockRestore();
    }
  });

  it('rechaza una respuesta incompleta en lugar de presentar el diseño predeterminado', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      fetchAppearanceSettings.mockResolvedValue({ theme: {} });
      render(<AppearancePage />);
      expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo cargar Apariencia');
      expect(saveSiteSettings).not.toHaveBeenCalled();
    } finally {
      consoleError.mockRestore();
    }
  });
});
