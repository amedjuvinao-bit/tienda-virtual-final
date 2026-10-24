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
  await user.click(screen.getByRole('tab', {name:'Fondo', exact:true}));
  await user.selectOptions(screen.getByLabelText('Origen del fondo'), 'custom');
  await user.upload(screen.getByLabelText('Subir imagen de fondo'), new File(['image'], 'fondo.webp', { type: 'image/webp' }));
  expect(await screen.findByText('Subiendo imagen…')).toBeInTheDocument();
  await user.click(screen.getByRole('tab', {name:'Encabezado', exact:true}));
  await user.click(screen.getByRole('tab', {name:'Texto', exact:true}));
  fireEvent.change(screen.getByLabelText('Tamaño del título de catálogo (px)'), { target: { value: '52' } });
  complete({ ok: true, json: async () => ({ url: 'https://example.test/fondo.webp' }) });
  await waitFor(() => expect(screen.getByLabelText('Dirección de la imagen de fondo')).toHaveValue('https://example.test/fondo.webp'));
  expect(JSON.parse(screen.getByTestId('config').textContent).titleSize).toBe(52);
  expect(adminFetch.mock.calls[0][1].body.get('file').name).toBe('fondo.webp');
  await user.click(screen.getByRole('tab', {name:'Fondo', exact:true}));
  await user.click(screen.getByRole('button', { name: 'Quitar imagen de fondo' }));
  expect(screen.getByLabelText('Dirección de la imagen de fondo')).toHaveValue('');
});

it('permite cambiar los colores, materiales y adorno del encabezado desde el panel', () => {
  render(<Editor/>);
  fireEvent.click(screen.getByRole('tab', {name:'Encabezado', exact:true}));
  fireEvent.change(screen.getByLabelText('Color del cristal del encabezado'), {target:{value:'#123456'}});
  fireEvent.click(screen.getByRole('tab', {name:'Bordes y luz', exact:true}));
  fireEvent.change(screen.getByLabelText('Intensidad de los reflejos (0 a 1)'), {target:{value:'0'}});
  fireEvent.click(screen.getByRole('tab', {name:'Bolsas', exact:true}));
  fireEvent.change(screen.getByLabelText('Adorno del encabezado'), {target:{value:'none'}});
  fireEvent.click(screen.getByRole('tab', {name:'Cristal', exact:true}));
  fireEvent.click(screen.getByLabelText('Mostrar segunda capa de cristal'));
  expect(JSON.parse(screen.getByTestId('config').textContent)).toMatchObject({headerTint:'#123456',headerReflection:0,headerIcon:'none',headerLayers:false});
});

it('muestra un tema a la vez y permite navegar las pestañas con el teclado sin perder cambios', async () => {
  const user = userEvent.setup();
  render(<Editor/>);
  expect(screen.getByRole('tab', {name:'Distribución'})).toHaveAttribute('aria-selected','true');
  expect(screen.getByLabelText('Color del cristal del encabezado')).not.toBeVisible();
  await user.click(screen.getByRole('tab', {name:'Encabezado', exact:true}));
  fireEvent.change(screen.getByLabelText('Color del cristal del encabezado'), {target:{value:'#123456'}});
  screen.getByRole('tab', {name:'Cristal', exact:true}).focus();
  await user.keyboard('{ArrowRight}');
  expect(screen.getByRole('tab', {name:'Bordes y luz'})).toHaveFocus();
  expect(screen.getByLabelText('Color del cristal del encabezado')).not.toBeVisible();
  await user.keyboard('{Home}');
  expect(screen.getByLabelText('Color del cristal del encabezado')).toHaveValue('#123456');
});

it('recupera la paleta de cristal en un paso sin modificar las medidas del usuario', async () => {
  const user=userEvent.setup();
  render(<Editor/>);
  await user.click(screen.getByRole('tab',{name:'Encabezado',exact:true}));
  fireEvent.change(screen.getByLabelText('Color del cristal del encabezado'),{target:{value:'#f8b4d9'}});
  await user.click(screen.getByRole('tab',{name:'Medidas',exact:true}));
  fireEvent.change(screen.getByLabelText('Altura mínima del encabezado (px)'),{target:{value:'164'}});
  await user.click(screen.getByRole('button',{name:'Aplicar paleta de cristal',exact:true}));
  expect(JSON.parse(screen.getByTestId('config').textContent)).toMatchObject({headerTint:'#fff6f0',headerBadgeColor:'#984d62',headerHeight:164,glassPaletteVersion:2});
  expect(screen.getByText('Paleta aplicada a la vista previa. Guarda los cambios para conservarla.')).toHaveAttribute('role','status');
});


it('usa Inicio por defecto y conserva la imagen propia al cambiar de origen del fondo', async () => {
  const user=userEvent.setup();
  render(<Editor/>);
  await user.click(screen.getByRole('tab',{name:'Fondo',exact:true}));
  expect(screen.getByLabelText('Origen del fondo')).toHaveValue('continuity');
  expect(screen.getByLabelText('Dirección de la imagen de fondo')).not.toBeVisible();
  await user.selectOptions(screen.getByLabelText('Origen del fondo'),'custom');
  fireEvent.change(screen.getByLabelText('Dirección de la imagen de fondo'),{target:{value:'/saved-background.webp'}});
  await user.selectOptions(screen.getByLabelText('Origen del fondo'),'continuity');
  expect(JSON.parse(screen.getByTestId('config').textContent)).toMatchObject({backgroundMode:'continuity',backgroundImage:'/saved-background.webp'});
  await user.selectOptions(screen.getByLabelText('Origen del fondo'),'custom');
  expect(screen.getByLabelText('Dirección de la imagen de fondo')).toHaveValue('/saved-background.webp');
});
