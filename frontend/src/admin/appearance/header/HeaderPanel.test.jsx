import React, { useState } from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import HeaderPanel from './HeaderPanel';

afterEach(cleanup);

function Editor({ upload = vi.fn() }) {
  const [theme, setTheme] = useState({ header: { bgColor: '#18181b', logoLight: '/claro.png', logoDark: '/oscuro.png', logoHeightPx: 80 } });
  const [menus, setMenus] = useState({ header: [{ title: 'Inicio', ref: '/' }] });
  const setPath = (path, value) => setTheme((previous) => {
    const next = structuredClone(previous);
    const parts = path.split('.');
    let target = next;
    for (const part of parts.slice(0, -1)) target = target[part] ||= {};
    target[parts.at(-1)] = value;
    return next;
  });
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

  it('muestra cuatro juegos distintos en escritorio y móvil con tamaño fiel', async () => {
    const user = userEvent.setup();
    render(<Editor />);
    const preview = screen.getByText('Vista previa en vivo').closest('.appearance-header__preview');
    await user.click(screen.getByRole('button', { name: /Estilo Fuente/ }));
    await user.click(screen.getByRole('button', { name: 'Íconos' }));
    const options = within(screen.getByRole('group', { name: 'Modelo de íconos' })).getAllByRole('button');
    expect(options).toHaveLength(4);
    const gallery = within(screen.getByRole('group', { name: 'Modelo de íconos' }));
    await user.click(gallery.getByRole('button', { name: /Oro satinado/ }));
    const favorite = within(preview).getByRole('button', { name: 'Favoritos (vista previa)' }).querySelector('img');
    expect(favorite).toHaveAttribute('data-icon-style', 'gold');
    expect(favorite.getAttribute('src')).toContain('gold-favorites');
    await user.click(gallery.getByRole('button', { name: /Esmalte vino/ }));
    const cart = within(preview).getByRole('button', { name: 'Carrito (vista previa)' }).querySelector('img');
    expect(cart).toHaveAttribute('data-icon-style', 'wine');
    expect(cart.getAttribute('src')).toContain('wine-cart');
    await user.click(gallery.getByRole('button', { name: /Satén rosa/ }));
    expect(cart.getAttribute('src')).toContain('satin-cart');
    await user.click(gallery.getByRole('button', { name: /Porcelana rosa/ }));
    expect(cart.getAttribute('src')).toContain('porcelain-cart');
    fireEvent.change(screen.getByRole('slider', { name: /Tamaño en la tienda/ }), { target: { value: '30' } });
    expect(preview.querySelector('.appearance-header__store-header').style.getPropertyValue('--storefront-action-size')).toBe('30px');
    await user.click(within(preview).getByRole('button', { name: 'Móvil' }));
    expect(within(preview).getByRole('button', { name: 'Carrito (vista previa)' }).querySelector('img')).toHaveAttribute('data-icon-style', 'porcelain');
  });

  it('carga cada icono por separado y lo conserva solo en el juego elegido', async () => {
    const user = userEvent.setup();
    const upload = vi.fn().mockResolvedValue('https://res.cloudinary.com/tienda/image/upload/v1/cuenta.webp');
    render(<Editor upload={upload} />);
    await user.click(screen.getByRole('button', { name: /Estilo Fuente/ }));
    await user.click(screen.getByRole('button', { name: 'Íconos' }));
    const gallery = within(screen.getByRole('group', { name: 'Modelo de íconos' }));
    await user.click(gallery.getByRole('button', { name: /Satén rosa/ }));
    await user.upload(screen.getByLabelText('Seleccionar imagen para Icono de Cuenta'), new File(['icono'], 'cuenta.webp', { type: 'image/webp' }));
    expect(upload).toHaveBeenCalled();
    const preview = screen.getByText('Vista previa en vivo').closest('.appearance-header__preview');
    expect(within(preview).getByRole('button', { name: 'Administración (vista previa)' }).querySelector('img'))
      .toHaveAttribute('src', 'https://res.cloudinary.com/tienda/image/upload/v1/cuenta.webp');
    expect(within(preview).getByRole('button', { name: 'Favoritos (vista previa)' }).querySelector('img').getAttribute('src')).toContain('satin-favorites');
    await user.click(gallery.getByRole('button', { name: /Esmalte vino/ }));
    expect(within(preview).getByRole('button', { name: 'Administración (vista previa)' }).querySelector('img').getAttribute('src')).toContain('wine-account');
    await user.click(gallery.getByRole('button', { name: /Satén rosa/ }));
    expect(within(preview).getByRole('button', { name: 'Administración (vista previa)' }).querySelector('img'))
      .toHaveAttribute('src', 'https://res.cloudinary.com/tienda/image/upload/v1/cuenta.webp');
    await user.click(screen.getByRole('button', { name: /Quitar/ }));
    expect(within(preview).getByRole('button', { name: 'Administración (vista previa)' }).querySelector('img').getAttribute('src')).toContain('satin-account');
  });
});
