import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import SectionsPanel from './SectionsPanel';
import { getSectionOverview } from './sectionsOverviewModel';

const sections = [
  { id: 'tendencia', type: 'tendencia', name: 'En tendencia', enabled: true, config: { products: [] } },
  { id: 'look', type: 'look', name: 'Looks', enabled: true, config: { products: [{ productId: 'p1' }] } },
  { id: 'instagram', type: 'instagram', name: 'Instagram', enabled: false, config: { posts: [] } },
  { id: 'informacion', type: 'informacion', name: 'Información', enabled: true, config: {} },
];

afterEach(cleanup);

describe('vista general de Secciones', () => {
  it('resume el contenido real y distingue las secciones sin contenido de las ocultas', () => {
    expect(getSectionOverview(sections[0], sections)).toMatchObject({ status: 'needs-content', detail: '0 productos seleccionados' });
    expect(getSectionOverview(sections[1], sections)).toMatchObject({ status: 'ready', detail: '1 producto seleccionado' });
    expect(getSectionOverview(sections[2], sections)).toMatchObject({ status: 'hidden' });
    expect(getSectionOverview({ id: 'newsletter', name: 'Boletín' }, sections)).toMatchObject({ status: 'unsupported' });
  });

  it('filtra la lista sin alterar las secciones y conserva un acceso claro al editor', () => {
    render(<SectionsPanel theme={{ sections }} setPath={vi.fn()} />);
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.getAllByRole('article')).toHaveLength(4);
    const summary = screen.getByRole('group', { name: 'Resumen de secciones' });
    expect(summary).toHaveTextContent('2 configuradas');
    expect(summary).toHaveTextContent('1 por completar');
    expect(summary).toHaveTextContent('1 ocultas');

    fireEvent.click(screen.getByRole('button', { name: 'Por completar' }));
    expect(screen.getAllByRole('article')).toHaveLength(1);
    expect(screen.getByRole('heading', { name: 'En tendencia' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Editar En tendencia' }));
    expect(screen.getByPlaceholderText('Ej: En tendencia')).toBeInTheDocument();
  });

  it('permite ocultar una sección desde la lista y pasa el cambio al guardado global', async () => {
    const setPath = vi.fn();
    render(<SectionsPanel theme={{ sections }} setPath={setPath} />);
    const lookCard = screen.getByRole('heading', { name: 'Selección de productos' }).closest('article');
    const toggle = within(lookCard).getByRole('switch', { name: 'Mostrar Selección de productos en la tienda' });
    expect(toggle).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-checked', 'false');
    expect(within(lookCard).getByText('Oculta')).toBeInTheDocument();
    await waitFor(() => expect(setPath).toHaveBeenCalledWith('sections', expect.arrayContaining([
      expect.objectContaining({ id: 'look', enabled: false }),
    ])));
  });
});
