import React, { useState } from 'react';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import SectionsPanel from '../SectionsPanel';
import { DEFAULT_TRENDING_MOBILE_COLORS, normalizeTrendingPresentation } from '../../../../components/trendingPresentation';

vi.mock('../../../../context/CartContext', () => ({ useCart: () => ({ addToCart: vi.fn() }) }));
vi.mock('../../../../context/FavoritesContext', () => ({ useFavorites: () => ({ toggleFavorite: vi.fn(), isFavorite: () => false }) }));

const desktop = { titleColor: '#008811', cardPriceColor: '#553300', actionColor: '#020202', backgroundColor: '#abcdef', dockGapPx: 17 };
function Harness({ onSave, uploadToCloudinary }) {
  const [theme, setTheme] = useState({ sections: [{ id: 'tendencia', type: 'tendencia', enabled: true,
    config: { products: [], presentation: { mode: 'floatingGlass', ...desktop } },
  }] });
  return <MemoryRouter><SectionsPanel theme={theme} setPath={(_, sections) => setTheme({ sections })} uploadToCloudinary={uploadToCloudinary} />
    <button onClick={() => onSave(theme.sections[0])}>Guardar prueba</button></MemoryRouter>;
}
function openColors(onSave = vi.fn(), uploadToCloudinary) {
  render(<Harness onSave={onSave} uploadToCloudinary={uploadToCloudinary} />);
  fireEvent.click(screen.getByRole('button', { name: 'Editar En tendencia' }));
  fireEvent.click(within(screen.getByRole('navigation', { name: 'Pasos de edición' })).getByRole('button', { name: /Diseño/ }));
  fireEvent.click(within(screen.getByRole('navigation', { name: 'Diseño de Tendencia' })).getByRole('button', { name: 'Móvil', exact: true }));
  return screen.getByRole('region', { name: 'Colores del móvil' });
}
const change = (label, value) => fireEvent.change(screen.getByLabelText(`${label} del móvil: código hexadecimal`), { target: { value } });

beforeEach(() => {
  vi.stubGlobal('innerWidth', 1200);
  vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('controles de colores móviles de Tendencia', () => {
  it('permite ajustar el cristal con tinte blanco y recuperar la transparencia inicial', () => {
    const save = vi.fn();
    const panel = openColors(save);
    fireEvent.click(within(panel).getByRole('button', { name: 'Botón', exact: true }));
    change('Fondo del botón', '#ffffff');
    fireEvent.change(screen.getByRole('slider', { name: 'Intensidad del tinte del botón móvil' }), { target: { value: '20' } });
    fireEvent.change(screen.getByRole('slider', { name: 'Desenfoque del cristal del botón móvil' }), { target: { value: '6' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar prueba' }));
    expect(save.mock.lastCall[0].config.presentation).toMatchObject({ mobileButtonColor: '#ffffff', mobileButtonTintOpacity: .2, mobileButtonBlurPx: 6 });
    expect(within(panel).getByRole('group', { name: 'Muestra de colores del móvil' })).toHaveStyle({ '--runway-button-tint': '0.2', '--runway-button-blur': '6px' });
    fireEvent.click(within(panel).getByRole('button', { name: 'Restaurar cristal transparente' }));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar prueba' }));
    expect(save.mock.lastCall[0].config.presentation).toMatchObject({ mobileButtonColor: '#ffffff', mobileButtonTintOpacity: .08, mobileButtonBlurPx: 2 });
  });

  it('carga, guarda y quita una imagen exclusiva del móvil sin perder cambios hechos durante la carga', async () => {
    const save = vi.fn();
    let finish;
    const upload = vi.fn().mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    const panel = openColors(save, upload);
    const url = 'https://res.cloudinary.com/tienda/image/upload/v2/fondo-movil.webp';
    const input = within(panel).getByLabelText('Cargar imagen de fondo móvil');
    const file = new File(['photo'], 'fondo.webp', { type: 'image/webp' });
    fireEvent.change(input, { target: { files: [file] } });
    expect(upload).toHaveBeenCalledWith(file);
    expect(screen.getByText('Cargando imagen…')).toBeInTheDocument();
    expect(input).toBeDisabled();
    change('Título de la sección', '#123456');
    finish(url);
    const thumbnail = await screen.findByRole('img', { name: 'Imagen elegida para el fondo móvil' });
    expect(thumbnail).toHaveAttribute('src', url);
    expect(within(panel).getByRole('button', { name: 'Mi imagen', exact: true })).toHaveAttribute('aria-pressed', 'true');
    expect(within(panel).getByRole('group', { name: 'Muestra de colores del móvil' }).style.backgroundImage).toContain(url);
    fireEvent.click(screen.getByRole('button', { name: 'Guardar prueba' }));
    expect(save.mock.lastCall[0].config.presentation).toMatchObject({ ...desktop, mobileTitleColor: '#123456', mobileBackgroundImage: url, mobileBackgroundMode: 'custom' });
    fireEvent.click(within(panel).getByRole('button', { name: 'Quitar imagen móvil' }));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar prueba' }));
    expect(save.mock.lastCall[0].config.presentation).toMatchObject({ ...desktop, mobileBackgroundImage: '', mobileBackgroundMode: 'inherit' });
    expect(screen.queryByRole('img', { name: 'Imagen elegida para el fondo móvil' })).not.toBeInTheDocument();
  });

  it('informa de un fallo de carga, conserva el fondo y permite volver a intentarlo', async () => {
    const save = vi.fn();
    const upload = vi.fn().mockRejectedValueOnce(new Error('No se pudo cargar la imagen.')).mockResolvedValueOnce('https://res.cloudinary.com/tienda/image/upload/fondo.png');
    const panel = openColors(save, upload);
    const input = within(panel).getByLabelText('Cargar imagen de fondo móvil');
    const file = new File(['photo'], 'fondo.png', { type: 'image/png' });
    fireEvent.change(input, { target: { files: [file] } });
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo cargar la imagen.');
    fireEvent.click(screen.getByRole('button', { name: 'Guardar prueba' }));
    expect(normalizeTrendingPresentation(save.mock.lastCall[0].config.presentation).mobileBackgroundMode).toBe('inherit');
    expect(input).not.toBeDisabled();
    fireEvent.change(input, { target: { files: [file] } });
    await screen.findByRole('img', { name: 'Imagen elegida para el fondo móvil' });
    expect(upload).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('rechaza archivos incompatibles y respuestas inválidas sin activar un fondo roto', async () => {
    const save = vi.fn();
    const upload = vi.fn().mockResolvedValue('javascript:alert(1)');
    const panel = openColors(save, upload);
    const input = within(panel).getByLabelText('Cargar imagen de fondo móvil');
    fireEvent.change(input, { target: { files: [new File(['x'], 'documento.pdf', { type: 'application/pdf' })] } });
    expect(screen.getByRole('alert')).toHaveTextContent('Selecciona una imagen');
    expect(upload).not.toHaveBeenCalled();
    fireEvent.change(input, { target: { files: [new File(['x'], 'fondo.png', { type: 'image/png' })] } });
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('No se recibió una imagen válida'));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar prueba' }));
    expect(normalizeTrendingPresentation(save.mock.lastCall[0].config.presentation).mobileBackgroundImage).toBe('');
  });

  it('guarda cambios de cada grupo y mantiene los colores de escritorio', () => {
    const save = vi.fn();
    const panel = openColors(save);
    change('Título de la sección', '#112233');
    change('Precio', '#114455');
    fireEvent.click(within(panel).getByRole('button', { name: 'Botón', exact: true }));
    change('Fondo del botón', '#334455');
    change('Texto e icono del botón', '#fefefe');
    fireEvent.click(within(panel).getByRole('button', { name: 'Corazón e indicadores' }));
    change('Corazón marcado', '#9b2266');
    change('Otros indicadores', '#bb6677');
    fireEvent.click(within(panel).getByRole('button', { name: 'Fondo y detalles' }));
    fireEvent.click(within(panel).getByRole('button', { name: 'Color liso', exact: true }));
    change('Fondo de la sección', '#f6e5ef');
    fireEvent.click(screen.getByRole('button', { name: 'Guardar prueba' }));
    expect(save.mock.lastCall[0].config.presentation).toMatchObject({ ...desktop,
      mobileTitleColor: '#112233', mobilePriceColor: '#114455', mobileButtonColor: '#334455', mobileButtonTextColor: '#fefefe',
      mobileFavoriteActiveColor: '#9b2266', mobileIndicatorInactiveColor: '#bb6677', mobileBackgroundMode: 'color', mobileBackgroundColor: '#f6e5ef',
    });
    expect(within(panel).getByRole('group', { name: 'Muestra de colores del móvil' })).toHaveStyle('--runway-button: #334455');
  });

  it('aplica una combinación y restaura solo los colores móviles', () => {
    const save = vi.fn();
    const panel = openColors(save);
    fireEvent.click(within(panel).getByRole('button', { name: 'Cacao', exact: true }));
    expect(within(panel).getByRole('button', { name: 'Cacao', exact: true })).toHaveAttribute('aria-pressed', 'true');
    expect(within(panel).getByRole('group', { name: 'Muestra de colores del móvil' })).toHaveStyle('--runway-button: #754535');
    fireEvent.click(screen.getByRole('button', { name: 'Guardar prueba' }));
    expect(save.mock.lastCall[0].config.presentation).toMatchObject({ ...desktop, mobileButtonColor: '#754535' });
    fireEvent.click(within(panel).getByRole('button', { name: 'Restaurar colores originales' }));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar prueba' }));
    expect(save.mock.lastCall[0].config.presentation).toMatchObject({ ...desktop, ...DEFAULT_TRENDING_MOBILE_COLORS });
  });

  it('permite escribir el color por partes sin guardar valores incompletos', () => {
    const save = vi.fn();
    openColors(save);
    change('Título de la sección', '#12');
    expect(screen.getByLabelText('Título de la sección del móvil: código hexadecimal')).toHaveValue('#12');
    fireEvent.click(screen.getByRole('button', { name: 'Guardar prueba' }));
    expect(normalizeTrendingPresentation(save.mock.lastCall[0].config.presentation).mobileTitleColor).toBe(DEFAULT_TRENDING_MOBILE_COLORS.mobileTitleColor);
    change('Título de la sección', '#123456');
    fireEvent.click(screen.getByRole('button', { name: 'Guardar prueba' }));
    expect(save.mock.lastCall[0].config.presentation.mobileTitleColor).toBe('#123456');
  });

  it('permite escoger la vista móvil aunque la ventana sea de escritorio', () => {
    openColors();
    const preview = screen.getByRole('region', { name: 'Vista real de la tienda' });
    fireEvent.click(within(preview).getByRole('button', { name: 'Vista móvil', exact: true }));
    expect(within(preview).getByText('Vista previa · Móvil 390 px')).toBeInTheDocument();
    fireEvent.click(within(preview).getByRole('button', { name: 'Vista escritorio', exact: true }));
    expect(within(preview).getByText('Vista previa · Escritorio 1280 px')).toBeInTheDocument();
  });
});
