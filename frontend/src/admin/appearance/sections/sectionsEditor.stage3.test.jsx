import React, { useCallback, useState } from 'react';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import SectionsPanel from './SectionsPanel';
import api from '../../../lib/api';

vi.mock('../../../context/CartContext', () => ({ useCart: () => ({ addToCart: vi.fn() }) }));
vi.mock('../../../context/FavoritesContext', () => ({ useFavorites: () => ({ toggleFavorite: vi.fn(), isFavorite: () => false }) }));

beforeEach(() => vi.stubGlobal('matchMedia', vi.fn().mockImplementation(query => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }))));

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
  it('ofrece la vitrina como opción y conserva sus parámetros al guardar', () => {
    const onSave = vi.fn();
    render(<Harness id="tendencia" onSave={onSave} />);
    fireEvent.click(screen.getByRole('button', { name: 'Editar En tendencia' }));
    fireEvent.click(within(screen.getByRole('navigation', { name: 'Pasos de edición' })).getByRole('button', { name: /Diseño/ }));
    expect(screen.getByRole('button', { name: /Tarjeta actual/ })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: /Vitrina flotante/ }));
    expect(screen.getByRole('button', { name: /Vitrina flotante/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Floral incluido' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Color y luz' }));
    expect(screen.getByRole('button', { name: 'Color y luz' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.change(screen.getByRole('slider', { name: 'Profundidad' }), { target: { value: '.8' } });
    fireEvent.change(screen.getByRole('slider', { name: 'Luz detrás de las fotos' }), { target: { value: '.4' } });
    fireEvent.change(screen.getByRole('slider', { name: 'Desenfoque de la pared' }), { target: { value: '9' } });
    fireEvent.click(screen.getByText('Forma y botones'));
    fireEvent.change(screen.getByLabelText('Separación foto/ficha (px)'), { target: { value: '19' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar ahora' }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ config: expect.objectContaining({ presentation: expect.objectContaining({ mode: 'floatingGlass', backdropMode: 'color', dockGapPx: 19, sceneDepth: .8, sceneLight: .4, sceneBlurPx: 9, showWatermark: false }) }) }));
  });
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

  it('guarda un color elegido del espectro en Instagram', () => {
    const onSave = vi.fn();
    render(<Harness id="instagram" onSave={onSave} />);
    fireEvent.click(screen.getByRole('button', { name: 'Editar Instagram' }));
    fireEvent.click(within(screen.getByRole('navigation', { name: 'Pasos de edición' })).getByRole('button', { name: /Diseño/ }));
    fireEvent.click(within(screen.getByRole('navigation', { name: 'Diseño de Instagram' })).getByRole('button', { name: 'Botones' }));
    fireEvent.click(screen.getByRole('button', { name: 'Abrir paleta de Color del texto del botón' }));
    fireEvent.click(screen.getByRole('button', { name: 'Usar color #3b82f6' }));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar ahora' }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      config: expect.objectContaining({ journalButtonTextColor: '#3b82f6' }),
    }));
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
    expect(await within(preview).findByAltText('Banner horizontal')).toHaveAttribute('src', '/banner-horizontal.jpg');
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

  it.each([['instagram', 'Instagram'], ['tiktok', 'TikTok']])(
    'permite editar una publicación a la vez en %s sin perder el resto', (id, label) => {
      render(<Harness id={id} onSave={vi.fn()} />);
      fireEvent.click(screen.getByRole('button', { name: `Editar ${label}` }));
      fireEvent.click(within(screen.getByRole('navigation', { name: `Contenido de ${label}` })).getByRole('button', { name: id === 'tiktok' ? 'Videos' : /Publicaciones/ }));
      const picker = screen.getByRole('navigation', { name: `Elegir publicación de ${label}` });
      const first = within(picker).getByRole('button', { name: 'Editar publicación 1' });
      const second = within(picker).getByRole('button', { name: 'Editar publicación 2' });
      expect(first).toHaveAttribute('aria-pressed', 'true');
      fireEvent.click(second);
      expect(second).toHaveAttribute('aria-pressed', 'true');
      if (id === 'tiktok') {
        const links = screen.getAllByPlaceholderText('https://www.tiktok.com/@usuario/video/…');
        expect(links[1]).toBeVisible();
        expect(links[0]).not.toBeVisible();
      } else {
        expect(screen.getByText('Publicación 2')).toBeVisible();
        expect(screen.getByText('Publicación 1')).not.toBeVisible();
      }
    },
  );

  it('conserva el enlace editado al cambiar de publicación y lo entrega al guardado', () => {
    const onSave = vi.fn();
    render(<Harness id="instagram" onSave={onSave} />);
    fireEvent.click(screen.getByRole('button', { name: 'Editar Instagram' }));
    fireEvent.click(within(screen.getByRole('navigation', { name: 'Contenido de Instagram' })).getByRole('button', { name: /Publicaciones/ }));
    const picker = screen.getByRole('navigation', { name: 'Elegir publicación de Instagram' });
    const firstCard = screen.getByText('Publicación 1').closest('.rounded-2xl.bg-neutral-50');
    const link = within(firstCard).getByPlaceholderText('https://instagram.com/p/xxxx');
    fireEvent.change(link, { target: { value: 'https://instagram.com/p/nuevo' } });
    fireEvent.click(within(picker).getByRole('button', { name: 'Editar publicación 2' }));
    fireEvent.click(within(picker).getByRole('button', { name: 'Editar publicación 1' }));
    expect(link).toHaveValue('https://instagram.com/p/nuevo');
    fireEvent.click(screen.getByRole('button', { name: 'Guardar ahora' }));
    expect(onSave.mock.calls[0][0].config.posts[0].link).toBe('https://instagram.com/p/nuevo');
  });

  it.each([
    ['tendencia', 'En tendencia', 'Diseño de Tendencia', 'Tarjetas y espacio'],
    ['look', 'Looks', 'Diseño de Looks', 'Miniaturas'],
    ['complementos', 'Complementos', 'Diseño de Complementos', 'Botón y efectos'],
    ['categorias', 'Categorías', 'Diseño de Categorías', 'Visibilidad'],
    ['informacion', 'Información', 'Diseño de Información', 'Animación'],
  ])('agrupa los controles de diseño de %s y deja seleccionar el último grupo', (id, name, navLabel, lastGroup) => {
    render(<Harness id={id} onSave={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: `Editar ${name}` }));
    fireEvent.click(within(screen.getByRole('navigation', { name: 'Pasos de edición' })).getByRole('button', { name: /Diseño/ }));
    const tabs = screen.getByRole('navigation', { name: navLabel });
    expect(tabs.closest('.section-card-tabs').querySelectorAll('.section-card-tabs__panels > div'))
      .toHaveLength(within(tabs).getAllByRole('button').length);
    const last = within(tabs).getByRole('button', { name: lastGroup });
    fireEvent.click(last);
    expect(last).toHaveAttribute('aria-pressed', 'true');
    expect(tabs.closest('.section-card-tabs').querySelectorAll('.section-card-tabs__panels > div:not([hidden])'))
      .toHaveLength(1);
    expect(screen.getByRole('region', { name: 'Vista real de la tienda' })).toBeInTheDocument();
  });
});
