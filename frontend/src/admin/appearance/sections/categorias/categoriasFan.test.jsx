import React, { useState } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import CategoriasSection from '../../../../components/CategoriasSection';
import CategoriaArtwork from '../../../../components/CategoriaArtwork';
import CategoriasSectionUI from './CategoriasSectionUI';
import { CATEGORIAS_SECTION_DEFAULTS, normalizeCategoriasSection } from './categoriasSectionHelpers';
import { categoryPhotoSource, normalizeCategoriasFanStyle } from './categoriasFanHelpers';
import StorefrontSectionPreview from '../ui/StorefrontSectionPreview';

afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });
const records = [
  { id: 'one', title: 'Primera categoría', href: '/coleccion/uno', image: '/uno.jpg', subtitle: 'Detalles de la primera', review: 'Reseña original', buttonImg: '/boton.png', enabled: true },
  { id: 'two', title: 'Segunda categoría', href: '/coleccion/dos', image: '/dos.jpg', enabled: true },
  { id: 'three', title: 'Tercera categoría', href: '/coleccion/tres', image: '/tres.jpg', enabled: true },
];
const makeTheme = (slides = records, style = {}) => ({ sections: [{ id: 'categorias', config: { titleText: 'Colecciones especiales', slides }, style }] });
function Harness({ save = () => {}, upload }) {
  const [theme, setTheme] = useState({ sections: [...makeTheme().sections, { id: 'otra', config: { keep: true } }] });
  return <><CategoriasSectionUI theme={theme} setPath={(path, value) => setTheme({ ...theme, [path]: value })} uploadToCloudinary={upload} /><CategoriasSection theme={theme} /><button onClick={() => save(JSON.parse(JSON.stringify(theme)))}>Guardar prueba</button></>;
}
function content(group) {
  fireEvent.click(within(screen.getByRole('navigation', { name: 'Pasos de edición' })).getByRole('button', { name: /Contenido/ }));
  fireEvent.click(within(screen.getByRole('navigation', { name: 'Contenido de Categorías' })).getByRole('button', { name: group, exact: true }));
}
function category(id) { fireEvent.change(screen.getByRole('combobox', { name: 'Categoría que estás editando' }), { target: { value: id } }); }
function design(group) {
  fireEvent.click(within(screen.getByRole('navigation', { name: 'Pasos de edición' })).getByRole('button', { name: /Diseño/ }));
  if (group) fireEvent.click(within(screen.getByRole('navigation', { name: 'Diseño de Categorías' })).getByRole('button', { name: group, exact: true }));
}

describe('Categorías: Abanico vivo', () => {
  it('mantiene todas las categorías y enlaces visibles sin temporizador ni carrusel', () => {
    const interval = vi.spyOn(globalThis, 'setInterval');
    const many = Array.from({ length: 8 }, (_, i) => ({ id: `c${i}`, title: `Colección ${i}`, href: `/coleccion/${i}` }));
    const { container } = render(<CategoriasSection theme={makeTheme(many)} />);
    expect(screen.getAllByRole('link')).toHaveLength(8);
    expect(container.querySelectorAll('.categories-fan__row')).toHaveLength(2);
    expect(screen.getByRole('link', { name: 'Explorar Colección 7' })).toHaveAttribute('href', '/coleccion/7');
    expect(container.querySelector('.keen-slider')).toBeNull();
    expect(screen.queryByRole('button', { name: /siguiente|anterior/i })).not.toBeInTheDocument();
    expect(interval).not.toHaveBeenCalled(); interval.mockRestore();
  });
  it('eleva la tarjeta explorada y muestra su descripción con cursor o teclado', () => {
    const { container } = render(<CategoriasSection theme={makeTheme()} />);
    const first = screen.getByRole('link', { name: 'Explorar Primera categoría' });
    fireEvent.mouseEnter(first);
    expect(first).toHaveClass('is-active');
    expect(container.querySelector('.categories-fan__footer')).toHaveTextContent('Detalles de la primera');
    fireEvent.focus(screen.getByRole('link', { name: 'Explorar Segunda categoría' }));
    expect(first).not.toHaveClass('is-active');
    expect(container.querySelector('.categories-fan__footer')).toHaveTextContent('Segunda categoría');
  });
  it('respeta categorías ocultas y no deja una sección vacía', () => {
    const { rerender, container } = render(<CategoriasSection theme={makeTheme(records.map((r, i) => ({ ...r, enabled: i !== 1 })))} />);
    expect(screen.getAllByRole('link')).toHaveLength(2);
    expect(screen.queryByRole('link', { name: 'Explorar Segunda categoría' })).not.toBeInTheDocument();
    rerender(<CategoriasSection theme={makeTheme([])} />); expect(container).toBeEmptyDOMElement();
  });
  it('respeta la desactivación general', () => {
    const theme = makeTheme(); theme.sections[0].enabled = false;
    const { container } = render(<CategoriasSection theme={theme} />); expect(container).toBeEmptyDOMElement();
  });
  it('conserva las cinco categorías originales y no pierde contenido al guardar', () => {
    const original = normalizeCategoriasSection({ config: { slides: records }, style: { fanGlassTint: 0, fanParallax: false, fanExpand: 1.6 } });
    expect(normalizeCategoriasSection(JSON.parse(JSON.stringify(original)))).toEqual(original);
    expect(original.config.slides[0]).toMatchObject(records[0]);
    expect(normalizeCategoriasSection({}).config.slides).toHaveLength(5);
  });
  it('acepta textos con espacios mientras se escriben', () => {
    const next = normalizeCategoriasSection({ config: { titleText: 'Mi colección ', slides: [{ ...records[0], title: 'Moda infantil ' }] } });
    expect(next.config.titleText).toBe('Mi colección '); expect(next.config.slides[0].title).toBe('Moda infantil ');
  });
  it('acota parámetros de movimiento y columnas', () => {
    expect(normalizeCategoriasFanStyle({ fanColumns: 30, fanMobileColumns: 0, fanExpand: 99, fanGlassTint: -1, fanHeightPx: NaN })).toMatchObject({ fanColumns: 6, fanMobileColumns: 1, fanExpand: 1.8, fanGlassTint: 0, fanHeightPx: 380 });
  });
  it.each(['javascript:alert(1)', 'data:text/html,hello', '//example.com', '/\\example.com'])('rechaza destinos no válidos: %s', (href) => {
    render(<CategoriasSection theme={makeTheme([{ ...records[0], href }])} />);
    expect(screen.getByRole('link')).toHaveAttribute('href', '/categorias');
  });
  it('sustituye una imagen averiada y vuelve a intentar al cambiar de imagen', () => {
    const slide = normalizeCategoriasSection(makeTheme().sections[0]).config.slides[0];
    const { container, rerender } = render(<CategoriaArtwork slide={slide} />);
    fireEvent.error(screen.getByAltText('Primera categoría'));
    expect(container.querySelector('img')).toBeNull(); expect(container.querySelector('.category-artwork__fallback')).toBeInTheDocument();
    rerender(<CategoriaArtwork slide={{ ...slide, image: '/reparada.jpg' }} />);
    expect(screen.getByAltText('Primera categoría')).toHaveAttribute('src', '/reparada.jpg');
  });
  it('usa la foto de escritorio si falla la imagen móvil', () => {
    const slide = normalizeCategoriasSection({ config: { slides: [{ ...records[0], mobileImage: '/mobile.jpg' }] } }).config.slides[0];
    render(<CategoriaArtwork slide={slide} mobile />);
    fireEvent.error(screen.getByAltText('Primera categoría'));
    expect(screen.getByAltText('Primera categoría')).toHaveAttribute('src', '/uno.jpg');
  });
  it('usa fotografías incluidas para las rutas antiguas sin descartar imágenes propias', () => {
    expect(categoryPhotoSource('/SeccionCategoria/complementos.jpg')).toBe('');
    expect(categoryPhotoSource('/SeccionCategoria/propia.jpg')).toBe('/SeccionCategoria/propia.jpg');
    render(<CategoriasSection theme={{ sections: [] }} />);
    expect(screen.getAllByRole('link')).toHaveLength(5); expect(screen.queryByAltText('Título de categorías')).not.toBeInTheDocument();
  });
  it('actualiza el fondo con Looks y permite un color propio', () => {
    const theme = makeTheme(); theme.sections.unshift({ id: 'look', config: { editorialBackgroundImage: '/fondo.webp' }, style: { editorialBackgroundColor: '#cc7788' } });
    const { container, rerender } = render(<CategoriasSection theme={theme} />);
    expect(container.querySelector('.categories-fan').style.getPropertyValue('--cat-scene-image')).toContain('/fondo.webp');
    const next = makeTheme(records, { fanBackgroundMode: 'color', fanBackgroundColor: '#aa6677' }); rerender(<CategoriasSection theme={next} />);
    expect(container.querySelector('.categories-fan').style.getPropertyValue('--cat-scene-color')).toBe('#aa6677');
    expect(container.querySelector('.categories-fan').style.getPropertyValue('--cat-scene-image')).toBe('none');
  });
  it('desactiva la profundidad cuando se apaga la interacción', () => {
    const { container } = render(<CategoriasSection theme={makeTheme(records, { fanMotionEnabled: false })} />);
    expect(container.querySelector('.categories-fan')).toHaveAttribute('data-motion', 'off');
    fireEvent.pointerMove(container.querySelector('.categories-fan'), { clientX: 20, clientY: 20 });
    expect(container.querySelector('.categories-fan').style.getPropertyValue('--cat-pointer-x')).toBe('');
  });
  it('edita una categoría, la reordena y entrega sus datos sin alterar las demás secciones', () => {
    const save = vi.fn(); render(<Harness save={save} />);
    content('Nombre y enlace'); category('two');
    fireEvent.change(screen.getByLabelText('Nombre de la categoría'), { target: { value: 'Categoría renovada' } });
    fireEvent.change(screen.getByLabelText('Enlace de la galería'), { target: { value: '/renovada' } });
    fireEvent.click(screen.getByRole('button', { name: 'Subir categoría' }));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar prueba' }));
    const result = save.mock.calls[0][0];
    expect(result.sections[0].config.slides.map((r) => r.id)).toEqual(['two', 'one', 'three']);
    expect(result.sections[0].config.slides[0]).toMatchObject({ title: 'Categoría renovada', href: '/renovada' });
    expect(result.sections[0].config.slides[1]).toMatchObject(records[0]);
    expect(result.sections[1]).toEqual({ id: 'otra', config: { keep: true } });
  });
  it('añade categorías sin sobrescribir ni eliminar las existentes', () => {
    const save = vi.fn(); render(<Harness save={save} />);
    content('Nombre y enlace');
    fireEvent.click(screen.getByRole('button', { name: 'Agregar categoría' }));
    fireEvent.change(screen.getByLabelText('Nombre de la categoría'), { target: { value: 'Nueva colección' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar prueba' }));
    const slides = save.mock.calls[0][0].sections[0].config.slides;
    expect(slides).toHaveLength(4); expect(slides.slice(0, 3).map((r) => r.id)).toEqual(['one', 'two', 'three']);
    expect(slides[3].title).toBe('Nueva colección');
  });
  it('restaura el diseño conservando textos, imágenes y galerías', () => {
    const save = vi.fn(); render(<Harness save={save} />);
    fireEvent.change(screen.getByLabelText('Título de la sección'), { target: { value: 'Mi título' } });
    design('Móvil'); fireEvent.click(screen.getByRole('button', { name: 'Una columna' }));
    fireEvent.click(screen.getByRole('button', { name: 'Restaurar diseño predeterminado' }));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar prueba' }));
    expect(save.mock.calls[0][0].sections[0]).toMatchObject({ config: { titleText: 'Mi título', slides: expect.arrayContaining([expect.objectContaining(records[0])]) }, style: { fanMobileColumns: 2 } });
  });
  it('guarda los controles de movimiento y móvil con vista pública conectada', () => {
    const save = vi.fn(); const { container } = render(<Harness save={save} />);
    design('Movimiento'); fireEvent.change(screen.getByRole('slider', { name: 'Expansión al explorar' }), { target: { value: '1.6' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sin movimiento' }));
    design('Móvil'); fireEvent.click(screen.getByRole('button', { name: 'Una columna' }));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar prueba' }));
    expect(save.mock.calls[0][0].sections[0].style).toMatchObject({ fanExpand: 1.6, fanMotionEnabled: false, fanMobileColumns: 1 });
    expect(container.querySelector('.categories-fan')).toHaveAttribute('data-motion', 'off');
  });
  it('conserva las ediciones durante la carga e impide cambiar de categoría hasta terminar', async () => {
    let resolve; const upload = vi.fn(() => new Promise((r) => { resolve = r; }));
    const save = vi.fn(); render(<Harness save={save} upload={upload} />);
    content('Imagen principal');
    fireEvent.change(screen.getByLabelText('Cargar imagen de la categoría'), { target: { files: [new File(['image'], 'foto.png', { type: 'image/png' })] } });
    expect(screen.getByRole('combobox', { name: 'Categoría que estás editando' })).toBeDisabled();
    content('Nombre y enlace');
    fireEvent.change(screen.getByLabelText('Nombre de la categoría'), { target: { value: 'Nombre actualizado' } });
    await act(async () => resolve('https://images.example/new.webp'));
    expect(screen.getByRole('combobox', { name: 'Categoría que estás editando' })).not.toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Guardar prueba' }));
    expect(save.mock.calls[0][0].sections[0].config.slides[0]).toMatchObject({ title: 'Nombre actualizado', image: 'https://images.example/new.webp' });
  });
  it('avisa una carga fallida sin perder la imagen vigente', async () => {
    const save = vi.fn(); render(<Harness save={save} upload={vi.fn().mockRejectedValue(new Error('offline'))} />);
    content('Imagen principal');
    fireEvent.change(screen.getByLabelText('Cargar imagen de la categoría'), { target: { files: [new File(['image'], 'foto.png', { type: 'image/png' })] } });
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('No se pudo cargar'));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar prueba' }));
    expect(save.mock.calls[0][0].sections[0].config.slides[0].image).toBe('/uno.jpg');
  });
  it('muestra solo los ajustes elegidos y conserva la categoría al cambiar de grupo', () => {
    const save = vi.fn(); render(<Harness save={save} />);
    expect(screen.getByLabelText('Título de la sección')).toBeVisible();
    expect(screen.getByLabelText('Nombre de la categoría')).not.toBeVisible();
    content('Nombre y enlace'); category('two');
    fireEvent.change(screen.getByLabelText('Nombre de la categoría'), { target: { value: 'Mi selección' } });
    content('Encuadre');
    expect(screen.getByLabelText('Nombre de la categoría')).not.toBeVisible();
    expect(screen.getByRole('combobox', { name: 'Categoría que estás editando' })).toHaveValue('two');
    fireEvent.change(screen.getByRole('slider', { name: 'Ampliación de la foto' }), { target: { value: '1.3' } });
    content('Imagen móvil'); category('one'); category('two');
    content('Nombre y enlace');
    expect(screen.getByLabelText('Nombre de la categoría')).toHaveValue('Mi selección');
    fireEvent.click(screen.getByRole('button', { name: 'Guardar prueba' }));
    expect(save.mock.calls[0][0].sections[0].config.slides[1]).toMatchObject({ title: 'Mi selección', imageScale: 1.3 });
  });
  it('separa composición, movimiento y espacios sin ocultar sus ajustes', () => {
    render(<Harness />); design('Abanico');
    expect(screen.getByRole('slider', { name: 'Categorías por fila en escritorio' })).toBeVisible();
    expect(screen.queryByRole('slider', { name: 'Expansión al explorar' })).not.toBeInTheDocument();
    design('Movimiento');
    expect(screen.getByRole('slider', { name: 'Expansión al explorar' })).toBeVisible();
    expect(screen.queryByRole('slider', { name: 'Ancho máximo (px)' })).not.toBeInTheDocument();
    design('Espacios');
    expect(screen.getByRole('slider', { name: 'Espacio superior (px)' })).toBeVisible();
    design('Ancho');
    expect(screen.getByRole('slider', { name: 'Ancho máximo (px)' })).toBeVisible();
  });
  it('amplía la sección desde el panel y conserva el ancho personalizado al alternar modos', () => {
    const save = vi.fn(); const { container } = render(<Harness save={save} />);
    design('Ancho');
    fireEvent.change(screen.getByRole('slider', { name: 'Ancho máximo (px)' }), { target: { value: '2200' } });
    fireEvent.change(screen.getByRole('slider', { name: 'Espacio a los lados (px)' }), { target: { value: '0' } });
    expect(container.querySelector('.categories-fan').style.getPropertyValue('--cat-max')).toBe('2200px');
    fireEvent.click(screen.getByRole('button', { name: 'Ancho completo' }));
    expect(screen.queryByRole('slider', { name: 'Ancho máximo (px)' })).not.toBeInTheDocument();
    expect(container.querySelector('.categories-fan').style.getPropertyValue('--cat-max')).toBe('none');
    fireEvent.click(screen.getByRole('button', { name: 'Guardar prueba' }));
    const saved = save.mock.calls[0][0];
    expect(normalizeCategoriasSection(saved.sections[0]).style).toMatchObject({ fanWidthMode: 'full', sectionMaxWidthPx: 2200, sectionPaddingXPx: 0 });
    fireEvent.click(screen.getByRole('button', { name: 'Ancho personalizado' }));
    expect(screen.getByRole('slider', { name: 'Ancho máximo (px)' })).toHaveValue('2200');
    expect(container.querySelector('.categories-fan').style.getPropertyValue('--cat-max')).toBe('2200px');
    expect(saved.sections[0].config.slides).toEqual(normalizeCategoriasSection(makeTheme().sections[0]).config.slides);
  });
  it('mantiene los anchos guardados y descarta modos o límites inválidos', () => {
    expect(normalizeCategoriasSection({ style: { sectionMaxWidthPx: 1600 } }).style).toMatchObject({ sectionMaxWidthPx: 1600, fanWidthMode: 'limited' });
    expect(normalizeCategoriasSection({ style: { sectionMaxWidthPx: 10000, fanWidthMode: 'bad' } }).style).toMatchObject({ sectionMaxWidthPx: 2560, fanWidthMode: 'limited' });
  });
  it('permite comparar móvil y escritorio en la vista previa sin activar enlaces', async () => {
    const section = normalizeCategoriasSection(makeTheme().sections[0]);
    render(<StorefrontSectionPreview section={section} theme={{ sections: [section] }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Vista móvil' }));
    expect(screen.getByText(/Móvil 390 px/)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('link', { name: 'Explorar Primera categoría' })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Vista escritorio' }));
    expect(screen.getByText(/Escritorio 1280 px/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Vista escritorio amplio' }));
    expect(screen.getByText(/Escritorio amplio 1920 px/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Vista escritorio amplio' })).toHaveAttribute('aria-pressed', 'true');
  });
  it('muestra el título de texto si la imagen del título no carga', () => {
    const theme = makeTheme(); theme.sections[0].config.useTitleImage = true; theme.sections[0].config.titleImage = '/titulo-roto.png';
    render(<CategoriasSection theme={theme} />);
    fireEvent.error(screen.getByAltText('Título de categorías'));
    expect(screen.getByRole('heading', { name: 'Colecciones especiales' })).toBeInTheDocument();
    expect(screen.queryByAltText('Título de categorías')).not.toBeInTheDocument();
  });

});
