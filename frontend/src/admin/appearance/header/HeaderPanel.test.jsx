import React, { useState } from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
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
    expect(within(preview).getByAltText('Logo Rosa Boutique')).toHaveAttribute('src', '/claro.png');
    await user.click(screen.getByRole('button', { name: /Fondo/ }));
    await user.clear(screen.getByPlaceholderText('#FFFFFF'));
    await user.type(screen.getByPlaceholderText('#FFFFFF'), '#ffffff');
    expect(within(preview).getByAltText('Logo Rosa Boutique')).toHaveAttribute('src', '/oscuro.png');
    await user.click(screen.getByRole('button', { name: 'Logo' }));
    await user.click(screen.getByRole('button', { name: /Logo claro Siempre priorizar claro/ }));
    expect(within(preview).getByAltText('Logo Rosa Boutique')).toHaveAttribute('src', '/claro.png');
    expect(screen.getByRole('button', { name: /Logo claro Siempre priorizar claro/ })).toHaveAttribute('aria-pressed', 'true');
    await user.click(screen.getByRole('button', { name: /Logo oscuro Siempre priorizar oscuro/ }));
    expect(within(preview).getByAltText('Logo Rosa Boutique')).toHaveAttribute('src', '/oscuro.png');
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
    expect(within(screen.getByText('Vista previa en vivo').closest('.appearance-header__preview')).getByAltText('Logo Rosa Boutique')).toHaveAttribute('src', 'https://res.cloudinary.com/tienda/logo.png');
    expect(screen.getByText(/Pulsa “Guardar cambios”/)).toBeInTheDocument();
  });

  it('aplica cada modelo de letra a la vista previa y limpia la fuente personalizada al elegir otro', async () => {
    const user = userEvent.setup();
    render(<Editor />);
    const preview = screen.getByText('Vista previa en vivo').closest('.appearance-header__preview');
    const nav = within(preview).getByRole('navigation', { name: 'Vista previa del menú' });
    await user.click(screen.getByRole('button', { name: /Estilo Fuente/ }));
    await user.click(screen.getByRole('button', { name: /Contemporáneo/ }));
    expect(nav).toHaveStyle({ fontWeight: '800', letterSpacing: '0.14em', textTransform: 'uppercase' });
    expect(nav.parentElement).toHaveStyle({ fontFamily: 'Manrope, system-ui, sans-serif' });
    await user.type(screen.getByPlaceholderText('"Playfair Display", Georgia, serif'), 'Arial');
    expect(nav.parentElement).toHaveStyle({ fontFamily: 'Arial' });
    await user.click(screen.getByRole('button', { name: /Alta costura/ }));
    expect(nav.parentElement).toHaveStyle({ fontFamily: '"Cormorant Garamond", Georgia, serif' });
    expect(nav).toHaveStyle({ fontStyle: 'italic', letterSpacing: '0.04em', textTransform: 'none' });
  });

  it('cambia forma, redondeo y vidrio de la vista previa antes de guardar', async () => {
    const user = userEvent.setup();
    render(<Editor />);
    const preview = screen.getByText('Vista previa en vivo').closest('.appearance-header__preview');
    const header = preview.querySelector('.appearance-header__store-header');
    await user.click(screen.getByRole('button', { name: 'Forma y vidrio' }));
    await user.click(screen.getByRole('button', { name: /Flotante Separado/ }));
    expect(header).toHaveAttribute('data-shape', 'floating');
    fireEvent.change(screen.getByRole('slider', { name: /Redondeo de bordes/ }), { target: { value: '38' } });
    expect(header.style.getPropertyValue('--header-surface-radius')).toBe('38px');
    await user.click(screen.getByRole('checkbox', { name: /Vidrio líquido con relieve 3D/ }));
    expect(header).toHaveAttribute('data-glass', 'true');
    expect(header).toHaveStyle({ backgroundColor: '#18181b9e' });
    await user.click(within(preview).getByRole('button', { name: 'Móvil' }));
    expect(header).toHaveAttribute('data-shape', 'floating');
    await user.click(screen.getByRole('checkbox', { name: /Vidrio líquido con relieve 3D/ }));
    expect(header).toHaveAttribute('data-glass', 'false');
  });

  it('muestra familias visualmente diferentes en escritorio y móvil', async () => {
    const user = userEvent.setup();
    render(<Editor />);
    const preview = screen.getByText('Vista previa en vivo').closest('.appearance-header__preview');
    await user.click(screen.getByRole('button', { name: /Estilo Fuente/ }));
    await user.click(screen.getByRole('button', { name: 'Íconos' }));
    const options = within(screen.getByRole('group', { name: 'Modelo de íconos' })).getAllByRole('button');
    expect(options).toHaveLength(6);
    const gallery = within(screen.getByRole('group', { name: 'Modelo de íconos' }));
    await user.click(gallery.getByRole('button', { name: /Silueta/ }));
    expect(within(preview).getByRole('button', { name: 'Favoritos (vista previa)' }).querySelector('svg')).toHaveAttribute('fill', 'currentColor');
    await user.click(gallery.getByRole('button', { name: /Geométrico/ }));
    expect(within(preview).getByRole('button', { name: 'Carrito (vista previa)' }).querySelector('svg')).toHaveAttribute('data-icon-style', 'editorial');
    await user.click(gallery.getByRole('button', { name: /Destello/ }));
    expect(within(preview).getByRole('button', { name: 'Administración (vista previa)' }).querySelector('svg')).toHaveAttribute('data-icon-style', 'silk');
    expect(within(preview).getByRole('button', { name: 'Favoritos (vista previa)' })).not.toHaveAttribute('data-finish');
    await user.click(within(preview).getByRole('button', { name: 'Móvil' }));
    expect(within(preview).getByRole('button', { name: 'Carrito (vista previa)' }).querySelector('svg')).toHaveAttribute('data-icon-style', 'silk');
  });
});
