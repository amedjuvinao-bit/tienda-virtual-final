import React from 'react';
import { cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import CarouselBanner from './CarouselBanner';

vi.mock('keen-slider/react', () => ({ useKeenSlider: () => [() => {}, { current: null }] }));
vi.mock('../lib/siteSettingsApi', () => ({ fetchSiteSettings: vi.fn().mockResolvedValue({ theme: {} }) }));

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('portada pública con diseño opcional', () => {
  it('aplica la misma plantilla a toda la galería y conserva las imágenes al mostrarla sola', async () => {
    const slides = [
      { image: '/uno.jpg', button: { enabled: true, kind: 'text', text: 'Viejo' } },
      { image: '/dos.jpg', button: { enabled: true, kind: 'text', text: 'Viejo 2' } },
    ];
    const { container, rerender } = render(<CarouselBanner bannerOverride={{ type: 'slider', templateId: 'discovery', slides }} />);
    await waitFor(() => expect(container.querySelector('.rb-template__picture .keen-slider')).toBeInTheDocument());
    expect(Array.from(container.querySelectorAll('.rb-template__picture .keen-slider__slide img')).map((img) => img.getAttribute('src'))).toEqual(['/uno.jpg', '/dos.jpg']);

    rerender(<CarouselBanner bannerOverride={{ type: 'slider', templateId: 'plain', slides }} />);
    await waitFor(() => expect(container.querySelector('.rb-template')).not.toBeInTheDocument());
    expect(Array.from(container.querySelectorAll('.keen-slider__slide img')).map((img) => img.getAttribute('src'))).toEqual(['/uno.jpg', '/dos.jpg']);
    expect(container.querySelector('[data-rb-btn]')).not.toBeInTheDocument();
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
