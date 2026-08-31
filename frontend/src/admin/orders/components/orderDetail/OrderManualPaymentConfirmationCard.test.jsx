import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import OrderManualPaymentConfirmationCard from './OrderManualPaymentConfirmationCard';
import OrderManualPaymentEvidence from './OrderManualPaymentEvidence';

const VALIDATION = {
  valid: false,
  errors: {
    reference: 'Registra una referencia comprobable de al menos 4 caracteres.',
    reason: 'Explica el motivo en al menos 8 caracteres.',
    verified: 'Confirma que verificaste el comprobante y el monto.',
  },
};

const MANUAL_ORDER = {
  _id: 'order-1',
  status: 'pending',
  payment: { provider: 'manual', status: 'pending_manual', amount: 250000, currency: 'COP' },
};

function controller(overrides = {}) {
  return {
    eligible: true,
    form: {
      method: 'transfer',
      reference: '',
      amount: 250000,
      currency: 'COP',
      reason: '',
      verified: false,
    },
    setField: vi.fn(),
    submit: vi.fn(),
    submitting: false,
    validation: VALIDATION,
    ...overrides,
  };
}

afterEach(() => cleanup());

describe('formulario accesible de pago manual', () => {
  it('no aparece sin permiso ni para una orden no elegible', () => {
    const { rerender } = render(
      <OrderManualPaymentConfirmationCard
        canConfirmManualPayment={false}
        controller={controller()}
        order={MANUAL_ORDER}
      />
    );
    expect(screen.queryByRole('form', { name: /confirmación manual/i })).not.toBeInTheDocument();

    rerender(
      <OrderManualPaymentConfirmationCard
        canConfirmManualPayment
        controller={controller({ eligible: false })}
        order={MANUAL_ORDER}
      />
    );
    expect(screen.queryByRole('form', { name: /confirmación manual/i })).not.toBeInTheDocument();

    rerender(
      <OrderManualPaymentConfirmationCard
        canConfirmManualPayment
        controller={controller({ eligible: true })}
        order={{
          ...MANUAL_ORDER,
          payment: { ...MANUAL_ORDER.payment, provider: 'wompi' },
        }}
      />
    );
    expect(screen.queryByRole('form', { name: /confirmación manual/i })).not.toBeInTheDocument();
  });

  it('usa allowlist, bloquea monto/moneda y exige confirmación explícita', () => {
    const state = controller();
    render(
      <OrderManualPaymentConfirmationCard
        canConfirmManualPayment
        controller={state}
        order={MANUAL_ORDER}
      />
    );

    expect(screen.getByRole('form', { name: 'Confirmación manual de pago' })).toBeInTheDocument();
    expect(screen.getAllByRole('option').map((option) => option.value)).toEqual([
      'cash', 'transfer', 'card', 'other',
    ]);
    expect(screen.getByLabelText(/^Monto exacto/)).toHaveAttribute('readonly');
    expect(screen.getByLabelText(/^Monto exacto/)).toHaveValue('250000');
    expect(screen.getByLabelText(/^Moneda/)).toHaveAttribute('readonly');
    expect(screen.getByRole('button', { name: 'Confirmar pago manual' })).toBeDisabled();

    fireEvent.change(screen.getByLabelText('Referencia del comprobante'), {
      target: { value: 'TRX-1' },
    });
    fireEvent.change(screen.getByLabelText('Motivo de la confirmación'), {
      target: { value: 'Pago conciliado' },
    });
    fireEvent.click(screen.getByLabelText(/confirmo que verifiqué/i));
    expect(state.setField).toHaveBeenNthCalledWith(1, 'reference', 'TRX-1');
    expect(state.setField).toHaveBeenNthCalledWith(2, 'reason', 'Pago conciliado');
    expect(state.setField).toHaveBeenNthCalledWith(3, 'verified', true);
  });

  it('expone errores de validación sin usar prompt', () => {
    render(
      <OrderManualPaymentConfirmationCard
        canConfirmManualPayment
        controller={controller({
          form: { ...controller().form, verified: true },
        })}
        order={MANUAL_ORDER}
      />
    );
    fireEvent.submit(screen.getByRole('form', { name: 'Confirmación manual de pago' }));
    expect(screen.getByText(/referencia comprobable/i)).toBeInTheDocument();
    expect(screen.getByText(/explica el motivo/i)).toBeInTheDocument();
  });

  it('muestra evidencia persistida en modo lectura', () => {
    render(<OrderManualPaymentEvidence order={{
      payment: {
        manualConfirmation: {
          evidence: 'evidence-1',
          method: 'cash',
          reference: 'CAJA-009',
          amount: 250000,
          currency: 'COP',
          reason: 'Efectivo contado y conciliado',
          actorLabel: 'Ana Admin',
          actorRole: 'billing',
          confirmedAt: '2026-08-27T10:00:00.000Z',
        },
      },
    }} />);
    expect(screen.getByRole('region', { name: 'Evidencia de pago manual' })).toHaveTextContent(
      'CAJA-009'
    );
    expect(screen.getByText(/efectivo contado/i)).toBeInTheDocument();
  });
});
