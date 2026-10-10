import React, { useState } from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import BannerPanel from './BannerPanel';
import { getBannerPreviewModel } from './BannerDevicePreview';
import { getBannerHeightStyle } from '../../../lib/bannerHeight';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

const slides = [
  { image: '/first.jpg', fit: 'cover', posX: 0, posY: 35, button: { enabled: true, kind: 'text', text: 'Ver colección', posX: 50, posY: 85 } },
  { image: '/second.jpg', fit: 'contain', posX: 70, posY: 50, button: { enabled: false } },
];

function Editor({ initial = { type: 'slider', heightMode: 'auto', heightPx: 520, sliderIntervalMs: 4500, sliderShowProgress: true, slides }, upload = vi.fn(), sections = [] }) {
  const [theme, setTheme] = useState({ banner: initial, sections });
  const setPath = (path, value) => setTheme((previous) => {
    const next = structuredClone(previous);
    const keys = path.split('.');
    let cursor = next;
    for (const key of keys.slice(0, -1)) cursor = cursor[key] ||= {};
    cursor[keys.at(-1)] = value;
    return next;
  });
  return <><output data-testid="banner-values">{JSON.stringify(theme.banner)}</output><BannerPanel theme={theme} setPath={setPath} uploading={false} setUploading={() => {}} uploadToCloudinaryViaBackend={upload} onPreview={() => {}} /></>;
}

describe('editor de Portada', () => {
  it('conserva la galería al alternar entre solo imágenes y un diseño común', async () => {
    const user = userEvent.setup();
    render(<Editor />);
    const preview = screen.getByRole('region', { name: 'Vista previa de portada' });
    await user.click(screen.getByRole('button', { name: 'Solo archivo' }));
    expect(preview.querySelector('.rb-template')).not.toBeInTheDocument();
    expect(preview.querySelector('.banner-preview-cta')).not.toBeInTheDocument();
    await user.click(within(preview).getByRole('button', { name: 'Siguiente ›' }));
    expect(within(preview).getByAltText('Slide 2')).toHaveAttribute('src', '/second.jpg');
    await user.click(screen.getByRole('button', { name: 'Descubrimiento' }));
    expect(preview.querySelector('.rb-template')).toBeInTheDocument();
    expect(within(preview).getByAltText('Slide 2')).toHaveAttribute('src', '/second.jpg');
    await user.click(within(preview).getByRole('button', { name: '‹ Anterior' }));
    expect(within(preview).getByAltText('Slide 1')).toHaveAttribute('src', '/first.jpg');
    expect(preview.querySelector('.rb-template__title')).toBeInTheDocument();
    expect(JSON.parse(screen.getByTestId('banner-values').textContent).slides).toHaveLength(2);
  });

  it('conserva el video al activar y desactivar el diseño', async () => {
    const user = userEvent.setup();
    render(<Editor initial={{ type: 'video', videoUrl: '/portada.mp4', videoButton: { enabled: true, kind: 'text', text: 'Antiguo' } }} />);
    const preview = screen.getByRole('region', { name: 'Vista previa de portada' });
    await user.click(screen.getByRole('button', { name: 'Solo archivo' }));
    expect(preview.querySelector('video')).toHaveAttribute('src', '/portada.mp4');
    expect(preview.querySelector('.banner-preview-cta')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Editorial' }));
    expect(preview.querySelector('video')).toHaveAttribute('src', '/portada.mp4');
    expect(preview.querySelector('.rb-template')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Solo archivo' }));
    expect(preview.querySelector('video')).toHaveAttribute('src', '/portada.mp4');
    expect(JSON.parse(screen.getByTestId('banner-values').textContent).videoUrl).toBe('/portada.mp4');
  });

  it('elige la parte en la vista previa y muestra solo sus controles', async () => {
    const user = userEvent.setup();
    render(<Editor initial={{ type: 'image', imageUrl: '/hero.jpg' }} />);
    await user.click(screen.getByRole('button', { name: /Descubrimiento/ }));
    const preview = screen.getByRole('region', { name: 'Vista previa de portada' });
    const title = preview.querySelector('.rb-template__title .rb-template__editable');
    await user.click(title);
    expect(screen.getByLabelText('Título')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '② Botones' }));
    expect(screen.queryByLabelText('Título')).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Texto del botón'), { target: { value: 'Explorar ahora' } });
    expect(preview).toHaveTextContent('Explorar ahora');
    expect(JSON.parse(screen.getByTestId('banner-values').textContent).templateConfigs.discovery.primary.text).toBe('Explorar ahora');
  });

  it('ubica el punto sobre la imagen y conserva el color del acceso al guardar', async () => {
    const user = userEvent.setup();
    const sections = [{ id: 'categorias', config: { slides: [
      { id: 'hogar', title: 'Hogar', href: '/categoria/hogar', enabled: true },
      { id: 'regalos', title: 'Regalos', href: '/categoria/regalos', enabled: true },
    ] } }];
    render(<Editor initial={{ type: 'image', imageUrl: '/hero.jpg', templateId: 'atelier' }} sections={sections} />);
    await user.click(screen.getByRole('button', { name: '③ Categorías' }));
    fireEvent.change(screen.getByLabelText('Color de línea y punto'), { target: { value: '#ca2379' } });
    await user.click(screen.getByRole('button', { name: 'Señalar lugar en la imagen' }));
    const preview = screen.getByRole('region', { name: 'Vista previa de portada' });
    const target = within(preview).getByRole('button', { name: 'Señalar en la imagen el acceso 1' });
    target.getBoundingClientRect = () => ({ left: 10, top: 30, width: 400, height: 200 });
    fireEvent.click(target, { clientX: 150, clientY: 180 });
    const saved = JSON.parse(screen.getByTestId('banner-values').textContent);
    expect(saved.templateConfigs.atelier.cards[0]).toEqual(expect.objectContaining({ categoryId: 'hogar', x: 35, y: 75, lineColor: '#ca2379' }));
    expect(preview.querySelector('.rb-template__spot').style.getPropertyValue('--rb-spot-x')).toBe('35%');
    expect(within(preview).queryByRole('button', { name: 'Señalar en la imagen el acceso 1' })).not.toBeInTheDocument();
  });
  it('mantiene los controles compactos y cambia el encuadre entre móvil, tableta y escritorio', async () => {
    const user = userEvent.setup();
    render(<Editor />);
    expect(screen.queryByText(/Comportamiento responsive prediseñado/)).not.toBeInTheDocument();
    const preview = screen.getByRole('region', { name: 'Vista previa de portada' });
    const frame = preview.querySelector('.banner-preview-viewport');
    expect(frame).toHaveAttribute('data-device', 'desktop');
    expect(preview.querySelector('.banner-preview-hero')).toHaveStyle({ height: `${(520 / 1200) * 100}%` });
    expect(within(preview).getByAltText('Slide 1')).toHaveStyle({ objectPosition: '0% 35%' });
    await user.click(within(preview).getByRole('button', { name: 'Móvil' }));
    expect(frame).toHaveAttribute('data-device', 'mobile');
    expect(preview.querySelector('.banner-preview-hero')).toHaveStyle({ height: `${(844 / 1200) * 100}%` });
    await user.click(within(preview).getByRole('button', { name: 'Tableta' }));
    expect(frame).toHaveAttribute('data-device', 'tablet');
    await user.click(within(preview).getByRole('button', { name: 'Siguiente ›' }));
    expect(within(preview).getByAltText('Slide 2')).toHaveStyle({ objectFit: 'contain' });
    await user.click(screen.getByRole('button', { name: 'Mover slide antes' }));
    const values = JSON.parse(screen.getByTestId('banner-values').textContent);
    expect(values.slides[0].image).toBe('/second.jpg');
    expect(within(preview).getByAltText('Slide 1')).toHaveAttribute('src', '/second.jpg');
  });

  it('guarda el intervalo mostrado y la opción real del progreso', async () => {
    const user = userEvent.setup();
    render(<Editor />);
    await user.click(screen.getByRole('button', { name: 'Comportamiento' }));
    const interval = screen.getByRole('spinbutton', { name: 'Segundos por imagen' });
    expect(interval).toHaveValue(4.5);
    fireEvent.change(interval, { target: { value: '6.2' } });
    await user.click(screen.getByRole('checkbox', { name: 'Mostrar progreso entre imágenes' }));
    const values = JSON.parse(screen.getByTestId('banner-values').textContent);
    expect(values.sliderIntervalMs).toBe(6200);
    expect(values.sliderShowProgress).toBe(false);
  });

  it('previsualiza un video y avisa cuando el autoplay con sonido puede fallar', async () => {
    const user = userEvent.setup();
    render(<Editor initial={{ type: 'video', videoUrl: '/hero.mp4', videoAutoplay: true, videoMuted: false, videoLoop: true }} />);
    expect(screen.getByRole('region', { name: 'Vista previa de portada' }).querySelector('video')).toHaveAttribute('src', '/hero.mp4');
    expect(screen.getByText(/reproducción automática con sonido puede ser bloqueada/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Comportamiento' }));
    await user.click(screen.getByRole('checkbox', { name: 'Silenciar' }));
    expect(screen.queryByText(/reproducción automática con sonido puede ser bloqueada/)).not.toBeInTheDocument();
  });

  it('mantiene la vista previa en el bloque fijo y recoge los avisos en pantallas estrechas', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
    render(<Editor initial={{ type: 'video', videoUrl: '/hero.mp4', videoAutoplay: true, videoMuted: false }} />);
    const preview = screen.getByRole('region', { name: 'Vista previa de portada' });
    const fixed = preview.querySelector('.banner-preview-pin');
    expect(fixed).toContainElement(preview.querySelector('.banner-preview-viewport'));
    expect(fixed).toContainElement(screen.getByText('1 aviso antes de publicar'));
    expect(screen.getAllByText(/reproducción automática con sonido puede ser bloqueada/)).toHaveLength(1);
    expect(preview.querySelector('.banner-issues')).not.toBeInTheDocument();
  });

  it('ancla la vista previa al desplazarse, conserva los controles y la libera al salir del editor', async () => {
    const user = userEvent.setup();
    let anchorTop = 170;
    let workspaceBottom = 1600;
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function () {
      if (this.classList.contains('admin-header-panel')) return { top: 16, bottom: 80, height: 64 };
      if (this.classList.contains('banner-preview-anchor')) return { top: anchorTop, left: 780, width: 320, height: 400 };
      if (this.classList.contains('banner-workspace')) return { top: -200, bottom: workspaceBottom, height: 1800 };
      if (this.classList.contains('banner-preview-pin')) return { top: 0, bottom: 400, height: 400 };
      return { top: 0, bottom: 0, height: 0, width: 0 };
    });
    render(<div className="admin-area"><div className="admin-header-panel" /><Editor /></div>);
    expect(document.querySelector('.banner-preview-floating')).not.toBeInTheDocument();
    anchorTop = 40;
    fireEvent.scroll(document);
    const floating = document.querySelector('.admin-area > .banner-preview-floating');
    expect(floating).toHaveStyle({ top: '88px', left: '780px', width: '320px' });
    expect(document.querySelector('.banner-preview-anchor')).toHaveStyle({ minHeight: '400px' });
    await user.click(within(floating).getByRole('button', { name: 'Móvil' }));
    expect(within(floating).getByRole('button', { name: 'Móvil' })).toHaveAttribute('aria-pressed', 'true');
    workspaceBottom = 60;
    fireEvent.scroll(document);
    expect(document.querySelector('.banner-preview-floating')).not.toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Vista previa de portada' }).querySelector('.banner-preview-pin')).toBeInTheDocument();
  });

  it('edita el botón elegido en la vista previa cuando el slide tiene varios', async () => {
    const user = userEvent.setup();
    const first = { ...slides[0], buttons: [
      { enabled: true, kind: 'text', text: 'Primero', posX: 30, posY: 70 },
      { enabled: true, kind: 'text', text: 'Segundo', posX: 70, posY: 70 },
    ] };
    render(<Editor initial={{ type: 'slider', slides: [first], heightMode: 'auto', heightPx: 520 }} />);
    await user.click(screen.getByRole('button', { name: 'Editar botón 2 de la portada' }));
    const dialog = screen.getByRole('dialog', { name: 'Editar Slide #1' });
    expect(within(dialog).getByDisplayValue('Segundo')).toBeInTheDocument();
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Texto del botón' }), { target: { value: 'Nuevo texto' } });
    const values = JSON.parse(screen.getByTestId('banner-values').textContent);
    expect(values.slides[0].buttons[0].text).toBe('Primero');
    expect(values.slides[0].buttons[1].text).toBe('Nuevo texto');
  });

  it('ajusta la altura de escritorio y conserva 100dvh para móvil y tableta', () => {
    const banner = { type: 'image', imageUrl: '/hero.jpg', imagePosX: 0, imagePosY: 100, heightMode: 'auto', heightPx: 450 };
    expect(getBannerPreviewModel(banner, [], 0, 'desktop').heightPercent).toBe(37.5);
    expect(getBannerPreviewModel({ ...banner, heightPx: 1100 }, [], 0, 'desktop').heightPercent).toBeCloseTo(91.67, 1);
    expect(getBannerPreviewModel({ ...banner, heightMode: 'fullscreen' }, [], 0, 'desktop').heightPercent).toBe(75);
    expect(getBannerPreviewModel(banner, [], 0, 'mobile').heightPercent).toBeCloseTo((844 / 1200) * 100);
    expect(getBannerPreviewModel(banner, [], 0, 'tablet').objectPosition).toBe('0% 100%');
    expect(getBannerHeightStyle(banner, 'mobile')).toEqual({ height: '100dvh' });
    expect(getBannerHeightStyle(banner, 'tablet')).toEqual({ height: '100dvh' });
    expect(getBannerHeightStyle(banner, 'desktop')).toEqual({ height: '450px' });
  });

  it('ajusta la altura del dispositivo seleccionado sin cambiar la vista y conserva las otras alturas', async () => {
    const user = userEvent.setup();
    render(<Editor />);
    const preview = screen.getByRole('region', { name: 'Vista previa de portada' });
    const frame = preview.querySelector('.banner-preview-viewport');
    await user.click(within(preview).getByRole('button', { name: 'Móvil' }));
    await user.click(screen.getByRole('button', { name: 'Comportamiento' }));
    fireEvent.change(screen.getByRole('slider', { name: /Altura de móvil/ }), { target: { value: '650' } });
    expect(frame).toHaveAttribute('data-device', 'mobile');
    expect(preview.querySelector('.banner-preview-hero')).toHaveStyle({ height: `${(650 / 1200) * 100}%` });
    expect(getBannerHeightStyle(JSON.parse(screen.getByTestId('banner-values').textContent), 'mobile')).toEqual({ height: '650px' });
    await user.click(within(preview).getByRole('button', { name: 'Tableta' }));
    expect(screen.getByRole('slider', { name: /Altura de tableta/ })).toHaveValue('1180');
    fireEvent.change(screen.getByRole('slider', { name: /Altura de tableta/ }), { target: { value: '900' } });
    expect(frame).toHaveAttribute('data-device', 'tablet');
    expect(preview.querySelector('.banner-preview-hero')).toHaveStyle({ height: '75%' });
    await user.click(within(preview).getByRole('button', { name: 'Escritorio' }));
    expect(screen.getByRole('slider', { name: /Altura de escritorio/ })).toHaveValue('520');
    fireEvent.change(screen.getByRole('slider', { name: /Altura de escritorio/ }), { target: { value: '1100' } });
    expect(preview.querySelector('.banner-preview-hero')).toHaveStyle({ height: `${(1100 / 1200) * 100}%` });
    expect(within(preview).getByText(/portada 1100 px/)).toBeInTheDocument();
    const values = JSON.parse(screen.getByTestId('banner-values').textContent);
    expect(values).toMatchObject({ heightPx: 1100, mobileHeightPx: 650, mobileHeightMode: 'auto', tabletHeightPx: 900, tabletHeightMode: 'auto' });
    expect(getBannerHeightStyle(values, 'tablet')).toEqual({ height: '900px' });
    await user.click(within(preview).getByRole('button', { name: 'Móvil' }));
    await user.selectOptions(screen.getByRole('combobox', { name: 'Altura en móvil' }), 'fullscreen');
    expect(frame).toHaveAttribute('data-device', 'mobile');
    expect(getBannerHeightStyle(JSON.parse(screen.getByTestId('banner-values').textContent), 'mobile')).toEqual({ height: '100dvh' });
  });
});
