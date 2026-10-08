import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import BannerTemplateView from './BannerTemplateView';
import BannerDevicePreview from '../admin/appearance/banner/BannerDevicePreview';
import { getBannerTemplate } from '../lib/bannerTemplates';

const categories = [{ id: 'categorias', type: 'categorias', config: { slides: [
  { id: 'actual-a', title: 'Hogar', href: '/categoria/hogar', image: '/hogar.jpg', enabled: true },
  { id: 'actual-b', title: 'Tecnología', href: '/categoria/tecnologia', image: '/tecnologia.jpg', enabled: true },
  { id: 'oculta', title: 'Oculta', href: '/categoria/oculta', enabled: false },
] } }];

describe('plantillas sobre contenido existente', () => {
  it('toma categorías configuradas y conserva la configuración propia de cada diseño', () => {
    const banner = { templateId: 'discovery', templateConfigs: {
      discovery: { title: 'Nuestra selección', cards: [{ categoryId: 'actual-b', text: 'Explora tecnología', link: '/ofertas' }] },
      editorial: { title: 'Editorial propio' },
    } };
    const selected = getBannerTemplate(banner, categories);
    expect(selected.config.title).toBe('Nuestra selección');
    expect(selected.config.cards).toEqual([expect.objectContaining({ text: 'Explora tecnología', image: '/tecnologia.jpg', link: '/ofertas' })]);
    expect(getBannerTemplate({ ...banner, templateId: 'editorial' }, categories).config.title).toBe('Editorial propio');
    expect(selected.categories.map((entry) => entry.title)).toEqual(['Hogar', 'Tecnología']);
  });

  it('usa el mismo diseño para galería, imagen única y video en la vista previa', () => {
    for (const [type, media] of [['slider', '/una.jpg'], ['image', '/dos.jpg'], ['video', '/tres.mp4']]) {
      const banner = { type, templateId: 'editorial', slides: [{ image: media }], imageUrl: media, videoUrl: media };
      const { container, unmount } = render(<BannerDevicePreview banner={banner} sections={categories} slides={banner.slides} selectedIdx={0} device="mobile" onEdit={() => {}} />);
      expect(container.querySelector('[data-banner-template="editorial"]')).toBeTruthy();
      expect(container.querySelector(type === 'video' ? 'video' : '.banner-preview-media')?.getAttribute('src')).toBe(media);
      unmount();
    }
  });

  it('muestra botones y enlaces seguros; los puntos de la vitrina abren la categoría existente', () => {
    const banner = { templateId: 'atelier', templateConfigs: { atelier: {
      primary: { text: 'Comprar', link: 'javascript:alert(1)' },
      secondary: { text: 'Explorar', link: '/catalogo' },
    } } };
    const { container } = render(<BannerTemplateView banner={banner} sections={categories}><img src="/mi-foto.jpg" alt="" /></BannerTemplateView>);
    expect(screen.getByRole('heading', { name: 'Objetos para descubrir' })).toBeTruthy();
    expect(container.querySelector('.rb-template__picture img')?.getAttribute('src')).toBe('/mi-foto.jpg');
    expect(screen.getByText('Comprar').closest('a')).toBeNull();
    expect(container.querySelector('.rb-liquid-button--secondary')?.getAttribute('href')).toBe('/catalogo');
    fireEvent.click(screen.getByRole('button', { name: 'Hogar' }));
    const hotspot = screen.getByRole('button', { name: 'Hogar' });
    expect(hotspot).toBePressed();
    expect(hotspot).not.toHaveTextContent('+');
    expect(container.querySelector('.rb-template__spot-connector polyline')).toBeInTheDocument();
    expect(container.querySelector('.rb-template__spot-card[data-open="true"]')?.getAttribute('href')).toBe('/categoria/hogar');
  });
});
