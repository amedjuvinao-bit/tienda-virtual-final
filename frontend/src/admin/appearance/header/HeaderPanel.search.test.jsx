import React, { useState } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it } from 'vitest';
import HeaderPanel from './HeaderPanel';

afterEach(cleanup);

function PanelHarness() {
  const [theme, setTheme] = useState({ header: { bgColor: '#141414' }, colors: { primary: '#111827' }, logo: {} });
  const setPath = (path, value) => {
    const [, key] = path.split('.');
    setTheme((previous) => ({ ...previous, header: { ...previous.header, [key]: value } }));
  };
  return <HeaderPanel theme={theme} setPath={setPath} menus={{ header: [] }} routeOptions={{ public: [], dynamic: [] }} />;
}

it('personaliza los colores del buscador, los previsualiza y recupera el tema', async () => {
  const user = userEvent.setup();
  render(<PanelHarness />);
  await user.click(screen.getByRole('button', { name: /Estilo Fuente, colores y movimiento/ }));
  await user.click(screen.getByRole('button', { name: 'Buscador' }));
  const preview = screen.getByLabelText('Vista previa de colores del buscador');
  expect(preview.parentElement.style.getPropertyValue('--header-search-bg')).toBe('#141414');
  const backgroundInput = screen.getByText('Fondo', { exact: true }).closest('label').querySelector('input:not([type])');
  fireEvent.change(backgroundInput, { target: { value: '#254254' } });
  expect(backgroundInput).toHaveValue('#254254');
  expect(preview.parentElement.style.getPropertyValue('--header-search-bg')).toBe('#254254');
  await user.click(screen.getByRole('button', { name: 'Usar colores del tema' }));
  expect(backgroundInput).toHaveValue('#141414');
  expect(preview.parentElement.style.getPropertyValue('--header-search-bg')).toBe('#141414');
});
