import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import OrderReturnsPage from './OrderReturnsPage';
import { storeOrderReturnAccess } from '../utils/orderReturnAccess';

const ORDER_ID = '64c000000000000000000001';
const LINE_ID = '64c000000000000000000101';

vi.mock('../components/Header', () => ({ default: () => <div>Header</div> }));
vi.mock('../components/FooterSection', () => ({ default: () => <div>Footer</div> }));

function payload(returns = []) {
  return {
    ok: true,
    order: { id: ORDER_ID, orderNumber: '000123' },
    policy: {
      enabled: true,
      customerPortalEnabled: true,
      windowDays: 30,
      allowedResolutions: ['exchange', 'store_credit'],
      requireReasonText: true,
      policyText: 'Puedes solicitar cambios desde la entrega.',
    },
    eligibility: [{
      orderItemId: LINE_ID,
      title: 'Tenis Plus',
      availableQuantity: 1,
      eligible: true,
      eligibleUntil: '2026-09-20T12:00:00.000Z',
    }],
    returns,
  };
}

describe('OrderReturnsPage', () => {
  beforeEach(() => {
    localStorage.clear();
    storeOrderReturnAccess({
      orderId: ORDER_ID,
      token: 'return-access-token',
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('permite al cliente crear una solicitud con el token de una sola orden', async () => {
    const requests = [];
    vi.stubGlobal('fetch', vi.fn(async (_url, options = {}) => {
      requests.push(options);
      if (options.method === 'POST') {
        return {
          ok: true,
          json: async () => ({ returnCase: { returnNumber: 'RMA-000123-1' } }),
        };
      }
      return { ok: true, json: async () => payload() };
    }));

    render(
      <MemoryRouter initialEntries={[`/devoluciones/${ORDER_ID}`]}>
        <Routes><Route path="/devoluciones/:orderId" element={<OrderReturnsPage />} /></Routes>
      </MemoryRouter>
    );

    await screen.findByText('Tenis Plus');
    fireEvent.change(screen.getByLabelText('Cantidad Tenis Plus'), { target: { value: '1' } });
    fireEvent.change(screen.getByLabelText('Motivo Tenis Plus'), { target: { value: 'wrong_size' } });
    fireEvent.change(screen.getByLabelText('Detalle Tenis Plus'), { target: { value: 'Necesito otra talla' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar solicitud' }));

    await screen.findByText(/Solicitud RMA-000123-1 creada correctamente/);
    const post = requests.find((options) => options.method === 'POST');
    expect(post.headers['X-Order-Return-Token']).toBe('return-access-token');
    expect(post.headers['Idempotency-Key']).toMatch(/^rma-v1-/);
    expect(post.headers['Idempotency-Key'].length).toBeGreaterThanOrEqual(8);
    expect(post.headers['Idempotency-Key'].length).toBeLessThanOrEqual(200);
    expect(JSON.parse(post.body)).toEqual(expect.objectContaining({
      requestedResolution: 'exchange',
      items: [expect.objectContaining({
        orderItemId: LINE_ID,
        quantity: 1,
        reasonCode: 'wrong_size',
        reasonText: 'Necesito otra talla',
      })],
    }));
    expect(JSON.parse(post.body)).not.toHaveProperty('idempotencyKey');
  });

  it('reutiliza la clave tras 5xx, rota con el payload y la limpia tras éxito', async () => {
    const postRequests = [];
    vi.stubGlobal('fetch', vi.fn(async (_url, options = {}) => {
      if (options.method === 'POST') {
        postRequests.push(options);
        if (postRequests.length <= 3) {
          return {
            ok: false,
            status: 503,
            json: async () => ({ message: 'Servicio temporalmente no disponible.' }),
          };
        }
        return {
          ok: true,
          json: async () => ({
            returnCase: { returnNumber: `RMA-000123-${postRequests.length}` },
          }),
        };
      }
      return { ok: true, json: async () => payload() };
    }));

    render(
      <MemoryRouter initialEntries={[`/devoluciones/${ORDER_ID}`]}>
        <Routes><Route path="/devoluciones/:orderId" element={<OrderReturnsPage />} /></Routes>
      </MemoryRouter>
    );

    await screen.findByText('Tenis Plus');
    fireEvent.change(screen.getByLabelText('Cantidad Tenis Plus'), { target: { value: '1' } });
    fireEvent.change(screen.getByLabelText('Motivo Tenis Plus'), { target: { value: 'wrong_size' } });
    fireEvent.change(screen.getByLabelText('Detalle Tenis Plus'), { target: { value: 'Necesito otra talla' } });

    fireEvent.click(screen.getByRole('button', { name: 'Enviar solicitud' }));
    await waitFor(() => expect(postRequests).toHaveLength(1));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Enviar solicitud' })).toBeEnabled());

    fireEvent.click(screen.getByRole('button', { name: 'Enviar solicitud' }));
    await waitFor(() => expect(postRequests).toHaveLength(2));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Enviar solicitud' })).toBeEnabled());

    fireEvent.change(screen.getByLabelText('Detalle Tenis Plus'), {
      target: { value: 'Necesito una talla diferente' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar solicitud' }));
    await waitFor(() => expect(postRequests).toHaveLength(3));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Enviar solicitud' })).toBeEnabled());

    fireEvent.click(screen.getByRole('button', { name: 'Enviar solicitud' }));
    await screen.findByText(/Solicitud RMA-000123-4 creada correctamente/);
    await screen.findByText('Tenis Plus');

    fireEvent.change(screen.getByLabelText('Cantidad Tenis Plus'), { target: { value: '1' } });
    fireEvent.change(screen.getByLabelText('Motivo Tenis Plus'), { target: { value: 'wrong_size' } });
    fireEvent.change(screen.getByLabelText('Detalle Tenis Plus'), {
      target: { value: 'Necesito una talla diferente' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar solicitud' }));
    await waitFor(() => expect(postRequests).toHaveLength(5));

    const keys = postRequests.map(
      (request) => request.headers['Idempotency-Key']
    );
    expect(keys[1]).toBe(keys[0]);
    expect(keys[2]).not.toBe(keys[1]);
    expect(keys[3]).toBe(keys[2]);
    expect(keys[4]).not.toBe(keys[3]);
    postRequests.forEach((request) => {
      expect(Object.keys(request.headers).sort()).toEqual([
        'Content-Type',
        'Idempotency-Key',
        'X-Order-Return-Token',
      ]);
      expect(JSON.parse(request.body)).not.toHaveProperty('idempotencyKey');
    });
    const persistedAccess = localStorage.getItem('order_return_access_v1') || '';
    keys.forEach((key) => expect(persistedAccess).not.toContain(key));
  });

  it('muestra trazabilidad y etiqueta cuando la devolución está autorizada', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => payload([{
        _id: '64c000000000000000000201',
        returnNumber: 'RMA-000123-2',
        status: 'authorized',
        revision: 1,
        requestedResolution: 'store_credit',
        requestedAt: '2026-08-24T12:00:00.000Z',
        shipping: { instructions: 'Lleva el paquete al punto autorizado.' },
        items: [{ orderItemId: LINE_ID, title: 'Tenis Plus', requestedQuantity: 1, reasonCode: 'wrong_size' }],
      }]),
    })));

    render(
      <MemoryRouter initialEntries={[`/devoluciones/${ORDER_ID}`]}>
        <Routes><Route path="/devoluciones/:orderId" element={<OrderReturnsPage />} /></Routes>
      </MemoryRouter>
    );

    await screen.findByText('Devolución autorizada');
    expect(screen.getByText('Lleva el paquete al punto autorizado.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Descargar etiqueta RMA' })).toBeEnabled();
    await waitFor(() => expect(screen.getByText('RMA-000123-2')).toBeInTheDocument());
  });

  it('abre directamente una etiqueta HTTPS emitida por la transportadora', async () => {
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => payload([{
        _id: '64c000000000000000000202',
        returnNumber: 'RMA-000123-3',
        status: 'authorized',
        revision: 1,
        requestedResolution: 'exchange',
        requestedAt: '2026-08-24T12:00:00.000Z',
        shipping: {
          labelUrl: 'https://carrier.example.invalid/labels/RMA-000123-3.pdf',
          instructions: 'Entrega el paquete en un punto autorizado.',
        },
        items: [{ orderItemId: LINE_ID, title: 'Tenis Plus', requestedQuantity: 1, reasonCode: 'wrong_size' }],
      }]),
    }));
    vi.stubGlobal('fetch', fetchMock);

    render(
      <MemoryRouter initialEntries={[`/devoluciones/${ORDER_ID}`]}>
        <Routes><Route path="/devoluciones/:orderId" element={<OrderReturnsPage />} /></Routes>
      </MemoryRouter>
    );

    await screen.findByText('RMA-000123-3');
    fireEvent.click(screen.getByRole('button', { name: 'Descargar etiqueta RMA' }));
    expect(open).toHaveBeenCalledWith(
      'https://carrier.example.invalid/labels/RMA-000123-3.pdf',
      '_blank',
      'noopener,noreferrer'
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('explica una política especial sin mostrar señales internas de fraude', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({
        ...payload(),
        eligibility: [{
          ...payload().eligibility[0],
          policyRuleName: 'Tecnología de alto valor',
          policyWindowDays: 10,
          policyManualReview: true,
          requireReasonText: true,
          allowedResolutions: ['exchange'],
        }],
      }),
    })));

    render(
      <MemoryRouter initialEntries={[`/devoluciones/${ORDER_ID}`]}>
        <Routes><Route path="/devoluciones/:orderId" element={<OrderReturnsPage />} /></Routes>
      </MemoryRouter>
    );

    await screen.findByText(/Política: Tecnología de alto valor · 10 días · requiere revisión/);
    fireEvent.change(screen.getByLabelText('Cantidad Tenis Plus'), { target: { value: '1' } });
    expect(screen.getByText(/Tu solicitud será revisada por el equipo/)).toBeInTheDocument();
    expect(document.body.textContent).not.toContain('score');
    expect(document.body.textContent).not.toContain('frequent_return_requests');
  });
});
