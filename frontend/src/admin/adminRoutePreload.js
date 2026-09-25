export const loadOrdersAdmin = () => import('./OrdersAdmin');
export const loadProductsAdmin = () => import('./ProductosAdmin');
export const loadPosSalesPage = () => import('./pos/PosSalesPage');
export const loadCashSessionsPage = () => import('./cash/CashSessionsPage');

export function preloadAdminRoute(path) {
  if (path === '/admin/ordenes') return loadOrdersAdmin().catch(() => {});
  if (path === '/admin/productos') return loadProductsAdmin().catch(() => {});
  if (path === '/admin/pos') return loadPosSalesPage().catch(() => {});
  if (path === '/admin/caja') return loadCashSessionsPage().catch(() => {});
  return Promise.resolve();
}
