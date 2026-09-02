import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import PosCheckoutPanel from './PosCheckoutPanel';
import { createInitialDiscount, createInitialPaymentDetails } from './posCheckoutModel';

const paymentMethods = [
  { key: 'cash', label: 'Efectivo' },
  { key: 'transfer', label: 'Transferencia' },
  { key: 'card', label: 'Tarjeta / Datáfono' },
  { key: 'mixed', label: 'Pago mixto' },
];

afterEach(() => cleanup());

function props(overrides = {}) {
  return {
    subtotal: 28500,
    paymentMethods,
    paymentMethod: 'cash',
    paymentDetails: createInitialPaymentDetails(),
    discount: createInitialDiscount(),
    permissions: { canDiscount: true, canApproveDiscount: false },
    validationErrors: {},
    onPaymentMethodChange: vi.fn(),
    onPaymentDetailsChange: vi.fn(),
    onDiscountChange: vi.fn(),
    ...overrides,
  };
}

describe('PosCheckoutPanel', () => {
  it('presenta efectivo recibido y cambio como flujo principal', () => {
    render(<PosCheckoutPanel {...props()} />);

    expect(screen.getByText('Preparar cobro')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Ingresa el valor entregado')).toBeInTheDocument();
    expect(screen.getByText('Cambio')).toBeInTheDocument();
  });

  it('muestra soporte de tarjeta sin llenar la interfaz de opciones irrelevantes', () => {
    render(<PosCheckoutPanel {...props({ paymentMethod: 'card' })} />);

    expect(screen.getByPlaceholderText('Ej. DATAFONO-01')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Ej. AUTH-48291')).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('Ingresa el valor entregado')).not.toBeInTheDocument();
  });

  it('abre el descuento bajo demanda y conserva motivo obligatorio', () => {
    const onDiscountChange = vi.fn();
    render(<PosCheckoutPanel {...props({ onDiscountChange })} />);

    fireEvent.click(screen.getByRole('button', { name: /descuento comercial/i }));

    expect(screen.getByPlaceholderText('Motivo comercial obligatorio')).toBeInTheDocument();
    fireEvent.change(screen.getByDisplayValue('Sin descuento'), { target: { value: 'percent' } });
    expect(onDiscountChange).toHaveBeenCalledWith({ type: 'percent', value: '', reason: '' });
  });

  it('presenta distribución explícita cuando el pago es mixto', () => {
    render(<PosCheckoutPanel {...props({ paymentMethod: 'mixed' })} />);

    expect(screen.getByLabelText('Medio de pago 1')).toBeInTheDocument();
    expect(screen.getByLabelText('Medio de pago 2')).toBeInTheDocument();
    expect(screen.getByText('Agregar otro medio')).toBeInTheDocument();
    expect(screen.getByText(/Falta/)).toBeInTheDocument();
  });
});
