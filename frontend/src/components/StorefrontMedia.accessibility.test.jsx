import React, { useState } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import postcss from 'postcss';
import tailwindcss from 'tailwindcss';
import loadConfig from 'tailwindcss/loadConfig.js';
import { fileURLToPath, URL as NodeURL } from 'node:url';
import LookSection from './LookSection';
import TrendingSection from './TrendingSection';
import ProductDetailGallery from './product-detail/ProductDetailGallery';
import { buildSafeProductDetailConfig } from './product-detail/productDetailConfig';

vi.mock('../context/CartContext', () => ({ useCart: () => ({ addToCart: vi.fn() }) }));
vi.mock('../context/FavoritesContext', () => ({ useFavorites: () => ({
  toggleFavorite: vi.fn(), isFavorite: () => false,
}) }));

const product = { _id: 'p1', title: 'Vestido azul', image: '/vestido.jpg', price: 100000 };
const refs = [{ productId: 'p1', discountEnabled: true, discountPercent: 10 }];
const trendingTheme = (config = {}) => ({ sections: [{ id: 'tendencia', config: {
  products: refs, ...config,
} }] });

beforeEach(() => {
  vi.stubGlobal('matchMedia', () => ({ matches: false,
    addEventListener: vi.fn(), removeEventListener: vi.fn(),
    addListener: vi.fn(), removeListener: vi.fn(),
  }));
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true,
    json: async () => ({ products: [product] }),
  }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('descripciones de imágenes de la tienda', () => {
  it('mantiene legible el precio anterior en la tarjeta blanca con el CSS generado', async () => {
    render(<MemoryRouter><TrendingSection theme={trendingTheme()} /></MemoryRouter>);
    const previous = await screen.findByText('$100.000');
    const card = previous.closest('.bg-white');
    expect(card).not.toBeNull();
    const config = loadConfig(fileURLToPath(new NodeURL('../../tailwind.config.js', import.meta.url)));
    const result = await postcss([tailwindcss({ ...config,
      content: [{ raw: card.outerHTML, extension: 'html' }],
    })]).process('@tailwind utilities;', { from: undefined });
    const textClass = [...previous.classList].find(name => /^text-gray-\d+$/.test(name));
    const color = (selector, property) => {
      let value;
      result.root.walkRules(selector, rule => rule.walkDecls(property, declaration => { value = declaration.value; }));
      expect(value).toBeDefined();
      return value.match(/[\d.]+/g).slice(0, 3).map(Number);
    };
    const luminance = values => values.map(value => {
      const channel = value / 255;
      return channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4;
    }).reduce((sum, value, index) => sum + value * [.2126, .7152, .0722][index], 0);
    const foreground = luminance(color(`.${textClass}`, 'color'));
    const background = luminance(color('.bg-white', 'background-color'));
    const ratio = (Math.max(foreground, background) + .05) / (Math.min(foreground, background) + .05);
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });
  it.each(['Looks para cada ocasión', ''])('identifica el título gráfico de Looks con el texto configurado: %s', async (titleText) => {
    render(<LookSection theme={{ sections: [{ id: 'look', config: {
      products: refs, titleText, titleImage: '/titulo-look.png',
    }, style: { layoutPreset: 'classic' } }] }} />);
    const titles = await screen.findAllByAltText(titleText || 'Looks');
    expect(titles).toHaveLength(2);
    expect(titles.every((image) => image.getAttribute('src') === '/titulo-look.png')).toBe(true);
    expect(screen.queryByAltText('Título de la sección look')).not.toBeInTheDocument();
  });

  it('conserva el título personalizado cuando En tendencia utiliza una imagen', async () => {
    render(<MemoryRouter><TrendingSection theme={trendingTheme({
      title: 'Novedades de noviembre', titleImage: '/novedades.png',
    })} /></MemoryRouter>);
    await screen.findByText('Vestido azul');
    expect(screen.getByRole('img', { name: 'Novedades de noviembre' })).toHaveAttribute('src', '/novedades.png');
  });

  it('anuncia una sola foto por producto sin repetir la imagen superpuesta al pasar el puntero', async () => {
    render(<MemoryRouter><TrendingSection theme={trendingTheme()} /></MemoryRouter>);
    await screen.findByText('Vestido azul');
    expect(screen.getAllByRole('img', { name: 'Vestido azul' })).toHaveLength(1);
    const photos = document.querySelectorAll('.trending-card__photo img');
    expect(photos).toHaveLength(2);
    expect(photos[1]).toHaveAttribute('alt', '');
    expect(photos[1]).toHaveAttribute('aria-hidden', 'true');
  });

  it('mantiene el nombre de las fotos y la selección por botones sin anunciar miniaturas redundantes', () => {
    function Gallery() {
      const [image, setImage] = useState('/frente.jpg');
      return <ProductDetailGallery images={['/frente.jpg', '/espalda.jpg']}
        image={image} setImage={setImage} title="Vestido azul" discount={0}
        animationStyle={{}} config={buildSafeProductDetailConfig({})} />;
    }
    render(<Gallery />);
    expect(screen.getAllByRole('img')).toHaveLength(1);
    const second = screen.getByRole('button', { name: 'Ver foto 2' });
    fireEvent.click(second);
    expect(screen.getByRole('img', { name: 'Vestido azul' })).toHaveAttribute('src', '/espalda.jpg');
    expect(second).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Ver foto 1' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('conserva el color personalizado del precio anterior y los importes del diseño de cristal', async () => {
    render(<MemoryRouter><TrendingSection theme={trendingTheme({
      presentation: { mode: 'floatingGlass', cardMutedColor: '#73546a' },
    })} /></MemoryRouter>);
    await screen.findByText('Vestido azul');
    expect(screen.getByText('$100.000')).toHaveStyle({ color: '#73546a' });
    expect(screen.getByText('$90.000')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument());
  });
});
