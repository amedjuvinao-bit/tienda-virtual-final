import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import CatalogEditor from "./CatalogPageEditor";
import DetailEditor from "./ProductDetailPageEditor";
vi.mock("./workspace/PageLivePreview", () => ({
  default: ({ draft }) => (
    <output data-testid="live-draft">{JSON.stringify(draft)}</output>
  ),
}));
let failSave, discardSave, lastPayload;
const original = {
  _id: "test",
  name: "Mi página",
  slug: "mi-pagina",
  enabled: true,
  useHeader: true,
  useFooter: true,
  blocks: [{ id: "keep", type: "informacion", config: { title: "Conservar" } }],
};
beforeEach(() => {
  failSave = false;
  discardSave = false;
  lastPayload = null;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url, options) => {
      if (options?.method === "PUT") {
        lastPayload = JSON.parse(options.body);
        return {
          ok: !failSave,
          json: async () =>
            failSave
              ? { message: "No se pudo guardar. Reintenta." }
              : {
                  ...original,
                  ...lastPayload,
                  ...(discardSave
                    ? {
                        name: "Mi página",
                        catalogConfig: {},
                        productDetailConfig: {},
                      }
                    : {}),
                },
        };
      }
      if (url.includes("/api/products"))
        return {
          ok: true,
          json: async () => ({ products: [], categories: [] }),
        };
      return {
        ok: true,
        status: 200,
        json: async () => ({
          ...original,
          pageType: url.includes("detail-test") ? "product-detail" : "catalog",
          catalogConfig: { title: "Título guardado" },
          productDetailConfig: { titleOverride: "Título guardado" },
        }),
      };
    }),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
function mount(kind) {
  return render(
    <MemoryRouter
      initialEntries={[
        kind === "catalog"
          ? "/admin/catalogo/test"
          : "/admin/product-detail/detail-test",
      ]}
    >
      <Routes>
        <Route path="/admin/paginas" element={<h1>Listado</h1>} />
        <Route path="/admin/catalogo/:id" element={<CatalogEditor />} />
        <Route path="/admin/product-detail/:id" element={<DetailEditor />} />
      </Routes>
    </MemoryRouter>,
  );
}
describe.each(["catalog", "detail"])("editor de %s", (kind) => {
  it("muestra el borrador antes de guardar, conserva bloques y controla el estado de guardado", async () => {
    const user = userEvent.setup();
    mount(kind);
    await screen.findByRole("heading", { name: "Mi página" });
    expect(
      screen.getByRole("button", { name: "Guardar cambios" }),
    ).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Ajustes" }));
    await user.clear(screen.getByLabelText("Nombre de la página"));
    await user.type(
      screen.getByLabelText("Nombre de la página"),
      "Nueva identidad",
    );
    expect(screen.getByLabelText("Dirección de la página")).toHaveValue(
      "mi-pagina",
    );
    expect(screen.getByTestId("live-draft")).toHaveTextContent(
      "Nueva identidad",
    );
    expect(
      screen.getByRole("button", { name: "Guardar cambios" }),
    ).toBeEnabled();
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));
    await screen.findByText(
      "Cambios guardados. La página pública ya usa esta configuración.",
    );
    expect(lastPayload).toMatchObject({
      name: "Nueva identidad",
      slug: "mi-pagina",
      blocks: original.blocks,
    });
    expect(
      screen.getByRole("button", { name: "Guardar cambios" }),
    ).toBeDisabled();
  });
  it("conserva un borrador cuando falla el guardado y permite volver a guardar", async () => {
    const user = userEvent.setup();
    mount(kind);
    await screen.findByRole("heading", { name: "Mi página" });
    await user.click(screen.getByRole("button", { name: "Ajustes" }));
    await user.type(screen.getByLabelText("Nombre de la página"), " editada");
    failSave = true;
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "No se pudo guardar. Reintenta.",
    );
    expect(screen.getByLabelText("Nombre de la página")).toHaveValue(
      "Mi página editada",
    );
    expect(
      screen.getByRole("button", { name: "Guardar cambios" }),
    ).toBeEnabled();
    failSave = false;
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));
    await screen.findByText(
      "Cambios guardados. La página pública ya usa esta configuración.",
    );
  });
  it("mantiene los cambios cuando una respuesta exitosa omite la configuración", async () => {
    const user = userEvent.setup();
    mount(kind);
    await screen.findByRole("heading", { name: "Mi página" });
    if (kind === "catalog") {
      await user.click(
        screen.getByRole("button", { name: "Título y presentación" }),
      );
      await user.clear(screen.getByLabelText("Título del catálogo"));
      await user.type(
        screen.getByLabelText("Título del catálogo"),
        "Mi título nuevo",
      );
    } else {
      await user.click(screen.getByRole("button", { name: "Ajustes" }));
      await user.click(
        screen.getByRole("button", { name: "Encabezado del detalle" }),
      );
      await user.clear(screen.getByLabelText("Título alternativo"));
      await user.type(
        screen.getByLabelText("Título alternativo"),
        "Mi título nuevo",
      );
    }
    discardSave = true;
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "El servidor no conservó todos los ajustes",
    );
    expect(screen.getByTestId("live-draft")).toHaveTextContent(
      "Mi título nuevo",
    );
    expect(
      screen.getByRole("button", { name: "Guardar cambios" }),
    ).toBeEnabled();
  });
  it("permite cancelar la salida y no cambia el borrador al pasar de área", async () => {
    const user = userEvent.setup();
    mount(kind);
    await screen.findByRole("heading", { name: "Mi página" });
    await user.click(screen.getByRole("button", { name: "Ajustes" }));
    await user.type(screen.getByLabelText("Nombre de la página"), " editada");
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    await user.click(screen.getByRole("button", { name: "Páginas" }));
    expect(confirm).toHaveBeenCalledOnce();
    expect(
      screen.queryByRole("heading", { name: "Listado" }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Contenido" }));
    await user.click(screen.getByRole("button", { name: "Ajustes" }));
    expect(screen.getByLabelText("Nombre de la página")).toHaveValue(
      "Mi página editada",
    );
    confirm.mockReturnValue(true);
    await user.click(screen.getByRole("button", { name: "Páginas" }));
    expect(
      await screen.findByRole("heading", { name: "Listado" }),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(document.documentElement.dataset.pageDraftDirty).toBeUndefined(),
    );
  });
});

it("guarda descubrimiento, filtros, tarjetas y columnas del catálogo con el mismo contrato de la vista previa", async () => {
  const user = userEvent.setup();
  mount('catalog');
  await screen.findByRole('heading', { name: 'Mi página' });
  await user.click(screen.getByRole('button', { name: 'Diseño', exact: true }));
  await user.click(screen.getByLabelText('Mostrar búsqueda de productos'));
  await user.selectOptions(screen.getByLabelText('Orden inicial'), 'price');
  await user.click(screen.getByRole('button', { name: 'Estilo del filtro', exact: true }));
  await user.click(screen.getByRole('button', { name: 'Estilo profesional del filtro', exact: true }));
  fireEvent.change(screen.getByRole('textbox', { name: 'Fondo del panel', exact: true }), { target: { value: '#123456' } });
  await user.click(screen.getByRole('button', { name: 'Tarjetas de producto', exact: true }));
  await user.click(screen.getByRole('button', { name: 'Estilo editable de cards', exact: true }));
  fireEvent.change(screen.getByRole('textbox', { name: 'Fondo de card', exact: true }), { target: { value: '#654321' } });
  await user.click(screen.getByRole('button', { name: 'Opciones', exact: true }));
  await user.click(screen.getByRole('button', { name: 'Botones de columnas', exact: true }));
  fireEvent.change(screen.getByRole('textbox', { name: 'Fondo botón normal', exact: true }), { target: { value: '#abcdef' } });
  await user.click(screen.getByRole('button', { name: 'Guardar cambios', exact: true }));
  await screen.findByText('Cambios guardados. La página pública ya usa esta configuración.');
  expect(lastPayload.catalogConfig).toMatchObject({ showSearch: false, defaultSort: 'price', filterUiConfig: { panelBg: '#123456' }, cardUiConfig: { cardBg: '#654321' }, columnControlsUiConfig: { buttonBgColor: '#abcdef' } });
});
