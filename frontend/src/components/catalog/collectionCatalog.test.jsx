import React from "react";
import { createRequire } from "node:module";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import CatalogPageView from "./CatalogPageView";
import { buildSafeCatalogConfig } from "./catalogConfig";
import { buildCatalogProductQuery, readCatalogQuery } from "./catalogQuery";
import {
  pagePublicPath,
  pageEditorPath,
  pageMeta,
} from "../../admin/pages/workspace/pageModel";
import api from "../../lib/api";
const require = createRequire(import.meta.url);
const {
  complementsConfig,
  buildCategoryCatalogConfig,
  CATALOG_PAGES,
} = require("../../../../backend/services/pages/catalogPages.js");
const { addToCart, toggleFavorite } = vi.hoisted(() => ({
  addToCart: vi.fn(),
  toggleFavorite: vi.fn(),
}));
vi.mock("../../lib/api", () => ({ default: { get: vi.fn() } }));
vi.mock("../../context/CartContext", () => ({
  useCart: () => ({ cart: [], addToCart }),
}));
vi.mock("../../context/FavoritesContext", () => ({
  useFavorites: () => ({ isFavorite: () => false, toggleFavorite }),
}));
const page = {
  _id: "complements",
  name: "Complementos",
  slug: "complementos",
  pageType: "catalog",
  useHeader: false,
};
const product = {
  _id: "p1",
  slug: "articulo-real",
  title: "Artículo real publicado",
  price: 24000,
  image: "/placeholder.png",
  categories: ["Complementos"],
  colors: ["rojo"],
  variants: [],
  active: true,
  inventoryTracked: false,
};
let products = [];
beforeEach(() => {
  products = [];
  api.get.mockResolvedValue({ data: { categories: [], colors: [] } });
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: true,
      json: async () => ({
        products,
        pagination: {
          page: 1,
          limit: 12,
          totalPages: products.length ? 1 : 0,
          totalProducts: products.length,
          hasPreviousPage: false,
          hasNextPage: false,
        },
      }),
    })),
  );
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});
function mount(config = complementsConfig, selection = page) {
  return render(
    <MemoryRouter initialEntries={[pagePublicPath(selection)]}>
      <CatalogPageView page={selection} catalogConfig={config} />
    </MemoryRouter>,
  );
}
it("Bautizos usa el mismo catálogo y editor, en su ruta propia y con selección independiente", async () => {
  const definition = CATALOG_PAGES.find(item => item.slug === "bautizos");
  const selection = { ...page, _id: "bautizos-page", name: definition.name, slug: definition.slug };
  const config = buildCategoryCatalogConfig(definition, complementsConfig);
  expect(pagePublicPath(selection)).toBe("/categoria/bautizos");
  expect(pageEditorPath(selection)).toBe("/admin/catalogo/bautizos-page");
  expect(pageMeta(selection).system).toBe(true);
  mount(config, selection);
  await screen.findByRole("heading", { name: config.emptyTitle });
  expect(screen.getByRole("heading", { name: "Bautizos", exact: true })).toBeVisible();
  expect(screen.getByPlaceholderText("Buscar en Bautizos…")).toBeVisible();
  expect(new URL(fetch.mock.calls[0][0]).searchParams.getAll("categoryScope")).toEqual(["Bautizos"]);
  expect(screen.queryByRole("article")).not.toBeInTheDocument();
});
it.each(["vestidos", "jeans", "calzado"])("%s tiene su página, selección y carga de ilustración independiente", async (slug) => {
  const definition = CATALOG_PAGES.find(item => item.slug === slug);
  const selection = { ...page, _id: `${slug}-page`, name: definition.name, slug };
  const config = buildCategoryCatalogConfig(definition, complementsConfig);
  expect(pagePublicPath(selection)).toBe(`/categoria/${slug}`);
  expect(pageEditorPath(selection)).toBe(`/admin/catalogo/${slug}-page`);
  expect(pageMeta(selection).system).toBe(true);
  const view = mount(config, selection);
  await screen.findByRole("heading", { name: config.emptyTitle });
  expect(screen.getByRole("heading", { name: definition.name, exact: true })).toBeVisible();
  expect(screen.getByPlaceholderText(`Buscar en ${definition.name}…`)).toBeVisible();
  expect(new URL(fetch.mock.calls[0][0]).searchParams.getAll("categoryScope")).toEqual([definition.category]);
  expect(view.container.querySelector(".collection-catalog-art")).toBeNull();
  expect(view.container.querySelector(".collection-catalog-hero")).toHaveAttribute("data-artwork", "false");
  expect(screen.queryByRole("article")).not.toBeInTheDocument();
});
it("Novedades abre su catálogo propio con todos los publicados por fecha, sin heredar el ámbito de otra selección", async () => {
  const definition = CATALOG_PAGES.find(item => item.slug === "lo-nuevo");
  const config = buildCategoryCatalogConfig(definition, {
    ...complementsConfig, defaultSort: "price", initialColorsText: "rojo", initialMinPrice: 50000,
  });
  const selection = { ...page, _id: "news", name: definition.name, slug: definition.slug };
  expect(pagePublicPath(selection)).toBe("/lo-nuevo");
  expect(pageEditorPath(selection)).toBe("/admin/catalogo/news");
  mount(config, selection);
  await screen.findByRole("heading", { name: config.emptyTitle });
  expect(screen.getByRole("heading", { name: "Novedades", exact: true })).toBeVisible();
  const params = new URL(fetch.mock.calls[0][0]).searchParams;
  expect(params.get("status")).toBe("published");
  expect(params.get("sort")).toBe("-createdAt");
  expect(params.getAll("categoryScope")).toEqual([]);
  expect(params.getAll("category")).toEqual([]);
  expect(params.getAll("productKeys")).toEqual([]);
  expect(params.getAll("color")).toEqual([]);
  expect(params.get("minPrice")).toBe("0");
});
it("la página propia usa su editor y el ámbito de categorías permanece independiente de los filtros del visitante", () => {
  expect(pageMeta(page).system).toBe(true);
  expect(pagePublicPath(page)).toBe("/complementos");
  expect(pageEditorPath(page)).toBe("/admin/catalogo/complements");
  const c = buildSafeCatalogConfig(complementsConfig),
    query = readCatalogQuery(new URLSearchParams("cats=Ropa"), c);
  const params = buildCatalogProductQuery(c, query);
  expect(params.getAll("categoryScope")).toEqual(["Complementos"]);
  expect(params.getAll("category")).toEqual(["Ropa"]);
  expect(params.get("status")).toBe("published");
});
it("conserva ajustes y extensiones de la selección sin introducirlos en catálogos anteriores", () => {
  expect(
    buildSafeCatalogConfig({
      ...complementsConfig,
      collection: {
        ...complementsConfig.collection,
        heroArtwork: "",
        extension: true,
      },
    }).collection,
  ).toMatchObject({ heroArtwork: "", extension: true });
  expect(buildSafeCatalogConfig({}).collection).toBeUndefined();
});
it("sin productos muestra el estado vacío real sin tarjetas de ejemplo y consulta solo la categoría configurada", async () => {
  mount();
  expect(
    await screen.findByRole("heading", { name: complementsConfig.emptyTitle }),
  ).toBeVisible();
  expect(screen.queryByRole("article")).not.toBeInTheDocument();
  expect(screen.getByPlaceholderText("Buscar complementos…")).toBeVisible();
  const url = new URL(fetch.mock.calls[0][0]);
  expect(url.searchParams.getAll("categoryScope")).toEqual(["Complementos"]);
  expect(screen.queryByText("Diadema floral")).not.toBeInTheDocument();
});
it("los productos incorporados al servidor aparecen en la misma página y conservan favoritos y acceso al detalle", async () => {
  products = [product];
  mount();
  await screen.findByRole("heading", { name: product.title });
  expect(
    screen.getByRole("link", { name: `Ver ${product.title}` }),
  ).toHaveAttribute("href", "/producto/articulo-real");
  fireEvent.click(screen.getByRole("button", { name: "Favorito" }));
  expect(toggleFavorite).toHaveBeenCalledWith(product);
});
it("una categoría sin asignar nunca convierte el catálogo vacío en todos los productos", async () => {
  mount({ ...complementsConfig, allowedCategoriesText: "" });
  await screen.findByRole("heading", { name: complementsConfig.emptyTitle });
  expect(fetch).not.toHaveBeenCalled();
});
it("una foto que falla conserva el producto y sus acciones con el aviso configurado", async () => {
  products = [product];
  mount({
    ...complementsConfig,
    collection: {
      ...complementsConfig.collection,
      missingImageText: "Foto pendiente",
    },
  });
  const photo = await screen.findByRole("img", { name: product.title });
  fireEvent.error(photo);
  expect(screen.getByText("Foto pendiente")).toBeVisible();
  expect(
    screen.getByRole("link", { name: `Ver ${product.title}` }),
  ).toHaveAttribute("href", "/producto/articulo-real");
  fireEvent.click(screen.getByRole("button", { name: "Favorito" }));
  expect(toggleFavorite).toHaveBeenCalledWith(product);
});
it("un resultado vacío por búsqueda usa su propio mensaje y mantiene el ámbito de la selección", async () => {
  mount();
  await screen.findByRole("heading", { name: complementsConfig.emptyTitle });
  fireEvent.change(screen.getByRole("textbox", { name: "Buscar productos" }), {
    target: { value: "sin-coincidencia" },
  });
  fireEvent.submit(screen.getByRole("search"));
  await screen.findByRole("heading", { name: "No hay coincidencias" });
  await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
  expect(
    new URL(fetch.mock.calls[1][0]).searchParams.get("categoryScope"),
  ).toBe("Complementos");
});
