import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import InstagramJournal from './InstagramJournal';
import api from '../../lib/api';
vi.mock('../../lib/api', () => ({ default: { get: vi.fn() } }));
const manual = [{ id: 'manual', image: '/manual.jpg', alt: 'Foto manual', enabled: true }];
const post = id => ({ id: `ig_${id}`, image: `https://cdn.example.com/${id}.jpg`, alt: `Foto ${id}`, link: `https://instagram.com/p/${id}/`, enabled: true });
const account = { username: 'realrosa', name: 'Cuenta Rosa', url: 'https://instagram.com/realrosa/', avatar: 'https://cdn.example.com/avatar.jpg', followers: 50, mediaCount: 80 };
const theme = (config = {}) => ({ sections: [{ id: 'instagram', enabled: true, config: { posts: manual, profileUser: '@manual', ...config } }] });
afterEach(() => { cleanup(); vi.clearAllMocks(); localStorage.clear(); });
describe('Cuenta conectada y fotos manuales', () => {
  it('las fotos sin enlace tienen ampliar, compartir y guardar sin un contenedor vacío', async () => {
    const copy = vi.fn().mockResolvedValue();
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: copy } });
    render(<InstagramJournal theme={theme()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Compartir foto' }));
    await waitFor(() => expect(copy).toHaveBeenCalledWith(expect.stringContaining('ig_post=manual#instagram')));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar en este navegador' }));
    expect(screen.getByRole('button', { name: 'Quitar de guardadas' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Ampliar foto: Foto manual' }));
    expect(screen.getByRole('dialog', { name: 'Foto manual' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar publicación' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(api.get).not.toHaveBeenCalled(); delete navigator.clipboard;
  });
  it('oculta la barra al ocultar acciones y texto en una foto sin enlace', () => {
    const { container } = render(<InstagramJournal theme={theme({ journalShowActions: false, journalShowCaptions: false })} />);
    expect(container.querySelector('.ig-journal__post--featured .ig-journal__post-bottom')).toBeNull();
  });
  it('trae avatar, identidad y todas las páginas sin aplicar el límite manual', async () => {
    api.get.mockResolvedValueOnce({ data: { connected: true, account, posts: [post('one'), post('two')], nextCursor: 'signed-cursor' } })
      .mockResolvedValueOnce({ data: { connected: true, account, posts: [post('two'), post('three')], nextCursor: '' } });
    const { container } = render(<InstagramJournal theme={theme({ journalSource: 'connected', journalLimit: 1, journalShowAccountStats: true })} />);
    expect(await screen.findByRole('link', { name: '@realrosa' })).toHaveAttribute('href', account.url);
    expect(container.querySelector('.ig-journal__avatar img')).toHaveAttribute('src', account.avatar);
    expect(screen.getByText(/50 seguidores · 80 publicaciones/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cargar más publicaciones' }));
    await screen.findByRole('button', { name: 'Ver en grande: Foto three' });
    expect(api.get.mock.calls[1][1].params.cursor).toBe('signed-cursor');
    expect(screen.queryByRole('button', { name: 'Cargar más publicaciones' })).not.toBeInTheDocument();
    expect(container.querySelectorAll('[data-post-id="ig_two"]')).toHaveLength(1);
  });
  it('permite conservar nombre y avatar manuales', async () => {
    api.get.mockResolvedValue({ data: { connected: true, account, posts: [post('one')], nextCursor: '' } });
    const { container } = render(<InstagramJournal theme={theme({ journalSource: 'connected', journalUseAccountIdentity: false, journalUseAccountAvatar: false, journalAvatarImage: '/own-avatar.jpg' })} />);
    await screen.findByRole('img', { name: 'Foto one' });
    expect(screen.getByText('manual')).toBeInTheDocument();
    expect(container.querySelector('.ig-journal__avatar img')).toHaveAttribute('src', '/own-avatar.jpg');
  });
  it('mantiene fotos manuales ante error y permite reintentar', async () => {
    api.get.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({ data: { connected: true, account, posts: [post('one')], nextCursor: '' } });
    render(<InstagramJournal theme={theme({ journalSource: 'connected' })} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Volver a intentar' }));
    expect(await screen.findByRole('img', { name: 'Foto one' })).toBeInTheDocument();
  });
  it('una cuenta sin publicaciones muestra estado claro sin inventar fotos', async () => {
    api.get.mockResolvedValue({ data: { connected: true, account, posts: [], nextCursor: '' } });
    render(<InstagramJournal theme={theme({ journalSource: 'connected' })} />);
    expect(await screen.findByText('Pronto compartiremos nuevas publicaciones.')).toBeInTheDocument();
    expect(screen.queryByRole('img', { name: 'Foto manual' })).not.toBeInTheDocument();
  });
  it('abre álbumes completos con navegación y video', async () => {
    const album = { ...post('album'), album: [{ image: '/a.jpg' }, { image: '/b.jpg', videoUrl: '/b.mp4' }] };
    api.get.mockResolvedValue({ data: { connected: true, account, posts: [album], nextCursor: '' } });
    render(<InstagramJournal theme={theme({ journalSource: 'connected' })} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Ver las 2 fotos de esta publicación' }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByRole('img')).toHaveAttribute('src', '/a.jpg');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Foto siguiente' }));
    expect(dialog.querySelector('video')).toHaveAttribute('src', '/b.mp4');
    fireEvent.keyDown(dialog, { key: 'ArrowLeft' });
    expect(within(dialog).getByRole('img')).toHaveAttribute('src', '/a.jpg');
  });
});
