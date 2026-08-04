import { describe, expect, it } from 'vitest';
import { normalizeProductPageResponse } from './productPagination';

describe('productPagination', () => {
  it('consume el contrato paginado del backend', () => {
    const result = normalizeProductPageResponse({
      products: [{ _id: 'p1' }, { _id: 'p2' }],
      pagination: {
        page: 2,
        limit: 2,
        totalProducts: 7,
        totalPages: 4,
        from: 3,
        to: 4,
        hasPreviousPage: true,
        hasNextPage: true,
      },
    });
    expect(result.products.map((item) => item._id)).toEqual(['p1', 'p2']);
    expect(result.pagination).toMatchObject({
      page: 2,
      limit: 2,
      totalProducts: 7,
      totalPages: 4,
      hasPreviousPage: true,
      hasNextPage: true,
    });
  });

  it('no interpreta un arreglo completo como respuesta paginada', () => {
    const result = normalizeProductPageResponse([{ _id: 'legacy' }]);
    expect(result.products).toEqual([]);
    expect(result.pagination.totalProducts).toBe(0);
  });
});
