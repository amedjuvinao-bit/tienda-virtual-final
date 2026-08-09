// @vitest-environment jsdom

import { afterEach, describe, expect, it } from 'vitest';

import { applyProductSeo } from './productSeo';

function removeManagedSeo() {
  document.head
    .querySelectorAll('[data-product-seo="true"]')
    .forEach((element) => element.remove());
}

afterEach(() => {
  removeManagedSeo();
  document.title = '';
});

describe('applyProductSeo', () => {
  it('aplica las palabras clave sin interrumpir la ficha del producto', () => {
    const cleanup = applyProductSeo({
      title: 'Maceta cerámica',
      price: 65000,
      seo: {
        keywords: ['decoración', 'cerámica', '  hogar  ', ''],
      },
    });

    expect(
      document.head.querySelector('meta[name="keywords"]')?.content
    ).toBe('decoración, cerámica, hogar');
    expect(
      document.head.querySelector('script[type="application/ld+json"]')
    ).not.toBeNull();

    cleanup();
  });

  it('funciona cuando el producto no tiene palabras clave', () => {
    expect(() =>
      applyProductSeo({
        title: 'Producto sin palabras clave',
        price: 10000,
      })
    ).not.toThrow();
  });
});
