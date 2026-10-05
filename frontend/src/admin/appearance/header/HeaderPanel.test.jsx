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
    expect(within(preview).getByRole('navigation', { name: 'Vista previa del menú móvil' })).toHaveTextContent('Colección');
  });

  it('permite seleccionar Atelier y elegir el ícono de cualquier enlace en la vista previa', async () => {
    const user = userEvent.setup();
    render(<Editor />);
    await user.click(screen.getByRole('button', { name: /Menú móvil Panel/ }));
    await user.selectOptions(screen.getByRole('combobox', { name: 'Comportamiento del panel móvil' }), 'atelier-sheet');
    const preview = screen.getByText('Vista previa en vivo').closest('.appearance-header__preview');
    await user.click(within(preview).getByRole('button', { name: 'Móvil' }));
    await user.click(within(preview).getByRole('button', { name: 'Abrir menú de vista previa' }));
    expect(preview.querySelector('.atelier-menu')).toBeInTheDocument();
    expect(within(preview).getByRole('navigation', { name: 'Vista previa del menú móvil' })).toHaveTextContent('Inicio');
    await user.click(screen.getByRole('button', { name: /Enlaces Destinos/ }));
    await user.selectOptions(screen.getByRole('combobox', { name: 'Ícono móvil para Inicio' }), 'books');
    expect(preview.querySelector('[data-menu-icon="books"]')).toBeInTheDocument();
  });

  it('permite cargar una imagen propia para la tarjeta Atelier y verla antes de guardar', async () => {
    const user = userEvent.setup();
    const upload = vi.fn().mockResolvedValue('https://res.cloudinary.com/tienda/image/upload/v1/tarjeta.webp');
    render(<Editor upload={upload} />);
    await user.click(screen.getByRole('button', { name: /Menú móvil Panel/ }));
    const preview = screen.getByText('Vista previa en vivo').closest('.appearance-header__preview');
    await user.click(within(preview).getByRole('button', { name: 'Móvil' }));
    await user.click(within(preview).getByRole('button', { name: 'Abrir menú de vista previa' }));
    const feature = preview.querySelector('.atelier-menu__feature');
    expect(feature.style.backgroundImage).toBe('');
    await user.click(screen.getByRole('button', { name: /Tarjeta Destacado/ }));
    await user.upload(screen.getByLabelText('Seleccionar imagen para Imagen de tarjeta destacada del menú móvil'),
      new File(['imagen'], 'tarjeta.webp', { type: 'image/webp' }));
    expect(upload).toHaveBeenCalled();
    expect(feature.style.backgroundImage).toContain('/tarjeta.webp');
  });

  it('agrupa la edición por objeto y muestra solo los bordes que el diseño realmente usa', async () => {
    const user = userEvent.setup();
    render(<Editor />);
    await user.click(screen.getByRole('button', { name: /Menú móvil Panel/ }));
    expect(screen.getByRole('region', { name: 'Editar Panel' })).toBeInTheDocument();
    expect(screen.queryByText('Color del borde')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Abrir menú Botón hamburguesa/ }));
    await user.click(screen.getByRole('tab', { name: /Acabado/ }));
    expect(within(screen.getByRole('region', { name: 'Editar Abrir menú' })).getByText('Grosor del borde (px)')).toBeInTheDocument();
    expect(screen.queryByText('Tarjeta destacada')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Panel Forma y fondo/ }));
    await user.selectOptions(screen.getByRole('combobox', { name: 'Comportamiento del panel móvil' }), 'drawer-left');
    expect(screen.queryByRole('button', { name: /Tarjeta Destacado/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Redes y pie Parte inferior/ })).toBeInTheDocument();
    expect(screen.queryByText('Color del borde')).not.toBeInTheDocument();
    await user.clear(screen.getByRole('spinbutton', { name: /Grosor del borde \(px\)/ }));
    await user.type(screen.getByRole('spinbutton', { name: /Grosor del borde \(px\)/ }), '2');
    expect(screen.getByText('Color del borde')).toBeInTheDocument();
  });

  it('previsualiza por separado el botón para abrir y el icono para cerrar Atelier', async () => {
    const user = userEvent.setup();
    render(<Editor />);
    await user.click(screen.getByRole('button', { name: /Menú móvil Panel/ }));
    const preview = screen.getByText('Vista previa en vivo').closest('.appearance-header__preview');
    await user.click(within(preview).getByRole('button', { name: 'Móvil' }));
    await user.click(screen.getByRole('button', { name: /Abrir menú Botón hamburguesa/ }));
    await user.click(screen.getByRole('tab', { name: /Acabado/ }));
    await user.clear(screen.getByRole('spinbutton', { name: 'Tamaño del botón (px)' }));
    await user.type(screen.getByRole('spinbutton', { name: 'Tamaño del botón (px)' }), '52');
    expect(within(preview).getByRole('button', { name: 'Abrir menú de vista previa' })).toHaveStyle({ width: '52px' });
    await user.click(within(preview).getByRole('button', { name: 'Abrir menú de vista previa' }));
    await user.click(screen.getByRole('button', { name: /Cerrar menú Botón de cierre/ }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Color de la X: código de color' }), { target: { value: '#754153' } });
    expect(within(preview).getByRole('button', { name: 'Cerrar menú' })).toHaveStyle({ color: '#754153' });
  });

  it('aplica el modelo y la animación elegidos al mismo botón de la vista previa', async () => {
    const user = userEvent.setup();
    render(<Editor />);
    await user.click(screen.getByRole('button', { name: /Menú móvil Panel/ }));
    await user.click(screen.getByRole('button', { name: /Abrir menú Botón hamburguesa/ }));
    const region = screen.getByRole('region', { name: 'Editar Abrir menú' });
    const preview = screen.getByText('Vista previa en vivo').closest('.appearance-header__preview');
    await user.click(within(preview).getByRole('button', { name: 'Móvil' }));
    await user.click(within(region).getByRole('button', { name: /Constelación/ }));
    expect(within(region).getByRole('button', { name: /Constelación/ })).toHaveAttribute('aria-pressed', 'true');
    await user.click(within(region).getByRole('tab', { name: /Movimiento/ }));
    await user.click(within(region).getByRole('button', { name: /Metamorfosis/ }));
    expect(within(region).getByRole('button', { name: /Metamorfosis/ })).toHaveAttribute('aria-pressed', 'true');
    const demo = within(region).getByRole('button', { name: 'Probar apertura del símbolo' });
    expect(demo).toHaveAttribute('data-expanded', 'false');
    await user.click(demo);
    expect(within(region).getByRole('button', { name: 'Probar cierre del símbolo' })).toHaveAttribute('data-expanded', 'true');
    await user.click(within(region).getByRole('button', { name: 'Probar cierre del símbolo' }));
    expect(within(region).getByRole('button', { name: 'Probar apertura del símbolo' })).toHaveAttribute('data-expanded', 'false');
    const trigger = within(preview).getByRole('button', { name: 'Abrir menú de vista previa' });
    expect(trigger).toHaveAttribute('data-icon', 'dots');
    expect(trigger).toHaveAttribute('data-motion', 'morph');
    expect(trigger.querySelectorAll('.storefront-mobile-trigger__glyph i')).toHaveLength(6);
    await user.click(trigger);
    expect(within(preview).getByRole('button', { name: 'Cerrar menú de vista previa' })).toHaveAttribute('data-expanded', 'true');
  });

  it('permite dejar transparente el botón sin perder el icono en la vista previa', async () => {
    const user = userEvent.setup();
    render(<Editor />);
    await user.click(screen.getByRole('button', { name: /Menú móvil Panel/ }));
    await user.click(screen.getByRole('button', { name: /Abrir menú Botón hamburguesa/ }));
    await user.click(screen.getByRole('tab', { name: /Acabado/ }));
    fireEvent.change(screen.getByRole('slider', { name: 'Opacidad del fondo del botón' }), { target: { value: '0' } });
    const demo = screen.getByRole('button', { name: 'Probar apertura del símbolo' });
    expect(demo.style.backgroundColor).toContain('0%, transparent');
    expect(demo.querySelector('.storefront-mobile-trigger__glyph')).toBeInTheDocument();
  });

  it('conserva los colores propios al cambiar de modelo y aplica la paleta Atelier solo si se elige', async () => {
    const user = userEvent.setup();
    render(<Editor />);
    await user.click(screen.getByRole('button', { name: /Menú móvil Panel/ }));
    await user.click(screen.getByRole('button', { name: /Enlaces Texto y divisiones/ }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Texto principal: código de color' }), { target: { value: '#345678' } });
    await user.click(screen.getByRole('button', { name: /Panel Forma y fondo/ }));
    const layout = screen.getByRole('combobox', { name: 'Comportamiento del panel móvil' });
    await user.selectOptions(layout, 'drawer-left');
    await user.selectOptions(layout, 'atelier-sheet');
    await user.click(screen.getByRole('button', { name: /Enlaces Texto y divisiones/ }));
    expect(screen.getByRole('textbox', { name: 'Texto principal: código de color' })).toHaveValue('#345678');
    await user.click(screen.getByRole('button', { name: /Panel Forma y fondo/ }));
    await user.click(screen.getByRole('button', { name: /Aplicar paleta equilibrada de Atelier/ }));
    await user.click(screen.getByRole('button', { name: /Enlaces Texto y divisiones/ }));
    expect(screen.getByRole('textbox', { name: 'Texto principal: código de color' })).toHaveValue('#4e1e39');
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
    await user.click(screen.getByRole('button', { name: /Condensado/ }));
    expect(nav).toHaveStyle({ fontWeight: '600', letterSpacing: '0.08em', textTransform: 'uppercase' });
    expect(nav.parentElement).toHaveStyle({ fontFamily: '"Barlow Condensed", "Arial Narrow", sans-serif' });
    await user.type(screen.getByPlaceholderText('"Playfair Display", Georgia, serif'), 'Arial');
    expect(nav.parentElement).toHaveStyle({ fontFamily: 'Arial' });
    await user.click(screen.getByRole('button', { name: /Firma/ }));
    expect(nav.parentElement).toHaveStyle({ fontFamily: '"Dancing Script", cursive' });
    expect(nav).toHaveStyle({ fontStyle: 'normal', textTransform: 'none' });
    await user.click(screen.getByRole('button', { name: /Atelier/ }));
    expect(nav.parentElement).toHaveStyle({ fontFamily: '"IBM Plex Mono", ui-monospace, monospace' });
    expect(nav).toHaveStyle({ fontWeight: '500', letterSpacing: '-0.035em', textTransform: 'none' });
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
    options.forEach((option) => expect(option.querySelectorAll('.storefront-action-glyph')).toHaveLength(3));
    const gallery = within(screen.getByRole('group', { name: 'Modelo de íconos' }));
    await user.click(gallery.getByRole('button', { name: /Oro satinado/ }));
    const favorite = within(preview).getByRole('button', { name: 'Favoritos (vista previa)' }).querySelector('img');
    const search = within(preview).getByRole('button', { name: 'Buscar (vista previa)' }).querySelector('img');
    expect(search.getAttribute('src')).toContain('gold-search');
    expect(favorite).toHaveAttribute('data-icon-style', 'gold');
    expect(favorite.getAttribute('src')).toContain('gold-favorites');
    await user.click(gallery.getByRole('button', { name: /Esmalte vino/ }));
    const cart = within(preview).getByRole('button', { name: 'Carrito (vista previa)' }).querySelector('img');
    expect(cart).toHaveAttribute('data-icon-style', 'wine');
    expect(cart.getAttribute('src')).toContain('wine-cart');
    expect(search.getAttribute('src')).toContain('wine-search');
    await user.click(gallery.getByRole('button', { name: /Satén rosa/ }));
    expect(cart.getAttribute('src')).toContain('satin-cart');
    await user.click(gallery.getByRole('button', { name: /Porcelana rosa/ }));
    expect(cart.getAttribute('src')).toContain('porcelain-cart');
    expect(search.getAttribute('src')).toContain('porcelain-search');
    fireEvent.change(screen.getByRole('slider', { name: /Tamaño en la tienda/ }), { target: { value: '30' } });
    expect(preview.querySelector('.appearance-header__store-header').style.getPropertyValue('--storefront-action-size')).toBe('30px');
    await user.click(within(preview).getByRole('button', { name: 'Móvil' }));
    expect(within(preview).getByRole('button', { name: 'Carrito (vista previa)' }).querySelector('img')).toHaveAttribute('data-icon-style', 'porcelain');
    expect(within(preview).getByRole('button', { name: 'Buscar (vista previa)' }).querySelector('img')).toHaveAttribute('data-icon-style', 'porcelain');
  });

  it('carga cada icono por separado y lo conserva solo en el juego elegido', async () => {
    const user = userEvent.setup();
    const upload = vi.fn().mockResolvedValue('https://res.cloudinary.com/tienda/image/upload/v1/corazon.webp');
    render(<Editor upload={upload} />);
    await user.click(screen.getByRole('button', { name: /Estilo Fuente/ }));
    await user.click(screen.getByRole('button', { name: 'Íconos' }));
    const gallery = within(screen.getByRole('group', { name: 'Modelo de íconos' }));
    await user.click(gallery.getByRole('button', { name: /Satén rosa/ }));
    expect(screen.queryByLabelText('Seleccionar imagen para Icono de Cuenta')).not.toBeInTheDocument();
    await user.upload(screen.getByLabelText('Seleccionar imagen para Icono de Favoritos'), new File(['icono'], 'corazon.webp', { type: 'image/webp' }));
    expect(upload).toHaveBeenCalled();
    const preview = screen.getByText('Vista previa en vivo').closest('.appearance-header__preview');
    expect(within(preview).queryByRole('button', { name: 'Administración (vista previa)' })).not.toBeInTheDocument();
    expect(within(preview).getByRole('button', { name: 'Favoritos (vista previa)' }).querySelector('img'))
      .toHaveAttribute('src', 'https://res.cloudinary.com/tienda/image/upload/v1/corazon.webp');
    expect(within(preview).getByRole('button', { name: 'Carrito (vista previa)' }).querySelector('img').getAttribute('src')).toContain('satin-cart');
    await user.click(gallery.getByRole('button', { name: /Esmalte vino/ }));
    expect(within(preview).getByRole('button', { name: 'Favoritos (vista previa)' }).querySelector('img').getAttribute('src')).toContain('wine-favorites');
    await user.click(gallery.getByRole('button', { name: /Satén rosa/ }));
    expect(within(preview).getByRole('button', { name: 'Favoritos (vista previa)' }).querySelector('img'))
      .toHaveAttribute('src', 'https://res.cloudinary.com/tienda/image/upload/v1/corazon.webp');
    await user.click(screen.getByRole('button', { name: /Quitar/ }));
    expect(within(preview).getByRole('button', { name: 'Favoritos (vista previa)' }).querySelector('img').getAttribute('src')).toContain('satin-favorites');
  });
});
