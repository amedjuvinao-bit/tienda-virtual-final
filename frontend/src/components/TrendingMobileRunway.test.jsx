import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import TrendingSection from './TrendingSection';

const cart = vi.hoisted(() => vi.fn());
const favorite = vi.hoisted(() => vi.fn());
vi.mock('../context/CartContext', () => ({ useCart: () => ({ addToCart: cart }) }));
vi.mock('../context/FavoritesContext', () => ({ useFavorites: () => ({
  toggleFavorite: favorite, isFavorite: (product) => product.productId === 'p2',
}) }));
vi.mock('keen-slider/react', async () => {
  const { useRef } = await import('react');
  return { useKeenSlider: (options) => {
    const ref = useRef(null);
    if (!ref.current) {
      const instance = { track: { details: { abs: 0, rel: 0 } }, count: 1 };
      instance.attach = (element) => { if (element) instance.count = element.children.length; };
      instance.moveToIdx = (index) => {
        instance.track.details = { abs: index, rel: (index % instance.count + instance.count) % instance.count };
        instance.options.slideChanged(instance);
      };
      instance.next = () => instance.moveToIdx(instance.track.details.abs + 1);
      instance.prev = () => instance.moveToIdx(instance.track.details.abs - 1);
      ref.current = instance;
    }
    ref.current.options = options;
    return [ref.current.attach, ref];
  } };
});

const catalog = [
  { _id: 'p1', title: 'Vestido a rayas', price: 200000, image: '/rayas.jpg', sizes: ['XS'], colors: ['#ff7bac', '#cfa8e0'] },
  { _id: 'p2', title: 'Vestido floral', price: 250000, image: '/floral.jpg', sizes: ['10'], colors: [{ hex: '#ff7bac' }] },
];
const refs = [{ productId: 'p1' }, { productId: 'p2', discountEnabled: true, discountPercent: 10 }];
const theme = (config = {}) => ({ sections: [{ id: 'tendencia', config: {
  products: refs, presentation: { mode: 'floatingGlass' }, ...config,
} }] });
const view = (value) => <MemoryRouter><TrendingSection theme={value} /></MemoryRouter>;
let media;
let width;
function resize(nextWidth) {
  width = nextWidth;
  for (const [query, entry] of media) {
    entry.matches = query.includes('max-width') && width < 768;
    entry.listeners.forEach((listener) => listener(entry));
  }
}

beforeEach(() => {
  vi.clearAllMocks();
  width = 390;
  media = new Map();
  vi.stubGlobal('matchMedia', (query) => {
    if (!media.has(query)) media.set(query, {
      matches: query.includes('max-width') && width < 768, listeners: new Set(),
      addEventListener(_, listener) { this.listeners.add(listener); },
      removeEventListener(_, listener) { this.listeners.delete(listener); },
    });
    return media.get(query);
  });
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ products: catalog }) }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('Pasarela móvil de En tendencia', () => {
  it('usa la imagen móvil guardada y recupera la imagen de escritorio al ampliar', async () => {
    const backgroundImage = 'https://res.cloudinary.com/tienda/image/upload/escritorio.jpg';
    const mobileBackgroundImage = 'https://res.cloudinary.com/tienda/image/upload/movil.jpg';
    const { container } = render(view(theme({ presentation: { mode: 'floatingGlass', backdropMode: 'custom', backgroundImage,
      mobileBackgroundMode: 'custom', mobileBackgroundImage },
    })));
    const link = await screen.findByRole('link', { name: 'Ver producto' });
    expect(link).toHaveClass('trending-liquid-button');
    expect(container.querySelector('section').style.backgroundImage).toContain(mobileBackgroundImage);
    act(() => resize(1280));
    expect(container.querySelector('section').style.backgroundImage).toContain(backgroundImage);
    expect(container.querySelector('section').style.backgroundImage).not.toContain(mobileBackgroundImage);
    act(() => resize(390));
    expect(container.querySelector('section').style.backgroundImage).toContain(mobileBackgroundImage);
  });

  it('sincroniza la foto, precio, talla, favoritos y enlace al navegar entre productos', async () => {
    render(view(theme()));
    const link = await screen.findByRole('link', { name: 'Ver producto' });
    expect(screen.getByRole('heading', { name: 'En tendencia' })).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/producto/p1');
    expect(screen.getByText('XS')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Agregar a favoritos: Vestido a rayas' }));
    expect(favorite).toHaveBeenCalledWith(expect.objectContaining({ productId: 'p1', price: 200000, image: '/rayas.jpg' }));

    fireEvent.click(screen.getByRole('button', { name: 'Producto siguiente' }));
    expect(link).toHaveAttribute('href', '/producto/p2');
    expect(screen.getByText('$225.000')).toBeInTheDocument();
    expect(screen.getByText('$250.000').tagName).toBe('DEL');
    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Vestido floral' })).toHaveAttribute('src', '/floral.jpg');
    expect(screen.getByRole('button', { name: 'Quitar de favoritos: Vestido floral' })).toHaveAttribute('aria-pressed', 'true');
    expect(cart).not.toHaveBeenCalled();

    fireEvent.keyDown(screen.getByRole('region', { name: 'Productos en tendencia' }), { key: 'ArrowLeft' });
    expect(link).toHaveAttribute('href', '/producto/p1');
    fireEvent.click(screen.getByRole('button', { name: 'Ver producto 2: Vestido floral' }));
    expect(link).toHaveAttribute('href', '/producto/p2');
  });

  it('conserva el diseño de escritorio al ampliar y recupera Pasarela al volver a móvil', async () => {
    const { container } = render(view(theme()));
    await screen.findByRole('link', { name: 'Ver producto' });
    expect(container.querySelector('section').style.backgroundImage).toContain('trending-runway-mobile.webp');
    act(() => resize(1024));
    expect(screen.queryByRole('region', { name: 'Productos en tendencia' })).not.toBeInTheDocument();
    expect(container.querySelector('.trending-card--floating-glass')).toBeInTheDocument();
    expect(container.querySelector('section').style.backgroundImage).toContain('trending-vitrine-boutique.webp');
    act(() => resize(265));
    expect(screen.getByRole('link', { name: 'Ver producto' })).toHaveAttribute('href', '/producto/p1');
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('respeta el fondo propio, los campos desactivados y una selección de un solo producto', async () => {
    const backgroundImage = 'https://res.cloudinary.com/tienda/image/upload/v1/fondo.jpg';
    const { container } = render(view(theme({ products: [refs[0]],
      presentation: { mode: 'floatingGlass', backdropMode: 'custom', backgroundImage },
      actions: { favorite: { enabled: false } }, cardFields: { showSizes: false, showColors: false },
    })));
    await screen.findByRole('link', { name: 'Ver producto' });
    expect(container.querySelector('section').style.backgroundImage).toContain(backgroundImage);
    expect(container.querySelectorAll('.trending-runway__slide')).toHaveLength(1);
    expect(screen.queryByRole('button', { name: 'Producto siguiente' })).not.toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Elegir producto en tendencia' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /favoritos/ })).not.toBeInTheDocument();
    expect(screen.queryByText('XS')).not.toBeInTheDocument();
    expect(container.querySelector('.trending-runway__metadata')).toBeNull();
  });

  it('usa el ancho real del lienzo móvil del panel aunque la ventana sea de escritorio', async () => {
    width = 1200;
    const observers = [];
    vi.stubGlobal('ResizeObserver', class {
      constructor(callback) { observers.push(callback); }
      observe() {}
      disconnect() {}
    });
    const { container } = render(view(theme()));
    await screen.findByText('Vestido a rayas');
    const section = container.querySelector('section');
    let canvasWidth = 390;
    Object.defineProperty(section, 'clientWidth', { configurable: true, get: () => canvasWidth });
    act(() => observers.forEach((callback) => callback()));
    expect(screen.getByRole('link', { name: 'Ver producto' })).toHaveAttribute('href', '/producto/p1');
    canvasWidth = 1024;
    act(() => observers.forEach((callback) => callback()));
    expect(screen.queryByRole('link', { name: 'Ver producto' })).not.toBeInTheDocument();
    expect(container.querySelector('.trending-card--floating-glass')).toBeInTheDocument();
  });

  it('reinicia la selección si el editor cambia los productos mientras el carrusel está abierto', async () => {
    const { rerender } = render(view(theme()));
    await screen.findByRole('link', { name: 'Ver producto' });
    fireEvent.click(screen.getByRole('button', { name: 'Producto siguiente' }));
    rerender(view(theme({ products: [refs[0]] })));
    const link = await screen.findByRole('link', { name: 'Ver producto' });
    expect(link).toHaveAttribute('href', '/producto/p1');
    expect(screen.getByRole('img', { name: 'Vestido a rayas' })).toHaveAttribute('src', '/rayas.jpg');
    expect(document.querySelectorAll('.trending-runway__slide')).toHaveLength(1);
  });

  it('aplica los colores móviles guardados y conserva el fondo y título del escritorio', async () => {
    const { container } = render(view(theme({ presentation: { mode: 'floatingGlass',
      mobileTitleColor: '#123456', mobilePriceColor: '#345678', mobileButtonColor: '#234567',
      mobileFavoriteActiveColor: '#456789', mobileBackgroundMode: 'color', mobileBackgroundColor: '#eef1ff',
      titleColor: '#654321', backgroundColor: '#ffeedd',
    } })));
    await screen.findByRole('link', { name: 'Ver producto' });
    expect(container.querySelector('.trending-runway')).toHaveStyle({ '--runway-title': '#123456', '--runway-price': '#345678',
      '--runway-button': '#234567', '--runway-favorite-active': '#456789' });
    expect(container.querySelector('section')).toHaveStyle('--trending-background: #eef1ff');
    expect(container.querySelector('section').style.backgroundImage).toBe('');
    act(() => resize(1024));
    expect(container.querySelector('section')).toHaveStyle('--trending-background: #ffeedd');
    expect(screen.getByRole('heading', { name: 'EN TENDENCIA' })).toHaveStyle('color: #654321');
    expect(container.querySelector('.trending-runway')).toBeNull();
  });
});
