import React, { useState } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import BannerTemplatePanel from './BannerTemplatePanel';
import { getBannerTemplate } from '../../../lib/bannerTemplates';

beforeEach(() => vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ categories: [
  { id: '68a4a78a59706e44cade0316', name: 'Vestidos', path: 'Ropa / Vestidos', image: '/vestidos.png' },
  { id: 'legacy:Zapatos', name: 'Zapatos', path: 'Zapatos', image: '' },
] }) })));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

function Editor({ uploadImage = vi.fn() }) {
  const [theme, setTheme] = useState({ banner: { templateId: 'discovery' }, sections: [{ id: 'categorias', config: { slides: [
    { id: 'hogar', title: 'Hogar', href: '/categoria/hogar', enabled: true },
    { id: 'regalos', title: 'Regalos', href: '/categoria/regalos', enabled: true },
  ] } }] });
  const setPath = (path, value) => setTheme((previous) => {
    const draft = structuredClone(previous);
    const keys = path.split('.');
    let cursor = draft;
    for (const key of keys.slice(0, -1)) cursor = cursor[key] ||= {};
    cursor[keys.at(-1)] = typeof value === 'function' ? value(cursor[keys.at(-1)], previous) : value;
    return draft;
  });
  const [placingCard, setPlacingCard] = useState(null);
  return <><output data-testid="state">{JSON.stringify(theme.banner)}</output><button onClick={() => setPath('banner.templateId', 'editorial')}>Editorial</button><button onClick={() => setPath('banner.templateId', 'discovery')}>Descubrimiento</button><button onClick={() => setPath('banner.templateId', 'atelier')}>Vitrina</button><BannerTemplatePanel theme={theme} setPath={setPath} uploading={false} setUploading={() => {}} uploadToCloudinaryViaBackend={uploadImage} placingCard={placingCard} onStartPlacing={setPlacingCard} /></>;
}

describe('editor de plantillas', () => {
  it('abre el editor y permite cambiar a categorías sin error de inicialización', () => {
    render(<Editor />);
    fireEvent.click(screen.getByRole('button', { name: '③ Categorías' }));
    expect(screen.getByLabelText('Acceso anterior')).toBeInTheDocument();
  });

  it('conserva el texto de cada diseño al cambiar y solo ofrece categorías existentes', () => {
    render(<Editor />);
    fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'Mi portada' } });
    fireEvent.click(screen.getByRole('button', { name: /Editorial/ }));
    fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'Mi editorial' } });
    fireEvent.click(screen.getByRole('button', { name: /Descubrimiento/ }));
    expect(screen.getByLabelText('Título').value).toBe('Mi portada');
    fireEvent.click(screen.getByRole('button', { name: '③ Categorías' }));
    const select = screen.getByLabelText('Acceso anterior');
    expect(Array.from(select.options).map((option) => option.textContent)).toEqual(['Hogar', 'Regalos']);
    expect(screen.getAllByLabelText('Acceso anterior')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: /02.*Regalos/ }));
    fireEvent.click(screen.getByText(/Texto e imágenes/));
    fireEvent.change(screen.getByLabelText('Texto visible (opcional)'), { target: { value: 'Un regalo' } });
    fireEvent.click(screen.getByRole('button', { name: '② Botones' }));
    fireEvent.change(screen.getByLabelText('Texto del botón'), { target: { value: 'Comprar' } });
    const saved = JSON.parse(screen.getByTestId('state').textContent);
    expect(saved.templateConfigs.editorial.title).toBe('Mi editorial');
    expect(saved.templateConfigs.discovery.cards[1].text).toBe('Un regalo');
    expect(saved.templateConfigs.discovery.primary.text).toBe('Comprar');
  });

  it('guarda la posición y el color de cada punto de la vitrina', () => {
    render(<Editor />);
    fireEvent.click(screen.getByRole('button', { name: 'Vitrina' }));
    fireEvent.click(screen.getByRole('button', { name: '③ Categorías' }));
    fireEvent.click(screen.getByText('Ubicación y señalador'));
    fireEvent.click(screen.getByRole('button', { name: 'Señalar lugar en la imagen' }));
    expect(screen.getByText(/Ahora haz clic en el objeto/)).toHaveTextContent('vista previa');
    fireEvent.change(screen.getByLabelText('Punto horizontal %'), { target: { value: '31' } });
    fireEvent.change(screen.getByLabelText('Punto vertical %'), { target: { value: '62' } });
    fireEvent.change(screen.getByLabelText('Color de línea y punto'), { target: { value: '#de468a' } });
    const saved = JSON.parse(screen.getByTestId('state').textContent);
    expect(saved.templateConfigs.atelier.cards[0]).toEqual(expect.objectContaining({ x: 31, y: 62, lineColor: '#de468a' }));
    expect(saved.templateConfigs.atelier.cards[1]).toEqual(expect.objectContaining({ x: 74, y: 52 }));
  });

  it('explica por qué un botón visible no abre nada hasta configurar su enlace', () => {
    render(<Editor />);
    fireEvent.click(screen.getByRole('button', { name: '② Botones' }));
    expect(screen.getByText(/Este botón aún no abre ninguna página/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Al hacer clic, ir a'), { target: { value: '/categoria/hogar' } });
    expect(screen.queryByText(/Este botón aún no abre ninguna página/)).toBeNull();
  });

  it('ofrece cuatro animaciones y conserva la elección de cada plantilla', () => {
    render(<Editor />);
    fireEvent.click(screen.getByRole('button', { name: '② Botones' }));
    const choices = screen.getByRole('group', { name: 'Animación de los botones' });
    expect(choices.querySelectorAll('.banner-template-motion-choice')).toHaveLength(4);
    fireEvent.click(screen.getByRole('button', { name: /Aurora/ }));
    expect(screen.getByRole('button', { name: /Aurora/ })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: /Editorial/ }));
    expect(screen.getByRole('button', { name: /Prisma/ })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: /Perla/ }));
    fireEvent.click(screen.getByRole('button', { name: /Descubrimiento/ }));
    expect(screen.getByRole('button', { name: /Aurora/ })).toHaveAttribute('aria-pressed', 'true');
    const saved = JSON.parse(screen.getByTestId('state').textContent);
    expect(saved.templateConfigs.discovery.buttonAnimation).toBe('aurora');
    expect(saved.templateConfigs.editorial.buttonAnimation).toBe('pearl');
  });
  it('enlaza un producto del catálogo y conserva su imagen al guardar', async () => {
    const productId = '68a4a78a59706e44cade0316';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ products: [{ _id: productId, title: 'Vestido floral', image: '/vestido.png' }] }),
    }));
    render(<Editor />);
    fireEvent.click(screen.getByRole('button', { name: /Editorial/ }));
    fireEvent.click(screen.getByRole('button', { name: '③ Categorías' }));
    fireEvent.change(screen.getByLabelText('Al hacer clic, abrir'), { target: { value: 'product' } });
    fireEvent.change(screen.getByLabelText('Buscar producto'), { target: { value: 'Vestido' } });
    fireEvent.click(await screen.findByRole('button', { name: /Vestido floral Elegir/ }));
    const saved = JSON.parse(screen.getByTestId('state').textContent);
    const sections = [{ id: 'categorias', config: { slides: [{ id: 'hogar', title: 'Hogar', href: '/categoria/hogar', enabled: true }] } }];
    let card = getBannerTemplate({ templateId: 'editorial', templateConfigs: saved.templateConfigs }, sections).config.cards[0];
    expect(card.link).toBe(`/producto/${productId}`);
    expect(card.image).toBe('/vestido.png');
    fireEvent.change(screen.getByLabelText('Al hacer clic, abrir'), { target: { value: 'category' } });
    const updated = JSON.parse(screen.getByTestId('state').textContent);
    card = getBannerTemplate({ templateId: 'editorial', templateConfigs: updated.templateConfigs }, sections).config.cards[0];
    expect(card.link).toBe('/categoria/hogar');
  });

  it('elige una categoría real del catálogo y genera el enlace filtrado con su imagen', async () => {
    render(<Editor />);
    fireEvent.click(screen.getByRole('button', { name: /Editorial/ }));
    fireEvent.click(screen.getByRole('button', { name: '③ Categorías' }));
    fireEvent.change(screen.getByLabelText('Al hacer clic, abrir'), { target: { value: 'catalogCategory' } });
    await screen.findByRole('option', { name: 'Ropa / Vestidos' });
    const select = screen.getByLabelText('Categoría del catálogo');
    expect(Array.from(select.options).map((option) => option.textContent)).toContain('Ropa / Vestidos');
    fireEvent.change(select, { target: { value: '68a4a78a59706e44cade0316' } });
    const saved = JSON.parse(screen.getByTestId('state').textContent);
    const card = getBannerTemplate({ templateId: 'editorial', templateConfigs: saved.templateConfigs }, []).config.cards[0];
    expect(card.text).toBe('Vestidos');
    expect(card.image).toBe('/vestidos.png');
    expect(card.link).toBe('/buscar?category=68a4a78a59706e44cade0316&categoryName=Vestidos');
  });

  it('muestra tarjetas compactas y deja los ajustes de imagen plegados', () => {
    render(<Editor />);
    fireEvent.click(screen.getByRole('button', { name: '③ Categorías' }));
    const grid = screen.getByRole('group', { name: 'Acceso de categoría para editar' });
    expect(grid).toHaveClass('banner-template-parts');
    expect(screen.getByText('Texto e imágenes', { exact: false }).closest('details')).not.toHaveAttribute('open');
    expect(screen.getByLabelText('Al hacer clic, abrir')).toBeInTheDocument();
  });

  it('conserva una miniatura subida mientras se edita texto durante la carga', async () => {
    let finishUpload;
    const uploadImage = vi.fn(() => new Promise((resolve) => { finishUpload = resolve; }));
    render(<Editor uploadImage={uploadImage} />);
    fireEvent.click(screen.getByRole('button', { name: '③ Categorías' }));
    fireEvent.click(screen.getByText(/Texto e imágenes/));
    fireEvent.change(screen.getByLabelText('Imagen propia'), {
      target: { files: [new File(['foto'], 'miniatura.png', { type: 'image/png' })] },
    });
    expect(uploadImage).toHaveBeenCalledTimes(1);
    fireEvent.change(screen.getByLabelText('Texto visible (opcional)'), { target: { value: 'Colección nueva' } });
    finishUpload('https://example.test/miniatura.png');
    await waitFor(() => expect(JSON.parse(screen.getByTestId('state').textContent).templateConfigs.discovery.cards[0]).toEqual(
      expect.objectContaining({ text: 'Colección nueva', image: 'https://example.test/miniatura.png' })
    ));
    fireEvent.change(screen.getByLabelText('Etiqueta pequeña'), { target: { value: 'Destacado' } });
    expect(JSON.parse(screen.getByTestId('state').textContent).templateConfigs.discovery.cards[0]).toEqual(
      expect.objectContaining({ text: 'Colección nueva', label: 'Destacado', image: 'https://example.test/miniatura.png' })
    );
  });

  it('cambia a la imagen del catálogo sin borrar la miniatura propia', async () => {
    const uploadImage = vi.fn().mockResolvedValue('https://example.test/propia.png');
    render(<Editor uploadImage={uploadImage} />);
    fireEvent.click(screen.getByRole('button', { name: /Editorial/ }));
    fireEvent.click(screen.getByRole('button', { name: '③ Categorías' }));
    fireEvent.change(screen.getByLabelText('Al hacer clic, abrir'), { target: { value: 'catalogCategory' } });
    await screen.findByRole('option', { name: 'Ropa / Vestidos' });
    fireEvent.change(screen.getByLabelText('Categoría del catálogo'), { target: { value: '68a4a78a59706e44cade0316' } });
    fireEvent.click(screen.getByText(/Texto e imágenes/));
    fireEvent.change(screen.getByLabelText('Imagen propia'), {
      target: { files: [new File(['foto'], 'propia.png', { type: 'image/png' })] },
    });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Imagen que subí' })).toHaveAttribute('aria-pressed', 'true'));
    fireEvent.click(screen.getByRole('button', { name: 'Imagen de la categoría' }));
    let saved = JSON.parse(screen.getByTestId('state').textContent);
    expect(saved.templateConfigs.editorial.cards[0]).toEqual(expect.objectContaining({
      image: 'https://example.test/propia.png', imageSource: 'catalog',
    }));
    expect(getBannerTemplate({ templateId: 'editorial', templateConfigs: saved.templateConfigs }, []).config.cards[0].image).toBe('/vestidos.png');
    fireEvent.click(screen.getByRole('button', { name: 'Imagen que subí' }));
    saved = JSON.parse(screen.getByTestId('state').textContent);
    expect(getBannerTemplate({ templateId: 'editorial', templateConfigs: saved.templateConfigs }, []).config.cards[0].image).toBe('https://example.test/propia.png');
  });

  it('guarda la imagen decorativa propia, su ubicación y permite ocultarla', async () => {
    const uploadImage = vi.fn().mockResolvedValue('https://example.test/flor-propia.webp');
    render(<Editor uploadImage={uploadImage} />);
    fireEvent.click(screen.getByRole('button', { name: /Editorial/ }));
    fireEvent.click(screen.getByRole('button', { name: '③ Categorías' }));
    fireEvent.click(screen.getByText(/Texto e imágenes/));
    expect(screen.queryByRole('button', { name: 'Flor 2' })).toBeNull();
    fireEvent.change(screen.getByLabelText('Cargar o cambiar imagen decorativa'), {
      target: { files: [new File(['flor'], 'flor.webp', { type: 'image/webp' })] },
    });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Mostrar imagen' })).toHaveAttribute('aria-pressed', 'true'));
    const stage = screen.getByRole('img', { name: 'Encuadre del fondo de la tarjeta' });
    stage.getBoundingClientRect = () => ({ left: 0, top: 0, width: 200, height: 100 });
    fireEvent.pointerDown(stage, { pointerId: 1, clientX: 150, clientY: 40 });
    fireEvent.change(screen.getByLabelText(/Acercamiento/), { target: { value: '125' } });
    let saved = JSON.parse(screen.getByTestId('state').textContent);
    expect(saved.templateConfigs.editorial.cards[0]).toEqual(expect.objectContaining({
      decorationMode: 'custom', decorationImage: 'https://example.test/flor-propia.webp',
      decorationX: 75, decorationY: 40, decorationSize: 125,
    }));
    fireEvent.click(screen.getByRole('button', { name: 'Ocultar imagen' }));
    saved = JSON.parse(screen.getByTestId('state').textContent);
    expect(saved.templateConfigs.editorial.cards[0]).toEqual(expect.objectContaining({
      decorationMode: 'none', decorationImage: 'https://example.test/flor-propia.webp',
    }));
    fireEvent.click(screen.getByRole('button', { name: 'Mostrar imagen' }));
    expect(JSON.parse(screen.getByTestId('state').textContent).templateConfigs.editorial.cards[0].decorationMode).toBe('custom');
  });

  it('acepta una imagen decorativa JPG sin exigir que sea floral', async () => {
    const uploadImage = vi.fn().mockResolvedValue('https://example.test/ambiente.jpg');
    render(<Editor uploadImage={uploadImage} />);
    fireEvent.click(screen.getByRole('button', { name: /Editorial/ }));
    fireEvent.click(screen.getByRole('button', { name: '③ Categorías' }));
    fireEvent.click(screen.getByText(/Texto e imágenes/));
    fireEvent.change(screen.getByLabelText('Cargar o cambiar imagen decorativa'), {
      target: { files: [new File(['foto'], 'ambiente.jpg', { type: 'image/jpeg' })] },
    });
    await waitFor(() => expect(JSON.parse(screen.getByTestId('state').textContent).templateConfigs.editorial.cards[0]).toEqual(
      expect.objectContaining({ decorationMode: 'custom', decorationImage: 'https://example.test/ambiente.jpg' })
    ));
  });

  it('aplica colores, tamaños y metalizado a todas las tarjetas de un diseño', () => {
    render(<Editor />);
    fireEvent.click(screen.getByRole('button', { name: '③ Categorías' }));
    fireEvent.click(screen.getByText('Texto de todas las tarjetas'));
    fireEvent.change(screen.getByLabelText('Color de los títulos'), { target: { value: '#332211' } });
    fireEvent.change(screen.getByLabelText('Color de las etiquetas'), { target: { value: '#ddaa88' } });
    fireEvent.change(screen.getByLabelText(/Tamaño de los títulos/), { target: { value: '22' } });
    fireEvent.change(screen.getByLabelText(/Tamaño de las etiquetas/), { target: { value: '16' } });
    fireEvent.click(screen.getByLabelText('Acabado metalizado en los títulos'));
    let saved = JSON.parse(screen.getByTestId('state').textContent);
    expect(saved.templateConfigs.discovery.cardTextStyle).toEqual({ titleColor: '#332211', labelColor: '#ddaa88', titleSizePx: 22, labelSizePx: 16, metallicTitle: true });
    fireEvent.click(screen.getByRole('button', { name: /Editorial/ }));
    fireEvent.click(screen.getByRole('button', { name: '③ Categorías' }));
    fireEvent.click(screen.getByText('Texto de todas las tarjetas'));
    expect(screen.getByLabelText('Acabado metalizado en los títulos')).not.toBeChecked();
    fireEvent.click(screen.getByRole('button', { name: /Descubrimiento/ }));
    saved = JSON.parse(screen.getByTestId('state').textContent);
    expect(saved.templateConfigs.discovery.cardTextStyle.metallicTitle).toBe(true);
  });

});
