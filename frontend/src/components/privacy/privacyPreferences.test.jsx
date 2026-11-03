import '@testing-library/jest-dom/vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import PrivacyPreferences from './PrivacyPreferences';
import ExternalContentGate from './ExternalContentGate';
import { getPrivacyPreference, openPrivacyPreferences, savePrivacyPreference, PRIVACY_PREFERENCES_KEY as key } from '../../lib/privacyPreferences';

function fixture(path = '/') {
  return render(<MemoryRouter initialEntries={[path]}>
    <button onClick={openPrivacyPreferences}>Cookies y preferencias</button>
    <ExternalContentGate category="social" title="Redes de la tienda"><iframe title="TikTok de prueba" src="https://www.tiktok.com/player/v1/test" /><img src="https://instagram.example.test/photo.jpg" alt="Publicación" /></ExternalContentGate>
    <ExternalContentGate category="maps"><iframe title="Mapa de prueba" src="https://www.openstreetmap.org/export/embed.html" /></ExternalContentGate>
    <PrivacyPreferences />
  </MemoryRouter>);
}
beforeEach(() => localStorage.clear());
afterEach(() => { cleanup(); localStorage.clear(); window.dispatchEvent(new StorageEvent('storage', { key })); vi.restoreAllMocks(); });

it('no monta imágenes ni iframes opcionales antes de elegir; rechazar conserva el bloqueo', () => {
  const view = fixture();
  expect(view.container.querySelector('iframe,img')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Rechazar opcionales' }));
  expect(screen.queryByRole('region', { name: 'Cookies y contenidos externos' })).not.toBeInTheDocument();
  expect(view.container.querySelector('iframe,img')).toBeNull();
  expect(getPrivacyPreference().choices).toEqual({ social: false, maps: false });
});
it('permite solo mapas y desmonta el contenido al retirar esa elección', () => {
  fixture();
  fireEvent.click(screen.getByRole('button', { name: 'Elegir preferencias' }));
  const dialog = screen.getByRole('dialog');
  expect(within(dialog).getAllByRole('switch').every(input => !input.checked)).toBe(true);
  fireEvent.click(within(dialog).getByRole('switch', { name: /Mapa interactivo/ }));
  fireEvent.click(within(dialog).getByRole('button', { name: 'Guardar mi elección' }));
  expect(screen.getByTitle('Mapa de prueba')).toBeInTheDocument();
  expect(screen.queryByTitle('TikTok de prueba')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Cookies y preferencias' }));
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Rechazar opcionales' }));
  expect(screen.queryByTitle('Mapa de prueba')).not.toBeInTheDocument();
});
it('aceptar habilita contenidos y una revocación entre pestañas los desmonta', () => {
  fixture();
  fireEvent.click(screen.getByRole('button', { name: 'Aceptar opcionales' }));
  expect(screen.getByTitle('TikTok de prueba')).toBeInTheDocument();
  const record = { ...getPrivacyPreference(), choices: { social: false, maps: false }, method: 'reject_optional' };
  act(() => {
    localStorage.setItem(key, JSON.stringify(record));
    window.dispatchEvent(new StorageEvent('storage', { key, newValue: JSON.stringify(record) }));
  });
  expect(screen.queryByTitle('TikTok de prueba')).not.toBeInTheDocument();
  expect(screen.queryByTitle('Mapa de prueba')).not.toBeInTheDocument();
});
it('Escape descarta una selección sin guardarla y devuelve el foco al botón de apertura', () => {
  fixture();
  const trigger = screen.getByRole('button', { name: 'Elegir preferencias' });
  trigger.focus(); fireEvent.click(trigger);
  const dialog = screen.getByRole('dialog');
  fireEvent.click(within(dialog).getAllByRole('switch')[0]);
  fireEvent.keyDown(dialog, { key: 'Escape' });
  expect(getPrivacyPreference()).toBeNull();
  expect(trigger).toHaveFocus();
  expect(screen.getByRole('region', { name: 'Cookies y contenidos externos' })).toBeInTheDocument();
});
it('el teclado permanece dentro del diálogo mientras está abierto', () => {
  fixture();
  fireEvent.click(screen.getByRole('button', { name: 'Elegir preferencias' }));
  const dialog = screen.getByRole('dialog');
  const close = within(dialog).getByRole('button', { name: 'Cerrar preferencias' });
  const last = within(dialog).getByRole('button', { name: 'Guardar mi elección' });
  last.focus(); fireEvent.keyDown(dialog, { key: 'Tab' }); expect(close).toHaveFocus();
  fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true }); expect(last).toHaveFocus();
});
it('no muestra el aviso ni el diálogo en el panel administrativo', () => {
  fixture('/admin/clientes');
  expect(screen.queryByRole('region', { name: 'Cookies y contenidos externos' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Cookies y preferencias' }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});
it('el permiso de redes no habilita mapas ni suscribe a correos comerciales', () => {
  fixture();
  act(() => savePrivacyPreference({ social: true, maps: false }));
  expect(screen.getByAltText('Publicación')).toBeInTheDocument();
  expect(screen.queryByTitle('Mapa de prueba')).not.toBeInTheDocument();
  expect(localStorage.getItem('newsletter')).toBeNull();
});
