import { describe, expect, it } from 'vitest';

import {
  normalizeCustomerFollowUpPayload,
  normalizeCustomerPayload,
} from './adminCustomersApi';

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
});
