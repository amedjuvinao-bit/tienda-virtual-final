import React, { useState } from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import BannerPanel from './BannerPanel';
import { getBannerPreviewModel } from './BannerDevicePreview';

afterEach(cleanup);

const slides = [
  { image: '/first.jpg', fit: 'cover', posX: 0, posY: 35, button: { enabled: true, kind: 'text', text: 'Ver colección', posX: 50, posY: 85 } },
  { image: '/second.jpg', fit: 'contain', posX: 70, posY: 50, button: { enabled: false } },
];

function Editor({ initial = { type: 'slider', heightMode: 'auto', heightPx: 520, sliderIntervalMs: 4500, sliderShowProgress: true, slides }, upload = vi.fn() }) {
  const [theme, setTheme] = useState({ banner: initial });
  const setPath = (path, value) => setTheme((previous) => ({ banner: { ...previous.banner, [path.split('.')[1]]: value } }));
  return <><output data-testid="banner-values">{JSON.stringify(theme.banner)}</output><BannerPanel theme={theme} setPath={setPath} uploading={false} setUploading={() => {}} uploadToCloudinaryViaBackend={upload} onPreview={() => {}} /></>;
}

describe('editor de Portada', () => {
  it('mantiene los controles compactos y cambia el encuadre entre móvil, tableta y escritorio', async () => {
    const user = userEvent.setup();
    render(<Editor />);
    expect(screen.queryByText(/Comportamiento responsive prediseñado/)).not.toBeInTheDocument();
    const preview = screen.getByRole('region', { name: 'Vista previa de portada' });
    const frame = preview.querySelector('.banner-preview-viewport');
    expect(frame).toHaveAttribute('data-device', 'desktop');
    expect(preview.querySelector('.banner-preview-hero')).toHaveStyle({ height: `${(520 / 900) * 100}%` });
    expect(within(preview).getByAltText('Slide 1')).toHaveStyle({ objectPosition: '0% 35%' });
    await user.click(within(preview).getByRole('button', { name: 'Móvil' }));
    expect(frame).toHaveAttribute('data-device', 'mobile');
    expect(preview.querySelector('.banner-preview-hero')).toHaveStyle({ height: '100%' });
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
    expect(getBannerPreviewModel(banner, [], 0, 'desktop').heightPercent).toBe(50);
    expect(getBannerPreviewModel(banner, [], 0, 'mobile').heightPercent).toBe(100);
    expect(getBannerPreviewModel(banner, [], 0, 'tablet').objectPosition).toBe('0% 100%');
  });
});
