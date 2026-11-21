import React from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import InformationPageEditor from "./InformationPageEditor";
vi.mock("./workspace/PageLivePreview", () => ({
  default: ({ draft }) => (
    <output data-testid="draft">{JSON.stringify(draft)}</output>
  ),
}));
vi.mock("../media/AdminImageUploadField", () => ({
  default: ({ label }) => <p>{label}</p>,
}));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
function setup(moments = []) {
  let stored = {
    _id: "info",
    name: "Nosotros",
    slug: "nosotros",
    pageType: "information",
    systemRole: "about",
    informationPageConfig: {
      extension: { keep: true },
      journal: { extension: { keep: true }, moments },
    },
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
    <MemoryRouter initialEntries={["/edit/info"]}>
      <Routes>
        <Route path="/edit/:id" element={<InformationPageEditor />} />
      </Routes>
    </MemoryRouter>,
  );
  return { stored: () => stored, writes: () => writes };
}
it("edits the complete journal and saves real moments without losing extensions", async () => {
  const state = setup([
    { id: "real", title: "Encuentro", image: "/real.webp", enabled: true },
  ]);
  await screen.findByLabelText("Texto del título");
  fireEvent.click(
    screen.getByRole("button", {
      name: "Recuerdos y fotografías",
      exact: true,
    }),
  );
  fireEvent.change(screen.getByLabelText("Historia completa"), {
    target: { value: "Nuestra historia real" },
  });
  fireEvent.change(screen.getByLabelText("Categoría del recuerdo"), {
    target: { value: "Equipo" },
  });
  fireEvent.change(screen.getByLabelText("Fecha del recuerdo (opcional)"), {
    target: { value: "2026-06-03" },
  });
  fireEvent.click(screen.getByLabelText("Destacar al abrir la página"));
  fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
  await screen.findByText(
    "Cambios guardados. La página pública ya usa esta configuración.",
  );
  expect(state.stored().informationPageConfig.journal.moments[0]).toMatchObject(
    { story: "Nuestra historia real", category: "Equipo", date: "2026-06-03" },
  );
  expect(state.stored().informationPageConfig.journal.featuredId).toBe("real");
  expect(state.stored().informationPageConfig.journal.extension).toEqual({
    keep: true,
  });
  expect(state.stored().informationPageConfig.extension).toEqual({
    keep: true,
  });
});
it("blocks incomplete visible memories before sending and lets them be hidden", async () => {
  const state = setup();
  await screen.findByLabelText("Texto del título");
  fireEvent.click(
    screen.getByRole("button", {
      name: "Recuerdos y fotografías",
      exact: true,
    }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Añadir recuerdo" }));
  fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
  await screen.findByText(/Cada recuerdo visible necesita/);
  expect(state.writes()).toBe(0);
  fireEvent.click(screen.getByLabelText("Mostrar este recuerdo"));
  fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
  await screen.findByText(
    "Cambios guardados. La página pública ya usa esta configuración.",
  );
  expect(state.stored().informationPageConfig.journal.moments[0].enabled).toBe(
    false,
  );
});
