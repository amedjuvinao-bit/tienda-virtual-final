import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import PagesAdmin from "./PagesAdmin";
let permissions;
vi.mock("../security/useAdminPermissions", () => ({
  default: () => ({ can: (permission) => permissions.includes(permission) }),
}));
const pages = [
  {
    _id: "catalog",
    name: "Promoción de verano",
    slug: "verano",
    pageType: "catalog",
    enabled: true,
  },
  {
    _id: "cart",
    name: "Mi carrito",
    slug: "carrito",
    pageType: "custom",
    enabled: true,
  },
  {
    _id: "custom",
    name: "Nuestra historia",
    slug: "historia",
    pageType: "custom",
    enabled: false,
  },
];
function Destination() {
  return <output>{useLocation().pathname}</output>;
}
function mount() {
  return render(
    <MemoryRouter initialEntries={["/admin/paginas"]}>
      <Routes>
        <Route path="/admin/paginas" element={<PagesAdmin />} />
        <Route path="*" element={<Destination />} />
      </Routes>
    </MemoryRouter>,
  );
}
beforeEach(() => {
  permissions = ["pages:create", "pages:update", "pages:delete"];
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok: true, json: async () => pages })),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
describe("administración de páginas", () => {
  it("prioriza el listado, combina búsqueda y filtros y protege las páginas del sistema", async () => {
    const user = userEvent.setup();
    mount();
    await screen.findByRole("button", { name: "Editar Promoción de verano" });
    expect(
      screen.queryByLabelText("Nombre de la página"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Eliminar Mi carrito" }),
    ).not.toBeInTheDocument();
    await user.type(
      screen.getByRole("textbox", { name: "Buscar páginas" }),
      "promocion",
    );
    expect(
      screen.getByRole("heading", { name: "Promoción de verano" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Nuestra historia" }),
    ).not.toBeInTheDocument();
    await user.selectOptions(
      screen.getByLabelText("Filtrar por estado"),
      "inactive",
    );
    expect(screen.getByText("No hay coincidencias")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Limpiar filtros" }));
    expect(
      screen.getByRole("heading", { name: "Nuestra historia" }),
    ).toBeInTheDocument();
  });
  it("genera la dirección mientras se escribe y respeta la dirección personalizada antes de crear y editar", async () => {
    const user = userEvent.setup();
    mount();
    await screen.findByRole("heading", { name: "Promoción de verano" });
    await user.click(screen.getByRole("button", { name: "Nueva página" }));
    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByRole("radio", { name: /Catálogo/ }));
    await user.click(within(dialog).getByRole("button", { name: "Continuar" }));
    await user.type(
      within(dialog).getByLabelText("Nombre de la página"),
      "Nueva promoción",
    );
    const address = within(dialog).getByLabelText("Dirección de la página", {
      exact: false,
    });
    expect(address).toHaveValue("nueva-promocion");
    await user.clear(address);
    await user.type(address, "campana-especial");
    await user.type(
      within(dialog).getByLabelText("Nombre de la página"),
      " 2027",
    );
    expect(address).toHaveValue("campana-especial");
    fetch.mockImplementation(async (url, options) => ({
      ok: true,
      json: async () =>
        options?.method === "POST"
          ? { ...JSON.parse(options.body), _id: "new-page" }
          : pages,
    }));
    await user.click(
      within(dialog).getByRole("button", { name: "Crear y editar" }),
    );
    expect(
      await screen.findByText("/admin/catalogo/new-page"),
    ).toBeInTheDocument();
    const payload = JSON.parse(
      fetch.mock.calls.find(([, options]) => options?.method === "POST")[1]
        .body,
    );
    expect(payload).toMatchObject({
      name: "Nueva promoción 2027",
      slug: "campana-especial",
      pageType: "catalog",
      catalogConfig: {},
      blocks: [],
    });
  });
  it("conserva los datos cuando falla la creación y permite reintentar", async () => {
    const user = userEvent.setup();
    mount();
    await screen.findByRole("heading", { name: "Promoción de verano" });
    await user.click(screen.getByRole("button", { name: "Nueva página" }));
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    await user.type(screen.getByLabelText("Nombre de la página"), "Mi página");
    fetch.mockResolvedValue({
      ok: false,
      json: async () => ({ message: "La dirección ya está en uso." }),
    });
    await user.click(screen.getByRole("button", { name: "Crear y editar" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "La dirección ya está en uso.",
    );
    expect(screen.getByLabelText("Nombre de la página")).toHaveValue(
      "Mi página",
    );
  });
  it("mantiene las acciones de escritura fuera del alcance de un perfil de consulta", async () => {
    permissions = ["pages:view"];
    mount();
    await screen.findByRole("heading", { name: "Promoción de verano" });
    expect(
      screen.queryByRole("button", { name: "Nueva página" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Editar/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Eliminar/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Ver Promoción de verano" }),
    ).toHaveAttribute("href", "/pagina/verano");
  });
  it("confirma la eliminación en la fila y preserva las demás páginas", async () => {
    const user = userEvent.setup();
    mount();
    await screen.findByRole("heading", { name: "Promoción de verano" });
    await user.click(
      screen.getByRole("button", { name: "Eliminar Nuestra historia" }),
    );
    expect(fetch.mock.calls.every(([, options]) => !options?.method)).toBe(
      true,
    );
    fetch.mockResolvedValue({ ok: true, json: async () => ({}) });
    await user.click(screen.getByRole("button", { name: "Sí, eliminar" }));
    await waitFor(() =>
      expect(
        screen.queryByRole("heading", { name: "Nuestra historia" }),
      ).not.toBeInTheDocument(),
    );
    expect(
      screen.getByRole("heading", { name: "Promoción de verano" }),
    ).toBeInTheDocument();
    expect(
      fetch.mock.calls.some(
        ([url, options]) =>
          url.endsWith("/custom") && options?.method === "DELETE",
      ),
    ).toBe(true);
  });
});
