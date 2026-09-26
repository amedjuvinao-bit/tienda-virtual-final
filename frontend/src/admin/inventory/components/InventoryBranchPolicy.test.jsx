import React from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import api from '../../../lib/api';
import InventoryAdjustmentModal from './InventoryAdjustmentModal';
import InventoryTransferModal from './InventoryTransferModal';

vi.mock('../../../lib/api', () => ({ default: { get: vi.fn(), post: vi.fn() } }));

const disabledId = '64b000000000000000000101';
const enabledId = '64b000000000000000000102';
const productId = '64b000000000000000000201';
const branches = [
  { _id: disabledId, name: 'Bodega deshabilitada', active: true, status: 'active', settings: { allowInventoryMovements: false } },
  { _id: enabledId, name: 'Bodega habilitada', active: true, status: 'active', settings: { allowInventoryMovements: true } },
];
const stockRows = branches.map((branch, index) => ({
  _id: `64b00000000000000000030${index}`,
  product: { _id: productId, title: 'Producto de prueba', sku: 'PRUEBA' },
  branch,
  variant: { size: 'M', color: 'Azul' },
  stock: 8,
  availableStock: 8,
  reservedStock: 0,
}));

beforeEach(() => {
  vi.clearAllMocks();
  api.get.mockImplementation(async (url) => {
    if (url === '/api/products') {
      return { data: [{ _id: productId, title: 'Producto de prueba', sku: 'PRUEBA' }] };
    }
    return { data: { data: branches } };
  });
});
afterEach(cleanup);

it('solo permite elegir sedes habilitadas en el formulario de ajustes', async () => {
  render(<InventoryAdjustmentModal open onClose={() => {}} stockRows={stockRows} />);

  await waitFor(() => expect(screen.getByRole('option', { name: 'Bodega habilitada' })).toBeInTheDocument());
  expect(screen.queryByRole('option', { name: 'Bodega deshabilitada' })).not.toBeInTheDocument();
});

it('excluye la sede deshabilitada como origen y destino de un traslado', async () => {
  render(<InventoryTransferModal open onClose={() => {}} stockRows={stockRows} />);

  await waitFor(() => expect(screen.getByRole('option', { name: 'Bodega habilitada' })).toBeInTheDocument());
  expect(screen.queryByRole('option', { name: /Bodega deshabilitada/ })).not.toBeInTheDocument();
});
