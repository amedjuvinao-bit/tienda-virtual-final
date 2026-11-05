import '@testing-library/jest-dom/vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it } from 'vitest';
import SocialContentPrivacy, { isStoreMedia } from './SocialContentPrivacy';
import InstagramSection from '../InstagramSection';
import TiktokSection from '../TiktokSection';
import { getPrivacyPreference, savePrivacyPreference, PRIVACY_PREFERENCES_KEY as key } from '../../lib/privacyPreferences';
import { isSocialMediaFile, storeSocialMedia } from '../../lib/socialMediaDelivery';
import JournalReelPlayer from '../instagram/JournalReelPlayer';

const own = '/instagram/journal-satin.webp';
const external = 'https://www.instagram.com/optional.jpg';
const ig = layout => ({ sections: [{ id: 'instagram', enabled: true, config: { instagramLayout: layout,
  journalSource: 'manual', journalTitle: 'Nuestro diario', journalAvatarImage: external,
  journalHighlights: [{ id: 'h1', postId: 'own', title: 'Colección', image: external }],
  posts: [{ id: 'own', image: own, alt: 'Foto propia' }, { id: 'external', image: external, alt: 'Foto externa' }] } }] });
const tk = layout => ({ sections: [{ id: 'tiktok', enabled: true, config: { stageLayout: layout, stageSource: 'manual',
  posts: [{ id: 'one', title: 'Nuestra colección', image: own, tiktokId: '1234567890123456789', link: 'https://www.tiktok.com/@store/video/1234567890123456789' }] } }] });
const mount = content => render(<SocialContentPrivacy>{content}</SocialContentPrivacy>);
beforeEach(() => localStorage.clear());
afterEach(() => { cleanup(); localStorage.clear(); window.dispatchEvent(new StorageEvent('storage', { key })); });

it('identifica archivos propios sin aceptar dominios parecidos o protocolos ajenos', () => {
  for (const url of [own, 'https://res.cloudinary.com/store/image/upload/own.jpg']) expect(isStoreMedia(url)).toBe(true);
  for (const url of [external, 'https://res.cloudinary.com.evil.test/a', 'https://res.cloudinary.com@evil.test/a', 'javascript:alert(1)', '//www.tiktok.com/a']) expect(isStoreMedia(url)).toBe(false);
});
for (const layout of ['journal', 'editorial']) it(`conserva el diseño ${layout} y las fotos propias antes de autorizar redes`, () => {
  const { container } = mount(<InstagramSection theme={ig(layout)} />);
  expect(screen.getByRole('region', { name: 'Instagram de la tienda' })).toBeInTheDocument();
  expect(container.querySelector(`img[src="${own}"]`)).not.toBeNull();
  expect(container.querySelector('img[src^="https:"]')).toBeNull();
  act(() => savePrivacyPreference({ social: true, maps: false }));
  expect(container.querySelector(`img[src="${external}"]`)).not.toBeNull();
  act(() => savePrivacyPreference({ social: false, maps: false }));
  expect(container.querySelector('img[src^="https:"]')).toBeNull();
  expect(screen.getByRole('region', { name: 'Instagram de la tienda' })).toBeInTheDocument();
});
it('permite un reproductor mediante una decisión explícita sin cambiar la elección del mapa', () => {
  act(() => savePrivacyPreference({ social: false, maps: true }));
  const { container } = mount(<TiktokSection theme={tk('stage')} />);
  expect(screen.getByRole('region', { name: 'Videos de TikTok' })).toBeInTheDocument();
  expect(container.querySelector(`img[src="${own}"]`)).not.toBeNull();
  expect(container.querySelector('iframe,video')).toBeNull();
  expect(screen.getByRole('button', { name: 'Pantalla completa' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Reproducir: Nuestra colección' }));
  expect(container.querySelector('iframe,video')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Permitir redes' }));
  expect(getPrivacyPreference().choices).toEqual({ social: true, maps: true });
  expect(screen.getByTitle('Video de TikTok: Nuestra colección')).toBeInTheDocument();
  act(() => savePrivacyPreference({ social: false, maps: true }));
  expect(container.querySelector('iframe,video')).toBeNull();
  expect(screen.getByRole('region', { name: 'Videos de TikTok' })).toBeInTheDocument();
});
it('muestra las mismas fotos de las redes desde el backend antes y después de rechazar, sin cuadros de cristal', () => {
  const source = 'https://scontent.cdninstagram.com/photo.jpg?signature=public';
  for (const layout of ['journal', 'editorial']) {
    const theme = ig(layout); theme.sections[0].config.posts = [{ id: 'one', image: source, alt: 'La misma foto' }];
    theme.sections[0].config.journalAvatarImage = source; theme.sections[0].config.journalHighlights = [];
    const { container, unmount } = mount(<InstagramSection theme={theme} />);
    expect(container.querySelector('img')).toHaveAttribute('src', storeSocialMedia(source));
    expect(container.querySelector('[data-privacy-placeholder]')).toBeNull();
    act(() => savePrivacyPreference({ social: false, maps: false }));
    expect(container.querySelector('img')).toHaveAttribute('src', storeSocialMedia(source));
    expect(container.querySelector('.privacy-social-note')).toBeNull();
    unmount();
  }
});
it('conserva los controles del reel de Instagram y sirve su video por el backend sin permiso social', () => {
  const source = 'https://video.cdninstagram.com/reel.mp4';
  const { container } = mount(<JournalReelPlayer post={{ image: own, alt: 'Reel propio' }} src={source} onExpand={() => {}} />);
  expect(container.querySelector('video')).toHaveAttribute('src', storeSocialMedia(source, 'video'));
  expect(screen.getByRole('button', { name: 'Reproducir reel', exact: true })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Ampliar reel' })).toBeInTheDocument();
});
it('reconoce archivos CDN y rechaza páginas, reproductores y dominios similares', () => {
  expect(isSocialMediaFile('https://p16-sign-sg.tiktokcdn.com/cover.jpg')).toBe(true);
  for (const value of [external, 'https://www.tiktok.com/player/v1/123', 'https://cdninstagram.com.evil.test/a', 'https://cdninstagram.com@evil.test/a', 'https://scontent.cdninstagram.com/a?access_token=private']) expect(isSocialMediaFile(value)).toBe(false);
});
it('cerrar la solicitud de TikTok conserva la tarjeta y no concede autorización', () => {
  const { container } = mount(<TiktokSection theme={tk('stage')} />);
  fireEvent.click(screen.getByRole('button', { name: 'Reproducir: Nuestra colección' }));
  fireEvent.click(screen.getByRole('button', { name: 'Ahora no' }));
  expect(getPrivacyPreference()).toBeNull();
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(container.querySelector('iframe')).toBeNull();
  expect(screen.getByRole('button', { name: 'Pantalla completa' })).toBeInTheDocument();
});
it('cancelar la reproducción solicitada al elegir una tarjeta no deja un inicio automático pendiente', () => {
  const { container } = mount(<TiktokSection theme={tk('stage')} />);
  fireEvent.click(screen.getByRole('button', { name: 'Seleccionar video: Nuestra colección' }));
  fireEvent.click(screen.getByRole('button', { name: 'Ahora no' }));
  act(() => savePrivacyPreference({ social: true, maps: false }));
  expect(container.querySelector('iframe')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Reproducir: Nuestra colección' }));
  expect(screen.getByTitle('Video de TikTok: Nuestra colección')).toBeInTheDocument();
});
it('mantiene las tarjetas antiguas y evita que pasar el mouse cargue un iframe sin permiso', () => {
  const { container } = mount(<TiktokSection theme={tk('legacy')} />);
  const link = container.querySelector('a.group');
  expect(link).not.toBeNull();
  fireEvent.mouseEnter(link);
  expect(container.querySelector('iframe,video')).toBeNull();
  expect(container.querySelector(`img[src="${own}"]`)).not.toBeNull();
});
it('mantiene la vista previa del editor y sus imágenes sin aplicar el control público', () => {
  const { container } = render(<InstagramSection theme={ig('journal')} />);
  expect(container.querySelector(`img[src="${external}"]`)).not.toBeNull();
  expect(screen.queryByRole('button', { name: 'Gestionar redes' })).not.toBeInTheDocument();
});
