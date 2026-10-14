import React, { useCallback, useState } from 'react';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import SectionsPanel from './SectionsPanel';
import api from '../../../lib/api';

vi.mock('../../../context/CartContext', () => ({ useCart: () => ({ addToCart: vi.fn() }) }));
vi.mock('../../../context/FavoritesContext', () => ({ useFavorites: () => ({ toggleFavorite: vi.fn(), isFavorite: () => false }) }));

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

function Harness({ id, onSave }) {
  const [theme, setTheme] = useState({ sections: [{ id, type: id, name: id, enabled: true, config: {} }] });
  const setPath = useCallback((path, value) => {
    if (path === 'sections') setTheme({ sections: value });
  }, []);
  return <>
    <SectionsPanel theme={theme} setPath={setPath} />
    <button type="button" onClick={() => onSave(theme.sections[0])}>Guardar ahora</button>
  </>;
}

describe('editor de secciones, etapa 3', () => {
  it.each(['tendencia', 'look', 'complementos', 'categorias', 'instagram', 'tiktok', 'informacion'])(
    'muestra vista previa permanente al editar contenido y diseño de %s', (id) => {
      render(<Harness id={id} onSave={vi.fn()} />);
      fireEvent.click(screen.getByRole('button', { name: `Editar ${id === 'categorias' ? 'Categorías' : id === 'informacion' ? 'Información' : id === 'tiktok' ? 'TikTok' : id === 'look' ? 'Looks' : id === 'complementos' ? 'Complementos' : id === 'instagram' ? 'Instagram' : 'En tendencia'}` }));
      const steps = screen.getByRole('navigation', { name: 'Pasos de edición' });
      expect(screen.getByRole('region', { name: 'Vista real de la tienda' })).toBeInTheDocument();
      fireEvent.click(within(steps).getByRole('button', { name: /Diseño/ }));
      expect(within(steps).getByRole('button', { name: /Diseño/ })).toHaveAttribute('aria-current', 'step');
      expect(screen.getByRole('region', { name: 'Vista real de la tienda' })).toBeInTheDocument();
      expect(within(steps).getAllByRole('button')).toHaveLength(2);
      expect(screen.getByRole('region', { name: 'Vista real de la tienda' })).toBeInTheDocument();
    },
  );

  it('conserva el enlace de Instagram entre pasos y lo pasa al guardado global', async () => {
    const onSave = vi.fn();
    render(<Harness id="instagram" onSave={onSave} />);
    fireEvent.click(screen.getByRole('button', { name: 'Editar Instagram' }));
    const steps = screen.getByRole('navigation', { name: 'Pasos de edición' });
    fireEvent.change(screen.getByPlaceholderText('https://instagram.com/tuusuario'), {
      target: { value: 'https://instagram.com/rosa' },
    });
    fireEvent.click(within(steps).getByRole('button', { name: /Diseño/ }));
    fireEvent.click(within(steps).getByRole('button', { name: /Contenido/ }));
    expect(screen.getByPlaceholderText('https://instagram.com/tuusuario')).toHaveValue('https://instagram.com/rosa');
    await waitFor(() => expect(screen.getByPlaceholderText('https://instagram.com/tuusuario')).toHaveValue('https://instagram.com/rosa'));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar ahora' }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ config: expect.objectContaining({ profileLink: 'https://instagram.com/rosa' }) }));
  });

  it('muestra el componente público de Complementos con los cambios de imagen y texto', async () => {
    const theme = { sections: [{
      id: 'complementos', type: 'complementos', name: 'Complementos', enabled: true,
      config: { imageSrc: '/mi-banner.jpg', imageAlt: 'Mi banner', buttonText: 'Descubrir' },
    }] };
    render(<SectionsPanel theme={theme} setPath={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Editar Complementos' }));
    const preview = screen.getByRole('region', { name: 'Vista real de la tienda' });
    await waitFor(() => expect(within(preview).getByAltText('Mi banner')).toHaveAttribute('src', '/mi-banner.jpg'));
    expect(within(preview).getByText('Descubrir')).toBeInTheDocument();
    expect(within(preview).getByText('Descubrir').closest('.complementos-look-section')).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText('Conócelos'), { target: { value: 'Comprar ahora' } });
    await waitFor(() => expect(within(preview).getByText('Comprar ahora')).toBeInTheDocument());
  });

  it('reduce la vista de escritorio a escala sin cambiar el ancho del banner público', async () => {
    vi.stubGlobal('innerWidth', 1280);
    const theme = { colors: { primary: '#345678', background: '#fff8f2' }, sections: [{
      id: 'complementos', type: 'complementos', name: 'Complementos', enabled: true,
      config: { imageSrc: '/banner-horizontal.jpg', imageAlt: 'Banner horizontal' },
      style: { imageHeightPx: 500 },
    }] };
    render(<SectionsPanel theme={theme} setPath={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Editar Complementos' }));
    const preview = screen.getByRole('region', { name: 'Vista real de la tienda' });
    const viewport = preview.querySelector('.section-real-preview__viewport');
    Object.defineProperty(viewport, 'clientWidth', { configurable: true, value: 640 });
    fireEvent.resize(window);
    await waitFor(() => expect(preview.querySelector('.section-real-preview__canvas')).toHaveStyle({ width: '1280px', transform: 'scale(0.5)' }));
    expect(viewport).toHaveStyle('--color-primary: #345678');
    expect(within(preview).getByAltText('Banner horizontal')).toHaveAttribute('src', '/banner-horizontal.jpg');
  });

  it('muestra la tarjeta guardada en la vista de Tendencia si el catálogo no responde', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Catálogo fuera de línea')));
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const theme = { sections: [{
      id: 'tendencia', type: 'tendencia', name: 'En tendencia', enabled: true,
      config: { maxItems: 4, products: [{
        productId: '68a62e6e2705a006a538fff2', name: 'Vestido de prueba',
        mainImage: '/vestido-prueba.jpg', hoverImage: '/vestido-hover.jpg', price: 111111,
        finalPrice: 66667, hasDiscount: true, discountPercent: 40,
      }] },
    }] };
    render(<MemoryRouter><SectionsPanel theme={theme} setPath={vi.fn()} /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'Editar En tendencia' }));
    const preview = screen.getByRole('region', { name: 'Vista real de la tienda' });
    await waitFor(() => expect(within(preview).getByText('Vestido de prueba')).toBeInTheDocument());
    await waitFor(() => expect(within(preview).getByRole('status')).toHaveTextContent('no están disponibles en el catálogo'));
    expect(within(preview).getAllByAltText('Vestido de prueba')[0]).toHaveAttribute('src', '/vestido-prueba.jpg');
    warning.mockRestore();
  });

  it('muestra el Look guardado e informa si el catálogo no responde, sin ocultar la vista previa', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Catálogo fuera de línea')));
    const productRequest = vi.spyOn(api, 'get').mockResolvedValue({ data: { _id: 'producto-1', images: {} } });
    const theme = { sections: [{
      id: 'look', type: 'look', name: 'Looks', enabled: true,
      config: { products: [{ productId: 'producto-1', title: 'Vestido rosa', mainImage: '/look-rosa.jpg', price: 98000 }] },
    }] };
    render(<SectionsPanel theme={theme} setPath={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Editar Looks' }));
    const preview = screen.getByRole('region', { name: 'Vista real de la tienda' });
    await waitFor(() => expect(within(preview).getAllByAltText('Vestido rosa').length).toBeGreaterThan(0));
    await waitFor(() => expect(within(preview).getByRole('status')).toHaveTextContent('no están disponibles en el catálogo'));
    expect(within(preview).getAllByAltText('Vestido rosa')[0]).toHaveAttribute('src', '/look-rosa.jpg');
    productRequest.mockRestore();
  });
});
