import React from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';

import { getPosBootstrap, getPosProducts } from '../api/adminPosApi';
import { getCurrentCashSession } from '../api/adminCashSessionApi';
import PosSalesPageSafe from './PosSalesPageSafe';

vi.mock('../api/adminPosApi', () => ({ getPosBootstrap: vi.fn(), getPosProducts: vi.fn() }));
vi.mock('../api/adminCashSessionApi', () => ({ getCurrentCashSession: vi.fn() }));
vi.mock('./PosOperationsPanel', () => ({ default: () => null }));
vi.mock('./PosCheckoutPanel', () => ({ default: () => null }));
vi.mock('./PosSaleReviewModal', () => ({ default: () => null }));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

it('muestra productos mientras consulta la caja una sola vez', async () => {
  const branch = { id: 'sede-1', name: 'Principal', settings: { requireCashSessionForPos: true } };
  let resolveCash;
  getPosBootstrap.mockResolvedValue({ branches: [branch], defaultBranch: branch, paymentMethods: [{ key: 'cash', label: 'Efectivo' }] });
  getPosProducts.mockResolvedValue({ products: [{ id: 'producto-1', title: 'Producto disponible', price: 10000, availableStock: 2 }] });
  getCurrentCashSession.mockImplementation(() => new Promise((resolve) => { resolveCash = resolve; }));

  render(<MemoryRouter><PosSalesPageSafe /></MemoryRouter>);

  expect(await screen.findByText('Producto disponible')).toBeInTheDocument();
  expect(getPosProducts).toHaveBeenCalledWith({ branchId: branch.id, q: '', limit: 30 });
  expect(getCurrentCashSession).toHaveBeenCalledTimes(1);
  resolveCash({ session: { id: 'caja-1', status: 'open', salesSummary: {} } });
  await waitFor(() => expect(screen.getByText(/Caja abierta/)).toBeInTheDocument());
});
