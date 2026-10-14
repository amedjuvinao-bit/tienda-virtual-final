import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
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
  it('aplica a las tarjetas inferiores la animación elegida para los botones', () => {
    for (const templateId of ['discovery', 'editorial']) {
      for (const buttonAnimation of ['prism', 'pearl', 'aurora', 'rose']) {
        const banner = { templateId, templateConfigs: { [templateId]: { buttonAnimation } } };
        const { container, unmount } = render(<BannerTemplateView banner={banner} sections={categories} />);
        expect(container.querySelector('.rb-template')).toHaveAttribute('data-button-animation', buttonAnimation);
        const cards = container.querySelectorAll('.rb-template__card');
        expect(cards).toHaveLength(2);
        cards.forEach((card) => {
          card.getBoundingClientRect = () => ({ left: 10, top: 20, width: 160, height: 64 });
          fireEvent(card, new MouseEvent('pointermove', { bubbles: true, clientX: 90, clientY: 52 }));
          expect(card.style.getPropertyValue('--rb-light-x')).toBe('50%');
          expect(card.style.getPropertyValue('--rb-turn-x')).toBe('0.00deg');
        });
        unmount();
      }
    }
  });
  it('arrastra una tarjeta y conserva la ubicación al mostrar la tienda', () => {
    const onMoveCard = vi.fn();
    const banner = { templateId: 'atelier', templateConfigs: { atelier: { cards: [
      { categoryId: 'actual-a', x: 26, y: 63 }, { categoryId: 'actual-b', x: 78, y: 48 },
    ] } } };
    const { container, rerender, unmount } = render(<BannerTemplateView banner={banner} sections={categories} preview device="desktop" onMoveCard={onMoveCard} />);
    const root = container.querySelector('.rb-template');
    const card = container.querySelector('.rb-template__spot-card');
    root.getBoundingClientRect = () => ({ left: 0, top: 0, width: 1000, height: 400 });
    card.getBoundingClientRect = () => ({ left: 760, top: 50, width: 220, height: 60 });
    fireEvent(card, new MouseEvent('pointerdown', { bubbles: true, button: 0, clientX: 870, clientY: 80 }));
    fireEvent(card, new MouseEvent('pointermove', { bubbles: true, clientX: 770, clientY: 160 }));
    expect(container.querySelector('.rb-template__spot').style.getPropertyValue('--rb-card-desktop-x')).toBe('77%');
    fireEvent(card, new MouseEvent('pointerup', { bubbles: true, clientX: 770, clientY: 160 }));
    expect(onMoveCard).toHaveBeenCalledWith(0, 'desktop', 77, 40);
    const saved = { ...banner, templateConfigs: { atelier: { cards: [
      { ...banner.templateConfigs.atelier.cards[0], position: { desktop: { x: 77, y: 40 }, mobile: { x: 45, y: 65 } } },
      banner.templateConfigs.atelier.cards[1],
    ] } } };
    rerender(<BannerTemplateView banner={saved} sections={categories} />);
    expect(container.querySelector('.rb-template__spot').style.getPropertyValue('--rb-card-desktop-x')).toBe('77%');
    expect(container.querySelector('.rb-template__spot').style.getPropertyValue('--rb-card-mobile-x')).toBe('45%');
    unmount();
  });
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

  it('mantiene textos, botones y conexiones estables cuando cambia la imagen', () => {
    const animate = vi.fn(function animateElement() { return { cancel: vi.fn() }; });
    const original = Element.prototype.animate;
    Element.prototype.animate = animate;
    try {
      const banner = { templateId: 'atelier' };
      const { container, rerender, unmount } = render(<BannerTemplateView banner={banner} sections={categories}><img src="/primera.jpg" alt="" /></BannerTemplateView>);
      const actions = container.querySelectorAll('.rb-liquid-button, .rb-template__spot-card');
      const connectors = container.querySelectorAll('.rb-template__spot-connector polyline');
      rerender(<BannerTemplateView banner={banner} sections={categories}><img src="/segunda.jpg" alt="" /></BannerTemplateView>);
      expect(container.querySelector('.rb-template__picture img')).toHaveAttribute('src', '/segunda.jpg');
      expect([...container.querySelectorAll('.rb-liquid-button, .rb-template__spot-card')]).toEqual([...actions]);
      expect([...container.querySelectorAll('.rb-template__spot-connector polyline')]).toEqual([...connectors]);
      expect(animate).not.toHaveBeenCalled();
      unmount();
    } finally {
      if (original) Element.prototype.animate = original;
      else delete Element.prototype.animate;
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

  it('actualiza el reflejo y la inclinación de los cuatro accesos sin modificar sus enlaces', () => {
    const { container } = render(<BannerTemplateView banner={{ templateId: 'atelier' }} sections={categories}><img src="/mi-foto.jpg" alt="" /></BannerTemplateView>);
    const actions = container.querySelectorAll('.rb-liquid-button, .rb-template__spot-card');
    expect(actions).toHaveLength(4);
    actions.forEach((action) => {
      expect(action.querySelector('.rb-glass-lens')).toBeNull();
      action.getBoundingClientRect = () => ({ left: 10, top: 20, width: 160, height: 64 });
      fireEvent(action, new MouseEvent('pointermove', { bubbles: true, clientX: 90, clientY: 52 }));
      expect(action.style.getPropertyValue('--rb-light-x')).toBe('50%');
      expect(action.style.getPropertyValue('--rb-light-y')).toBe('50%');
      expect(action.style.getPropertyValue('--rb-turn-x')).toBe('0.00deg');
      expect(action.style.getPropertyValue('--rb-turn-y')).toBe('0.00deg');
      fireEvent(action, new MouseEvent('pointermove', { bubbles: true, clientX: 10, clientY: 20 }));
      expect(action.style.getPropertyValue('--rb-light-x')).toBe('0%');
      expect(action.style.getPropertyValue('--rb-light-y')).toBe('0%');
      expect(action.style.getPropertyValue('--rb-turn-x')).toBe('2.50deg');
      expect(action.style.getPropertyValue('--rb-turn-y')).toBe('-2.50deg');
    });
    expect(container.querySelector('.rb-template__spot-card[href="/categoria/hogar"]')).toBeInTheDocument();
  });

  it('aplica el estilo guardado a la vista previa y a los cuatro botones públicos', () => {
    const banner = { templateId: 'atelier', templateConfigs: { atelier: { buttonAnimation: 'rose' } } };
    const { container, rerender } = render(<BannerTemplateView banner={banner} sections={categories}><img src="/mi-foto.jpg" alt="" /></BannerTemplateView>);
    expect(container.querySelector('[data-banner-template="atelier"]')).toHaveAttribute('data-button-animation', 'rose');
    expect(container.querySelectorAll('.rb-liquid-button, .rb-template__spot-card')).toHaveLength(4);
    rerender(<BannerTemplateView banner={{ ...banner, templateConfigs: { atelier: { buttonAnimation: 'unknown' } } }} sections={categories} preview device="desktop"><img src="/mi-foto.jpg" alt="" /></BannerTemplateView>);
    expect(container.querySelector('[data-banner-template="atelier"]')).toHaveAttribute('data-button-animation', 'prism');
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
  it('muestra dos categorías y recoge las adicionales en móvil', () => {
    const banner = { templateId: 'editorial', templateConfigs: { editorial: { cards: [
      { categoryId: 'actual-a', enabled: true },
      { categoryId: 'actual-b', enabled: true },
      { destinationType: 'catalogCategory', catalogCategoryId: 'legacy:Zapatos', catalogCategoryName: 'Zapatos', enabled: true },
    ] } } };
    const { container } = render(<BannerTemplateView banner={banner} sections={categories} preview device="mobile" />);
    const toggle = screen.getByRole('button', { name: /Ver 1 categoría más/ });
    const rail = container.querySelector('.rb-template__rail');
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(rail).toHaveAttribute('data-mobile-open', 'false');
    expect(container.querySelectorAll('.rb-template__card:not(.rb-template__card--extra)')).toHaveLength(2);
    expect(container.querySelectorAll('.rb-template__card--extra')).toHaveLength(1);
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(rail).toHaveAttribute('data-mobile-open', 'true');
    expect(container.querySelector('.rb-template__card[href="/categoria/hogar"]')).toBeInTheDocument();
    fireEvent.click(toggle);
    expect(rail).toHaveAttribute('data-mobile-open', 'false');
  });

  it('cubre la tarjeta con un fondo independiente y respeta la opción sin imagen', () => {
    const banner = { templateId: 'editorial', templateConfigs: { editorial: { cards: [
      { categoryId: 'actual-a', decorationMode: 'custom', decorationImage: 'https://example.test/mi-flor.webp', decorationX: 72, decorationY: 35, decorationSize: 85, decorationOpacity: 60 },
      { categoryId: 'actual-b', decorationMode: 'none' },
    ] } } };
    const { container } = render(<BannerTemplateView banner={banner} sections={categories} />);
    const cards = container.querySelectorAll('.rb-template__card');
    expect(cards[0].querySelector('.rb-template__card-decoration').style.backgroundImage).toContain('mi-flor.webp');
    expect(cards[0].querySelector('.rb-template__card-decoration').style.backgroundPosition).toBe('72% 35%');
    expect(cards[0].querySelector('.rb-template__card-decoration').style.transform).toBe('scale(1)');
    expect(cards[0].querySelector(':scope > .rb-template__card-decoration-viewport')).not.toBeNull();
    expect(cards[1].querySelector('.rb-template__card-decoration')).toBeNull();
    expect(getBannerTemplate({ templateId: 'editorial' }, categories).config.cards[0].decorationImage).toBe('');
    expect(cards[0].querySelector('.rb-template__card-visual img')).toHaveAttribute('src', '/hogar.jpg');
  });

  it('aplica colores y tamaños guardados para cada tarjeta', () => {
    const banner = {
      templateId: 'editorial',
      templateConfigs: { editorial: { cards: [
        { categoryId: 'actual-a', text: 'Hogar destacado', label: 'Recomendado', titleColor: '#332211', labelColor: '#ddaa88', titleSizePx: 22, labelSizePx: 16 },
      ] } },
    };
    const { container } = render(<BannerTemplateView banner={banner} sections={categories} />);
    const card = container.querySelector('.rb-template__card');
    expect(card.querySelector('.rb-template__card-copy strong')).toHaveStyle({ color: '#332211' });
    expect(card.querySelector('.rb-template__card-copy small')).toHaveStyle({ color: '#ddaa88' });
    expect(card.querySelector('.rb-template__card-copy strong')).toHaveStyle({ fontSize: 'clamp(10px, 4.4cqw, 22px)' });
    expect(card.querySelector('.rb-template__card-copy small')).toHaveStyle({ fontSize: 'clamp(8px, 3.2cqw, 16px)' });
  });

  it('usa estilo global en todas las tarjetas y lo retira al desactivar metalizado', () => {
    const config = { cards: [
      { categoryId: 'actual-a', titleColor: '#332211', titleSizePx: 12, label: 'Especial' },
      { categoryId: 'actual-b', titleColor: '#446688', titleSizePx: 14, label: 'Nuevo' },
    ], cardTextStyle: { titleColor: '#b78853', labelColor: '#383433', titleSizePx: 22, labelSizePx: 16, metallicTitle: true } };
    const banner = { templateId: 'editorial', templateConfigs: { editorial: config } };
    const { container, rerender } = render(<BannerTemplateView banner={banner} sections={categories} />);
    const cards = container.querySelectorAll('.rb-template__card');
    expect(cards).toHaveLength(2);
    for (const card of cards) {
      expect(card.querySelector('strong')).toHaveStyle({ color: '#b78853', fontSize: 'clamp(10px, 4.4cqw, 22px)' });
      expect(card.querySelector('small')).toHaveStyle({ color: '#383433', fontSize: 'clamp(8px, 3.2cqw, 16px)' });
      expect(card.querySelector('strong')).toHaveAttribute('data-metallic', 'true');
    }
    rerender(<BannerTemplateView banner={{ ...banner, templateConfigs: { editorial: { ...config, cardTextStyle: { ...config.cardTextStyle, metallicTitle: false } } } }} sections={categories} />);
    expect(container.querySelector('strong[data-metallic]')).toBeNull();
  });

  it('encadena tarjetas al entrar y salir sin reiniciarse al cambiar la foto del slider', () => {
    let notify;
    const disconnect = vi.fn();
    const observe = vi.fn();
    const observer = vi.fn().mockImplementation((callback) => {
      notify = callback;
      return { observe, disconnect };
    });
    vi.stubGlobal('IntersectionObserver', observer);
    try {
      const banner = { templateId: 'editorial' };
      const { container, rerender, unmount } = render(<BannerTemplateView banner={banner} sections={categories}><span>Foto 1</span></BannerTemplateView>);
      const root = container.querySelector('.rb-template');
      const cards = container.querySelectorAll('.rb-template__card');
      expect(observe).toHaveBeenCalledWith(root);
      expect(cards[0].style.getPropertyValue('--rb-card-enter-delay')).toBe('0ms');
      expect(cards[1].style.getPropertyValue('--rb-card-enter-delay')).toBe('110ms');
      expect(cards[0].style.getPropertyValue('--rb-card-exit-delay')).toBe('85ms');
      act(() => notify([{ isIntersecting: true }]));
      expect(root).toHaveAttribute('data-card-motion', 'enter');
      rerender(<BannerTemplateView banner={banner} sections={categories}><span>Foto 2</span></BannerTemplateView>);
      expect(root).toHaveAttribute('data-card-motion', 'enter');
      expect(observer).toHaveBeenCalledTimes(1);
      act(() => notify([{ isIntersecting: false }]));
      expect(root).toHaveAttribute('data-card-motion', 'exit');
      unmount();
      expect(disconnect).toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('anima el clic de una categoría y conserva el clic con Ctrl para abrir otra pestaña', () => {
    vi.useFakeTimers();
    try {
      const banner = { templateId: 'editorial' };
      const { container, unmount } = render(<BannerTemplateView banner={banner} sections={categories} />);
      const card = container.querySelector('.rb-template__card[href="/categoria/hogar"]');
      const ordinaryClick = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 });
      act(() => card.dispatchEvent(ordinaryClick));
      expect(ordinaryClick.defaultPrevented).toBe(true);
      expect(card).toHaveAttribute('data-pressed', 'true');
      const modifiedClick = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0, ctrlKey: true });
      act(() => card.dispatchEvent(modifiedClick));
      expect(modifiedClick.defaultPrevented).toBe(false);
      unmount();
    } finally {
      vi.useRealTimers();
    }
  });

});
