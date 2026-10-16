import React, { useState } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import LookSectionUI from './LookSectionUI';
import { normalizeLookSection } from './lookSectionHelpers';
import LookSection from '../../../../components/LookSection';

vi.mock('../../../../context/CartContext', () => ({ useCart: () => ({ addToCart: vi.fn() }) }));
vi.mock('../../../../context/FavoritesContext', () => ({ useFavorites: () => ({ toggleFavorite: vi.fn(), isFavorite: () => false }) }));

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
beforeEach(() => { vi.stubGlobal('matchMedia', () => ({ matches: false, addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn() })); });

const imageUrl = 'https://res.cloudinary.com/tienda/image/upload/v1/portada-look.jpg';
const products = [{ productId: 'p1', title: 'Vestido azul', mainImage: '/vestido.jpg', price: 100000 }];

function Editor({ onSave, uploadToCloudinary }) {
  const [theme, setTheme] = useState({ sections: [{ id: 'look', config: { products } }] });
  return <>
    <LookSectionUI theme={theme} setPath={(_, sections) => setTheme({ sections })} uploadToCloudinary={uploadToCloudinary} />
    <button type="button" onClick={() => onSave(theme.sections[0])}>Guardar</button>
  </>;
}

describe('imagen principal independiente de Looks', () => {
  it('sube la imagen desde el editor y la conserva en la configuración guardada', async () => {
    const onSave = vi.fn();
    const uploadToCloudinary = vi.fn().mockResolvedValue(imageUrl);
    render(<Editor onSave={onSave} uploadToCloudinary={uploadToCloudinary} />);

    fireEvent.click(screen.getByRole('button', { name: 'Subir imagen propia' }));
    fireEvent.change(screen.getByLabelText('Cargar imagen grande'), {
      target: { files: [new File(['foto'], 'portada.jpg', { type: 'image/jpeg' })] },
    });
    await waitFor(() => expect(screen.getAllByAltText('Imagen principal elegida')[0]).toHaveAttribute('src', imageUrl));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      config: expect.objectContaining({
        heroMode: 'custom', heroImage: imageUrl,
        products: [expect.objectContaining({ productId: 'p1', mainImage: '/vestido.jpg' })],
      }),
    }));
    expect(uploadToCloudinary).toHaveBeenCalledTimes(1);
  });

  it('muestra la portada propia y permite volver a ella tras elegir una tarjeta', async () => {
    const interval = vi.spyOn(window, 'setInterval');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ products: [
      { _id: 'p1', title: 'Vestido azul', image: '/vestido.jpg', price: 100000 },
    ] }) }));
    render(<LookSection theme={{ sections: [{ id: 'look', config: { products, heroMode: 'custom', heroImage: imageUrl } }] }} previewProducts={products} />);
    expect(screen.getByAltText('Imagen principal de Looks')).toHaveAttribute('src', imageUrl);
    expect(document.querySelector('.look-editorial__hero-photo')).toHaveAttribute('src', imageUrl);
    expect(document.querySelector('.look-editorial__hero-backdrop')).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByRole('button', { name: 'Mostrar imagen principal' }).closest('.look-editorial__rail')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Productos del look' }).querySelector('.keen-slider')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tarjeta siguiente' })).toBeInTheDocument();
    expect(interval).toHaveBeenCalledWith(expect.any(Function), 3600);
    fireEvent.click(screen.getByRole('button', { name: 'Mostrar Vestido azul' }));
    expect(document.querySelector('.look-editorial__hero img')).toHaveAttribute('src', '/vestido.jpg');
    fireEvent.click(screen.getByRole('button', { name: 'Mostrar imagen principal' }));
    expect(screen.getByAltText('Imagen principal de Looks')).toHaveAttribute('src', imageUrl);
  });

  it('conserva los controles editoriales y muestra productos enlazados con su precio', () => {
    const section = normalizeLookSection({ config: { products, editorialEyebrow: 'Nueva colección', editorialHeadline: 'Nuestros looks' },
      style: { editorialDepth: 82, editorialGlassOpacity: 48, editorialOverlapPercent: 14 } });
    expect(section).toMatchObject({ config: { editorialHeadline: 'Nuestros looks' }, style: { editorialDepth: 82, editorialGlassOpacity: 48, editorialOverlapPercent: 14 } });
    render(<LookSection theme={{ sections: [section] }} previewProducts={products} />);
    expect(screen.getByText('Nuestros looks')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Vestido azul' })).toHaveAttribute('href', '/producto/p1');
    expect(screen.getByText('$100.000')).toBeInTheDocument();
  });

  it('guarda el fondo, textos y profundidad elegidos en el panel', async () => {
    const onSave = vi.fn();
    render(<Editor onSave={onSave} uploadToCloudinary={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText('Texto descriptivo de la sección LOOK…'), { target: { value: 'Una historia nueva' } });
    fireEvent.click(screen.getByRole('button', { name: /Diseño/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Composición' }));
    const depthField = screen.getByText('Profundidad del cristal').parentElement;
    fireEvent.change(depthField.querySelector('input[type="number"]'), { target: { value: '85' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      config: expect.objectContaining({ description: 'Una historia nueva' }),
      style: expect.objectContaining({ layoutPreset: 'editorialGlass', editorialDepth: 85 }),
    }));
  });

  it('ignora rutas inseguras y conserva el comportamiento anterior sin imagen propia', () => {
    const config = normalizeLookSection({ config: { products, heroMode: 'custom', heroImage: 'javascript:alert(1)' } }).config;
    expect(config.heroImage).toBe('');
    expect(normalizeLookSection({ config: { products } }).config).toMatchObject({ heroMode: 'product', heroImage: '' });
  });
});
