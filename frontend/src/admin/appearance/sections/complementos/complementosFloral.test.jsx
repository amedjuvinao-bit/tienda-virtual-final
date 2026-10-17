import React, { useState } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ComplementosLook from '../../../../components/ComplementosLook';
import ComplementosSectionUI from './ComplementosSectionUI';
import StorefrontSectionPreview from '../ui/StorefrontSectionPreview';
import { COMPLEMENTOS_SECTION_DEFAULTS as defaults, normalizeComplementosSection } from './complementosSectionHelpers';
afterEach(cleanup);
function Harness({ onSave = () => {}, upload }) {
  const [theme, setTheme] = useState({ sections: [{ id: 'complementos', config: {} }, { id: 'look', config: { keep: true } }] });
  return <><ComplementosSectionUI theme={theme} setPath={(path, value) => setTheme({ ...theme, [path]: value })} uploadToCloudinary={upload} />
    <ComplementosLook theme={theme} /><button onClick={() => onSave(JSON.parse(JSON.stringify(theme)))}>Guardar prueba</button></>;
}
const design = () => fireEvent.click(screen.getByRole('button', { name: /Diseño/ }));
describe('Complementos: banner floral editable', () => {
  it('migra solo imágenes predeterminadas y conserva las personalizadas', () => {
    expect(normalizeComplementosSection({ config: { imageSrc: '/SeccionComplementos/Complementos.png' } }).config.imageSrc).toBe(defaults.config.imageSrc);
    expect(normalizeComplementosSection({ config: { imageSrc: '/personal.jpg', linkHref: '/mi-categoria', buttonText: 'Mi selección ' } }).config).toMatchObject({ imageSrc: '/personal.jpg', mobileImageSrc: '', linkHref: '/mi-categoria', buttonText: 'Mi selección ' });
  });
  it('conserva fallback móvil y ajustes al normalizar un guardado', () => {
    const original = normalizeComplementosSection({ config: { mobileImageSrc: '', title: '', titleEnabled: false }, style: { buttonTintPercent: 0, buttonBlurPx: 0, mobileHeightPx: 550, layout: 'floating' } });
    expect(normalizeComplementosSection(JSON.parse(JSON.stringify(original)))).toEqual(original);
  });
  it('acota valores inválidos y opciones desconocidas', () => {
    expect(normalizeComplementosSection({ style: { mobileHeightPx: -1, buttonTintPercent: 900, layout: 'bad', titleFontSizePx: NaN } }).style).toMatchObject({ mobileHeightPx: 360, buttonTintPercent: 85, layout: 'frame', titleFontSizePx: 64 });
  });
  it.each(['javascript:alert(1)', 'data:text/html,bad', '//evil.com', '/\\evil.com'])('evita navegación ejecutable o ambigua: %s', (linkHref) => {
    render(<ComplementosLook theme={{ sections: [{ id: 'complementos', config: { linkHref } }] }} />);
    expect(screen.getByRole('link')).toHaveAttribute('href', '/complementos');
  });
  it('muestra una acción de categoría con imágenes separadas por dispositivo', () => {
    render(<ComplementosLook theme={{ sections: [{ id: 'complementos', config: { imageSrc: '/wide.jpg', mobileImageSrc: '/tall.jpg', title: 'Accesorios especiales', buttonText: 'Abrir galería' } }] }} />);
    expect(screen.getByRole('heading', { name: 'Accesorios especiales' })).toBeInTheDocument();
    expect(screen.getAllByRole('link')).toHaveLength(1);
    expect(screen.getByAltText('Complementos')).toHaveAttribute('src', '/wide.jpg');
    expect(screen.getByAltText('Complementos (móvil)')).toHaveAttribute('src', '/tall.jpg');
  });
  it('respeta los controles de visibilidad', () => {
    const { rerender } = render(<ComplementosLook theme={{ sections: [{ id: 'complementos', config: { titleEnabled: false, subtitleEnabled: false, buttonEnabled: false } }] }} />);
    expect(screen.queryByRole('heading')).not.toBeInTheDocument(); expect(screen.queryByRole('link')).not.toBeInTheDocument();
    rerender(<ComplementosLook theme={{ sections: [{ id: 'complementos', enabled: false }] }} />);
    expect(screen.queryByRole('region')).not.toBeInTheDocument();
  });
  it('guarda textos, enlace y ajustes móviles sin alterar otras secciones', () => {
    const save = vi.fn(); render(<Harness onSave={save} />);
    fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'Nueva colección' } });
    fireEvent.change(screen.getByLabelText('Texto del botón'), { target: { value: 'Ver mi colección' } });
    fireEvent.change(screen.getByLabelText('Enlace de la galería'), { target: { value: '/coleccion' } });
    design(); fireEvent.click(screen.getByRole('button', { name: 'Móvil', exact: true }));
    fireEvent.change(screen.getByRole('slider', { name: 'Altura móvil (px)' }), { target: { value: '660' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar prueba' }));
    expect(save.mock.calls[0][0].sections[0]).toMatchObject({ config: { title: 'Nueva colección', buttonText: 'Ver mi colección', linkHref: '/coleccion' }, style: { mobileHeightPx: 660 } });
    expect(save.mock.calls[0][0].sections[1]).toEqual({ id: 'look', config: { keep: true } });
    expect(screen.getByRole('link')).toHaveAttribute('href', '/coleccion');
  });
  it('restaura el estilo conservando el contenido', () => {
    const save = vi.fn(); render(<Harness onSave={save} />);
    fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'Mi colección' } });
    design(); fireEvent.click(screen.getByRole('button', { name: 'Cristal flotante', exact: true }));
    fireEvent.click(screen.getByRole('button', { name: 'Restaurar diseño de cristal floral' }));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar prueba' }));
    expect(save.mock.calls[0][0].sections[0]).toMatchObject({ config: { title: 'Mi colección' }, style: { layout: 'frame' } });
  });
  it('carga móvil sin perder ediciones realizadas durante la carga', async () => {
    let resolve; const upload = vi.fn(() => new Promise((r) => { resolve = r; }));
    const save = vi.fn(); render(<Harness upload={upload} onSave={save} />);
    fireEvent.change(screen.getByLabelText('Cargar imagen de móvil'), { target: { files: [new File(['image'], 'mobile.png', { type: 'image/png' })] } });
    fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'Título actualizado' } });
    await act(async () => resolve('https://images.example/mobile.png'));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar prueba' }));
    expect(save.mock.calls[0][0].sections[0].config).toMatchObject({ title: 'Título actualizado', mobileImageSrc: 'https://images.example/mobile.png' });
    fireEvent.click(screen.getByRole('button', { name: 'Usar imagen de escritorio' }));
    expect(screen.getByAltText('Complementos (móvil)')).toHaveAttribute('src', defaults.config.imageSrc);
  });
  it('avisa una carga fallida y conserva la imagen vigente', async () => {
    render(<Harness upload={vi.fn().mockRejectedValue(new Error('offline'))} />);
    fireEvent.change(screen.getByLabelText('Cargar imagen de escritorio'), { target: { files: [new File(['x'], 'photo.png', { type: 'image/png' })] } });
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('No se pudo cargar'));
    expect(screen.getByAltText('Complementos')).toHaveAttribute('src', defaults.config.imageSrc);
  });
  it('rechaza archivos ajenos a imágenes antes de subirlos', () => {
    const upload = vi.fn(); render(<Harness upload={upload} />);
    fireEvent.change(screen.getByLabelText('Cargar imagen de escritorio'), { target: { files: [new File(['x'], 'doc.pdf', { type: 'application/pdf' })] } });
    expect(screen.getByRole('alert')).toHaveTextContent('Elige una imagen'); expect(upload).not.toHaveBeenCalled();
  });
  it('cambia de dispositivo en la vista previa sin necesitar productos', async () => {
    const section = normalizeComplementosSection({});
    render(<StorefrontSectionPreview section={section} theme={{ sections: [section] }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Vista móvil' }));
    await waitFor(() => expect(screen.getByText(/Móvil 390 px/)).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Vista escritorio' }));
    await waitFor(() => expect(screen.getByText(/Escritorio 1280 px/)).toBeInTheDocument());
  });
});
