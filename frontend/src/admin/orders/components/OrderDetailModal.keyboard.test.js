import { createElement } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import OrderDetailModal, {
  isolateOrderDetailKeyboardEvent,
} from './OrderDetailModal';

vi.mock('../../../lib/api', () => ({
  default: {
    get: vi.fn().mockResolvedValue({ data: {} }),
  },
}));

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

      fireEvent.click(dialog);
      expect(onClose).toHaveBeenCalledTimes(1);
    } finally {
      window.removeEventListener('keydown', globalKeyDown);
    }
  });
});
