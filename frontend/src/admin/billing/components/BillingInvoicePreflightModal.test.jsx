import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import BillingInvoicePreflightModal from './BillingInvoicePreflightModal';

afterEach(cleanup);

// Fixture completamente ficticia: no representa a ninguna persona real.
const readyPreflight = {
  ready: true,
  fingerprint: 'a'.repeat(64),
  provider: 'factus',
  environment: 'habilitacion',
  blockers: [],
  warnings: [],
  customer: {
    personType: 'natural',
    documentType: 'CC',
    documentNumber: '0000000000',
    firstName: 'Fixture',
    lastName: 'Automatizada',
    email: 'fixture.modal@example.invalid',
    phone: '0000000001',
    address: 'DIRECCION FICTICIA SIN VALIDEZ',
    city: 'Bogotá, D.C.',
    department: 'Bogotá, D.C.',
    municipalityCode: '11001',
  },
  totals: {
    subtotal: 162900,
    totalDiscount: 0,
    taxAmount: 0,
    shipping: 0,
    total: 162900,
  },
  payload: {
    items: [
      {
        code_reference: 'QA50-022',
        name: 'Tableta Axis',
        quantity: 1,
        price: 162900,
      },
    ],
  },
};

describe('BillingInvoicePreflightModal', () => {
  it('muestra la fotografía fiscal y exige confirmación antes de emitir', () => {
    const onConfirm = vi.fn();
    render(
      <BillingInvoicePreflightModal
        open
        order={{ orderNumber: 'FM-PRECHECK-001' }}
        preflight={readyPreflight}
        onConfirm={onConfirm}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByRole('dialog', { name: /revisa antes de emitir/i })).toBeInTheDocument();
    expect(screen.getByText('0000000000')).toBeInTheDocument();
    expect(screen.getByText('Bogotá, D.C. · Bogotá, D.C.')).toBeInTheDocument();
    expect(screen.getByText('Tableta Axis')).toBeInTheDocument();

    const emitButton = screen.getByRole('button', { name: /confirmar y emitir/i });
    expect(emitButton).toBeDisabled();

    fireEvent.click(screen.getByRole('checkbox'));
    expect(emitButton).toBeEnabled();
    fireEvent.click(emitButton);
    expect(onConfirm).toHaveBeenCalledWith(readyPreflight);
  });

  it('explica el bloqueo fiscal y no permite emitir', () => {
    render(
      <BillingInvoicePreflightModal
        open
        order={{ orderNumber: 'FM-PRECHECK-002' }}
        preflight={{
          ...readyPreflight,
          ready: false,
          blockers: [
            {
              code: 'BILLING_FINAL_CONSUMER_MISMATCH',
              field: 'billing.documentNumber',
              message: 'El documento 222222222222 solo puede utilizarse cuando la orden está marcada expresamente como consumidor final.',
            },
          ],
        }}
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText('Emisión bloqueada')).toBeInTheDocument();
    expect(screen.getByText(/222222222222 solo puede utilizarse/i)).toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /confirmar y emitir/i })).toBeDisabled();
  });

  it('no se cierra accidentalmente al interactuar con su contenido', () => {
    const onClose = vi.fn();
    render(
      <BillingInvoicePreflightModal
        open
        order={{ orderNumber: 'FM-PRECHECK-003' }}
        preflight={readyPreflight}
        onConfirm={vi.fn()}
        onClose={onClose}
      />
    );

    fireEvent.mouseDown(screen.getByText('Comprador que recibirá Factus'));
    fireEvent.click(screen.getByText('Tableta Axis'));
    expect(onClose).not.toHaveBeenCalled();
  });
});
