const PAGE_EDITORS = new Set([
  "catalogo",
  "product-detail",
  "cart-page",
  "checkout-page",
  "thanks-page",
  "favorites-page",
  "notfound-page",
  "returns-page",
  "search-page",
]);

// Editor URLs belong to Pages in navigation; authorization still uses each route.
export function isAdminNavigationActive(pathname, target) {
  if (
    target === "/admin/paginas" &&
    pathname.startsWith("/admin/") &&
    PAGE_EDITORS.has(pathname.split("/")[2])
  ) {
    return true;
  }
  return pathname === target || pathname.startsWith(`${target}/`);
}
