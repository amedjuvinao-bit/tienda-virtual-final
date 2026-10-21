import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import StorefrontSectionPreview from './StorefrontSectionPreview';
import { normalizeInfoGlass } from '../info/infoGlassHelpers';
import { ModalShell } from './SectionsPanelUI';

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

const section = { id: 'informacion', enabled: true, config: {} };
const theme = { sections: [section] };

describe('vista previa responsive de Información', () => {
  it('permite cambiar entre móvil, tablet y escritorio y encaja toda la sección en el espacio disponible', async () => {
    let measure;
    vi.stubGlobal('innerWidth', 1440);
    vi.stubGlobal('ResizeObserver', class { constructor(callback) { measure = callback; } observe() {} disconnect() {} });
    const original = window.getComputedStyle;
    vi.spyOn(window, 'getComputedStyle').mockImplementation((el, ...args) => el.classList.contains('section-real-preview__viewport')
      ? { maxHeight: '500px' } : original.call(window, el, ...args));
    const { container } = render(<StorefrontSectionPreview section={section} theme={theme} />);
    await screen.findByRole('heading', { name: 'Envíos a todo el país' });
    const viewport = container.querySelector('.section-real-preview__viewport');
    const canvas = container.querySelector('.section-real-preview__canvas');
    Object.defineProperty(viewport, 'clientWidth', { configurable: true, value: 600 });
    Object.defineProperty(canvas, 'scrollHeight', { configurable: true, value: 1100 });
    const devices = within(screen.getByRole('group', { name: 'Dispositivo de vista previa' }));
    for (const [label, width] of [['Vista móvil',390],['Vista tablet',768],['Vista escritorio',1280]]) {
      fireEvent.click(devices.getByRole('button', { name: label, exact: true }));
      act(() => measure());
      expect(canvas).toHaveStyle({ width: width + 'px' });
      expect(devices.getByRole('button', { name: label, exact: true })).toHaveAttribute('aria-pressed', 'true');
      expect(parseFloat(container.querySelector('.section-real-preview__stage').style.height)).toBeLessThanOrEqual(500);
    }
    expect(container.querySelector('.section-real-preview')).toHaveClass('section-real-preview--fit');
  });

  it('deja probar el detalle de un bloque en la vista previa', async () => {
    const onClose = vi.fn();
    render(<ModalShell title="Editor de Información" onClose={onClose}><StorefrontSectionPreview section={section} theme={theme} /></ModalShell>);
    fireEvent.click(await screen.findByRole('button', { name: 'Consultar envíos' }));
    expect(screen.getByRole('dialog', { name: 'Envíos a todo el país' })).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Envíos a todo el país' })).not.toBeInTheDocument());
    expect(screen.getByRole('dialog', { name: 'Editor de Información' })).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('actualiza las medidas móviles predeterminadas anteriores y conserva las personalizadas', () => {
    expect(normalizeInfoGlass({ glass: { mobileCardHeight:310, mobileIconSize:90 } })).toMatchObject({ mobileLayout:'compact', mobileCardHeight:160, mobileIconSize:72 });
    expect(normalizeInfoGlass({ glass: { mobileCardHeight:245, mobileIconSize:66 } })).toMatchObject({ mobileCardHeight:245, mobileIconSize:66 });
    expect(normalizeInfoGlass({ glass: { mobileLayout:'cards', mobileCardHeight:310 } })).toMatchObject({ mobileLayout:'cards', mobileCardHeight:310 });
  });
});
