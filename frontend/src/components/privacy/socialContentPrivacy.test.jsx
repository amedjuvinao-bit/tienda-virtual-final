import '@testing-library/jest-dom/vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it } from 'vitest';
import SocialContentPrivacy, { isStoreMedia } from './SocialContentPrivacy';
import InstagramSection from '../InstagramSection';
import TiktokSection from '../TiktokSection';
import { getPrivacyPreference, savePrivacyPreference, PRIVACY_PREFERENCES_KEY as key } from '../../lib/privacyPreferences';

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
  fireEvent.click(screen.getByRole('button', { name: 'Ver video: Nuestra colección' }));
  expect(container.querySelector('iframe,video')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Permitir redes' }));
  expect(getPrivacyPreference().choices).toEqual({ social: true, maps: true });
  expect(screen.getByTitle('Video de TikTok: Nuestra colección')).toBeInTheDocument();
  act(() => savePrivacyPreference({ social: false, maps: true }));
  expect(container.querySelector('iframe,video')).toBeNull();
  expect(screen.getByRole('region', { name: 'Videos de TikTok' })).toBeInTheDocument();
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
