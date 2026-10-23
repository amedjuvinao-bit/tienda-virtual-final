import { describe, it, expect } from "vitest";
import {
  filterPages,
  pageMeta,
  pageEditorPath,
  pagePublicPath,
  slugify,
} from "./pageModel";
describe("páginas: identidad y búsqueda", () => {
  it("mantiene protegidas las direcciones reservadas incluso con un tipo antiguo", () => {
    const page = {
      _id: "1",
      name: "Mi carrito",
      pageType: "custom",
      slug: "carrito",
    };
    expect(pageMeta(page).system).toBe(true);
    expect(pageEditorPath(page)).toBe("/admin/cart-page/1");
    expect(pagePublicPath(page)).toBe("/carrito");
  });
  it("encuentra páginas por nombre y dirección, combinando tipo y estado", () => {
    const pages = [
      {
        name: "Promoción",
        slug: "verano",
        pageType: "catalog",
        enabled: false,
      },
      { name: "Carrito", slug: "carrito", pageType: "cart-page" },
    ];
    expect(filterPages(pages, "promocion", "catalog", "inactive")).toEqual([
      pages[0],
    ]);
    expect(filterPages(pages, "verano", "system")).toEqual([]);
    expect(filterPages(pages, "", "system", "active")).toEqual([pages[1]]);
  });
  it("normaliza una dirección completa conservando palabras y guiones", () => {
    expect(slugify("Nueva promoción de Otoño")).toBe(
      "nueva-promocion-de-otono",
    );
  });
});
