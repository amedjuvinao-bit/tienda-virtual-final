import React, { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within, waitFor } from '@testing-library/react';
import InstagramSection from '../../../../components/InstagramSection';
import InstagramSectionUI from './InstagramSectionUI';
import { normalizeJournal, journalHighlights } from './instagramJournalHelpers';

const posts = Array.from({ length: 6 }, (_, i) => ({
  id: `p${i}`, enabled: true, image: `/photo${i}.jpg`, link: `https://instagram.com/${i === 2 ? 'reel' : 'p'}/${i}/`,
  alt: `Prenda ${i}`, kind: i === 2 ? 'reel' : 'photo', extra: `campo antiguo ${i}`
}));
const themeFor = (config = {}, records = posts) => ({ sections: [{ id: 'instagram', enabled: true, config: { profileLink: 'https://instagram.com/rosa/', profileUser: '@rosa', posts: records, ...config } }] });
const nav = (name, button) => fireEvent.click(within(screen.getByRole('navigation', { name })).getByRole('button', { name: button }));
const featured = () => screen.getByLabelText('Publicación principal');
beforeEach(() => localStorage.clear());
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('Diario social público', () => {
  it('es el diseño por defecto y mantiene cada enlace independiente y la principal anterior', () => {
    const theme = themeFor({ editorialFeaturedPostId: 'p3' });
    const snapshot = JSON.stringify(theme);
    render(<InstagramSection theme={theme} />);
    expect(screen.getByRole('heading', { name: /^Instagram/ })).toBeInTheDocument();
    expect(within(featured()).getByRole('link', { name: 'Ver publicación: Prenda 3' })).toHaveAttribute('href', posts[3].link);
    expect(screen.getByRole('link', { name: 'Ver publicación: Prenda 0' })).toHaveAttribute('href', posts[0].link);
    expect(JSON.stringify(theme)).toBe(snapshot);
  });
  it('destacados y miniaturas actualizan la publicación principal y su enlace', () => {
    render(<InstagramSection theme={themeFor()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Ver destacado: Destacado 1' }));
    expect(within(featured()).getByRole('img', { name: 'Prenda 0' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Ver en grande: Prenda 1' }));
    expect(within(featured()).getByRole('link', { name: 'Ver publicación: Prenda 1' })).toHaveAttribute('href', posts[1].link);
    expect(featured()).toHaveFocus();
  });
  it('pagina todas las publicaciones sin borrar ni repetir la principal', () => {
    render(<InstagramSection theme={themeFor()} />);
    expect(screen.getByRole('button', { name: 'Ver en grande: Prenda 0' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Siguientes publicaciones' }));
    expect(screen.getByRole('button', { name: 'Ver en grande: Prenda 2' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Ver en grande: Prenda 4' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Siguientes publicaciones' }));
    expect(screen.getByRole('button', { name: 'Ver en grande: Prenda 5' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Siguientes publicaciones' })).toBeDisabled();
  });
  it('filtra reels y reproduce solo archivos de video explícitos', () => {
    const { rerender } = render(<InstagramSection theme={themeFor()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Reels', exact: true }));
    expect(screen.getByRole('button', { name: 'Ver en grande: Prenda 2' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Ver en grande: Prenda 0' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Ver en grande: Prenda 2' }));
    expect(featured().querySelector('video')).toBeNull();
    rerender(<InstagramSection theme={themeFor({ journalFeaturedPostId: 'p2' }, posts.map(p => p.id === 'p2' ? { ...p, videoUrl: '/video.mp4' } : p))} />);
    expect(featured().querySelector('video')).toHaveAttribute('src', '/video.mp4');
    expect(within(featured()).getByRole('group', { name: 'Controles del reel' })).toBeInTheDocument();
    expect(within(featured()).getByRole('button', { name: 'Reproducir reel', exact: true })).toBeInTheDocument();
  });
  it('guarda en este navegador, persiste al remontar y filtra las guardadas', () => {
    const view = render(<InstagramSection theme={themeFor()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Guardar en este navegador' }));
    expect(screen.getByRole('status')).toHaveTextContent('guardada en este navegador');
    view.unmount(); render(<InstagramSection theme={themeFor()} />);
    expect(screen.getByRole('button', { name: 'Quitar de guardadas' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Ver destacado: Destacado 1' }));
    fireEvent.click(screen.getByRole('button', { name: 'Guardadas' }));
    expect(screen.getByRole('button', { name: 'Ver en grande: Prenda 4' })).toBeInTheDocument();
  });
  it('comparte el enlace real, permite copiarlo y trata cancelación y errores', async () => {
    const writeText = vi.fn().mockResolvedValue();
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    const share = vi.fn().mockRejectedValueOnce(Object.assign(new Error(), { name: 'AbortError' })).mockRejectedValueOnce(new Error('blocked'));
    Object.defineProperty(navigator, 'share', { configurable: true, value: share });
    render(<InstagramSection theme={themeFor()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Compartir publicación' }));
    await waitFor(() => expect(share).toHaveBeenCalledWith({ title: 'Prenda 4', url: posts[4].link }));
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
    fireEvent.click(screen.getByRole('button', { name: 'Compartir publicación' }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('No se pudo compartir'));
    fireEvent.click(within(featured()).getByText('Copiar enlace'));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(posts[4].link));
    expect(screen.getByRole('status')).toHaveTextContent('Enlace copiado');
    delete navigator.share; delete navigator.clipboard;
  });
  it('respeta lista vacía, desactivación y URL insegura sin sustituirlas por otras publicaciones', () => {
    const { container, rerender } = render(<InstagramSection theme={themeFor({}, [])} posts={posts} />);
    expect(container).toBeEmptyDOMElement();
    rerender(<InstagramSection theme={themeFor({}, [{ ...posts[0], link: 'javascript:alert(1)' }])} />);
    expect(screen.queryByRole('link', { name: /Ver publicación/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Compartir publicación' })).not.toBeInTheDocument();
    rerender(<InstagramSection theme={{ sections: [{ ...themeFor().sections[0], enabled: false }] }} />);
    expect(container).toBeEmptyDOMElement();
  });
  it('reacciona al cambio de la principal en el panel y a la eliminación de la seleccionada', () => {
    const { rerender } = render(<InstagramSection theme={themeFor()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Ver destacado: Destacado 1' }));
    rerender(<InstagramSection theme={themeFor({ journalFeaturedPostId: 'p1' })} />);
    expect(within(featured()).getByRole('img', { name: 'Prenda 1' })).toBeInTheDocument();
    rerender(<InstagramSection theme={themeFor({ journalFeaturedPostId: 'p1' }, posts.filter(p => p.id !== 'p1'))} />);
    expect(within(featured()).getByRole('img')).toBeInTheDocument();
    expect(journalHighlights({ journalHighlights: [] }, posts)).toEqual([]);
    expect(normalizeJournal({ journalPageSize: 100, journalGap: -2 })).toMatchObject({ journalPageSize: 6, journalGap: 12 });
  });
  it('oculta un perfil vaciado y rechaza archivos de video con protocolo inseguro', () => {
    render(<InstagramSection theme={themeFor({ profileLink: '', journalFeaturedPostId: 'p2' }, posts.map(p => ({ ...p, videoUrl: 'javascript:alert(1)' })))} />);
    expect(screen.queryByRole('link', { name: /Seguir en Instagram/ })).not.toBeInTheDocument();
    expect(featured().querySelector('video')).toBeNull();
    expect(within(featured()).getByRole('link', { name: 'Ver publicación: Prenda 2' })).toHaveAttribute('href', posts[2].link);
  });
  it('actualiza la imagen automática al renovarse Instagram y conserva las portadas personalizadas', () => {
    const config = { journalHighlights: [
      { id: 'auto', title: 'Actual', postId: 'p0', image: '/expired.jpg', imageSource: 'post' },
      { id: 'custom', title: 'Propia', postId: 'p1', image: '/custom.jpg', imageSource: 'custom' },
    ] };
    const refreshed = posts.map(post => ({ ...post, image: `/refreshed-${post.id}.jpg` }));
    expect(journalHighlights(config, refreshed).map(h => h.image)).toEqual(['/refreshed-p0.jpg', '/custom.jpg']);
  });
});

function Editor({ save, upload }) {
  const [theme, setTheme] = useState(themeFor());
  return <><InstagramSectionUI theme={theme} setPath={(key, value) => setTheme(t => ({ ...t, [key]: value }))} uploadToCloudinary={upload} /><button onClick={() => save(theme)}>Guardar prueba</button></>;
}
describe('Editor del diario', () => {
  it('guarda textos, principal y destacados en grupos cortos sin perder campos existentes', () => {
    const save = vi.fn(); render(<Editor save={save} />);
    nav('Contenido de Instagram', 'Textos');
    fireEvent.change(screen.getByLabelText('Título de la sección'), { target: { value: 'Nuestro diario' } });
    nav('Contenido de Instagram', 'Destacados');
    fireEvent.change(screen.getAllByLabelText('Nombre del destacado')[0], { target: { value: 'Fiesta' } });
    fireEvent.change(screen.getAllByLabelText('Publicación del destacado')[0], { target: { value: 'p3' } });
    nav('Pasos de edición', /Diseño/); nav('Diseño de Instagram', 'Distribución');
    fireEvent.change(screen.getByLabelText('Publicación principal'), { target: { value: 'p2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar prueba' }));
    const config = save.mock.calls[0][0].sections[0].config;
    expect(config).toMatchObject({ journalTitle: 'Nuestro diario', journalFeaturedPostId: 'p2', posts });
    expect(config.journalHighlights[0]).toMatchObject({ title: 'Fiesta', postId: 'p3' });
  });
  it('conserva texto editado y destino de una carga al cambiar de publicación', async () => {
    let finish; const upload = vi.fn(() => new Promise(resolve => { finish = resolve; }));
    const save = vi.fn(); render(<Editor save={save} upload={upload} />);
    nav('Contenido de Instagram', 'Publicaciones');
    fireEvent.change(screen.getAllByLabelText('Subir imagen de la publicación')[0], { target: { files: [new File(['photo'], 'photo.png', { type: 'image/png' })] } });
    fireEvent.click(screen.getByRole('button', { name: 'Editar publicación 2' }));
    fireEvent.change(screen.getAllByLabelText('Enlace de la publicación')[1], { target: { value: 'https://instagram.com/p/nuevo/' } });
    await act(async () => finish('/nueva.jpg'));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar prueba' }));
    const saved = save.mock.calls[0][0].sections[0].config.posts;
    expect(saved[0]).toMatchObject({ ...posts[0], image: '/nueva.jpg' });
    expect(saved[1]).toMatchObject({ ...posts[1], link: 'https://instagram.com/p/nuevo/' });
  });
  it('permite alternar con el muro anterior conservando la configuración de ambos', () => {
    const save = vi.fn(); render(<Editor save={save} />);
    nav('Contenido de Instagram', 'Textos');
    fireEvent.change(screen.getByLabelText('Título de la sección'), { target: { value: 'Mi diario' } });
    fireEvent.change(screen.getByLabelText('Diseño de la sección Instagram'), { target: { value: 'editorial' } });
    fireEvent.change(screen.getByLabelText('Diseño de la sección Instagram'), { target: { value: 'journal' } });
    nav('Contenido de Instagram', 'Textos');
    expect(screen.getByLabelText('Título de la sección')).toHaveValue('Mi diario');
    fireEvent.click(screen.getByRole('button', { name: 'Guardar prueba' }));
    expect(save.mock.calls[0][0].sections[0].config.posts).toEqual(posts);
  });
  it('una carga que termina tras cambiar de diseño no restaura el diseño anterior', async () => {
    let finish; const upload = vi.fn(() => new Promise(resolve => { finish = resolve; }));
    const save = vi.fn(); render(<Editor save={save} upload={upload} />);
    nav('Contenido de Instagram', 'Publicaciones');
    fireEvent.change(screen.getAllByLabelText('Subir imagen de la publicación')[0], { target: { files: [new File(['photo'], 'photo.png', { type: 'image/png' })] } });
    fireEvent.change(screen.getByLabelText('Diseño de la sección Instagram'), { target: { value: 'editorial' } });
    await act(async () => finish('/late.jpg'));
    expect(screen.getByLabelText('Diseño de la sección Instagram')).toHaveValue('editorial');
    fireEvent.click(screen.getByRole('button', { name: 'Guardar prueba' }));
    expect(save.mock.calls[0][0].sections[0].config).toMatchObject({ instagramLayout: 'editorial', posts });
  });
});
