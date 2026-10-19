import React, { useState } from 'react';
import { afterEach, describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, within, act } from '@testing-library/react';
import InstagramSection from '../../../../components/InstagramSection';
import InstagramSectionUI from './InstagramSectionUI';
import { normalizeInstagramSection } from './instagramSectionHelpers';
import { normalizeEditorial, safeInstagramLink } from './instagramEditorialHelpers';
afterEach(cleanup);
const posts = [{
  id: 'a',
  image: '/a.jpg',
  link: 'https://www.instagram.com/p/a/',
  alt: 'Vestido',
  custom: 'retained'
}, {
  id: 'b',
  image: '/b.jpg',
  link: 'https://www.instagram.com/p/b/',
  alt: 'Bolso'
}];
const themeFor = (posts, config = {}) => ({
  sections: [{
    id: 'instagram',
    enabled: true,
    config: {
      posts,
      profileLink: 'https://instagram.com/rosa',
      ...config
    }
  }]
});
function Harness({
  save,
  upload
}) {
  const [theme, setTheme] = useState(themeFor(posts));
  return <><InstagramSectionUI theme={theme} uploadToCloudinary={upload} setPath={(k, v) => setTheme(t => ({
      ...t,
      [k]: v
    }))} /><button onClick={() => save(theme)}>Guardar</button></>;
}
const contentTab = name => fireEvent.click(within(screen.getByRole('navigation', {
  name: 'Contenido de Instagram'
})).getByRole('button', {
  name
}));
describe('Instagram editorial', () => {
  it('cada foto tiene su enlace independiente y conserva campos antiguos y encuadres', () => {
    const theme = themeFor([{
      ...posts[0],
      editorialX: 8,
      imageScale: 1.4,
      mobileImage: '/mobile.jpg'
    }, posts[1]]);
    const normalized = normalizeInstagramSection(theme.sections[0]);
    expect(normalized.config.posts[0]).toMatchObject({
      custom: 'retained',
      editorialX: 8,
      imageScale: 1.4,
      mobileImage: '/mobile.jpg'
    });
    render(<InstagramSection theme={theme} />);
    expect(screen.getByRole('link', {
      name: 'Ver publicación: Vestido'
    })).toHaveAttribute('href', posts[0].link);
    expect(screen.getByRole('link', {
      name: 'Ver publicación: Bolso'
    })).toHaveAttribute('href', posts[1].link);
    expect(screen.getByRole('link', {
      name: /Seguir en Instagram/
    })).toHaveAttribute('href', 'https://instagram.com/rosa');
  });
  it('no convierte una foto sin enlace o con protocolo inseguro en enlace al perfil', () => {
    render(<InstagramSection theme={themeFor([{
      ...posts[0],
      link: ''
    }, {
      ...posts[1],
      link: 'javascript:alert(1)'
    }])} />);
    expect(screen.queryByRole('link', {
      name: /Ver publicación/
    })).not.toBeInTheDocument();
    expect(screen.getAllByRole('img')).toHaveLength(2);
    expect(safeInstagramLink('data:text/html,test')).toBe('');
  });
  it('respeta todas las publicaciones incluidas las adicionales, ocultas y vacías', () => {
    const list = Array.from({
      length: 8
    }, (_, i) => ({
      ...posts[0],
      id: String(i),
      enabled: i !== 6,
      image: i === 7 ? '' : '/test.jpg'
    }));
    const {
      container
    } = render(<InstagramSection theme={themeFor(list, {
      editorialVisibleCount: 8
    })} />);
    expect(container.querySelectorAll('.ig-editorial__photo')).toHaveLength(6);
    expect(container.querySelectorAll('.ig-editorial__extra .ig-editorial__photo')).toHaveLength(1);
  });
  it('respeta un listado vacío y desactivado aunque haya posts de respaldo', () => {
    const {
      container,
      rerender
    } = render(<InstagramSection theme={themeFor([])} posts={posts} />);
    expect(container).toBeEmptyDOMElement();
    rerender(<InstagramSection theme={themeFor(posts.map(p => ({
      ...p,
      enabled: false
    })))} posts={posts} />);
    expect(container).toBeEmptyDOMElement();
    rerender(<InstagramSection theme={{
      sections: []
    }} posts={posts} />);
    expect(container.querySelectorAll('.ig-editorial__photo')).toHaveLength(2);
  });
  it('limita valores del diseño para evitar tamaños inválidos', () => {
    expect(normalizeEditorial({
      editorialHeight: 9000,
      editorialMobileColumns: 0,
      editorialRadius: -1,
      editorialMotion: 'bad'
    })).toMatchObject({
      editorialHeight: 1600,
      editorialMobileColumns: 1,
      editorialRadius: 0,
      editorialMotion: 'lift'
    });
  });
  it('guarda posiciones y encuadre y permite reordenar sin cambiar los enlaces', () => {
    const save = vi.fn();
    render(<Harness save={save} />);
    contentTab('Publicaciones');
    fireEvent.change(screen.getAllByLabelText('Configurar esta publicación')[0], {
      target: {
        value: '2'
      }
    });
    fireEvent.change(screen.getAllByLabelText('Posición horizontal (%)')[0], {
      target: {
        value: '14'
      }
    });
    fireEvent.change(screen.getAllByLabelText('Configurar esta publicación')[0], {
      target: {
        value: '1'
      }
    });
    fireEvent.change(screen.getAllByLabelText('Acercamiento')[0], {
      target: {
        value: '1.3'
      }
    });
    fireEvent.click(screen.getAllByRole('button', {
      name: 'Mover después'
    })[0]);
    fireEvent.click(screen.getByRole('button', {
      name: 'Guardar'
    }));
    expect(save.mock.calls[0][0].sections[0].config.posts[1]).toMatchObject({
      ...posts[0],
      editorialX: 14,
      imageScale: 1.3
    });
  });
  it('una carga pendiente conserva otras ediciones y sigue a su publicación al cambiar de pestaña', async () => {
    let finish;
    const upload = vi.fn(() => new Promise(resolve => {
      finish = resolve;
    }));
    const save = vi.fn();
    render(<Harness save={save} upload={upload} />);
    contentTab('Publicaciones');
    fireEvent.change(screen.getAllByLabelText('Subir imagen de la publicación')[0], {
      target: {
        files: [new File(['x'], 'a.png', {
          type: 'image/png'
        })]
      }
    });
    contentTab('Perfil');
    fireEvent.change(screen.getByLabelText('Usuario de Instagram'), {
      target: {
        value: '@editado'
      }
    });
    await act(async () => finish('/new.jpg'));
    fireEvent.click(screen.getByRole('button', {
      name: 'Guardar'
    }));
    expect(save.mock.calls[0][0].sections[0].config).toMatchObject({
      profileUser: '@editado',
      posts: [{
        ...posts[0],
        image: '/new.jpg'
      }, posts[1]]
    });
  });
  it('corrige los valores predeterminados anteriores sin sustituir ajustes personalizados', () => {
    const migrated = normalizeEditorial({
      editorialFont: 'Georgia, serif',
      editorialTitleSize: 290,
      editorialTitleTop: 0
    });
    expect(migrated.editorialFont).toContain('Bodoni Moda');
    expect(normalizeEditorial({
      editorialFont: 'Arial, sans-serif',
      editorialTitleSize: 180
    })).toMatchObject({
      editorialFont: 'Arial, sans-serif',
      editorialTitleSize: 180
    });
    expect(normalizeEditorial({
      editorialRevision: 2,
      editorialFont: 'Georgia, serif'
    }).editorialFont).toBe('Georgia, serif');
  });
  it('muestra cinco fotos sin eliminar las demás y permite elegir la principal', () => {
    const list = Array.from({
      length: 6
    }, (_, i) => ({
      ...posts[0],
      id: String(i)
    }));
    const theme = themeFor(list);
    const {
      container,
      rerender
    } = render(<InstagramSection theme={theme} />);
    expect(container.querySelectorAll('.ig-editorial__photo')).toHaveLength(5);
    expect(theme.sections[0].config.posts).toHaveLength(6);
    expect(container.querySelector('[data-post-id="4"]').style.getPropertyValue('--photo-x')).toBe('41%');
    rerender(<InstagramSection theme={themeFor(list, {
      editorialFeaturedPostId: '0'
    })} />);
    expect(container.querySelector('[data-post-id="0"]').style.getPropertyValue('--photo-x')).toBe('41%');
    expect(container.querySelector('[data-post-id="0"]').getAttribute('href')).toBe(posts[0].link);
  });
  it('el color antiguo del distintivo no contamina el botón del nuevo diseño', () => {
    const {
      container
    } = render(<InstagramSection theme={themeFor(posts, {
      profileBadgeTextColor: '#ff00ff'
    })} />);
    expect(container.querySelector('.ig-editorial').style.getPropertyValue('--ig-button-text')).toBe('#790d2d');
  });
});
