import React from "react";
import { afterEach, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import InformationPageEditor from "./InformationPageEditor";
vi.mock("./workspace/PageLivePreview", () => ({
  default: ({ draft }) => (
    <output data-testid="draft">{JSON.stringify(draft)}</output>
  ),
}));
vi.mock("../media/AdminImageUploadField", () => ({
  default: ({ label, onChange, onBusyChange }) => (
    <button
      onClick={() => {
        onBusyChange(true);
        onChange("https://res.cloudinary.com/demo/story.webp");
      }}
      type="button"
    >
      {label}
    </button>
  ),
}));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
function mount(initial = {}) {
  let stored = {
    _id: "info",
    name: "Nosotros",
    slug: "nosotros",
    systemRole: "about",
    pageType: "information",
    informationPageConfig: { extension: { keep: true } },
    ...initial,
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
  const view = render(
    <MemoryRouter initialEntries={["/edit/info"]}>
      <Routes>
        <Route path="/edit/:id" element={<InformationPageEditor />} />
      </Routes>
    </MemoryRouter>,
  );
  return { view, stored: () => stored, writes: () => writes };
}
it("edits content and sections, preserves extensions and saves the complete draft", async () => {
  const state = mount();
  fireEvent.change(await screen.findByLabelText("Texto del título"), {
    target: { value: "Nuestra identidad" },
  });
  fireEvent.click(
    screen.getByRole("button", { name: "Secciones de contenido", exact: true }),
  );
  fireEvent.change(screen.getByLabelText("Contenido de la sección"), {
    target: { value: "Nuestra historia real" },
  });
  expect(state.writes()).toBe(0);
  fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
  await screen.findByText(
    "Cambios guardados. La página pública ya usa esta configuración.",
  );
  expect(state.stored().informationPageConfig.extension).toEqual({
    keep: true,
  });
  expect(state.stored().informationPageConfig.sections[0].body).toBe(
    "Nuestra historia real",
  );
  expect(state.stored().informationPageConfig.titleText).toBe(
    "Nuestra identidad",
  );
  fireEvent.click(screen.getByRole("button", { name: "Ajustes", exact: true }));
  expect(screen.getByLabelText("Dirección de la página")).toHaveAttribute(
    "readonly",
  );
});
it("blocks saving and section removal while an image is uploading", async () => {
  mount();
  await screen.findByLabelText("Texto del título");
  fireEvent.click(
    screen.getByRole("button", { name: "Secciones de contenido", exact: true }),
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Imagen de la sección (opcional)" }),
  );
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: "Guardar cambios" }),
    ).toBeDisabled(),
  );
  expect(
    screen.getByRole("button", { name: "Eliminar sección" }),
  ).toBeDisabled();
  expect(
    screen.getByRole("button", { name: "Diseño", exact: true }),
  ).toBeDisabled();
});
it("keeps invalid link edits in the draft and reports them before sending", async () => {
  const state = mount();
  await screen.findByLabelText("Texto del título");
  fireEvent.click(
    screen.getByRole("button", { name: "Navegación y botón", exact: true }),
  );
  fireEvent.change(screen.getByLabelText("Destino del botón"), {
    target: { value: "javascript:alert(1)" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
  await screen.findByText(/Revisa el destino del botón/);
  expect(state.writes()).toBe(0);
  expect(screen.getByLabelText("Destino del botón")).toHaveValue(
    "javascript:alert(1)",
  );
});
it("agrupa el diseño de envíos y conserva pasos, textos y destinos al guardar y recargar", async () => {
  const state = mount({
    name: "Envíos y entregas",
    slug: "envios",
    systemRole: "consumer-shipping",
    informationPageConfig: { extension: { keep: true } },
  });
  await screen.findByLabelText("Texto del título");
  expect(
    screen.queryByRole("button", { name: "Temas y categorías", exact: true }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", {
      name: "Recuerdos y fotografías",
      exact: true,
    }),
  ).not.toBeInTheDocument();
  fireEvent.click(
    screen.getByRole("button", { name: "Proceso de entrega", exact: true }),
  );
  fireEvent.change(screen.getByLabelText("Título del paso"), {
    target: { value: "Confirmas tu compra" },
  });
  fireEvent.change(screen.getByLabelText("Descripción del paso"), {
    target: { value: "Revisa los datos antes de confirmar." },
  });
  fireEvent.click(
    screen.getByRole("button", {
      name: "Costo, plazo y cobertura",
      exact: true,
    }),
  );
  fireEvent.change(screen.getByLabelText("Explicación del costo"), {
    target: { value: "Consulta el valor final al comprar." },
  });
  fireEvent.click(
    screen.getByRole("button", { name: "Ayuda y enlaces", exact: true }),
  );
  fireEvent.change(screen.getByLabelText("Texto del botón de contacto"), {
    target: { value: "Hablar con nuestro equipo" },
  });
  fireEvent.change(screen.getByLabelText("Destino del botón de contacto"), {
    target: { value: "/contacto#ubicacion" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
  await screen.findByText(
    "Cambios guardados. La página pública ya usa esta configuración.",
  );
  const saved = state.stored();
  expect(saved.informationPageConfig).toMatchObject({
    extension: { keep: true },
    shipping: {
      costText: "Consulta el valor final al comprar.",
      contactText: "Hablar con nuestro equipo",
      contactHref: "/contacto#ubicacion",
    },
  });
  expect(saved.informationPageConfig.shipping.steps[0].title).toBe(
    "Confirmas tu compra",
  );
  state.view.unmount();
  mount(saved);
  await screen.findByLabelText("Texto del título");
  fireEvent.click(
    screen.getByRole("button", { name: "Proceso de entrega", exact: true }),
  );
  expect(screen.getByLabelText("Título del paso")).toHaveValue(
    "Confirmas tu compra",
  );
});
it("agrupa cambios por opciones, pasos y ayuda, conserva extensiones y recarga lo guardado", async () => {
  const state = mount({
    name: "Cambios y devoluciones",
    slug: "cambios-y-devoluciones",
    systemRole: "consumer-returns",
    informationPageConfig: { extension: { keep: true } },
  });
  await screen.findByLabelText("Texto del título");
  expect(
    screen.queryByRole("button", { name: "Proceso de entrega", exact: true }),
  ).not.toBeInTheDocument();
  fireEvent.click(
    screen.getByRole("button", { name: "Opciones de atención", exact: true }),
  );
  fireEvent.change(screen.getByLabelText("Título de la opción"), {
    target: { value: "Solicita tu cambio" },
  });
  fireEvent.change(screen.getByLabelText("Descripción de la opción"), {
    target: { value: "Conoce tus opciones de atención." },
  });
  fireEvent.click(
    screen.getByRole("button", { name: "Pasos de la solicitud", exact: true }),
  );
  fireEvent.change(screen.getByLabelText("Título del paso"), {
    target: { value: "Selecciona tu motivo" },
  });
  fireEvent.click(
    screen.getByRole("button", { name: "Ayuda y condiciones", exact: true }),
  );
  fireEvent.change(screen.getByLabelText("Texto del botón de seguimiento"), {
    target: { value: "Revisar mi radicado" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
  await screen.findByText(
    "Cambios guardados. La página pública ya usa esta configuración.",
  );
  const saved = state.stored();
  expect(saved.informationPageConfig.extension).toEqual({ keep: true });
  expect(saved.informationPageConfig.returnsGuide.choices[0].title).toBe(
    "Solicita tu cambio",
  );
  expect(saved.informationPageConfig.returnsGuide.steps[0].title).toBe(
    "Selecciona tu motivo",
  );
  expect(saved.informationPageConfig.returnsGuide.trackText).toBe(
    "Revisar mi radicado",
  );
  state.view.unmount();
  mount(saved);
  await screen.findByLabelText("Texto del título");
  fireEvent.click(
    screen.getByRole("button", { name: "Opciones de atención", exact: true }),
  );
  expect(screen.getByLabelText("Título de la opción")).toHaveValue(
    "Solicita tu cambio",
  );
});
it("la ilustración de cambios usa carga de imagen y bloquea guardar o navegar durante la subida", async () => {
  mount({
    name: "Cambios",
    slug: "cambios-y-devoluciones",
    systemRole: "consumer-returns",
  });
  await screen.findByLabelText("Texto del título");
  fireEvent.click(screen.getByRole("button", { name: "Diseño", exact: true }));
  fireEvent.click(
    screen.getByRole("button", { name: "Composición de cambios", exact: true }),
  );
  fireEvent.click(
    screen.getByRole("button", {
      name: "Ilustración de cambios y devoluciones",
      exact: true,
    }),
  );
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: "Guardar cambios" }),
    ).toBeDisabled(),
  );
  expect(
    screen.getByRole("button", { name: "Contenido", exact: true }),
  ).toBeDisabled();
});
