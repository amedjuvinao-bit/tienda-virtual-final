export const EMPTY_PRODUCT_PAGE = Object.freeze({
  products: [],
  pagination: Object.freeze({
    page: 1,
    limit: 24,
    totalProducts: 0,
    totalPages: 0,
    from: 0,
    to: 0,
    hasPreviousPage: false,
    hasNextPage: false,
  }),
});

const safeInteger = (value, fallback, minimum = 0) => {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= minimum
    ? parsed
    : fallback;
};

export function normalizeProductPageResponse(payload, fallbackLimit = 24) {
  const products = Array.isArray(payload?.products) ? payload.products : [];
  const source = payload?.pagination || {};
  const page = safeInteger(source.page, 1, 1);
  const limit = safeInteger(source.limit, fallbackLimit, 1);
  const totalProducts = safeInteger(source.totalProducts, 0);
  const totalPages = safeInteger(source.totalPages, 0);
  return {
    products,
    pagination: {
      page,
      limit,
      totalProducts,
      totalPages,
      from: safeInteger(source.from, 0),
      to: safeInteger(source.to, 0),
      hasPreviousPage: source.hasPreviousPage === true,
      hasNextPage: source.hasNextPage === true,
    },
    filters: payload?.filters && typeof payload.filters === 'object'
      ? payload.filters
      : {},
  };
}
