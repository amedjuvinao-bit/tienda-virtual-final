import React from "react";
import { createRequire } from "node:module";
import { afterEach, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import CatalogPageEditor from "./CatalogPageEditor";
const require = createRequire(import.meta.url);
const {
  complementsConfig,
  buildCategoryCatalogConfig,
  CATALOG_PAGES,
} = require("../../../../backend/services/pages/catalogPages.js");
const uploadState = vi.hoisted(() => ({ complete: null }));
vi.mock("../../lib/api", () => ({ adminFetch: (...args) => fetch(...args) }));
vi.mock("./workspace/PageLivePreview", () => ({
  default: ({ draft }) => (
    <output data-testid="draft">{JSON.stringify(draft)}</output>
  ),
}));
vi.mock("../media/AdminImageUploadField", () => ({
  default: ({ label, onChange, onBusyChange }) => (
    <button
      type="button"
      onClick={() => {
        onBusyChange(true);
        uploadState.complete = () => onBusyChange(false);
        onChange("https://res.cloudinary.com/demo/image/upload/art.webp");
      }}
    >
      {label}
    </button>
  ),
}));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  uploadState.complete = null;
});
function mount(slug = "complementos") {
  const definition = CATALOG_PAGES.find(item => item.slug === slug);
  const config = slug === "complementos" ? complementsConfig : buildCategoryCatalogConfig(definition);
  let stored = {
      _id: "comp",
      name: definition.name,
      slug,
      pageType: "catalog",
      catalogConfig: {
        ...config,
        collection: { ...config.collection, extension: true },
      },
      blocks: [],
    },
    writes = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url, options = {}) => {
      let data;
      if (String(url).includes("/api/pages/")) {
        if (options.method === "PUT") {
          writes++;
          stored = { ...stored, ...JSON.parse(options.body) };
        }
        data = stored;
      } else if (String(url).includes("catalog-categories"))
        data = {
          categories: [
            { id: "c", name: "Complementos" },
            { id: "a", name: "Accesorios" },
          ],
        };
      else if (String(url).includes("/meta"))
        data = { categories: [], colors: [] };
      else data = { products: [], pagination: { totalProducts: 0 } };
      return { ok: true, json: async () => data };
    }),
  );
  render(
    <MemoryRouter initialEntries={["/edit/comp"]}>
      <Routes>
        <Route path="/edit/:id" element={<CatalogPageEditor />} />
      </Routes>
    </MemoryRouter>,
  );
  return { stored: () => stored, writes: () => writes };
}
it("permite enlazar categorías vacías y guarda su ámbito y ajustes de selección", async () => {
  const state = mount();
  expect(
    await screen.findByRole("combobox", {
      name: "Origen de productos",
      exact: true,
    }),
  ).toHaveValue("categories");
  fireEvent.click(
    screen.getByRole("button", { name: "Categorías", exact: true }),
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Categorías permitidas", exact: true }),
  );
  fireEvent.click(
    await screen.findByRole("button", { name: "Accesorios", exact: true }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Diseño", exact: true }));
  fireEvent.click(
    screen.getByRole("button", { name: "Ilustración y mensajes", exact: true }),
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Buscador y categorías", exact: true }),
  );
  fireEvent.change(screen.getByLabelText("Ayuda del buscador"), {
    target: { value: "Encuentra un detalle" },
  });
  fireEvent.click(
    screen.getByRole("button", { name: "Guardar cambios", exact: true }),
  );
  await screen.findByText(/Cambios guardados/);
  expect(state.writes()).toBe(1);
  expect(state.stored().catalogConfig.allowedCategoriesText).toContain(
    "Accesorios",
  );
  expect(state.stored().catalogConfig.collection).toMatchObject({
    extension: true,
    searchPlaceholder: "Encuentra un detalle",
  });
});
it.each(["bautizos", "vestidos", "jeans", "calzado"])("%s guarda desde Encabezado y Adorno la imagen elegida y la entrega a la vista previa", async (slug) => {
  const state = mount(slug);
  const definition = CATALOG_PAGES.find(item => item.slug === slug);
  await screen.findByRole("combobox", { name: "Origen de productos", exact: true });
  fireEvent.click(screen.getByRole("button", { name: "Diseño", exact: true }));
  fireEvent.click(screen.getByRole("button", { name: "Encabezado", exact: true }));
  fireEvent.click(screen.getByRole("tab", { name: "Adorno", exact: true }));
  fireEvent.click(screen.getByRole("button", { name: "Ilustración del catálogo", exact: true }));
  expect(screen.getByRole("button", { name: "Guardar cambios", exact: true })).toBeDisabled();
  act(() => uploadState.complete());
  expect(JSON.parse(screen.getByTestId("draft").textContent).catalogConfig.collection.heroArtwork).toBe("https://res.cloudinary.com/demo/image/upload/art.webp");
  fireEvent.click(screen.getByRole("button", { name: "Guardar cambios", exact: true }));
  await screen.findByText(/Cambios guardados/);
  expect(state.writes()).toBe(1);
  expect(state.stored().catalogConfig).toMatchObject({
    sourceMode: "categories",
    allowedCategoriesText: definition.category,
    collection: { heroArtwork: "https://res.cloudinary.com/demo/image/upload/art.webp", extension: true },
  });
});
it("bloquea el guardado durante una carga desde el equipo", async () => {
  mount();
  await screen.findByRole("combobox", {
    name: "Origen de productos",
    exact: true,
  });
  fireEvent.click(screen.getByRole("button", { name: "Diseño", exact: true }));
  fireEvent.click(
    screen.getByRole("button", { name: "Ilustración y mensajes", exact: true }),
  );
  fireEvent.click(
    screen.getByRole("button", {
      name: "Ilustración del catálogo",
      exact: true,
    }),
  );
  expect(
    screen.getByRole("button", { name: "Guardar cambios", exact: true }),
  ).toBeDisabled();
  expect(
    screen.getByRole("button", { name: "Contenido", exact: true }),
  ).toBeDisabled();
});
