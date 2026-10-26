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
