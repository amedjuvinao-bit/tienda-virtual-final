import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
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

  it('impide guardar valores iniciales si la carga falla y permite reintentar', async () => {
    const user = userEvent.setup();
    fetchAppearanceSettings
      .mockRejectedValueOnce(new Error('Red no disponible'))
      .mockResolvedValueOnce({ theme: {}, menus: { header: [], footer: [], social: [] }, appearanceRevision: 0 });
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      render(<AppearancePage />);

      expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo cargar Apariencia');
      expect(screen.queryByRole('button', { name: 'Guardar' })).not.toBeInTheDocument();
      expect(saveSiteSettings).not.toHaveBeenCalled();

      await user.click(screen.getByRole('button', { name: 'Reintentar carga' }));
      expect(await screen.findByText('Editor general')).toBeInTheDocument();
      expect(fetchAppearanceSettings).toHaveBeenCalledTimes(2);
      expect(screen.getByRole('button', { name: 'Guardar' })).toBeInTheDocument();
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
