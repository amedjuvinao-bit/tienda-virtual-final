import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import InformationPageEditor from "./InformationPageEditor";
vi.mock("./workspace/PageLivePreview", () => ({
  default: ({ draft }) => (
    <output data-testid="draft">{JSON.stringify(draft)}</output>
  ),
}));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
function mount() {
  let stored = {
    _id: "contact",
    name: "Contacto",
    slug: "contacto",
    systemRole: "contact",
    pageType: "information",
    informationPageConfig: { extension: true, contact: { extension: true } },
  };
  let writes = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url, options = {}) => {
      if (options.method === "PUT") {
        writes++;
        stored = { ...stored, ...JSON.parse(options.body) };
      }
      return { ok: true, json: async () => stored };
    }),
  );
  render(
    <MemoryRouter initialEntries={["/edit/contact"]}>
      <Routes>
        <Route path="/edit/:id" element={<InformationPageEditor />} />
      </Routes>
    </MemoryRouter>,
  );
  return { stored: () => stored, writes: () => writes };
}
it("groups Contacto by purpose, saves independent channel data and preserves its fixed route and extensions", async () => {
  const state = mount();
  await screen.findByLabelText("Texto del título");
  expect(screen.getByLabelText("Diseño de la página")).toHaveValue("contact");
  expect(
    screen.queryByRole("button", {
      name: "Recuerdos y fotografías",
      exact: true,
    }),
  ).toBeNull();
  fireEvent.click(
    screen.getByRole("button", { name: "Canales de contacto", exact: true }),
  );
  fireEvent.change(screen.getByLabelText("Datos de WhatsApp"), {
    target: { value: "custom" },
  });
  fireEvent.change(screen.getByLabelText("Número de WhatsApp con indicativo"), {
    target: { value: "+12025550123" },
  });
  fireEvent.change(screen.getByLabelText("Mensaje inicial de WhatsApp"), {
    target: { value: "Consulta desde la tienda" },
  });
  expect(state.writes()).toBe(0);
  fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
  await screen.findByText(
    "Cambios guardados. La página pública ya usa esta configuración.",
  );
  expect(state.stored().informationPageConfig).toMatchObject({
    extension: true,
    layout: "contact",
    contact: {
      extension: true,
      whatsappSource: "custom",
      whatsappPhone: "+12025550123",
      whatsappMessage: "Consulta desde la tienda",
    },
  });
  fireEvent.click(screen.getByRole("button", { name: "Ajustes", exact: true }));
  expect(screen.getByLabelText("Dirección de la página")).toHaveAttribute(
    "readonly",
  );
});
it("keeps invalid coordinates in the draft and blocks publication until both coordinates are valid", async () => {
  const state = mount();
  await screen.findByLabelText("Texto del título");
  fireEvent.click(
    screen.getByRole("button", { name: "Ubicación y mapa", exact: true }),
  );
  fireEvent.click(
    screen.getByRole("button", {
      name: "Punto exacto en el mapa",
      exact: true,
    }),
  );
  fireEvent.change(screen.getByLabelText("Latitud del negocio"), {
    target: { value: "0" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
  await screen.findByText(/Escribe ambas coordenadas/);
  expect(state.writes()).toBe(0);
  fireEvent.change(screen.getByLabelText("Longitud del negocio"), {
    target: { value: "0" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
  await screen.findByText(
    "Cambios guardados. La página pública ya usa esta configuración.",
  );
  expect(state.stored().informationPageConfig.contact).toMatchObject({
    latitude: "0",
    longitude: "0",
  });
});
