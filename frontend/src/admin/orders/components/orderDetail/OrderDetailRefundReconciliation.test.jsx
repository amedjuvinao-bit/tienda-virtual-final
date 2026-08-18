import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import OrderDetailRefundReconciliation from './OrderDetailRefundReconciliation';

const refund = {
  _id: 'refund-1',
  refundNumber: 'RF-ORD-1',
  amount: 45000,
  processedAt: '2026-08-13T12:00:00.000Z',
  reconciliation: {
    state: 'action_required',
    inventory: { state: 'completed' },
    payment: { state: 'action_required' },
    cash: { state: 'completed' },
    billing: { state: 'action_required' },
  },
};

afterEach(() => cleanup());

describe('conciliación comercial de devoluciones', () => {
  it('expone las cuatro etapas y nunca presenta una devolución incompleta como cerrada', () => {
    render(<OrderDetailRefundReconciliation refunds={[refund]} />);

    expect(screen.getByText('Inventario')).toBeInTheDocument();
    expect(screen.getByText('Dinero')).toBeInTheDocument();
    expect(screen.getByText('Caja')).toBeInTheDocument();
    expect(screen.getByText('Nota crédito')).toBeInTheDocument();
    expect(screen.getAllByText('Requiere acción')).toHaveLength(3);
  });

  it('exige referencia antes de confirmar la salida del dinero', () => {
    const onConfirmPayment = vi.fn();
    render(
      <OrderDetailRefundReconciliation
        refunds={[refund]}
        canConfirmPayment
        onConfirmPayment={onConfirmPayment}
      />
    );

    const button = screen.getByRole('button', { name: 'Confirmar dinero devuelto' });
    expect(button).toBeDisabled();

    fireEvent.change(
      screen.getByRole('textbox', { name: 'Referencia devolución RF-ORD-1' }),
      { target: { value: 'REVERSO-4581' } }
    );
    fireEvent.click(button);

    expect(onConfirmPayment).toHaveBeenCalledWith(refund, 'REVERSO-4581');
  });

  it('permite automatizar las etapas compatibles sin ocultar la salida manual', () => {
    const onAutomate = vi.fn();
    render(
      <OrderDetailRefundReconciliation
        refunds={[refund]}
        canConfirmPayment
        canAutomate
        onAutomate={onAutomate}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Automatizar cierre' }));

    expect(onAutomate).toHaveBeenCalledWith(refund);
    expect(
      screen.getByRole('button', { name: 'Confirmar dinero devuelto' })
    ).toBeInTheDocument();
  });
});
