import React, { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import InstagramJournal from './InstagramJournal';
import InstagramJournalUI from '../../admin/appearance/sections/instagram/InstagramJournalUI';

const posts = ['one', 'two'].map(id => ({ id, image: `/${id}.jpg`, alt: id }));
const themeFor = config => ({ sections: [{ id: 'instagram', enabled: true, config: { posts, journalFeaturedPostId: 'one', ...config } }] });
let animate, notify, original;
beforeEach(() => {
  original = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'animate');
  animate = vi.fn(() => ({ cancel: vi.fn() }));
  Object.defineProperty(HTMLElement.prototype, 'animate', { configurable: true, value: animate });
  vi.stubGlobal('IntersectionObserver', class { constructor(callback) { notify = callback; } observe() {} disconnect() {} });
});
afterEach(() => {
  cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks();
  if (original) Object.defineProperty(HTMLElement.prototype, 'animate', original); else delete HTMLElement.prototype.animate;
});
describe('movimiento e interacción de Instagram', () => {
  it('responde a cada clic, incluso en el círculo activo, y anima solamente el contenido de la imagen', () => {
    const { container } = render(<InstagramJournal theme={themeFor({})} />);
    const button = screen.getByRole('button', { name: 'Ver destacado: Destacado 2' });
    fireEvent.click(button);
    expect(button).toHaveAttribute('aria-pressed', 'true');
    expect(button.querySelector('.ig-journal__highlight-check')).not.toBeNull();
    const count = animate.mock.calls.length;
    fireEvent.click(button);
    expect(animate.mock.calls.length).toBeGreaterThan(count);
    expect(animate.mock.instances.every(element => element.matches('.ig-journal__highlight-ring,.ig-journal__highlight-wave,.ig-journal__media > *'))).toBe(true);
    expect(container.querySelector('.ig-journal__post--featured')).toHaveAttribute('data-post-id', 'two');
  });
  it.each([true, false])('restablece la principal al regresar solo cuando está configurado (%s)', reset => {
    const { container } = render(<InstagramJournal theme={themeFor({ journalResetOnEnter: reset })} />);
    act(() => notify([{ isIntersecting: true }]));
    fireEvent.click(screen.getByRole('button', { name: 'Ver destacado: Destacado 2' }));
    act(() => notify([{ isIntersecting: false }]));
    act(() => notify([{ isIntersecting: true }]));
    expect(container.querySelector('.ig-journal__post--featured')).toHaveAttribute('data-post-id', reset ? 'one' : 'two');
  });
  it.each(['disabled', 'reduced'])('mantiene el cambio de publicación sin movimiento en modo %s', mode => {
    if (mode === 'reduced') vi.stubGlobal('matchMedia', () => ({ matches: true }));
    render(<InstagramJournal theme={themeFor({ journalMotionEnabled: mode !== 'disabled' })} />);
    fireEvent.click(screen.getByRole('button', { name: 'Ver destacado: Destacado 2' }));
    expect(screen.getByLabelText('Publicación principal').querySelector('article')).toHaveAttribute('data-post-id', 'two');
    expect(animate).not.toHaveBeenCalled();
  });
  it('guarda el estilo y la duración desde grupos cortos del panel', () => {
    let saved;
    function Editor() {
      const [theme, setTheme] = useState(themeFor({})); saved = theme;
      return <InstagramJournalUI theme={theme} setPath={(_path, sections) => setTheme({ sections })} />;
    }
    render(<Editor />);
    fireEvent.click(within(screen.getByRole('navigation', { name: 'Pasos de edición' })).getByRole('button', { name: /Diseño/ }));
    fireEvent.click(within(screen.getByRole('navigation', { name: 'Diseño de Instagram' })).getByRole('button', { name: 'Animaciones' }));
    fireEvent.change(screen.getByLabelText('Transición de la publicación principal'), { target: { value: 'focus' } });
    fireEvent.change(screen.getByLabelText('Duración de las animaciones (ms)'), { target: { value: '650' } });
    fireEvent.change(screen.getByLabelText('Editar animaciones'), { target: { value: '1' } });
    fireEvent.change(screen.getByLabelText('Animación de los destacados'), { target: { value: 'tilt' } });
    expect(saved.sections[0].config).toMatchObject({ journalMotion: 'focus', journalMotionDuration: 650, journalHighlightMotion: 'tilt', posts });
  });
});
