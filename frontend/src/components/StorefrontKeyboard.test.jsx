import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import CarouselBanner from './CarouselBanner';
import LookSection from './LookSection';

const actions = vi.hoisted(() => ({ next: vi.fn(), previous: vi.fn(), cart: vi.fn(), favorite: vi.fn() }));
vi.mock('keen-slider/react', async () => {
  const { useCallback, useRef } = await import('react');
  return { useKeenSlider(options) {
    const settings = useRef(options);
    settings.current = options;
    const instance = useRef(null);
    const attach = useCallback(node => {
      if (!node) { instance.current = null; return; }
      const slider = { track: { details: { rel: 0 } } };
      const move = delta => {
        const count = node.children.length;
        slider.track.details.rel = (slider.track.details.rel + delta + count) % count;
        settings.current?.slideChanged?.(slider);
        settings.current?.animationEnded?.(slider);
      };
      slider.next = () => { actions.next(); move(1); };
      slider.prev = () => { actions.previous(); move(-1); };
      instance.current = slider;
      settings.current?.created?.(slider);
    }, []);
    return [attach, instance];
  } };
});
vi.mock('../lib/siteSettingsApi', () => ({ fetchSiteSettings: vi.fn().mockResolvedValue({ theme: {} }) }));
vi.mock('../context/CartContext', () => ({ useCart: () => ({ addToCart: actions.cart }) }));
vi.mock('../context/FavoritesContext', () => ({ useFavorites: () => ({
  toggleFavorite: actions.favorite, isFavorite: () => false,
}) }));

const products = [
  { _id: 'p1', title: 'Vestido azul', image: '/azul.jpg', price: 100000, colors: ['#0000ff'] },
  { _id: 'p2', title: 'Vestido rojo', image: '/rojo.jpg', price: 120000, colors: ['#ff0000'] },
];
const slides = [
  { image: '/uno.jpg', link: '/catalogo-uno', button: { kind: 'text', text: 'Ver colección uno' } },
  { image: '/dos.jpg', link: '/catalogo-dos', button: { kind: 'text', text: 'Ver colección dos' } },
];
const sliderBanner = (extra = {}) => ({ type: 'slider', slides, autoplayMs: 1200, ...extra });
const lookTheme = (config = {}) => ({ sections: [{ id: 'look', config: {
  products: products.map(product => ({ productId: product._id })),
  actions: { favorite: { enabled: true }, cart: { enabled: true } },
  ...config,
}, style: { layoutPreset: 'classic' } }] });

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
  vi.stubGlobal('matchMedia', () => ({ matches: false,
    addEventListener: vi.fn(), removeEventListener: vi.fn(),
    addListener: vi.fn(), removeListener: vi.fn(),
  }));
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ products }) }));
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('teclado en la portada', () => {
  it.each(['{Enter}', ' '])('amplía con %s, mantiene el foco en el diálogo y lo devuelve al cerrar', async key => {
    const user = userEvent.setup();
    const { container } = render(<CarouselBanner bannerOverride={{ type: 'image', templateId: 'plain', imageUrl: '/portada.jpg' }} />);
    const opener = screen.getByRole('button', { name: 'Ampliar imagen de la portada' });
    await user.tab();
    expect(opener).toHaveFocus();
    await user.keyboard(key);
    const dialog = screen.getByRole('dialog', { name: 'Imagen ampliada' });
    expect(within(dialog).getByRole('img')).toHaveAttribute('src', '/portada.jpg');
    const close = within(dialog).getByRole('button', { name: 'Cerrar imagen ampliada' });
    expect(close).toHaveFocus();
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(container).toHaveAttribute('inert');
    expect(document.body.style.overflow).toBe('hidden');
    await user.tab();
    expect(close).toHaveFocus();
    await user.tab({ shift: true });
    expect(close).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
    expect(container).not.toHaveAttribute('inert');
    expect(document.body.style.overflow).toBe('');
  });

  it('restaura el bloqueo previo al cerrar con el botón y al desmontar', async () => {
    const user = userEvent.setup();
    const previous = document.createElement('div');
    previous.setAttribute('inert', '');
    document.body.appendChild(previous);
    document.body.style.overflow = 'clip';
    const { unmount } = render(<CarouselBanner bannerOverride={{ type: 'image', imageUrl: '/portada.jpg' }} />);
    const opener = screen.getByRole('button', { name: 'Ampliar imagen de la portada' });
    opener.focus();
    await user.keyboard('{Enter}');
    await user.keyboard('{Enter}');
    expect(opener).toHaveFocus();
    expect(document.body.style.overflow).toBe('clip');
    expect(previous).toHaveAttribute('inert');
    await user.keyboard(' ');
    unmount();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(document.body.style.overflow).toBe('clip');
    expect(previous).toHaveAttribute('inert');
    previous.remove();
    document.body.style.overflow = '';
  });

  it('recorre solo la imagen y el enlace activos, cambia con las flechas y amplía la imagen elegida', async () => {
    const user = userEvent.setup();
    const { container } = render(<CarouselBanner bannerOverride={sliderBanner()} />);
    const first = screen.getByRole('button', { name: 'Ampliar imagen 1 de 2 de la portada' });
    const hidden = container.querySelectorAll('.keen-slider__slide')[1];
    expect(hidden).toHaveAttribute('inert');
    expect(hidden).toHaveAttribute('aria-hidden', 'true');
    expect(hidden.querySelector('button')).toHaveAttribute('tabindex', '-1');
    expect(screen.queryByRole('link', { name: 'Ver colección dos' })).not.toBeInTheDocument();
    await user.tab();
    expect(first).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('link', { name: 'Ver colección uno' })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Imagen anterior' })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Imagen siguiente' })).toHaveFocus();
    await user.keyboard('{Enter}');
    const second = screen.getByRole('button', { name: 'Ampliar imagen 2 de 2 de la portada' });
    expect(first.closest('.keen-slider__slide')).toHaveAttribute('inert');
    await waitFor(() => expect(screen.getByRole('link', { name: 'Ver colección dos' })).toBeInTheDocument());
    await user.tab({ shift: true });
    expect(screen.getByRole('button', { name: 'Imagen anterior' })).toHaveFocus();
    await user.tab({ shift: true });
    expect(screen.getByRole('link', { name: 'Ver colección dos' })).toHaveFocus();
    await user.tab({ shift: true });
    expect(second).toHaveFocus();
    await user.keyboard(' ');
    expect(within(screen.getByRole('dialog')).getByRole('img')).toHaveAttribute('src', '/dos.jpg');
    await user.keyboard('{Escape}');
    expect(second).toHaveFocus();
    expect(container.querySelector('button a, button button')).toBeNull();
  });

  it('conserva los destinos de la foto enlazada y los botones de colección sin abrir la ampliación', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<CarouselBanner bannerOverride={{ type: 'image', imageUrl: '/portada.jpg', imageLink: '/catalogo' }} />);
    const imageLink = screen.getByRole('link');
    expect(imageLink).toHaveAttribute('href', '/catalogo');
    imageLink.addEventListener('click', event => event.preventDefault());
    imageLink.focus();
    await user.keyboard('{Enter}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Ampliar/ })).not.toBeInTheDocument();
    rerender(<CarouselBanner bannerOverride={sliderBanner()} />);
    const cta = screen.getByRole('link', { name: 'Ver colección uno' });
    expect(cta).toHaveAttribute('href', '/catalogo-uno');
    cta.addEventListener('click', event => event.preventDefault());
    cta.focus();
    await user.keyboard('{Enter}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it.each([undefined, 'discovery'])('pausa el avance durante el uso con teclado y lo reanuda al salir (%s)', templateId => {
    vi.useFakeTimers();
    render(<><CarouselBanner bannerOverride={sliderBanner({ templateId })} /><button>Continuar página</button></>);
    const next = screen.getByRole('button', { name: 'Imagen siguiente' });
    act(() => next.focus());
    act(() => vi.advanceTimersByTime(2400));
    expect(actions.next).not.toHaveBeenCalled();
    act(() => screen.getByRole('button', { name: 'Continuar página' }).focus());
    act(() => vi.advanceTimersByTime(1200));
    expect(actions.next).toHaveBeenCalledTimes(1);
  });

  it('mantiene el carrusel pausado mientras la ampliación está abierta y libera el fondo al cambiar de formato', () => {
    vi.useFakeTimers();
    const { container, rerender } = render(<CarouselBanner bannerOverride={sliderBanner()} />);
    const opener = screen.getByRole('button', { name: 'Ampliar imagen 1 de 2 de la portada' });
    act(() => opener.focus());
    fireEvent.click(opener);
    act(() => vi.advanceTimersByTime(2400));
    expect(actions.next).not.toHaveBeenCalled();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(opener).toHaveFocus();
    act(() => vi.advanceTimersByTime(1200));
    expect(actions.next).not.toHaveBeenCalled();
    fireEvent.click(opener);
    rerender(<CarouselBanner bannerOverride={{ type: 'image', templateId: 'editorial', imageUrl: '/otra.jpg' }} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(container).not.toHaveAttribute('inert');
    expect(document.body.style.overflow).toBe('');
  });
});

describe('teclado en el Look clásico', () => {
  it.each([0, 1])('selecciona productos con Enter y Espacio en la lista %s sin cambiar la presentación', async copy => {
    const user = userEvent.setup();
    const { container } = render(<LookSection theme={lookTheme()} />);
    const red = (await screen.findAllByRole('button', { name: 'Mostrar Vestido rojo' }))[copy];
    const blue = screen.getAllByRole('button', { name: 'Mostrar Vestido azul' })[copy];
    const hero = () => container.querySelector('[data-story-actor="hero"] img');
    expect(hero()).toHaveAttribute('src', '/azul.jpg');
    red.focus();
    await user.keyboard('{Enter}');
    expect(hero()).toHaveAttribute('src', '/rojo.jpg');
    expect(red).toHaveAttribute('aria-pressed', 'true');
    expect(blue).toHaveAttribute('aria-pressed', 'false');
    blue.focus();
    await user.keyboard(' ');
    expect(hero()).toHaveAttribute('src', '/azul.jpg');
    expect(blue).toHaveAttribute('aria-pressed', 'true');
    expect(blue).toHaveClass('focus-visible:outline');
    expect(container.querySelector('button button')).toBeNull();
    expect(screen.queryByRole('button', { name: /Color option/ })).not.toBeInTheDocument();
    expect(screen.getAllByRole('img', { name: 'Color disponible: Azul' })).toHaveLength(2);
  });

  it('activa favoritos y carrito por teclado con los mismos datos, conservando la imagen seleccionada', async () => {
    const user = userEvent.setup();
    const { container } = render(<LookSection theme={lookTheme()} />);
    const favorite = (await screen.findAllByRole('button', { name: 'Agregar a favoritos: Vestido rojo' }))[0];
    favorite.focus();
    await user.keyboard('{Enter}');
    expect(actions.favorite).toHaveBeenCalledWith({ productId: 'p2', title: 'Vestido rojo', image: '/rojo.jpg', color: '', size: '', price: 120000 });
    const cart = screen.getAllByRole('button', { name: 'Agregar al carrito: Vestido rojo' })[0];
    cart.focus();
    await user.keyboard(' ');
    expect(actions.cart).toHaveBeenCalledWith({ _id: 'p2', title: 'Vestido rojo', image: '/rojo.jpg', color: '', size: '', quantity: 1, price: 120000 });
    expect(container.querySelector('[data-story-actor="hero"] img')).toHaveAttribute('src', '/azul.jpg');
  });

  it('permite volver a la portada personalizada desde una miniatura con el teclado', async () => {
    const user = userEvent.setup();
    const { container } = render(<LookSection theme={lookTheme({ heroMode: 'custom', heroImage: '/look-completo.jpg' })} />);
    const red = (await screen.findAllByRole('button', { name: 'Mostrar Vestido rojo' }))[0];
    red.focus();
    await user.keyboard('{Enter}');
    expect(container.querySelector('[data-story-actor="hero"] img')).toHaveAttribute('src', '/rojo.jpg');
    const cover = screen.getAllByRole('button', { name: 'Mostrar imagen principal' })[0];
    cover.focus();
    await user.keyboard(' ');
    expect(container.querySelector('[data-story-actor="hero"] img')).toHaveAttribute('src', '/look-completo.jpg');
    expect(cover).toHaveAttribute('aria-pressed', 'true');
  });
});
