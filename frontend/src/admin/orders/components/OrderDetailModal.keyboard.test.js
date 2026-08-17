import { describe, expect, it, vi } from 'vitest';
import { shouldCloseOrderDetailFromKeyboard } from './OrderDetailModal';

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

describe('protección de teclado del detalle de la orden', () => {
  it('no cierra el modal al copiar, pegar o seleccionar con el teclado', () => {
    const target = { closest: vi.fn(() => null) };

    expect(
      shouldCloseOrderDetailFromKeyboard(
        keyboardEvent({ key: 'c', ctrlKey: true, target })
      )
    ).toBe(false);
    expect(
      shouldCloseOrderDetailFromKeyboard(
        keyboardEvent({ key: 'v', ctrlKey: true, target })
      )
    ).toBe(false);
    expect(
      shouldCloseOrderDetailFromKeyboard(
        keyboardEvent({ key: 'a', ctrlKey: true, target })
      )
    ).toBe(false);
  });

  it('protege Escape cuando el foco permanece en un campo editable', () => {
    const target = { closest: vi.fn(() => ({ tagName: 'INPUT' })) };

    expect(
      shouldCloseOrderDetailFromKeyboard(
        keyboardEvent({ key: 'Escape', target })
      )
    ).toBe(false);
  });

  it('conserva Escape como cierre cuando no se está editando', () => {
    const target = { closest: vi.fn(() => null) };

    expect(
      shouldCloseOrderDetailFromKeyboard(
        keyboardEvent({ key: 'Escape', target })
      )
    ).toBe(true);
  });
});
