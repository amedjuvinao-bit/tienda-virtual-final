import { afterEach, describe, expect, it } from 'vitest';

import {
  applyAdminPanelBackground,
  normalizeAdminPanelBackground,
} from './adminPanelBackground';

describe('fondo global del panel administrativo', () => {
  afterEach(() => {
    applyAdminPanelBackground({ enabled: false, image: '' });
  });

  it('acepta únicamente imágenes HTTPS servidas por Cloudinary', () => {
    expect(
      normalizeAdminPanelBackground({
        enabled: true,
        image: 'https://res.cloudinary.com/demo/image/upload/panel.webp',
      })
    ).toEqual({
      enabled: true,
      image: 'https://res.cloudinary.com/demo/image/upload/panel.webp',
    });

    expect(
      normalizeAdminPanelBackground({
        enabled: true,
        image: 'javascript:alert(1)',
      })
    ).toEqual({ enabled: false, image: '' });
  });

  it('aplica la imagen como variable global o vuelve al fondo del tema', () => {
    applyAdminPanelBackground({
      enabled: true,
      image: 'https://res.cloudinary.com/demo/image/upload/panel.webp',
    });

    expect(document.documentElement.dataset.adminPanelBackground).toBe('image');
    expect(
      document.documentElement.style.getPropertyValue(
        '--admin-panel-background-image'
      )
    ).toContain('res.cloudinary.com');

    applyAdminPanelBackground({ enabled: false, image: '' });
    expect(document.documentElement.dataset.adminPanelBackground).toBe('theme');
    expect(
      document.documentElement.style.getPropertyValue(
        '--admin-panel-background-image'
      )
    ).toBe('none');
  });
});
