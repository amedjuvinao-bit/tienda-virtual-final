import React, { useCallback, useState } from 'react';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import SectionsPanel from './SectionsPanel';

afterEach(cleanup);

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
    'permite recorrer contenido, diseño y vista previa de %s', (id) => {
      render(<Harness id={id} onSave={vi.fn()} />);
      fireEvent.click(screen.getByRole('button', { name: `Editar ${id === 'categorias' ? 'Categorías' : id === 'informacion' ? 'Información' : id === 'tiktok' ? 'TikTok' : id === 'look' ? 'Looks' : id === 'complementos' ? 'Complementos' : id === 'instagram' ? 'Instagram' : 'En tendencia'}` }));
      const steps = screen.getByRole('navigation', { name: 'Pasos de edición' });
      fireEvent.click(within(steps).getByRole('button', { name: /Diseño/ }));
      expect(within(steps).getByRole('button', { name: /Diseño/ })).toHaveAttribute('aria-current', 'step');
      fireEvent.click(within(steps).getByRole('button', { name: /Vista previa/ }));
      expect(within(steps).getByRole('button', { name: /Vista previa/ })).toHaveAttribute('aria-current', 'step');
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
    fireEvent.click(within(steps).getByRole('button', { name: /Vista previa/ }));
    fireEvent.click(within(steps).getByRole('button', { name: /Contenido/ }));
    expect(screen.getByPlaceholderText('https://instagram.com/tuusuario')).toHaveValue('https://instagram.com/rosa');
    await waitFor(() => expect(screen.getByPlaceholderText('https://instagram.com/tuusuario')).toHaveValue('https://instagram.com/rosa'));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar ahora' }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ config: expect.objectContaining({ profileLink: 'https://instagram.com/rosa' }) }));
  });
});
