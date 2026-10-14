import React, { useCallback, useState } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import SectionsPanel from './SectionsPanel';

afterEach(cleanup);

function EditorHarness() {
  const [theme, setTheme] = useState({ sections: [{
    id: 'tendencia', type: 'tendencia', name: 'En tendencia', enabled: true,
    config: { products: [] },
  }] });
  const [savedName, setSavedName] = useState('');
  const setPath = useCallback((path, value) => {
    if (path === 'sections') setTheme((previous) => ({ ...previous, sections: value }));
  }, []);

  return <>
    <SectionsPanel theme={theme} setPath={setPath} />
    <button onClick={() => setSavedName(theme.sections[0].name)}>Guardar ahora</button>
    <output data-testid="saved-name">{savedName}</output>
  </>;
}

describe('edición de secciones', () => {
  it('pasa el último cambio al formulario antes de guardar inmediatamente', () => {
    render(<EditorHarness />);
    fireEvent.click(screen.getByRole('button', { name: 'Editar' }));
    fireEvent.change(screen.getByPlaceholderText('Ej: En tendencia'), { target: { value: 'Nueva tendencia' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar ahora' }));
    expect(screen.getByTestId('saved-name')).toHaveTextContent('Nueva tendencia');
    expect(screen.getAllByDisplayValue('tendencia').every((field) => field.readOnly)).toBe(true);
  });
});
