import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
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

  it('permite señalar un punto desde la vista previa y colorea cada conexión', () => {
    const onPlaceCard = vi.fn();
    const banner = { templateId: 'atelier', templateConfigs: { atelier: { cards: [
      { categoryId: 'actual-a', x: 26, y: 63, lineColor: '#ef357c' },
      { categoryId: 'actual-b', x: 78, y: 48, lineColor: 'url(evil)' },
    ] } } };
    const { container } = render(<BannerTemplateView banner={banner} sections={categories} preview device="desktop" placingCard={0} onPlaceCard={onPlaceCard}><img src="/mi-foto.jpg" alt="" /></BannerTemplateView>);
    const spots = container.querySelectorAll('.rb-template__spot');
    expect(spots[0].style.getPropertyValue('--rb-spot-color')).toBe('#ef357c');
    expect(spots[1].style.getPropertyValue('--rb-spot-color')).toBe('#ffffff');
    expect(spots[0].querySelector('polyline')).toHaveAttribute('points', '26,63 73,63 73,20 76,20');
    expect(spots[0].querySelector('polyline')).toHaveAttribute('stroke', '#ef357c');
    expect(spots[1].querySelector('polyline')).toHaveAttribute('stroke', '#ffffff');
    const target = screen.getByRole('button', { name: 'Señalar en la imagen el acceso 1' });
    target.getBoundingClientRect = () => ({ left: 20, top: 10, width: 200, height: 100 });
    fireEvent.click(target, { clientX: 120, clientY: 85 });
    expect(onPlaceCard).toHaveBeenCalledWith(0, 50, 75);
  });

  it('usa el color guardado en la tarjeta y en su conexión', () => {
    const banner = { templateId: 'atelier', templateConfigs: { atelier: {
      glassColor: '#75cfff', cards: [{ categoryId: 'actual-a', lineColor: '#c32d72' }],
    } } };
    const { container, rerender } = render(<BannerTemplateView banner={banner} sections={categories}><img src="/mi-foto.jpg" alt="" /></BannerTemplateView>);
    const template = container.querySelector('.rb-template');
    const card = container.querySelector('.rb-template__spot-card');
    expect(template).toHaveStyle({ '--rb-template-glass': '#75cfff' });
    expect(card).toHaveAttribute('href', '/categoria/hogar');
    expect(card.closest('.rb-template__spot')).toHaveStyle({ '--rb-spot-color': '#c32d72' });
    rerender(<BannerTemplateView banner={{ ...banner, templateConfigs: { atelier: { ...banner.templateConfigs.atelier, cards: [{ categoryId: 'actual-a', lineColor: '#18ad7c' }] } } }} sections={categories}><img src="/mi-foto.jpg" alt="" /></BannerTemplateView>);
    expect(container.querySelector('.rb-template__spot-connector polyline')).toHaveAttribute('stroke', '#18ad7c');
  });

  it('desplaza la refracción de la superficie con el puntero sin ampliar el contenido', () => {
    const frames = [];
    const imageData = [];
    const frameSpy = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => { frames.push(callback); return frames.length; });
    const cancelSpy = vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
    const contextSpy = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => ({
      createImageData: (width, height) => {
        const image = { data: new Uint8ClampedArray(width * height * 4) };
        imageData.push(image);
        return image;
      },
      putImageData: () => {},
    }));
    const dataSpy = vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/png;base64,YQ==');
    const { container } = render(<BannerTemplateView banner={{ templateId: 'atelier' }} sections={categories}><img src="/mi-foto.jpg" alt="" /></BannerTemplateView>);
    const card = container.querySelector('.rb-template__spot-card');
    const copy = card.querySelector('.rb-template__spot-copy');
    card.getBoundingClientRect = () => ({ left: 20, top: 10, width: 250, height: 70 });
    const move = (x) => {
      const event = new Event('pointermove', { bubbles: true });
      Object.defineProperties(event, { clientX: { value: x }, clientY: { value: 35 }, pointerType: { value: 'mouse' } });
      fireEvent(card, event);
    };
    move(80);
    expect(card).toHaveAttribute('data-refracting', 'true');
    const lens = card.querySelector('.rb-glass-lens');
    expect(lens.compareDocumentPosition(card.querySelector('.rb-glass-surface')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(card).toHaveStyle({ '--rb-pointer-x': '60px', '--rb-pointer-y': '25px' });
    expect(lens).toHaveAttribute('aria-hidden', 'true');
    expect(card.querySelector('.rb-glass-rim')).toHaveAttribute('aria-hidden', 'true');
    frames.shift()(0);
    expect(card.querySelector('[data-glass-map]')).toHaveAttribute('href', 'data:image/png;base64,YQ==');
    expect(lens.style.filter).toMatch(/^url\(#rb-liquid-/);
    const firstMap = imageData[0].data;
    expect(firstMap[(25 * 250 + 80) * 4]).not.toBe(128);
    expect(firstMap[(65 * 250 + 200) * 4]).toBe(128);
    move(230);
    expect(card).toHaveStyle({ '--rb-pointer-x': '210px' });
    frames.shift()(0);
    expect(imageData[1].data[(25 * 250 + 80) * 4]).toBe(128);
    expect(imageData[1].data[(25 * 250 + 230) * 4]).not.toBe(128);
    expect(copy).not.toHaveAttribute('data-zoom-part');
    expect(copy.style.getPropertyValue('--rb-local-zoom')).toBe('');
    fireEvent.pointerLeave(card);
    expect(card).not.toHaveAttribute('data-refracting');
    expect(lens.style.filter).toBe('');
    frameSpy.mockRestore();
    cancelSpy.mockRestore();
    contextSpy.mockRestore();
    dataSpy.mockRestore();
  });

  it('mantiene el contorno original del botón mientras sigue el puntero', () => {
    const { container } = render(<BannerTemplateView banner={{ templateId: 'atelier' }} sections={categories} />);
    const button = container.querySelector('.rb-liquid-button--secondary');
    button.getBoundingClientRect = () => ({ left: 10, top: 15, width: 120, height: 48 });
    const event = new Event('pointermove', { bubbles: true });
    Object.defineProperties(event, { clientX: { value: 70 }, clientY: { value: 34 }, pointerType: { value: 'mouse' } });
    fireEvent(button, event);
    expect(button).toHaveAttribute('data-refracting', 'true');
    expect(button).toHaveStyle({ '--rb-pointer-x': '60px', '--rb-pointer-y': '19px' });
    expect(button.querySelector('.rb-glass-rim')).toBeInTheDocument();
    expect(button.style.transform).toBe('');
    fireEvent.pointerLeave(button);
    expect(button).not.toHaveAttribute('data-refracting');
  });
});
