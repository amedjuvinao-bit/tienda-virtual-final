import { beforeEach, describe, expect, it } from 'vitest';
import {
  ADMIN_LOADER_LOGIN_COLOR_KEY,
  ADMIN_LOADER_PANEL_COLOR_KEY,
  rememberAdminLoadingColors,
} from './adminLoaderConfig';

describe('colores del indicador administrativo', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.style.removeProperty('--rb-loader-login-color');
    document.documentElement.style.removeProperty('--rb-loader-panel-color');
  });

  it('usa el color principal configurado del tema activo de login y del panel', () => {
    rememberAdminLoadingColors({
      loginAdmin: {
        theme: 'immersiveGallery',
        customizations: { immersiveGallery: { primary: '#34ABCD' } },
      },
      admin: { theme: { primary: '#EE3399' } },
    });

    expect(localStorage.getItem(ADMIN_LOADER_LOGIN_COLOR_KEY)).toBe('#34abcd');
    expect(localStorage.getItem(ADMIN_LOADER_PANEL_COLOR_KEY)).toBe('#ee3399');
    expect(document.documentElement.style.getPropertyValue('--rb-loader-login-color')).toBe('#34abcd');
    expect(document.documentElement.style.getPropertyValue('--rb-loader-panel-color')).toBe('#ee3399');
  });

  it('conserva el color anterior si una respuesta no trae un color válido', () => {
    rememberAdminLoadingColors({ admin: { theme: { primary: '#315d73' } } });
    rememberAdminLoadingColors({ admin: { theme: { primary: 'url(javascript:invalid)' } } });

    expect(localStorage.getItem(ADMIN_LOADER_PANEL_COLOR_KEY)).toBe('#315d73');
  });
});
