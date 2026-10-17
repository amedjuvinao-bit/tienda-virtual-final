import React, { useState } from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import SectionsPanel from '../SectionsPanel';
import { DEFAULT_TRENDING_MOBILE_COLORS, normalizeTrendingPresentation } from '../../../../components/trendingPresentation';

vi.mock('../../../../context/CartContext', () => ({ useCart: () => ({ addToCart: vi.fn() }) }));
vi.mock('../../../../context/FavoritesContext', () => ({ useFavorites: () => ({ toggleFavorite: vi.fn(), isFavorite: () => false }) }));

const desktop = { titleColor: '#008811', cardPriceColor: '#553300', actionColor: '#020202', backgroundColor: '#abcdef', dockGapPx: 17 };
function Harness({ onSave }) {
  const [theme, setTheme] = useState({ sections: [{ id: 'tendencia', type: 'tendencia', enabled: true,
    config: { products: [], presentation: { mode: 'floatingGlass', ...desktop } },
  }] });
  return <MemoryRouter><SectionsPanel theme={theme} setPath={(_, sections) => setTheme({ sections })} />
    <button onClick={() => onSave(theme.sections[0])}>Guardar prueba</button></MemoryRouter>;
}
function openColors(onSave = vi.fn()) {
  render(<Harness onSave={onSave} />);
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
