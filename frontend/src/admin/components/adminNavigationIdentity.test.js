import { describe, expect, it } from "vitest";
import { isAdminNavigationActive } from "./adminNavigationIdentity";

describe("admin navigation identity", () => {
  it.each([
    "catalogo",
    "product-detail",
    "cart-page",
    "checkout-page",
    "thanks-page",
    "favorites-page",
    "notfound-page",
  ])("keeps %s editors under Pages", (editor) => {
    expect(
      isAdminNavigationActive(`/admin/${editor}/page-id`, "/admin/paginas"),
    ).toBe(true);
    expect(
      isAdminNavigationActive(`/admin/${editor}/page-id`, "/admin/productos"),
    ).toBe(false);
  });

  it("preserves exact and nested module matching", () => {
    expect(
      isAdminNavigationActive("/admin/productos", "/admin/productos"),
    ).toBe(true);
    expect(
      isAdminNavigationActive("/admin/productos/123", "/admin/productos"),
    ).toBe(true);
    expect(
      isAdminNavigationActive("/admin/productos-extra", "/admin/productos"),
    ).toBe(false);
  });
});
