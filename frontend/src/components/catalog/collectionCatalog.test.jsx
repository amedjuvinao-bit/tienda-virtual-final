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
function mount(config = complementsConfig) {
  return render(
    <MemoryRouter initialEntries={["/complementos"]}>
      <CatalogPageView page={page} catalogConfig={config} />
    </MemoryRouter>,
  );
}
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
