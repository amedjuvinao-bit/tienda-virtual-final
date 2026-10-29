import React from "react";
import { createRequire } from "node:module";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import CatalogPageEditor from "./CatalogPageEditor";
const require = createRequire(import.meta.url);
const {
  complementsConfig,
} = require("../../../../backend/services/pages/catalogPages.js");
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
});
function mount() {
  let stored = {
      _id: "comp",
      name: "Complementos",
      slug: "complementos",
      pageType: "catalog",
      catalogConfig: {
        ...complementsConfig,
        collection: { ...complementsConfig.collection, extension: true },
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
