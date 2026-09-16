import { describe, expect, it } from 'vitest';
import { findShippingZone, resolveShippingRate } from './shippingRateRules';

const config = {
  active: true,
  mode: 'zones',
  freeShipping: { enabled: true, minimum: 200000 },
  fallback: { price: 25000 },
  zones: [{
    countryCode: 'CO',
    country: 'Colombia',
    departmentCode: '47',
    department: 'Magdalena',
    cityCode: '47189',
    city: 'Ciénaga',
    price: 12000,
  }],
};

describe('shippingRateRules', () => {
  it('prioriza códigos geográficos y conserva compatibilidad por nombre', () => {
    expect(findShippingZone(config, {
      countryCode: 'CO',
      departmentCode: '47',
      cityCode: '47189',
    })?.price).toBe(12000);
    expect(findShippingZone(config, {
      country: 'Colombia',
      department: 'Magdalena',
      city: 'Cienaga',
    })?.cityCode).toBe('47189');
  });

  it('aplica zona, respaldo y mínimo gratis con las mismas reglas del servidor', () => {
    const customer = { countryCode: 'CO', departmentCode: '47', cityCode: '47189' };
    expect(resolveShippingRate({ config, customer, subtotal: 100000 })).toBe(12000);
    expect(resolveShippingRate({
      config,
      customer: { countryCode: 'CO', departmentCode: '11', cityCode: '11001' },
      subtotal: 100000,
    })).toBe(25000);
    expect(resolveShippingRate({ config, customer, subtotal: 200000 })).toBe(0);
  });

  it('no convierte un mínimo vacío en envío gratis para todos', () => {
    expect(resolveShippingRate({
      config: { ...config, freeShipping: { enabled: true, minimum: null } },
      customer: { countryCode: 'CO', departmentCode: '47', cityCode: '47189' },
      subtotal: 50000,
    })).toBe(12000);
  });
});
