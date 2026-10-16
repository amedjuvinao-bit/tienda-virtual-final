import React, { useState } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import LookSectionUI from './LookSectionUI';
import { normalizeLookSection } from './lookSectionHelpers';
import LookSection from '../../../../components/LookSection';

vi.mock('../../../../context/CartContext', () => ({ useCart: () => ({ addToCart: vi.fn() }) }));
vi.mock('../../../../context/FavoritesContext', () => ({ useFavorites: () => ({ toggleFavorite: vi.fn(), isFavorite: () => false }) }));

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

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
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ products: [
      { _id: 'p1', title: 'Vestido azul', image: '/vestido.jpg', price: 100000 },
    ] }) }));
    render(<LookSection theme={{ sections: [{ id: 'look', config: { products, heroMode: 'custom', heroImage: imageUrl } }] }} previewProducts={products} />);
    expect(screen.getByAltText('Imagen principal de Looks')).toHaveAttribute('src', imageUrl);
    fireEvent.click(screen.getAllByAltText('Vestido azul')[0]);
    expect(screen.getByRole('button', { name: 'Volver a la imagen principal' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Volver a la imagen principal' }));
    expect(screen.getByAltText('Imagen principal de Looks')).toHaveAttribute('src', imageUrl);
  });

  it('ignora rutas inseguras y conserva el comportamiento anterior sin imagen propia', () => {
    const config = normalizeLookSection({ config: { products, heroMode: 'custom', heroImage: 'javascript:alert(1)' } }).config;
    expect(config.heroImage).toBe('');
    expect(normalizeLookSection({ config: { products } }).config).toMatchObject({ heroMode: 'product', heroImage: '' });
  });
});
