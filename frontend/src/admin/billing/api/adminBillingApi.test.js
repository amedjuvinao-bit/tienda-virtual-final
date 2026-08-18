import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
  post: vi.fn(),
}));

vi.mock('../../../lib/api', () => ({ default: api }));

import {
  BILLING_GENERATION_TIMEOUT_MS,
  generateBillingInvoiceForOrder,
} from './adminBillingApi';

describe('generateBillingInvoiceForOrder', () => {
  beforeEach(() => {
    api.post.mockReset();
  });

  it('espera la respuesta real de Factus sin usar el timeout global de 15 segundos', async () => {
    api.post.mockResolvedValue({
      data: {
        data: {
          invoice: { invoiceNumber: 'SETP990015999' },
        },
      },
    });

    const result = await generateBillingInvoiceForOrder(
      '000000000000000000000001',
      'a'.repeat(64)
    );

    expect(BILLING_GENERATION_TIMEOUT_MS).toBe(60_000);
    expect(api.post).toHaveBeenCalledWith(
      '/api/admin/billing/orders/000000000000000000000001/generate',
      { preflightFingerprint: 'a'.repeat(64) },
      { timeout: 60_000 }
    );
    expect(result.invoice.invoiceNumber).toBe('SETP990015999');
  });
});
