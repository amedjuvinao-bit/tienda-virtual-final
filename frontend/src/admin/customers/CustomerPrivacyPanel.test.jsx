import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../api/adminCustomersApi', () => ({
  anonymizeAdminCustomer: vi.fn(),
  exportAdminCustomerData: vi.fn(),
  getAdminCustomerAudit: vi.fn(),
  getAdminCustomerPrivacy: vi.fn(),
  updateAdminCustomerConsent: vi.fn(),
}));

import {
  getAdminCustomerAudit,
  getAdminCustomerPrivacy,
  updateAdminCustomerConsent,
} from '../api/adminCustomersApi';
import CustomerPrivacyPanel from './CustomerPrivacyPanel';

afterEach(() => cleanup());

beforeEach(() => {
  vi.clearAllMocks();
  getAdminCustomerPrivacy.mockResolvedValue({
    ok: true,
    privacy: {
      status: 'active',
      confirmationPhrase: 'ANONIMIZAR CLI-1',
      retention: {
        retentionDays: 3650,
        retentionUntil: '2036-08-31T00:00:00.000Z',
        eligibleForAnonymization: false,
      },
    },
    consent: { status: 'unknown' },
  });
  getAdminCustomerAudit.mockResolvedValue({
    ok: true,
    integrityVerified: true,
    coverage: { total: 1, loaded: 1, truncated: false },
    events: [
      {
        id: 'event-1',
        eventType: 'viewed',
        action: 'Ficha del cliente consultada',
        actor: { name: 'Propietario Principal' },
        changes: [],
        createdAt: '2026-08-31T10:00:00.000Z',
      },
    ],
  });
  updateAdminCustomerConsent.mockResolvedValue({
    ok: true,
    customer: { id: 'customer-1', marketingConsent: { status: 'granted' } },
  });
});

describe('CustomerPrivacyPanel Etapa 4', () => {
  it('muestra conservación, verifica auditoría y registra consentimiento con evidencia', async () => {
    const onUpdated = vi.fn();
    render(
      <CustomerPrivacyPanel
        customer={{ id: 'customer-1', customerCode: 'CLI-1' }}
        access={{ audit: true, consent: true, export: false, anonymize: true }}
        onUpdated={onUpdated}
      />
    );

    expect(await screen.findByText(/Cadena criptográfica verificada/i)).toBeInTheDocument();
    expect(screen.getByText('Ficha del cliente consultada')).toBeInTheDocument();
    expect(screen.getByText(/No es elegible hasta/i)).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('Referencia de evidencia'), {
      target: { value: 'checkout-123' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Registrar consentimiento' }));

    await waitFor(() => {
      expect(updateAdminCustomerConsent).toHaveBeenCalledWith(
        'customer-1',
        expect.objectContaining({
          status: 'granted',
          source: 'admin',
          proofReference: 'checkout-123',
        })
      );
      expect(onUpdated).toHaveBeenCalled();
    });
  });

  it('no consulta información cuando falta customers:audit', () => {
    render(
      <CustomerPrivacyPanel
        customer={{ id: 'customer-1', customerCode: 'CLI-1' }}
        access={{ audit: false }}
      />
    );

    expect(screen.getByText(/no tiene el permiso/i)).toBeInTheDocument();
    expect(getAdminCustomerPrivacy).not.toHaveBeenCalled();
    expect(getAdminCustomerAudit).not.toHaveBeenCalled();
  });
});
