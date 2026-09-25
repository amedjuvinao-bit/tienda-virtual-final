import fs from 'node:fs';
import { JSDOM } from 'jsdom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchSiteSettings } from './siteSettingsApi';

afterEach(() => {
  delete globalThis.__adminInitialSettingsPromise;
  vi.unstubAllGlobals();
});

describe('configuración del indicador desde el arranque', () => {
  it('colorea el indicador y selecciona su modelo antes de montar React', async () => {
    const html = fs.readFileSync('index.html', 'utf8')
      .replace('%VITE_API_BASE_URL%', 'http://localhost:5000');
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        loginAdmin: { theme: 'immersiveGallery', customizations: { immersiveGallery: { primary: '#DD4488' } } },
        admin: { theme: { primary: '#2244AA' }, loader: { model: 'pulse' } },
      }),
    });
    const page = new JSDOM(html, {
      url: 'http://localhost:5173/admin/login',
      runScripts: 'dangerously',
      beforeParse(window) { window.fetch = fetchMock; },
    });

    await page.window.__adminInitialSettingsPromise;
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(page.window.document.documentElement.dataset.adminLoader).toBe('pulse');
    expect(page.window.document.documentElement.style.getPropertyValue('--rb-loader-login-color')).toBe('#DD4488');
    expect(page.window.localStorage.getItem('rb_admin_loader_panel_color')).toBe('#2244AA');
    page.window.close();
  });

  it('reutiliza la primera respuesta sin repetir la petición y permite recargar después', async () => {
    const first = { admin: { loader: { model: 'pulse' } } };
    const second = { admin: { loader: { model: 'halo' } } };
    globalThis.__adminInitialSettingsPromise = Promise.resolve(first);
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => second });
    vi.stubGlobal('fetch', fetchMock);

    expect(await fetchSiteSettings()).toEqual(first);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(await fetchSiteSettings()).toEqual(second);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
