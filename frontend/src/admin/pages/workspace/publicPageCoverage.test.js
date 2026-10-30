import { expect, it } from "vitest";
import fs from "node:fs";
import { PAGE_TYPES } from "./pageModel";
import CATALOG_PAGES from "../../../../../shared/catalogPages.json";
it("toda ruta pública tiene una ubicación de configuración conocida", () => {
  const source = fs.readFileSync("src/App.jsx", "utf8");
  const paths = [...source.matchAll(/<Route\s+path="([^"]+)"/g)]
    .map((match) => match[1])
    .filter((path) => path.startsWith("/") && !path.startsWith("/admin"));
  expect(source).toContain("CATALOG_PAGES.map(({ slug, publicPath })");
  paths.push(...CATALOG_PAGES.map(page => page.publicPath));
  const configured = {
    "/": "Apariencia",
    "/complementos": "Páginas",
    "/categoria/bautizos": "Páginas",
    "/nosotros": "Páginas",
    "/contacto": "Páginas",
    "/politicas": "Páginas",
    "/cambios-devoluciones": "Páginas",
    "/preguntas-frecuentes": "Páginas",
    "/ayuda": "Páginas",
    "/centro-ayuda": "Páginas",
    "/nuestra-sede": "Páginas",
    "/nuestra-historia": "Páginas",
    "/pagina/:slug": "Páginas",
    "/lo-nuevo": "Apariencia",
    "/producto/:id": "product-detail",
    "/p/:id": "product-detail",
    "/carrito": "cart-page",
    "/favoritos": "favorites-page",
    "/buscar": "search-page",
    "/checkout": "checkout-page",
    "/gracias": "thanks-page",
    "/devoluciones/:orderId": "returns-page",
    "/probe-site-settings": "development-only",
  };
  expect(source).toContain('<Route path="*" element={<NotFound />}');
  expect(PAGE_TYPES["notfound-page"].system).toBe(true);
  for (const path of paths) {
    expect(configured[path], path).toBeTruthy();
    if (configured[path].endsWith("-page"))
      expect(PAGE_TYPES[configured[path]], path).toBeTruthy();
  }
  expect(source).toContain(
    'import.meta.env.DEV && <Route path="/probe-site-settings"',
  );
});
