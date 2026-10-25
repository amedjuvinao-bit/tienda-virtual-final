import React from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import ProductDetailRelatedProducts from "./ProductDetailRelatedProducts";
import { buildSafeProductDetailConfig } from "./productDetailConfig";
import api from "../../lib/api";
vi.mock("../../lib/api", () => ({ default: { get: vi.fn() } }));
vi.mock("../catalog/CatalogEditorialCard", () => ({
  default: ({ product, config }) => (
    <div
      data-testid="related-card"
      style={{ color: config.cardUiConfig.titleColor }}
    >
      {product.title}
    </div>
  ),
}));
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});
const config = buildSafeProductDetailConfig({});
const view = (product) => (
  <MemoryRouter>
    <ProductDetailRelatedProducts config={config} product={product} />
  </MemoryRouter>
);
it("excluye el producto actual e inactivos, conserva colores y consulta la categoría real", async () => {
  api.get.mockResolvedValue({
    data: {
      products: [
        { _id: "p1", title: "Actual" },
        { _id: "p2", title: "Relacionado" },
        { _id: "p3", title: "Inactivo", active: false },
      ],
    },
  });
  render(view({ _id: "p1", category: "Servicios de instalación" }));
  await screen.findByText("Relacionado");
  expect(screen.queryByText("Actual")).toBeNull();
  expect(screen.queryByText("Inactivo")).toBeNull();
  const query = new URL(api.get.mock.calls[0][0], "https://tienda.test");
  expect(query.searchParams.get("categories")).toBe("Servicios de instalación");
  expect(screen.getByTestId("related-card")).toHaveStyle({
    color: config.style.primaryTextColor,
  });
});
it("no muestra resultados atrasados al cambiar de producto ni un bloque vacío", async () => {
  let resolveOld;
  api.get
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveOld = resolve;
        }),
    )
    .mockResolvedValueOnce({ data: { products: [] } })
    .mockResolvedValueOnce({ data: { products: [] } });
  const rendered = render(view({ _id: "p1", category: "Uno" }));
  rendered.rerender(view({ _id: "p2", category: "Dos" }));
  await waitFor(() => expect(api.get).toHaveBeenCalledTimes(3));
  await act(async () =>
    resolveOld({
      data: { products: [{ _id: "old", title: "Resultado atrasado" }] },
    }),
  );
  expect(screen.queryByText("Resultado atrasado")).toBeNull();
  expect(screen.queryByRole("region")).toBeNull();
});

it("completa la categoría vacía con el catálogo y conserva la prioridad y la deduplicación", async () => {
  api.get
    .mockResolvedValueOnce({
      data: {
        products: [
          { _id: "p1", title: "Actual" },
          { _id: "same", title: "Misma categoría" },
        ],
      },
    })
    .mockResolvedValueOnce({
      data: {
        products: [
          { _id: "same", title: "Misma categoría" },
          { _id: "other", title: "Otra opción" },
        ],
      },
    });
  render(view({ _id: "p1", category: "Categoría pequeña" }));
  await screen.findByText("Otra opción");
  expect(
    screen.getAllByTestId("related-card").map((node) => node.textContent),
  ).toEqual(["Misma categoría", "Otra opción"]);
  expect(
    new URL(api.get.mock.calls[1][0], "https://tienda.test").searchParams.has(
      "categories",
    ),
  ).toBe(false);
});
it("ofrece reintento cuando la consulta falla y recupera el carrusel", async () => {
  api.get
    .mockRejectedValueOnce(new Error("Sin conexión"))
    .mockResolvedValueOnce({
      data: { products: [{ _id: "p2", title: "Recuperado" }] },
    });
  render(view({ _id: "p1" }));
  await screen.findByRole("alert");
  const { fireEvent } = await import("@testing-library/react");
  fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
  await screen.findByText("Recuperado");
  expect(screen.queryByRole("alert")).toBeNull();
});
