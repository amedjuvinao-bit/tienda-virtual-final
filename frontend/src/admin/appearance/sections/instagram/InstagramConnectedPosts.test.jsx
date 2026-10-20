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
const openHighlights = () => fireEvent.click(within(screen.getByRole('navigation', { name: 'Contenido de Instagram' })).getByRole('button', { name: 'Destacados' }));
const openHighlightPicker = () => fireEvent.click(screen.getByRole('button', { name: 'Elegir publicación de Instagram para el destacado' }));
afterEach(() => { cleanup(); vi.resetAllMocks(); });
describe('selección visual de la cuenta conectada', () => {
  it('ordena publicaciones visibles y marca una principal independiente del orden lateral', async () => {
    api.get.mockResolvedValue({ data: { connected: true, account, posts: [...records, post('3')], nextCursor: '' } });
    const { container } = render(<Harness />); openPosts();
    await screen.findByRole('button', { name: 'Usar como principal: Prenda 1' });
    fireEvent.click(screen.getByRole('button', { name: 'Usar como principal: Prenda 1' }));
    fireEvent.change(screen.getByLabelText('Orden de las publicaciones'), { target: { value: 'manual' } });
    fireEvent.click(screen.getByRole('button', { name: 'Mover antes: Prenda 3' }));
    const config = JSON.parse(screen.getByLabelText('Borrador guardable').textContent);
    expect(config).toMatchObject({ journalFeaturedPostId: 'ig_1', journalFeaturedAccountId: '123', journalConnectedOrder: { accountId: '123', mode: 'manual', ids: ['ig_1', 'ig_3', 'ig_2'] } });
    expect(container.querySelector('.ig-journal__post--featured')).toHaveAttribute('data-post-id', 'ig_1');
    expect([...container.querySelectorAll('.ig-journal__previews article')].map(el => el.dataset.postId)).toEqual(['ig_3', 'ig_2']);
    fireEvent.change(screen.getByLabelText('Orden de las publicaciones'), { target: { value: 'instagram' } });
    expect([...container.querySelectorAll('.ig-journal__previews article')].map(el => el.dataset.postId)).toEqual(['ig_2', 'ig_3']);
  });
  it('permite renombrar y enlazar los destacados automáticos de la cuenta conectada', async () => {
    api.get.mockResolvedValue({ data: { connected: true, account, posts: records, nextCursor: '' } });
    const { container } = render(<Harness />);
    await screen.findByRole('link', { name: '@rosa' });
    fireEvent.click(within(screen.getByRole('navigation', { name: 'Contenido de Instagram' })).getByRole('button', { name: 'Destacados' }));
    const names = screen.getAllByLabelText('Nombre del destacado');
    expect(names).toHaveLength(2);
    expect(names[0]).toHaveValue('Destacado 1');
    fireEvent.change(names[0], { target: { value: 'Nuestro equipo' } });
    openHighlightPicker();
    fireEvent.click(screen.getByRole('button', { name: 'Elegir para el destacado: Prenda 2' }));
    const saved = JSON.parse(screen.getByLabelText('Borrador guardable').textContent);
    expect(saved.journalHighlights[0]).toMatchObject({ title: 'Nuestro equipo', postId: 'ig_2' });
    fireEvent.click(screen.getByRole('button', { name: 'Ver destacado: Nuestro equipo' }));
    expect(container.querySelector('.ig-journal__post--featured')).toHaveAttribute('data-post-id', 'ig_2');
    expect(saved.posts).toEqual([]);
  });
  it('cambia la miniatura guardada anteriormente al elegir otra publicación y mantiene el nombre del destacado', async () => {
    api.get.mockResolvedValue({ data: { connected: true, account, posts: records, nextCursor: '' } });
    const { container } = render(<Harness config={{ journalHighlights: [{ id: 'legacy', title: 'Mi destacado', postId: 'ig_1', image: records[0].image }] }} />);
    await screen.findByRole('link', { name: '@rosa' }); openHighlights(); openHighlightPicker();
    fireEvent.click(screen.getByRole('button', { name: 'Elegir para el destacado: Prenda 2' }));
    expect(container.querySelector('.ig-journal__highlights img')).toHaveAttribute('src', records[1].image);
    expect(screen.getByRole('button', { name: 'Editar destacado 1' }).querySelector('img')).toHaveAttribute('src', records[1].image);
    const saved = JSON.parse(screen.getByLabelText('Borrador guardable').textContent);
    expect(saved.journalHighlights[0]).toMatchObject({ title: 'Mi destacado', postId: 'ig_2', image: '', imageSource: 'post' });
    expect(screen.queryByRole('region', { name: 'Publicaciones de Instagram para el destacado' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Elegir publicación de Instagram para el destacado' })).toHaveFocus();
    fireEvent.change(screen.getByLabelText('Imagen del círculo destacado'), { target: { value: 'custom' } });
    fireEvent.change(screen.getByLabelText('Imagen del destacado (opcional)'), { target: { value: '/custom-cover.jpg' } });
    expect(container.querySelector('.ig-journal__highlights img')).toHaveAttribute('src', '/custom-cover.jpg');
    fireEvent.change(screen.getByLabelText('Imagen del círculo destacado'), { target: { value: 'post' } });
    expect(container.querySelector('.ig-journal__highlights img')).toHaveAttribute('src', records[1].image);
  });
  it('elegir una publicación oculta para un destacado la hace visible sin aprobar las demás', async () => {
    api.get.mockResolvedValue({ data: { connected: true, account, posts: [...records, post('3')], nextCursor: '' } });
    const { container } = render(<Harness config={{ journalConnectedSelection: { accountId: '123', mode: 'selected', included: ['ig_1'], excluded: ['ig_2'] } }} />);
    await screen.findByRole('link', { name: '@rosa' }); openHighlights(); openHighlightPicker();
    expect(screen.getByRole('button', { name: 'Elegir para el destacado: Prenda 2' })).toHaveTextContent('Oculta');
    fireEvent.click(screen.getByRole('button', { name: 'Elegir para el destacado: Prenda 2' }));
    const saved = JSON.parse(screen.getByLabelText('Borrador guardable').textContent);
    expect(saved.journalConnectedSelection).toMatchObject({ accountId: '123', mode: 'selected', included: ['ig_1', 'ig_2'], excluded: [] });
    expect(container.querySelector('.ig-journal [data-post-id="ig_2"]')).not.toBeNull();
    expect(container.querySelector('.ig-journal [data-post-id="ig_3"]')).toBeNull();
  });
  it('carga más publicaciones desde Destacados y permite buscar y elegir una de otra página', async () => {
    api.get.mockResolvedValueOnce({ data: { connected: true, account, posts: records, nextCursor: 'signed' } })
      .mockResolvedValueOnce({ data: { connected: true, account, posts: Array.from({ length: 7 }, (_, i) => post(String(i + 3))), nextCursor: '' } });
    const { container } = render(<Harness />);
    await screen.findByRole('link', { name: '@rosa' }); openHighlights(); openHighlightPicker();
    fireEvent.click(screen.getByRole('button', { name: 'Cargar más para elegir' }));
    await screen.findByText('9 publicaciones cargadas');
    expect(api.get.mock.calls[1][1].params.cursor).toBe('signed');
    fireEvent.click(within(screen.getByRole('navigation', { name: 'Páginas para elegir un destacado' })).getByRole('button', { name: 'Siguientes' }));
    expect(screen.getByRole('button', { name: 'Elegir para el destacado: Prenda 9' })).toBeInTheDocument();
    fireEvent.change(screen.getByRole('searchbox', { name: 'Buscar publicación de Instagram' }), { target: { value: 'Prenda 9' } });
    expect(screen.queryByRole('button', { name: 'Elegir para el destacado: Prenda 1' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Elegir para el destacado: Prenda 9' }));
    expect(container.querySelector('.ig-journal__highlights img')).toHaveAttribute('src', post('9').image);
  });
  it('mantiene la publicación y permite reintentar si falla cargar más en el selector', async () => {
    api.get.mockResolvedValueOnce({ data: { connected: true, account, posts: records, nextCursor: 'signed' } })
      .mockRejectedValueOnce({ response: { data: { message: 'Instagram no respondió.' } } })
      .mockResolvedValueOnce({ data: { connected: true, account, posts: records, nextCursor: '' } });
    render(<Harness />);
    await screen.findByRole('link', { name: '@rosa' }); openHighlights(); openHighlightPicker();
    fireEvent.click(screen.getByRole('button', { name: 'Cargar más para elegir' }));
    const retry = await screen.findByRole('button', { name: 'Reintentar publicaciones de Instagram' });
    expect(screen.getByRole('button', { name: 'Elegir para el destacado: Prenda 1' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(retry);
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Reintentar publicaciones de Instagram' })).not.toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Elegir para el destacado: Prenda 1' })).toHaveAttribute('aria-pressed', 'true');
  });
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
    expect(api.get.mock.calls[0][0]).toBe('/api/admin/instagram-settings/feed');
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
    expect(api.post).toHaveBeenCalledWith('/api/admin/instagram-settings/refresh-feed', {}, expect.any(Object));
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
  it.each([
    [{ response: { status: 404, data: '<html>Cannot GET</html>' } }, /HTTP 404/],
    [{ code: 'ECONNABORTED' }, /tardó demasiado/],
    [{ response: { status: 403 } }, /permiso de consultar Apariencia/],
  ])('identifica el error de carga sin dejar un mensaje genérico', async (error, message) => {
    api.get.mockRejectedValue(error);
    render(<Harness />); openPosts();
    expect(await screen.findByRole('alert')).toHaveTextContent(message);
    expect(api.get.mock.calls[0][0]).toBe('/api/admin/instagram-settings/feed');
    expect(api.get.mock.calls[0][1].timeout).toBe(45000);
  });
  it('rechaza HTML devuelto como éxito en lugar de simular una cuenta vacía', async () => {
    api.get.mockResolvedValue({ data: '<html>Not found</html>' });
    render(<Harness />); openPosts();
    expect(await screen.findByRole('alert')).toHaveTextContent('El servidor no devolvió una lista válida');
  });

});
