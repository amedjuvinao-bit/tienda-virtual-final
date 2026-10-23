import React, { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import InstagramSection from '../../../../components/InstagramSection';
import InstagramSectionUI from './InstagramSectionUI';
import { normalizeJournal } from './instagramJournalHelpers';
import { moveJournalGlass, resetJournalGlass } from '../../../../components/instagram/journalGlass';

const post = { id: 'one', image: '/one.jpg', alt: 'Vestido rosa', link: 'https://instagram.com/p/one/' };
const theme = { sections: [{ id: 'instagram', config: { posts: [post] } }] };
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
describe('Cristal con relieve del diario', () => {
  it('actualiza los acabados anteriores y conserva elecciones de material personalizadas', () => {
    expect(normalizeJournal({ journalCardOpacity: 78, journalShadow: 20, journalBlur: 14 })).toMatchObject({ journalCardOpacity: 52, journalShadow: 28, journalBlur: 18, journalGlassEnabled: true });
    expect(normalizeJournal({ journalCardOpacity: 64, journalShadow: 15, journalBlur: 6 })).toMatchObject({ journalCardOpacity: 64, journalShadow: 15, journalBlur: 6 });
    expect(normalizeJournal({ journalMaterialRevision: 1, journalCardOpacity: 78 })).toMatchObject({ journalCardOpacity: 78 });
  });
  it('mantiene las acciones y permite desactivar el acabado sin cambiar imágenes ni enlaces', () => {
    const { container, rerender } = render(<InstagramSection theme={theme} />);
    expect(container.querySelector('.ig-journal')).toHaveAttribute('data-glass', 'true');
    expect(container.querySelector('.ig-journal').style.getPropertyValue('--igj-glass-depth')).toBe('8px');
    expect(screen.getByRole('link', { name: 'Ver publicación: Vestido rosa' })).toHaveAttribute('href', post.link);
    rerender(<InstagramSection theme={{ sections: [{ ...theme.sections[0], config: { posts: [post], journalGlassEnabled: false } }] }} />);
    expect(container.querySelector('.ig-journal')).toHaveAttribute('data-glass', 'false');
    expect(screen.getByRole('button', { name: 'Guardar en este navegador' })).toBeInTheDocument();
  });
  it('guarda grosor, textura y reflejos desde los grupos cortos del editor', () => {
    const save = vi.fn();
    function Editor() { const [value, setValue] = useState(theme); return <><InstagramSectionUI theme={value} setPath={(key, v) => setValue(t => ({ ...t, [key]: v }))} /><button onClick={() => save(value)}>Guardar prueba</button></>; }
    render(<Editor />);
    fireEvent.click(within(screen.getByRole('navigation', { name: 'Pasos de edición' })).getByRole('button', { name: /Diseño/ }));
    fireEvent.click(within(screen.getByRole('navigation', { name: 'Diseño de Instagram' })).getByRole('button', { name: 'Cristal' }));
    fireEvent.change(screen.getByLabelText('Editar cristal'), { target: { value: '2' } });
    fireEvent.change(screen.getByLabelText('Grosor del canto de cristal (px)'), { target: { value: '12' } });
    fireEvent.change(screen.getByLabelText('Textura del cristal (%)'), { target: { value: '40' } });
    fireEvent.change(screen.getByLabelText('Editar cristal'), { target: { value: '3' } });
    fireEvent.change(screen.getByLabelText('Reflejos del cristal (%)'), { target: { value: '60' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar prueba' }));
    expect(save.mock.calls[0][0].sections[0].config).toMatchObject({ journalGlassDepth: 12, journalGlassTexture: 40, journalGlassReflection: 60, posts: [post] });
  });
  it('mueve la luz y perspectiva con límites estables y los limpia al salir', () => {
    vi.stubGlobal('matchMedia', vi.fn(query => ({ matches: !query.includes('prefers-reduced-motion') })));
    const root = document.createElement('div'); root.className = 'ig-journal'; Object.defineProperty(root, 'clientWidth', { value: 1280 });
    const el = document.createElement('article'); el.dataset.igjGlass = 'featured'; root.appendChild(el);
    el.getBoundingClientRect = vi.fn(() => ({ left: 100, top: 20, width: 200, height: 300 }));
    const event = { currentTarget: el, target: el, clientX: 150, clientY: 100, pointerType: 'mouse' };
    const settings = normalizeJournal({}); moveJournalGlass(event, settings);
    const first = el.style.getPropertyValue('--igj-pointer-y');
    moveJournalGlass({ ...event, clientX: 260 }, settings);
    expect(el.style.getPropertyValue('--igj-pointer-y')).not.toBe(first);
    expect(el.getBoundingClientRect).toHaveBeenCalledTimes(1);
    resetJournalGlass(event); expect(el.style.length).toBe(0);
  });
  it('respeta movimiento reducido, touch y controles desactivados', () => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true })));
    const el = document.createElement('article');
    const event = { currentTarget: el, target: el, clientX: 10, clientY: 10 };
    moveJournalGlass(event, normalizeJournal({}));
    moveJournalGlass({ ...event, pointerType: 'touch' }, normalizeJournal({}));
    moveJournalGlass(event, normalizeJournal({ journalGlassEnabled: false }));
    moveJournalGlass(event, normalizeJournal({ journalGlassInteractive: false }));
    expect(el.style.length).toBe(0);
  });
});
