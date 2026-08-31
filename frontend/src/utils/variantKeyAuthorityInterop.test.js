import { describe, expect, it } from 'vitest';

import variantKeyAuthority from '@shared/variant-key-authority';

describe('variantKeyAuthority CommonJS/ESM interop', () => {
  it('expone la autoridad CommonJS como default preoptimizado por Vite', () => {
    expect(variantKeyAuthority.buildVariantKey('4', 'royalblue')).toBe(
      '4__royalblue',
    );
    expect(variantKeyAuthority.normalizeVariantKey('4__royalblue')).toBe(
      '4__royalblue',
    );
    expect(
      variantKeyAuthority.canonicalizeVariantKey(
        'v2__capacidad=256gb__color=azul__conectividad=5g__ram=12gb',
      ),
    ).toBe(
      'v2__capacidad=256gb__color=blue__conectividad=5g__ram=12gb',
    );
  });
});
