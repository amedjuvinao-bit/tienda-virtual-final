import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../api/adminCustomersApi', () => ({
  createAdminCustomerSavedSegment: vi.fn(),
  deleteAdminCustomerSavedSegment: vi.fn(),
  getAdminCustomerSavedSegments: vi.fn(),
}));

import {
  createAdminCustomerSavedSegment,
  deleteAdminCustomerSavedSegment,
  getAdminCustomerSavedSegments,
} from '../api/adminCustomersApi';
import CustomerSavedSegments from './CustomerSavedSegments';

afterEach(() => cleanup());

beforeEach(() => {
  vi.clearAllMocks();
  getAdminCustomerSavedSegments.mockResolvedValue({
    ok: true,
    segments: [
      {
        id: 'segment-1',
        name: 'VIP asignados',
        filters: { segment: 'vip', crmOwner: 'me' },
      },
    ],
  });
  createAdminCustomerSavedSegment.mockResolvedValue({
    ok: true,
    segment: {
      id: 'segment-2',
      name: 'Clientes en riesgo',
      filters: { segment: 'at-risk' },
    },
  });
  deleteAdminCustomerSavedSegment.mockResolvedValue({ ok: true });
});

describe('CustomerSavedSegments Etapa 3', () => {
  it('aplica, guarda y elimina filtros personales', async () => {
    const onApply = vi.fn();
    const filters = {
      status: 'active',
      source: 'web',
      segment: 'at-risk',
      crmStage: 'all',
      crmPriority: 'high',
      crmOwner: 'me',
    };
    render(<CustomerSavedSegments filters={filters} onApply={onApply} />);

    fireEvent.click(await screen.findByRole('button', { name: /^VIP asignados$/i }));
    expect(onApply).toHaveBeenCalledWith({ segment: 'vip', crmOwner: 'me' });

    fireEvent.change(screen.getByPlaceholderText('Ej: VIP asignados a mí'), {
      target: { value: 'Clientes en riesgo' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => {
      expect(createAdminCustomerSavedSegment).toHaveBeenCalledWith({
        name: 'Clientes en riesgo',
        filters,
      });
    });

    fireEvent.click(screen.getByRole('button', { name: 'Eliminar segmento VIP asignados' }));
    await waitFor(() => {
      expect(deleteAdminCustomerSavedSegment).toHaveBeenCalledWith('segment-1');
    });
  });
});
