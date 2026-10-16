import React, { useState } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import LookSectionUI from './LookSectionUI';
import SectionsPanel from '../SectionsPanel';
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
    const hero = document.querySelector('.look-editorial__hero');
    Object.defineProperties(screen.getByAltText('Imagen principal de Looks'), { naturalWidth: { value: 800 }, naturalHeight: { value: 1000 } });
    fireEvent.load(screen.getByAltText('Imagen principal de Looks'));
    expect(hero.closest('.look-editorial')).toHaveStyle({ '--look-hero-aspect': '800 / 1000' });
    expect(screen.getByRole('button', { name: 'Mostrar imagen principal' }).closest('.look-editorial__rail')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Productos del look' }).querySelector('.keen-slider')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tarjeta siguiente' })).toBeInTheDocument();
    expect(interval).toHaveBeenCalledWith(expect.any(Function), 3600);
    const productSurface = screen.getByRole('button', { name: 'Mostrar Vestido azul' }).closest('.look-editorial__card-surface');
    const animate = vi.fn();
    productSurface.animate = animate;
    fireEvent.click(screen.getByRole('button', { name: 'Mostrar Vestido azul' }));
    expect(document.querySelector('.look-editorial__hero img')).toHaveAttribute('src', '/vestido.jpg');
    expect(animate).toHaveBeenCalledTimes(1);
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
    expect(normalizeLookSection({ style: { editorialVisibleCards: 4 } }).style.editorialVisibleCards).toBe(3);
  });

  it('migra la tipografía antigua de la vitrina y conserva una elección posterior del usuario', () => {
    const migrated = normalizeLookSection({ style: {
      layoutPreset: 'editorialGlass', thumbTitleColor: '#1f2937', thumbPriceColor: '#e11d48',
      thumbTitleFontFamily: '', thumbPriceFontFamily: '',
    } }).style;
    expect(migrated).toMatchObject({
      thumbTitleColor: '#633847', thumbPriceColor: '#a34e66',
      thumbTitleFontFamily: "Georgia, 'Times New Roman', serif", editorialCardTextVersion: 1,
    });

    const chosen = normalizeLookSection({ style: { ...migrated, thumbTitleColor: '#1f2937',
      thumbTitleFontFamily: 'system-ui', thumbTitleWeight: 700 } }).style;
    expect(chosen).toMatchObject({ thumbTitleColor: '#1f2937', thumbTitleFontFamily: 'system-ui', thumbTitleWeight: 700 });

    expect(normalizeLookSection({ style: { layoutPreset: 'classic' } }).style)
      .toMatchObject({ thumbTitleColor: '#1f2937', thumbPriceColor: '#e11d48' });
  });

  it('permite escoger el recorte y conserva la proporción elegida', () => {
    const onSave = vi.fn();
    const { unmount } = render(<Editor onSave={onSave} uploadToCloudinary={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /Diseño/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Composición' }));
    expect(screen.getByRole('button', { name: 'Foto completa' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Recortar' }));
    fireEvent.click(screen.getByRole('button', { name: '4/5' }));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      style: expect.objectContaining({ editorialHeroFit: 'crop', editorialHeroAspect: '4/5' }),
    }));
    unmount();

    render(<LookSection theme={{ sections: [onSave.mock.calls[0][0]] }} previewProducts={products} />);
    expect(document.querySelector('.look-editorial__hero')).toHaveClass('look-editorial__hero--crop');
    expect(document.querySelector('.look-editorial')).toHaveStyle({ '--look-hero-aspect': '4 / 5' });
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

  it('mueve toda la franja de tarjetas y conserva la posición al guardar', () => {
    const onSave = vi.fn();
    const { unmount } = render(<Editor onSave={onSave} uploadToCloudinary={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /Diseño/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Composición' }));
    const positionField = screen.getByText('Posición horizontal del carrusel').parentElement;
    fireEvent.change(positionField.querySelector('input[type="number"]'), { target: { value: '35' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    const saved = onSave.mock.calls[0][0];
    expect(saved.style.editorialRailPositionPercent).toBe(35);
    unmount();

    render(<LookSection theme={{ sections: [saved] }} previewProducts={products} />);
    expect(document.querySelector('.look-editorial')).toHaveStyle({ '--look-rail-left': '13.3%' });
    expect(document.querySelector('.look-editorial__rail')).toBeInTheDocument();
  });

  it('permite llevar el carrusel hasta el espacio libre a la derecha del diseño', () => {
    const section = normalizeLookSection({ config: { products }, style: {
      editorialContentWidthPx: 1000, editorialRailPositionPercent: 150,
    } });
    render(<LookSection theme={{ sections: [section] }} previewProducts={products} />);
    const wrapper = document.querySelector('.look-editorial');
    expect(wrapper).toHaveStyle({ '--look-rail-left': '50%' });
    expect(normalizeLookSection({ style: { editorialRailPositionPercent: 200 } }).style.editorialRailPositionPercent).toBe(150);
  });

  it('actualiza la posición en la vista previa real del modal al mover el control', async () => {
    function PreviewEditor() {
      const [theme, setTheme] = useState({ sections: [{ id: 'look', type: 'look', name: 'Looks',
        config: { products, heroMode: 'custom', heroImage: imageUrl },
        style: { editorialContentWidthPx: 1000 },
      }] });
      return <SectionsPanel theme={theme} setPath={(path, value) => {
        if (path === 'sections') setTheme((current) => ({ ...current, sections: value }));
      }} uploadToCloudinary={vi.fn()} />;
    }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ products: [] }) }));
    render(<PreviewEditor />);
    fireEvent.click(screen.getByRole('button', { name: 'Editar Looks' }));
    fireEvent.click(screen.getByRole('button', { name: /Diseño/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Composición' }));
    await waitFor(() => expect(document.querySelector('.section-real-preview .look-editorial')).toBeInTheDocument());
    const field = screen.getByText('Posición horizontal del carrusel').parentElement;
    fireEvent.change(field.querySelector('input[type="number"]'), { target: { value: '150' } });
    await waitFor(() => expect(document.querySelector('.section-real-preview .look-editorial'))
      .toHaveStyle({ '--look-rail-left': '50%' }));
  });

  it('ignora rutas inseguras y conserva el comportamiento anterior sin imagen propia', () => {
    const config = normalizeLookSection({ config: { products, heroMode: 'custom', heroImage: 'javascript:alert(1)' } }).config;
    expect(config.heroImage).toBe('');
    expect(normalizeLookSection({ config: { products } }).config).toMatchObject({ heroMode: 'product', heroImage: '' });
  });
});
