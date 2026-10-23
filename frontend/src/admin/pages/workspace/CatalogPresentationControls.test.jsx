import React, { useState } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CatalogPresentationControls from './CatalogPresentationControls';
import { buildCatalogPresentation } from '../../../components/catalog/catalogPresentation';
import { adminFetch } from '../../../lib/api';
vi.mock('../../../lib/api', () => ({ adminFetch: vi.fn() }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });
function Editor() {
  const [value, setValue] = useState(buildCatalogPresentation({}));
  return <><CatalogPresentationControls value={value} onChange={patch => setValue(current => ({ ...current, ...patch }))}/><output data-testid="config">{JSON.stringify(value)}</output></>;
}
it('sube un fondo sin sobrescribir ajustes editados durante la subida y permite quitarlo', async () => {
  let complete;
  adminFetch.mockReturnValue(new Promise(resolve => { complete = resolve; }));
  const user = userEvent.setup();
  render(<Editor/>);
  await user.upload(screen.getByLabelText('Subir imagen de fondo'), new File(['image'], 'fondo.webp', { type: 'image/webp' }));
  expect(await screen.findByText('Subiendo imagen…')).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Tamaño del título de catálogo (px)'), { target: { value: '52' } });
  complete({ ok: true, json: async () => ({ url: 'https://example.test/fondo.webp' }) });
  await waitFor(() => expect(screen.getByLabelText('Dirección de la imagen de fondo')).toHaveValue('https://example.test/fondo.webp'));
  expect(JSON.parse(screen.getByTestId('config').textContent).titleSize).toBe(52);
  expect(adminFetch.mock.calls[0][1].body.get('file').name).toBe('fondo.webp');
  await user.click(screen.getByRole('button', { name: 'Quitar imagen de fondo' }));
  expect(screen.getByLabelText('Dirección de la imagen de fondo')).toHaveValue('');
});

it('permite cambiar los colores, materiales y adorno del encabezado desde el panel', () => {
  render(<Editor/>);
  fireEvent.change(screen.getByLabelText('Color del cristal del encabezado'), {target:{value:'#123456'}});
  fireEvent.change(screen.getByLabelText('Intensidad de los reflejos (0 a 1)'), {target:{value:'0'}});
  fireEvent.change(screen.getByLabelText('Adorno del encabezado'), {target:{value:'none'}});
  fireEvent.click(screen.getByLabelText('Mostrar segunda capa de cristal'));
  expect(JSON.parse(screen.getByTestId('config').textContent)).toMatchObject({headerTint:'#123456',headerReflection:0,headerIcon:'none',headerLayers:false});
});
