import { describe, expect, it } from 'vitest';

import { buildCatalogCartIntent } from './ProductCard';

describe('agregado profesional desde la tarjeta del catálogo', () => {
  it('no inventa talla ni color para combos, digitales o servicios sin variantes', () => {
    const intent = buildCatalogCartIntent({
      _id: '68a4a78a59706e44cade0501',
      productType: 'bundle',
      title: 'Combo digital',
      price: 249000,
      variants: [],
      sizes: [],
      colors: [],
    });

    expect(intent.requiresSelection).toBe(false);
    expect(intent.payload).toMatchObject({
      color: '',
      size: '',
      variantKey: '',
      quantity: 1,
      price: 249000,
    });
  });

  it('usa la identidad canónica cuando existe una sola variante', () => {
    const intent = buildCatalogCartIntent({
      _id: '68a4a78a59706e44cade0502',
      price: 100000,
      variants: [{
        variantKey: '8__azul-cielo',
        size: '8',
        color: 'azul-cielo',
        colorLabel: 'Azul cielo',
        price: 140000,
        active: true,
      }],
    });

    expect(intent.requiresSelection).toBe(false);
    expect(intent.payload).toMatchObject({
      size: '8',
      color: 'Azul cielo',
      colorValue: 'azul-cielo',
      variantKey: '8__azul-cielo',
      price: 140000,
    });
  });

  it('obliga a elegir cuando hay varias variantes reales', () => {
    const intent = buildCatalogCartIntent({
      variants: [
        { variantKey: 's__negro', active: true },
        { variantKey: 'm__blanco', active: true },
      ],
    });

    expect(intent).toEqual({ requiresSelection: true, payload: null });
  });
});
