export const loadOrdersAdmin = () => import('./OrdersAdmin');
export const loadProductsAdmin = () => import('./ProductosAdmin');

export function preloadAdminRoute(path) {
  if (path === '/admin/ordenes') return loadOrdersAdmin().catch(() => {});
  if (path === '/admin/productos') return loadProductsAdmin().catch(() => {});
  return Promise.resolve();
}
