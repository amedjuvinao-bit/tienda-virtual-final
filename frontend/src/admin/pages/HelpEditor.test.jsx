import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
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
      _id: "help",
      name: "Centro de ayuda",
      slug: "preguntas-frecuentes",
      systemRole: "help",
      pageType: "information",
      informationPageConfig: {
        extension: true,
        help: { extension: { keep: true } },
      },
    },
    writes = 0;
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
    <MemoryRouter initialEntries={["/edit/help"]}>
      <Routes>
        <Route path="/edit/:id" element={<InformationPageEditor />} />
      </Routes>
    </MemoryRouter>,
  );
  return { stored: () => stored, writes: () => writes };
}
it("groups the editor by purpose and saves complete answers, actions and extensions without changing the fixed identity", async () => {
  const state = mount();
  await screen.findByLabelText("Texto del título");
  expect(screen.getByLabelText("Diseño de la página")).toHaveValue("help");
  expect(
    screen.queryByRole("button", { name: "Canales de contacto", exact: true }),
  ).toBeNull();
  fireEvent.click(
    screen.getByRole("button", { name: "Preguntas y respuestas", exact: true }),
  );
  expect(screen.getByLabelText("Pregunta")).toHaveValue(
    "¿Cómo realizo una compra?",
  );
  fireEvent.change(screen.getByLabelText("Respuesta publicada"), {
    target: { value: "Respuesta comercial revisada por el negocio." },
  });
  expect(state.writes()).toBe(0);
  fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
  await screen.findByText(
    "Cambios guardados. La página pública ya usa esta configuración.",
  );
  expect(state.stored().informationPageConfig).toMatchObject({
    extension: true,
    help: { extension: { keep: true } },
  });
  expect(
    state.stored().informationPageConfig.help.categories[0].questions[0],
  ).toMatchObject({
    answer: "Respuesta comercial revisada por el negocio.",
    actionHref: "/#categorias",
  });
  fireEvent.click(screen.getByRole("button", { name: "Ajustes", exact: true }));
  expect(screen.getByLabelText("Dirección de la página")).toHaveAttribute(
    "readonly",
  );
});
it("keeps a new question unpublished and blocks incomplete content when it is made visible", async () => {
  const state = mount();
  await screen.findByLabelText("Texto del título");
  fireEvent.click(
    screen.getByRole("button", { name: "Preguntas y respuestas", exact: true }),
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Añadir pregunta", exact: true }),
  );
  expect(screen.getByLabelText("Publicar esta respuesta")).not.toBeChecked();
  fireEvent.click(screen.getByLabelText("Publicar esta respuesta"));
  fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
  await screen.findByText(/Cada pregunta visible necesita/);
  expect(state.writes()).toBe(0);
  fireEvent.change(screen.getByLabelText("Pregunta"), {
    target: { value: "¿Cómo consulto una duda?" },
  });
  fireEvent.change(screen.getByLabelText("Respuesta publicada"), {
    target: { value: "Puedes utilizar nuestros canales de atención." },
  });
  fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
  await screen.findByText(
    "Cambios guardados. La página pública ya usa esta configuración.",
  );
  expect(
    state.stored().informationPageConfig.help.categories[0].questions.at(-1),
  ).toMatchObject({
    enabled: true,
    answer: "Puedes utilizar nuestros canales de atención.",
  });
});
