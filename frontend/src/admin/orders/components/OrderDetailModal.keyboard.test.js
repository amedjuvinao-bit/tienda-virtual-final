import { createElement } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import OrderDetailModal, {
  isolateOrderDetailKeyboardEvent,
  isolateOrderDetailPointerEvent,
} from './OrderDetailModal';

vi.mock('../../../lib/api', () => ({
  default: {
    get: vi.fn().mockResolvedValue({ data: {} }),
  },
}));

afterEach(cleanup);

function keyboardEvent(overrides = {}) {
  return {
    key: '',
    defaultPrevented: false,
    isComposing: false,
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    target: null,
    ...overrides,
  };
}

describe('aislamiento de teclado del detalle de la orden', () => {
  it.each([
    ['Control', { key: 'Control', ctrlKey: true }],
    ['copiar', { key: 'c', ctrlKey: true }],
    ['pegar', { key: 'v', ctrlKey: true }],
    ['seleccionar', { key: 'a', ctrlKey: true }],
    ['Escape', { key: 'Escape' }],
  ])('detiene %s dentro del modal sin bloquear su acción normal', (_label, overrides) => {
    const stopPropagation = vi.fn();
    const preventDefault = vi.fn();
    const event = keyboardEvent({
      ...overrides,
      stopPropagation,
      preventDefault,
    });

    isolateOrderDetailKeyboardEvent(event);

    expect(stopPropagation).toHaveBeenCalledTimes(1);
    expect(preventDefault).not.toHaveBeenCalled();
  });

  it('mantiene abierto el modal real y evita que sus teclas lleguen a manejadores globales', () => {
    const onClose = vi.fn();
    const globalKeyDown = vi.fn();
    window.addEventListener('keydown', globalKeyDown);

    try {
      render(
        createElement(OrderDetailModal, {
          open: true,
          onClose,
          order: {
            _id: 'order-keyboard-test',
            orderNumber: 'ORD-KEYBOARD-TEST',
            status: 'paid',
            items: [],
            customer: {},
            billing: {},
          },
        })
      );

      const dialog = screen.getByRole('dialog');
      fireEvent.keyDown(dialog, { key: 'Control', ctrlKey: true });
      fireEvent.keyDown(dialog, { key: 'c', ctrlKey: true });
      fireEvent.keyDown(dialog, { key: 'v', ctrlKey: true });
      fireEvent.paste(dialog);
      fireEvent.keyDown(dialog, { key: 'Escape' });

      expect(onClose).not.toHaveBeenCalled();
      expect(globalKeyDown).not.toHaveBeenCalled();

      fireEvent.click(screen.getByRole('button', { name: 'Cerrar modal' }));
      expect(onClose).toHaveBeenCalledTimes(1);
    } finally {
      window.removeEventListener('keydown', globalKeyDown);
    }
  });

  it('oculta Gestionar cuando el perfil no tiene acciones administrativas', () => {
    render(
      createElement(OrderDetailModal, {
        open: true,
        onClose: vi.fn(),
        order: {
          _id: 'order-read-only-test',
          orderNumber: 'ORD-READ-ONLY-TEST',
          status: 'paid',
          items: [],
          customer: {},
          billing: {},
        },
      })
    );

    expect(
      screen.queryByRole('button', { name: 'Gestionar', exact: true })
    ).not.toBeInTheDocument();
  });

  it('no cierra al seleccionar con el mouse, usar clic derecho o pegar desde el menú contextual', () => {
    const onClose = vi.fn();
    const globalClick = vi.fn();
    const globalContextMenu = vi.fn();
    window.addEventListener('click', globalClick);
    window.addEventListener('contextmenu', globalContextMenu);

    try {
      render(
        createElement(OrderDetailModal, {
          open: true,
          onClose,
          order: {
            _id: 'order-pointer-test',
            orderNumber: 'ORD-POINTER-TEST',
            status: 'paid',
            items: [],
            customer: {},
            billing: {},
          },
        })
      );

      const dialog = screen.getByRole('dialog');
      fireEvent.pointerDown(dialog);
      fireEvent.mouseDown(dialog);
      fireEvent.mouseUp(dialog);
      fireEvent.pointerUp(dialog);
      fireEvent.contextMenu(dialog);
      fireEvent.paste(dialog);
      fireEvent.click(dialog);

      expect(onClose).not.toHaveBeenCalled();
      expect(globalClick).not.toHaveBeenCalled();
      expect(globalContextMenu).not.toHaveBeenCalled();
    } finally {
      window.removeEventListener('click', globalClick);
      window.removeEventListener('contextmenu', globalContextMenu);
    }
  });

  it('aísla cada evento de puntero sin bloquear la selección nativa', () => {
    const stopPropagation = vi.fn();
    const preventDefault = vi.fn();

    isolateOrderDetailPointerEvent({ stopPropagation, preventDefault });

    expect(stopPropagation).toHaveBeenCalledTimes(1);
    expect(preventDefault).not.toHaveBeenCalled();
  });
});
