import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter, useLocation, useNavigate } from "react-router-dom";
import CatalogPageView from "./CatalogPageView";
import api from "../../lib/api";
const { addToCart, toggleFavorite } = vi.hoisted(() => ({
  addToCart: vi.fn(),
  toggleFavorite: vi.fn(),
}));
vi.mock("../../lib/api", () => ({ default: { get: vi.fn() } }));
vi.mock("../../context/CartContext.jsx", () => ({
  useCart: () => ({ addToCart }),
}));
vi.mock("../../context/FavoritesContext", () => ({
  useFavorites: () => ({ toggleFavorite, isFavorite: () => false }),
}));
const product = {
  _id: "p1",
  slug: "libro",
  title: "Libro especial",
  price: 20000,
  variants: [],
  image: "/placeholder.png",
};
const result = (page = 1, products = [product]) => ({
  products,
  pagination: {
    page,
    totalPages: 3,
    totalProducts: 50,
    from: (page - 1) * 24 + 1,
    to: page * 24,
    limit: 24,
    hasPreviousPage: page > 1,
    hasNextPage: page < 3,
  },
});
const response = (data) => ({ ok: true, json: async () => data });
function Shell({ config }) {
  const location = useLocation(),
    navigate = useNavigate();
  return (
    <>
      <button onClick={() => navigate(-1)}>Volver navegador</button>
      <output data-testid="url">{location.search}</output>
      <CatalogPageView catalogConfig={config} />
    </>
  );
}
function mount(config = {}, url = "/pagina/catalogo") {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <Shell config={config} />
    </MemoryRouter>,
  );
}
beforeEach(() => {
  vi.clearAllMocks();
  api.get.mockResolvedValue({
    data: { categories: ["Hogar", "Libros"], colors: ["rojo"] },
  });
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url) =>
      response(result(Number(new URL(url).searchParams.get("page") || 1))),
    ),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

it('aplica al cristal los grosores del panel y permite quitarlos sin conservar marcos fijos', async () => {
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(600);
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(300);
  const config = { presentation: { styleVersion: 4, headerEdgeWidth: 1 }, cardUiConfig: { cardBorderWidthPx: 1 }, filterUiConfig: { borderWidthPx: 1 } };
  const view = mount(config);
  await screen.findByText('Libro especial');
  const header = () => view.container.querySelector('.catalog-liquid > .polished-glass-rim');
  const card = () => view.container.querySelector('.catalog-ecard > .polished-glass-rim');
  const filters = () => view.container.querySelector('.cpv-sidebar > .polished-glass-rim');
  for (const node of [header(), card(), filters()]) expect(node.style.getPropertyValue('--pg-width')).toBe('1px');
  const change = (headerEdgeWidth, cardBorderWidthPx, borderWidthPx) => view.rerender(<MemoryRouter initialEntries={['/pagina/catalogo']}><Shell config={{ ...config, presentation: { ...config.presentation, headerEdgeWidth }, cardUiConfig: { cardBorderWidthPx }, filterUiConfig: { borderWidthPx } }}/></MemoryRouter>);
  change(4, 5, 3);
  await waitFor(() => expect(header().style.getPropertyValue('--pg-width')).toBe('4px'));
  expect(card().style.getPropertyValue('--pg-width')).toBe('5px');
  expect(filters().style.getPropertyValue('--pg-width')).toBe('3px');
  change(0, 0, 0);
  await waitFor(() => expect(header().querySelector('svg')).toBeNull());
  expect(card()).toBeNull();
  expect(view.container.querySelector('.catalog-ecard')).toHaveAttribute('data-rim', 'none');
  expect(filters().querySelector('svg')).toBeNull();
});

describe("catálogo conectado", () => {
  it("carga los ajustes de precio y columnas, mantiene paginación en la URL y restaura al volver", async () => {
    mount({
      showFilters: false,
      initialMinPrice: 12000,
      initialMaxPrice: 900000,
      defaultColsDesktop: 4,
    });
    await screen.findByText("Libro especial");
    expect(new URL(fetch.mock.calls[0][0]).searchParams.get("maxPrice")).toBe(
      "900000",
    );
    fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));
    await screen.findByText("Página 2 de 3");
    expect(screen.getByTestId("url")).toHaveTextContent("page=2");
    fireEvent.click(screen.getByRole("button", { name: "Volver navegador" }));
    await screen.findByText("Página 1 de 3");
    expect(screen.getByTestId("url")).not.toHaveTextContent("page=2");
  });
  it("busca y ordena en servidor, vuelve a página uno y conserva el alcance del catálogo", async () => {
    mount(
      {
        showFilters: false,
        sourceMode: "categories",
        allowedCategoriesText: "Hogar",
      },
      "/pagina/catalogo?page=2&utm_source=mail",
    );
    await screen.findByText("Libro especial");
    fireEvent.change(
      screen.getByRole("textbox", { name: "Buscar productos" }),
      { target: { value: "libro" } },
    );
    fireEvent.submit(screen.getByRole("search"));
    await waitFor(() =>
      expect(new URL(fetch.mock.calls.at(-1)[0]).searchParams.get("q")).toBe(
        "libro",
      ),
    );
    fireEvent.change(screen.getByLabelText("Ordenar productos"), {
      target: { value: "price" },
    });
    await waitFor(() =>
      expect(new URL(fetch.mock.calls.at(-1)[0]).searchParams.get("sort")).toBe(
        "price",
      ),
    );
    const params = new URL(fetch.mock.calls.at(-1)[0]).searchParams;
    expect(params.get("page")).toBe("1");
    expect(params.getAll("categoryScope")).toEqual(["Hogar"]);
    expect(screen.getByTestId("url")).toHaveTextContent("utm_source=mail");
  });
  it("distingue un error de conexión de un catálogo vacío y permite reintentar", async () => {
    fetch.mockResolvedValueOnce({ ok: false, status: 503 });
    mount({ showFilters: false });
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "No pudimos cargar el catálogo",
    );
    expect(
      screen.queryByText("No se encontraron productos"),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    await screen.findByText("Libro especial");
  });
  it("ignora respuestas atrasadas aunque la conexión no respete AbortController", async () => {
    let finish;
    fetch.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    mount({ showFilters: false });
    await waitFor(() => expect(finish).toBeTypeOf("function"));
    fireEvent.change(screen.getByLabelText("Ordenar productos"), {
      target: { value: "price" },
    });
    await screen.findByText("Libro especial");
    finish(response(result(1, [{ ...product, title: "Respuesta antigua" }])));
    await waitFor(() =>
      expect(screen.queryByText("Respuesta antigua")).not.toBeInTheDocument(),
    );
  });
  it("usa categorías del alcance y envía el nombre real del color sin añadir tonos inventados", async () => {
    mount({ sourceMode: "categories", allowedCategoriesText: "Hogar" });
    const color = await screen.findByRole("button", { name: "rojo" });
    expect(api.get.mock.calls[0][0]).toContain("categoryScope=Hogar");
    expect(
      screen.queryByRole("button", { name: "Lila" }),
    ).not.toBeInTheDocument();
    fireEvent.click(color);
    await waitFor(() =>
      expect(
        new URL(fetch.mock.calls.at(-1)[0]).searchParams.get("color"),
      ).toBe("rojo"),
    );
    expect(
      screen.getByRole("button", { name: "rojo", pressed: true }),
    ).toHaveAttribute("aria-pressed", "true");
  });
  it("conecta favoritos y compra con la variante correcta y respeta el estilo de la tarjeta", async () => {
    const selected = {
      ...product,
      inventoryTracked: true,
      availableStock: 2,
      variants: [{ variantKey: "unica", price: 35000, availableStock: 2 }],
    };
    fetch.mockResolvedValue(response(result(1, [selected])));
    const { container } = mount({
      showFilters: false,
      defaultColsDesktop: 2,
      presentation: { styleVersion: 2 },
      cardUiConfig: { showBorder: false, showShadow: false },
    });
    await screen.findByText("Libro especial");
    fireEvent.click(screen.getByRole("button", { name: "Agregar al carrito" }));
    expect(addToCart).toHaveBeenCalledWith(
      expect.objectContaining({ variantKey: "unica", price: 35000 }),
    );
    fireEvent.click(screen.getByRole("button", { name: /favorito/i }));
    expect(toggleFavorite).toHaveBeenCalledWith(selected);
    expect(container.querySelector('.catalog-ecard').style.getPropertyValue('--ecard-border-width')).toBe('0px');
    expect(container.querySelector('.catalog-ecard').style.getPropertyValue('--ecard-shadow')).toBe('0 0 0 transparent');
    expect(screen.getByText(/35.000/)).toBeInTheDocument();
  });
  it("bloquea agregar productos agotados y conserva navegación al detalle", async () => {
    fetch.mockResolvedValue(
      response(
        result(1, [{ ...product, inventoryTracked: true, availableStock: 0 }]),
      ),
    );
    mount({ showFilters: false });
    expect(
      await screen.findByRole("button", { name: "Agotado" }),
    ).toBeDisabled();
    expect(screen.getByRole("link", { name: "Inicio" })).toHaveAttribute(
      "href",
      "/",
    );
    expect(screen.getByAltText("Libro especial").closest("a")).toHaveAttribute(
      "href",
      "/producto/libro",
    );
    expect(addToCart).not.toHaveBeenCalled();
  });
  it("no descarga todos los productos si una selección manual está vacía", async () => {
    mount({
      sourceMode: "manual",
      manualProductIdsText: "",
      showFilters: false,
    });
    await screen.findByText("No se encontraron productos");
    expect(fetch).not.toHaveBeenCalled();
  });
});


it('presenta todos los resultados en una cuadrícula sin destacar ninguno y permite configurar los bordes', async () => {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1440 });
  fetch.mockResolvedValue(response(result(1, Array.from({ length: 6 }, (_, i) => ({ ...product, _id: `p${i}`, title: `Artículo ${i}` })))));
  const rendered = mount({ showFilters: false, presentation: { rimStyle: 'optical', motion: 'none', titleSize: 38 } });
  await screen.findByText('Artículo 0');
  const items = [...rendered.container.querySelectorAll('.cpv-product-item')];
  expect(items).toHaveLength(6);
  expect(items.map(item => item.querySelector('h3').textContent)).toEqual(Array.from({ length: 6 }, (_, i) => `Artículo ${i}`));
  expect(items.every(item => item.className === 'cpv-product-item')).toBe(true);
  expect(rendered.container.querySelectorAll('.catalog-ecard > .polished-glass-rim')).toHaveLength(6);
  expect(rendered.container.querySelector('.cpv-page')).toHaveAttribute('data-motion', 'none');
  rendered.unmount();
  mount({ showFilters: false, presentation: { rimStyle: 'none' } });
  await screen.findByText('Artículo 0');
  expect(document.querySelector('.catalog-ecard > .polished-glass-rim')).toBeNull();
});
