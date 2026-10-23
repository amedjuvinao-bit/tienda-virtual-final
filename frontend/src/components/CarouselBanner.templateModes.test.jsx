import React from 'react';
import { cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import CarouselBanner from './CarouselBanner';
import { StorefrontSettingsContext } from '../context/StorefrontSettingsContext';
import { fetchSiteSettings } from '../lib/siteSettingsApi';

vi.mock('keen-slider/react', () => ({ useKeenSlider: () => [() => {}, { current: null }] }));
vi.mock('../lib/siteSettingsApi', () => ({ fetchSiteSettings: vi.fn().mockResolvedValue({ theme: {} }) }));

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('portada pública con diseño opcional', () => {
  it('reutiliza la configuración de la aplicación sin consultas ni portada provisional', async () => {
    const view = settings => <StorefrontSettingsContext.Provider value={settings}><CarouselBanner /></StorefrontSettingsContext.Provider>;
    const { container, rerender } = render(view(null));
    expect(container.querySelector('img')).toBeNull();
    expect(fetchSiteSettings).not.toHaveBeenCalled();
    rerender(view({ theme: { banner: { type: 'image', templateId: 'plain', imageUrl: '/configurada.jpg' } } }));
    await waitFor(() => expect(container.querySelector('img')).toHaveAttribute('src', '/configurada.jpg'));
    window.dispatchEvent(new Event('focus'));
    window.dispatchEvent(new StorageEvent('storage', { key: 'rb_site_settings_tick' }));
    expect(fetchSiteSettings).not.toHaveBeenCalled();
    rerender(view({ theme: { banner: { type: 'image', templateId: 'plain', imageUrl: '/actualizada.jpg' } } }));
    await waitFor(() => expect(container.querySelector('img')).toHaveAttribute('src', '/actualizada.jpg'));
  });

  it('aplica la misma plantilla a toda la galería y conserva las imágenes al mostrarla sola', async () => {
    const slides = [
      { image: '/uno.jpg', button: { enabled: true, kind: 'text', text: 'Viejo' } },
      { image: '/dos.jpg', button: { enabled: true, kind: 'text', text: 'Viejo 2' } },
    ];
    const { container, rerender } = render(<CarouselBanner bannerOverride={{ type: 'slider', templateId: 'discovery', slides }} />);
    await waitFor(() => expect(container.querySelector('.rb-template__picture .keen-slider')).toBeInTheDocument());
    expect(Array.from(container.querySelectorAll('.rb-template__picture .keen-slider__slide img')).map((img) => img.getAttribute('src'))).toEqual(['/uno.jpg', '/dos.jpg']);
    expect(container.querySelector('.rb-slider-controls')).toHaveStyle({ '--rb-slider-color': '#ffffff' });
    expect(container.querySelector('.rb-slider-controls__counter')).not.toBeInTheDocument();

    rerender(<CarouselBanner bannerOverride={{ type: 'slider', templateId: 'plain', slides }} />);
    await waitFor(() => expect(container.querySelector('.rb-template')).not.toBeInTheDocument());
    expect(Array.from(container.querySelectorAll('.keen-slider__slide img')).map((img) => img.getAttribute('src'))).toEqual(['/uno.jpg', '/dos.jpg']);
    expect(container.querySelector('[data-rb-btn]')).not.toBeInTheDocument();
    expect(container.querySelector('.rb-slider-controls')).toBeInTheDocument();

    rerender(<CarouselBanner bannerOverride={{ type: 'slider', templateId: 'discovery', slides, sliderControlColor: '#bd8db5', sliderShowControls: false }} />);
    await waitFor(() => expect(container.querySelector('.rb-slider-controls')).not.toBeInTheDocument());

    rerender(<CarouselBanner bannerOverride={{ type: 'slider', templateId: 'discovery', slides, sliderControlColor: '#bd8db5', sliderControlTheme: 'editorial', sliderControlPosition: 'bottom', sliderControlSize: 120, sliderShowControls: true }} />);
    await waitFor(() => expect(container.querySelector('.rb-slider-controls')).toHaveStyle({ '--rb-slider-color': '#bd8db5', '--rb-slider-scale': '1.2' }));
    expect(container.querySelector('.rb-slider-controls')).toHaveAttribute('data-theme', 'editorial');
    expect(container.querySelector('.rb-slider-controls')).toHaveAttribute('data-position', 'bottom');
  });

  it('mantiene el mismo video con o sin plantilla y oculta el botón antiguo en modo solo archivo', async () => {
    const base = { type: 'video', videoUrl: '/portada.mp4', videoButton: { enabled: true, kind: 'text', text: 'Viejo' } };
    const { container, rerender } = render(<CarouselBanner bannerOverride={{ ...base, templateId: 'editorial' }} />);
    await waitFor(() => expect(container.querySelector('.rb-template video')).toHaveAttribute('src', '/portada.mp4'));
    rerender(<CarouselBanner bannerOverride={{ ...base, templateId: 'plain' }} />);
    await waitFor(() => expect(container.querySelector('.rb-template')).not.toBeInTheDocument());
    expect(container.querySelector('video')).toHaveAttribute('src', '/portada.mp4');
    expect(container.querySelector('[data-rb-btn]')).not.toBeInTheDocument();
  });
});
