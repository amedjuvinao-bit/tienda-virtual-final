import React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import InstagramSection from '../../../../components/InstagramSection';
import InstagramSectionUI from './InstagramSectionUI';
import { journalIdentity, normalizeJournal } from './instagramJournalHelpers';

const posts = [{ id: 'one', image: '/post.jpg', link: 'https://instagram.com/p/one/' }];
const theme = config => ({ sections: [{ id: 'instagram', enabled: true, config: { posts, ...config } }] });
afterEach(cleanup);

describe('Instagram reutilizable para cualquier negocio', () => {
  it.each(['journal', 'editorial'])('no inventa una cuenta, una marca ni un eslogan en %s', instagramLayout => {
    const { container } = render(<InstagramSection theme={theme({ instagramLayout })} />);
    expect(container.textContent).not.toMatch(/Rosa|Boutique|Momentos que enamoran|Looks/);
    expect(screen.queryByRole('link', { name: 'Seguir en Instagram' })).not.toBeInTheDocument();
    expect(container.querySelector('.ig-journal__subtitle, .ig-editorial__subtitle')).toBeNull();
    if (instagramLayout === 'journal') {
      expect(container.querySelector('.ig-journal__avatar')).toHaveTextContent('IG');
      expect(screen.getByRole('img', { name: 'Publicación de Instagram' })).toBeInTheDocument();
    }
  });

  it.each([
    ['Café Norte', '@cafenorte', 'CN'],
    ['Centro Salud', '@centrosalud', 'CS'],
  ])('usa la identidad y los textos configurados de %s', (name, user, initials) => {
    const config = {
      journalName: name, profileUser: user, profileLink: 'https://instagram.com/negocio/',
      journalTitle: 'Nuestras novedades', journalSidebarTitle: 'Explora', journalSubtitle: 'Conoce nuestro equipo',
      journalFollowText: 'Visitar perfil', journalPostText: 'Abrir contenido',
      journalHighlights: [{ id: 'team', postId: 'one', title: 'Equipo' }],
    };
    const { container } = render(<InstagramSection theme={theme(config)} />);
    expect(screen.getByRole('heading', { name: /^Nuestras novedades/ })).toBeInTheDocument();
    expect(container.querySelector('.ig-journal__identity')).toHaveTextContent(name);
    expect(container.querySelector('.ig-journal__avatar')).toHaveTextContent(initials);
    expect(screen.getByRole('link', { name: user })).toHaveAttribute('href', config.profileLink);
    expect(screen.getByRole('link', { name: 'Visitar perfil' })).toHaveAttribute('href', config.profileLink);
    expect(screen.getByRole('link', { name: 'Abrir contenido: Publicación de Instagram' })).toHaveAttribute('href', posts[0].link);
    expect(screen.getByRole('button', { name: 'Ver destacado: Equipo' })).toBeInTheDocument();
    expect(screen.getByText(config.journalSubtitle)).toBeInTheDocument();
  });

  it('respeta textos personalizados y campos vacíos, y permite iniciales propias', () => {
    const config = { journalTitle: 'InstaGram', journalSidebarTitle: '', journalSubtitle: '', journalMonogram: 'XY' };
    expect(normalizeJournal(config)).toMatchObject(config);
    expect(journalIdentity({ ...config, journalName: 'Mi negocio' })).toMatchObject({ journalName: 'Mi negocio', journalMonogram: 'XY' });
  });

  it('el selector y los formularios no incluyen una marca de ejemplo', () => {
    const { container } = render(<InstagramSectionUI theme={theme({})} />);
    expect(screen.getByRole('option', { name: 'Perfil social · cristal' })).toHaveValue('journal');
    expect(container.textContent).not.toMatch(/El diario de Rosa|Rosa Boutique|una prenda/);
    expect(screen.getByLabelText('Usuario de Instagram')).toHaveAttribute('placeholder', '@tuusuario');
    expect(screen.getByLabelText('Nombre del perfil')).toHaveValue('');
    expect(screen.getByLabelText('Iniciales del avatar')).toHaveValue('');
    expect(screen.getByLabelText('Título de la sección')).toHaveValue('Instagram');
  });
});
