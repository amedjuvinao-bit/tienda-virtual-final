import React, { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import InstagramJournalUI from './InstagramJournalUI';
import InstagramJournal from '../../../../components/instagram/InstagramJournal';
import { InstagramEditorFeedProvider } from '../../../../components/instagram/InstagramEditorFeed';
import StorefrontSectionPreview from '../ui/StorefrontSectionPreview';
import { getSectionOverview } from '../sectionsOverviewModel';
import api from '../../../../lib/api';
vi.mock('../../../../lib/api', () => ({ default: { get: vi.fn(), post: vi.fn() } }));
const account = { id: '123', username: 'rosa', name: 'Rosa Boutique', avatar: '/avatar.jpg', url: 'https://instagram.com/rosa/' };
const post = id => ({ id: `ig_${id}`, caption: `Prenda ${id}`, alt: `Prenda ${id}`, image: `https://cdn.example.com/${id}.jpg`, kind: id === '2' ? 'reel' : 'photo', link: `https://instagram.com/p/${id}/` });
const records = [post('1'), post('2')];
const makeTheme = config => ({ sections: [{ id: 'instagram', enabled: true, config: { journalSource: 'connected', posts: [], ...config } }] });
function Harness({ config = {}, realPreview = false }) {
  const [theme, setTheme] = useState(() => makeTheme(config));
  return <InstagramEditorFeedProvider enabled>
    <InstagramJournalUI theme={theme} setPath={(_path, sections) => setTheme({ sections })} />
    {realPreview ? <StorefrontSectionPreview section={theme.sections[0]} theme={theme} /> : <InstagramJournal theme={theme} />}
    <output aria-label="Borrador guardable">{JSON.stringify(theme.sections[0].config)}</output>
  </InstagramEditorFeedProvider>;
}
const openPosts = () => fireEvent.click(within(screen.getByRole('navigation', { name: 'Contenido de Instagram' })).getByRole('button', { name: 'Publicaciones' }));
afterEach(() => { cleanup(); vi.resetAllMocks(); });
describe('selección visual de la cuenta conectada', () => {
  it('muestra fotos reales sin formulario manual; ocultar y mostrar actualizan el borrador y la vista previa', async () => {
    api.get.mockResolvedValue({ data: { connected: true, account, posts: records, nextCursor: '' } });
    const { container } = render(<Harness />); openPosts();
    await screen.findByRole('button', { name: 'Ocultar publicación: Prenda 1' });
    expect(screen.queryByRole('button', { name: 'Agregar publicación' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Ocultar publicación: Prenda 1' }));
    expect(screen.getByRole('button', { name: 'Mostrar publicación: Prenda 1' })).toHaveAttribute('aria-pressed', 'false');
    expect(container.querySelector('.ig-journal [data-post-id="ig_1"]')).toBeNull();
    expect(screen.getByLabelText('Borrador guardable').textContent).toContain('"excluded":["ig_1"]');
    expect(api.post).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Mostrar publicación: Prenda 1' }));
    expect(container.querySelector('.ig-journal [data-post-id="ig_1"]')).not.toBeNull();
    expect(api.get).toHaveBeenCalledTimes(1);
    expect(api.get.mock.calls[0][0]).toBe('/api/instagram/admin/feed');
  });
  it('carga más páginas, evita duplicados y deja las publicaciones nuevas pendientes de selección', async () => {
    api.get.mockResolvedValueOnce({ data: { connected: true, account, posts: records, nextCursor: 'signed' } })
      .mockResolvedValueOnce({ data: { connected: true, account, posts: [post('2'), post('3')], nextCursor: '' } });
    const { container } = render(<Harness />); openPosts();
    await screen.findByRole('button', { name: 'Ocultar publicación: Prenda 1' });
    fireEvent.change(screen.getByLabelText('Al recibir publicaciones nuevas'), { target: { value: 'selected' } });
    fireEvent.click(screen.getByRole('button', { name: 'Cargar más de Instagram' }));
    await screen.findByRole('button', { name: 'Mostrar publicación: Prenda 3' });
    expect(screen.getAllByRole('button', { name: 'Ocultar publicación: Prenda 2' })).toHaveLength(1);
    expect(container.querySelector('.ig-journal [data-post-id="ig_3"]')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Mostrar publicación: Prenda 3' }));
    expect(container.querySelector('.ig-journal [data-post-id="ig_3"]')).not.toBeNull();
    expect(api.get.mock.calls[1][1].params.cursor).toBe('signed');
  });
  it('filtra y aplica acciones de grupo sin cambiar las publicaciones fuera del resultado', async () => {
    api.get.mockResolvedValue({ data: { connected: true, account, posts: records, nextCursor: '' } });
    render(<Harness />); openPosts(); await screen.findByRole('button', { name: 'Ocultar publicación: Prenda 1' });
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'Prenda 2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Ocultar resultados' }));
    expect(screen.getByRole('button', { name: 'Mostrar publicación: Prenda 2' })).toBeInTheDocument();
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: '' } });
    expect(screen.getByRole('button', { name: 'Ocultar publicación: Prenda 1' })).toBeInTheDocument();
  });
  it('conserva la selección al actualizar y permite reintentar fallos sin borrar el borrador', async () => {
    api.get.mockResolvedValue({ data: { connected: true, account, posts: records, nextCursor: '' } });
    api.post.mockRejectedValue({ response: { data: { message: 'Instagram no respondió.' } } });
    render(<Harness />); openPosts(); await screen.findByRole('button', { name: 'Ocultar publicación: Prenda 1' });
    fireEvent.click(screen.getByRole('button', { name: 'Ocultar publicación: Prenda 1' }));
    fireEvent.click(screen.getByRole('button', { name: 'Actualizar', exact: true }));
    await screen.findByRole('alert');
    expect(screen.getByLabelText('Borrador guardable').textContent).toContain('ig_1');
    expect(screen.getByRole('button', { name: 'Mostrar publicación: Prenda 1' })).toBeInTheDocument();
    expect(api.post).toHaveBeenCalledWith('/api/instagram/admin/refresh', {}, expect.any(Object));
  });
  it('activa la vista previa real y la sección pública sin necesitar fotos manuales', async () => {
    api.get.mockResolvedValue({ data: { connected: true, account, posts: records, nextCursor: '' } });
    const theme = makeTheme({}); expect(getSectionOverview(theme.sections[0], theme.sections).status).toBe('ready');
    render(<Harness realPreview />);
    await waitFor(() => expect(within(screen.getByRole('region', { name: 'Vista real de la tienda' })).getByRole('link', { name: '@rosa' })).toBeInTheDocument());
    expect(screen.queryByText('Agrega contenido para verla aquí.')).not.toBeInTheDocument();
  });
  it('preserva las fotos manuales al cambiar entre las dos fuentes', async () => {
    api.get.mockResolvedValue({ data: { connected: true, account, posts: records, nextCursor: '' } });
    render(<Harness config={{ journalSource: 'manual', posts: [{ id: 'manual', image: '/manual.jpg', enabled: true }] }} />); openPosts();
    await screen.findByText(/@rosa está conectada/);
    fireEvent.change(screen.getByLabelText('Contenido que se muestra en la tienda'), { target: { value: 'connected' } });
    await screen.findByRole('button', { name: 'Ocultar publicación: Prenda 1' });
    fireEvent.change(screen.getByLabelText('Contenido que se muestra en la tienda'), { target: { value: 'manual' } });
    expect(screen.getByRole('button', { name: 'Agregar publicación' })).toBeInTheDocument();
    expect(screen.getByLabelText('Borrador guardable').textContent).toContain('/manual.jpg');
  });
  it('conserva las ocultas al alternar entre aprobación y publicación automática', async () => {
    api.get.mockResolvedValue({ data: { connected: true, account, posts: records, nextCursor: '' } });
    render(<Harness />); openPosts(); await screen.findByRole('button', { name: 'Ocultar publicación: Prenda 1' });
    fireEvent.change(screen.getByLabelText('Al recibir publicaciones nuevas'), { target: { value: 'selected' } });
    fireEvent.click(screen.getByRole('button', { name: 'Ocultar publicación: Prenda 1' }));
    fireEvent.change(screen.getByLabelText('Al recibir publicaciones nuevas'), { target: { value: 'all' } });
    expect(screen.getByRole('button', { name: 'Mostrar publicación: Prenda 1' })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Al recibir publicaciones nuevas'), { target: { value: 'selected' } });
    expect(screen.getByRole('button', { name: 'Mostrar publicación: Prenda 1' })).toBeInTheDocument();
  });
});
