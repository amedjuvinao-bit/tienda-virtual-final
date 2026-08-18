import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  generate: vi.fn(),
  getPending: vi.fn(),
  getPreflight: vi.fn(),
}));

vi.mock('../../security/useAdminPermissions', () => ({
  default: () => ({ can: () => true }),
}));

vi.mock('../api/adminBillingApi', () => ({
  generateBillingInvoiceForOrder: state.generate,
  getBillingInvoicePreflight: state.getPreflight,
  getPendingBillingOrders: state.getPending,
}));

import BillingPendingOrdersPanel from './BillingPendingOrdersPanel';

const ORDER = {
  id: '000000000000000000000001',
  orderNumber: 'TST-BILLING-RECOVERY',
  customerName: 'Cliente de prueba',
  customerEmail: 'cliente@example.invalid',
  source: 'pos',
  itemsCount: 1,
  paymentStatus: 'paid',
  total: 90000,
};

const PREFLIGHT = {
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
    firstName: 'Cliente',
    lastName: 'Prueba',
    email: 'cliente@example.invalid',
    municipalityCode: '11001',
  },
  totals: { subtotal: 90000, total: 90000 },
  payload: {
    items: [
      { code_reference: 'PRUEBA-1', name: 'Producto de prueba', quantity: 1, price: 90000 },
    ],
  },
};

function DocumentsDestination() {
  const location = useLocation();
  return (
    <div>
      <p>Destino documentos</p>
      <p>{new URLSearchParams(location.search).get('q')}</p>
      <p>{location.state?.billingNotice}</p>
    </div>
  );
}

function renderPanel() {
  return render(
    <MemoryRouter initialEntries={['/admin/facturacion/ordenes']}>
      <Routes>
        <Route path="/admin/facturacion/ordenes" element={<BillingPendingOrdersPanel />} />
        <Route path="/admin/facturacion/documentos" element={<DocumentsDestination />} />
      </Routes>
    </MemoryRouter>
  );
}

async function reviewAndConfirm() {
  fireEvent.click(await screen.findByRole('button', { name: 'Revisar y emitir' }));
  fireEvent.click(await screen.findByRole('checkbox'));
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar y emitir' }));
}

describe('BillingPendingOrdersPanel', () => {
  beforeEach(() => {
    state.generate.mockReset();
    state.getPending.mockReset();
    state.getPreflight.mockReset();
    state.getPending.mockResolvedValue({ rows: [ORDER], total: 1, page: 1, pages: 1 });
  });

  afterEach(cleanup);

  it('abre Documentos filtrado por la factura después de una emisión exitosa', async () => {
    state.getPreflight.mockResolvedValue(PREFLIGHT);
    state.generate.mockResolvedValue({
      created: true,
      invoice: { invoiceNumber: 'SETP990015999', status: 'accepted' },
    });

    renderPanel();
    await reviewAndConfirm();

    expect(await screen.findByText('Destino documentos')).toBeInTheDocument();
    expect(screen.getByText('SETP990015999')).toBeInTheDocument();
    expect(screen.getByText('Factura SETP990015999 generada correctamente.')).toBeInTheDocument();
  });

  it('recupera una factura validada si la conexión vence después de crearla', async () => {
    state.getPreflight
      .mockResolvedValueOnce(PREFLIGHT)
      .mockResolvedValueOnce({
        ...PREFLIGHT,
        ready: false,
        existingInvoice: {
          number: 'SETP990015998',
          status: 'accepted',
          validated: true,
          inProgress: false,
        },
      });
    state.generate.mockRejectedValue(
      Object.assign(new Error('timeout of 60000ms exceeded'), {
        code: 'ECONNABORTED',
      })
    );

    renderPanel();
    await reviewAndConfirm();

    expect(await screen.findByText('Destino documentos')).toBeInTheDocument();
    expect(screen.getByText('SETP990015998')).toBeInTheDocument();
    expect(screen.getByText('Factura SETP990015998 validada correctamente.')).toBeInTheDocument();
    await waitFor(() => expect(state.getPreflight).toHaveBeenCalledTimes(2));
    expect(screen.queryByText(/timeout of/i)).not.toBeInTheDocument();
  });
});
