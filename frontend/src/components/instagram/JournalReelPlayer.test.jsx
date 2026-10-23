import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import JournalReelPlayer from './JournalReelPlayer';

const post = { id: 'reel', image: '/poster.webp', alt: 'Vestido rosa', videoUrl: 'https://cdn.example.com/reel.mp4' };
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
describe('reproductor ambiental de reels', () => {
  it('reproduce, pausa, avanza y cambia el sonido sin reproducción automática', () => {
    const play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(function () { fireEvent.play(this); return Promise.resolve(); });
    const pause = vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(function () { fireEvent.pause(this); });
    render(<JournalReelPlayer post={post} src={post.videoUrl} onExpand={() => {}} />);
    const video = screen.getByLabelText('Reel: Vestido rosa');
    expect(play).not.toHaveBeenCalled(); expect(video).toHaveAttribute('playsinline');
    expect(video).not.toHaveAttribute('controls'); expect(video).not.toHaveAttribute('autoplay');
    fireEvent.click(screen.getByRole('button', { name: 'Reproducir reel', exact: true }));
    expect(play).toHaveBeenCalledOnce();
    expect(screen.getByRole('button', { name: 'Pausar reel' })).toBeInTheDocument();
    Object.defineProperty(video, 'paused', { configurable: true, value: false });
    fireEvent.click(screen.getByRole('button', { name: 'Pausar reel' })); expect(pause).toHaveBeenCalledOnce();
    Object.defineProperty(video, 'duration', { configurable: true, value: 90 }); fireEvent.loadedMetadata(video);
    fireEvent.change(screen.getByRole('slider'), { target: { value: '35' } }); expect(video.currentTime).toBe(35);
    expect(screen.getByRole('slider')).toHaveAttribute('aria-valuetext', '0:35 de 1:30');
    fireEvent.click(screen.getByRole('button', { name: 'Silenciar reel' })); expect(video.muted).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Activar sonido del reel' })); expect(video.muted).toBe(false);
  });
  it('pausa el vídeo al abrirlo en grande y permite reproducirlo de nuevo al terminar', () => {
    const pause = vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {}), expand = vi.fn();
    render(<JournalReelPlayer post={post} src={post.videoUrl} onExpand={expand} />);
    const video = screen.getByLabelText('Reel: Vestido rosa');
    fireEvent.play(video); fireEvent.ended(video);
    expect(screen.getByRole('button', { name: 'Reproducir reel', exact: true })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Ampliar reel' }));
    expect(pause).toHaveBeenCalledOnce(); expect(expand).toHaveBeenCalledWith(post);
  });
  it('conserva los controles y explica un error de carga', () => {
    render(<JournalReelPlayer post={post} src={post.videoUrl} onExpand={() => {}} />);
    fireEvent.error(screen.getByLabelText('Reel: Vestido rosa'));
    expect(screen.getByRole('status')).toHaveTextContent('No se pudo cargar el reel');
    expect(screen.getByRole('button', { name: 'Ampliar reel' })).toBeInTheDocument();
    expect(screen.getByRole('slider')).toBeDisabled();
  });
});
