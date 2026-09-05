import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

import { CashStatusPanel } from './PosSalesPageSafe';

afterEach(cleanup);

describe('POS y conteo ciego de Caja Etapa 3', () => {
  it('no convierte valores protegidos en ceros visibles para el cajero', () => {
    render(
      <MemoryRouter>
        <CashStatusPanel
          session={{
            id: 'cash-stage3',
            status: 'open',
            sessionCode: 'CAJA-20260904-STAGE3',
            cashRegisterCode: 'CAJA POS',
            expectedCash: null,
            salesSummary: {
              ordersCount: 2,
              netSales: null,
              paymentTotals: { cash: null },
            },
            cashControl: { blindCountActive: true },
          }}
          loading={false}
          error=""
          required
          branchName="Sede Principal"
          onRefresh={vi.fn()}
        />
      </MemoryRouter>
    );

    expect(screen.getAllByText('Oculto')).toHaveLength(3);
    expect(screen.getByText(/Efectivo esperado Oculto/)).toBeInTheDocument();
    expect(screen.queryByText('Efectivo esperado $ 0')).not.toBeInTheDocument();
  });
});
