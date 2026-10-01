import React, { useState } from 'react';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import HeaderPanel from './HeaderPanel';

afterEach(cleanup);

function Editor({ upload = vi.fn() }) {
  const [theme, setTheme] = useState({ header: { bgColor: '#18181b', logoLight: '/claro.png', logoDark: '/oscuro.png', logoHeightPx: 80 } });
  const [menus, setMenus] = useState({ header: [{ title: 'Inicio', ref: '/' }] });
  const setPath = (path, value) => setTheme((previous) => ({ ...previous, header: { ...previous.header, [path.split('.')[1]]: value } }));
  return <HeaderPanel theme={theme} setPath={setPath} menus={menus}
    routeOptions={{ public: [{ label: 'Inicio', value: '/' }, { label: 'Lo Nuevo', value: '/lo-nuevo' }] }}
    uploading={false} setUploading={() => {}} savedRevision={1} uploadToCloudinaryViaBackend={upload}
    addHeaderMenuItem={() => setMenus((previous) => ({ header: [...previous.header, { title: 'Nuevo', ref: '/lo-nuevo' }] }))}
    removeHeaderMenuItem={() => {}} moveHeaderMenuItem={() => {}}
    setHeaderMenuItem={(index, patch) => setMenus((previous) => ({ header: previous.header.map((item, i) => i === index ? { ...item, ...patch } : item) }))} />;
}

describe('edición del encabezado', () => {
  it('muestra el logo correcto, la navegación editada y el menú móvil antes de guardar', async () => {
    const user = userEvent.setup();
    render(<Editor />);
    const preview = screen.getByText('Vista previa en vivo').closest('.appearance-header__preview');
    expect(within(preview).getByAltText('Logo del encabezado')).toHaveAttribute('src', '/claro.png');
    await user.click(screen.getByRole('button', { name: /Fondo/ }));
    await user.clear(screen.getByPlaceholderText('#FFFFFF'));
    await user.type(screen.getByPlaceholderText('#FFFFFF'), '#ffffff');
    expect(within(preview).getByAltText('Logo del encabezado')).toHaveAttribute('src', '/oscuro.png');
    await user.click(screen.getByRole('button', { name: /Enlaces Destinos/ }));
    await user.clear(screen.getByPlaceholderText('Ej: Lo Nuevo'));
    await user.type(screen.getByPlaceholderText('Ej: Lo Nuevo'), 'Colección');
    expect(within(preview).getByText('Colección')).toBeInTheDocument();
    await user.click(within(preview).getByRole('button', { name: 'Móvil' }));
    await user.click(within(preview).getByRole('button', { name: 'Abrir menú de vista previa' }));
    expect(within(preview).getByText('Colección')).toBeInTheDocument();
  });

  it('sube un archivo de logo en un solo paso y lo muestra en la vista previa', async () => {
    const user = userEvent.setup();
    const upload = vi.fn().mockResolvedValue('https://res.cloudinary.com/tienda/logo.png');
    render(<Editor upload={upload} />);
    const input = screen.getByLabelText('Seleccionar imagen para Logo claro');
    const file = new File(['imagen'], 'logo.png', { type: 'image/png' });
    await user.upload(input, file);
    expect(upload).toHaveBeenCalledWith(file, 'image');
    expect(screen.getByAltText('Logo del encabezado')).toHaveAttribute('src', 'https://res.cloudinary.com/tienda/logo.png');
    expect(screen.getByText(/Pulsa “Guardar cambios”/)).toBeInTheDocument();
  });
});
