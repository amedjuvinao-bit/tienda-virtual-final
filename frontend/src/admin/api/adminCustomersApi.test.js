import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  anonymizeAdminCustomer,
  createAdminCustomerSavedSegment,
  exportAdminCustomerData,
  getAdminCustomerAudit,
  getAdminCustomer360,
  getAdminCustomerCrmQueue,
  getAdminCustomerPrivacy,
  getAdminCustomerSavedSegments,
  normalizeCustomerFollowUpPayload,
  normalizeCustomerPayload,
  updateAdminCustomerConsent,
} from './adminCustomersApi';

import api from '../../lib/api';

vi.mock('../../lib/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('adminCustomersApi Etapa 1', () => {
  it('conserva el perfil fiscal y la sede al normalizar una ficha', () => {
    const payload = normalizeCustomerPayload({
      fullName: 'Empresa Cliente',
      documentType: 'NIT',
      documentNumber: '900123456',
      branchId: '64c000000000000000000001',
      personType: 'juridica',
      businessName: 'Empresa Cliente SAS',
      dv: '7',
      municipalityCode: '47001',
      departmentCode: '47',
      tributeCode: 'ZZ',
      taxRegime: 'Ordinario',
      taxResponsibilities: 'R-99-PN, O-13, R-99-PN',
    });

    expect(payload.branchId).toBe('64c000000000000000000001');
    expect(payload.fiscalProfile).toMatchObject({
      personType: 'juridica',
      businessName: 'Empresa Cliente SAS',
      verificationDigit: '7',
      municipalityCode: '47001',
      departmentCode: '47',
      tributeCode: 'ZZ',
      taxRegime: 'Ordinario',
      taxResponsibilities: ['R-99-PN', 'O-13'],
    });
  });

  it('conserva la sede de un seguimiento sin mezclarla con la nota', () => {
    expect(
      normalizeCustomerFollowUpPayload({
        type: 'call',
        note: 'Llamar mañana',
        branchId: '64c000000000000000000001',
      })
    ).toMatchObject({
      type: 'call',
      note: 'Llamar mañana',
      branchId: '64c000000000000000000001',
    });
  });

  it('consulta la ficha 360 con un límite acotado de historial', async () => {
    api.get.mockResolvedValueOnce({
      data: { ok: true, customerId: 'customer-1', activity: [] },
    });

    await expect(
      getAdminCustomer360('customer-1', { historyLimit: 80 })
    ).resolves.toMatchObject({ ok: true, customerId: 'customer-1' });
    expect(api.get).toHaveBeenCalledWith(
      '/api/admin/customers/customer-1/360?historyLimit=80'
    );
  });

  it('consulta la bandeja CRM con prioridad, vencimiento y responsable', async () => {
    api.get.mockResolvedValueOnce({ data: { ok: true, followUps: [] } });

    await getAdminCustomerCrmQueue({
      priority: 'urgent',
      dueScope: 'overdue',
      assignedTo: 'me',
      page: 2,
    });

    expect(api.get).toHaveBeenCalledWith(
      '/api/admin/customer-follow-ups/queue?status=pending&priority=urgent&dueScope=overdue&assignedTo=me&page=2&limit=25'
    );
  });

  it('lista y crea segmentos guardados con los filtros actuales', async () => {
    api.get.mockResolvedValueOnce({ data: { ok: true, segments: [] } });
    api.post.mockResolvedValueOnce({
      data: { ok: true, segment: { id: 'segment-1', name: 'VIP' } },
    });

    await expect(getAdminCustomerSavedSegments()).resolves.toMatchObject({ ok: true });
    await createAdminCustomerSavedSegment({
      name: ' VIP asignados ',
      filters: { segment: 'vip', crmOwner: 'me' },
    });

    expect(api.get).toHaveBeenCalledWith('/api/admin/customers/segments/saved');
    expect(api.post).toHaveBeenCalledWith('/api/admin/customers/segments/saved', {
      name: 'VIP asignados',
      filters: { segment: 'vip', crmOwner: 'me' },
    });
  });

  it('usa endpoints protegidos para privacidad, auditoría, exportación y consentimiento', async () => {
    api.get
      .mockResolvedValueOnce({ data: { ok: true, privacy: {} } })
      .mockResolvedValueOnce({ data: { ok: true, events: [] } })
      .mockResolvedValueOnce({ data: { ok: true, customer: {} } });
    api.post
      .mockResolvedValueOnce({ data: { ok: true, customer: {} } })
      .mockResolvedValueOnce({ data: { ok: true, customer: {} } });

    await getAdminCustomerPrivacy('customer-1');
    await getAdminCustomerAudit('customer-1', { limit: 80 });
    await exportAdminCustomerData('customer-1');
    await updateAdminCustomerConsent('customer-1', {
      status: 'granted',
      source: 'web',
      proofReference: 'checkout-123',
    });
    await anonymizeAdminCustomer('customer-1', 'ANONIMIZAR CLI-1');

    expect(api.get).toHaveBeenNthCalledWith(1, '/api/admin/customers/customer-1/privacy');
    expect(api.get).toHaveBeenNthCalledWith(2, '/api/admin/customers/customer-1/audit?limit=80');
    expect(api.get).toHaveBeenNthCalledWith(3, '/api/admin/customers/customer-1/export');
    expect(api.post).toHaveBeenCalledWith('/api/admin/customers/customer-1/consent', {
      status: 'granted',
      source: 'web',
      proofReference: 'checkout-123',
      note: '',
    });
    expect(api.post).toHaveBeenCalledWith('/api/admin/customers/customer-1/anonymize', {
      confirmation: 'ANONIMIZAR CLI-1',
    });
  });
});
