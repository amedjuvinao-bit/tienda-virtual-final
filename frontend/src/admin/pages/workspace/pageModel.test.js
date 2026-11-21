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

it("enruta páginas informativas y la identidad fija de Nosotros al editor correcto", () => {
  const about = { _id: "a", slug: "nosotros", pageType: "information", systemRole: "about" };
  expect(pageEditorPath(about)).toBe("/admin/information-page/a");
  expect(pagePublicPath(about)).toBe("/nosotros");
  const contact = { _id: "c", slug: "contacto", pageType: "information", systemRole: "contact" };
  expect(pageEditorPath(contact)).toBe("/admin/information-page/c");
  expect(pagePublicPath(contact)).toBe("/contacto");
  const help = { _id: "h", slug: "preguntas-frecuentes", pageType: "information", systemRole: "help" };
  expect(pageEditorPath(help)).toBe("/admin/information-page/h");
  expect(pagePublicPath(help)).toBe("/preguntas-frecuentes");
  expect(pagePublicPath({ pageType: "information", slug: "ayuda" })).toBe("/pagina/ayuda");
});
