import React from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  cleanup,
  render,
  screen,
  waitFor,
  fireEvent,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import ThanksPageEditor from "./ThanksPageEditor";
vi.mock("./workspace/PageLivePreview", () => ({
  default: ({ draft }) => (
    <output data-testid="draft">{JSON.stringify(draft)}</output>
  ),
}));
let stored, lastPayload, failSave, dropSave, uploadRelease;
beforeEach(() => {
  stored = {
    _id: "cart",
    name: "Gracias",
    slug: "thanks",
    pageType: "thanks-page",
    useHeader: true,
    useFooter: true,
    thanksPageConfig: {
      designVersion: 3,
      titleMode: "text",
      titleText: "Tu thanks",
      extension: { preserve: true },
      style: { panelBg: "#ab6789" },
    },
  };
  lastPayload = null;
  failSave = false;
  dropSave = false;
  uploadRelease = null;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url, options = {}) => {
      if (options.method === "POST")
        return new Promise(
          (resolve) =>
            (uploadRelease = () =>
              resolve({
                ok: true,
                json: async () => ({
                  url: "https://res.cloudinary.com/demo/title.webp",
                }),
              })),
        );
      if (options.method === "PUT") {
        lastPayload = JSON.parse(options.body);
        if (!failSave && !dropSave) stored = { ...stored, ...lastPayload };
        return {
          ok: !failSave,
          json: async () =>
            failSave ? { message: "Error de guardado" } : stored,
        };
      }
      return { ok: true, json: async () => stored };
    }),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
function mount() {
  return render(
    <MemoryRouter initialEntries={["/admin/thanks-page/cart"]}>
      <Routes>
        <Route path="/admin/thanks-page/:id" element={<ThanksPageEditor />} />
        <Route path="/admin/paginas" element={<h1>Listado</h1>} />
      </Routes>
    </MemoryRouter>,
  );
}
it("actualiza el borrador, conserva extensiones y verifica lo guardado", async () => {
  const user = userEvent.setup();
  mount();
  await screen.findByLabelText("Texto del título");
  expect(
    screen.getByRole("button", { name: "Guardar cambios" }),
  ).toBeDisabled();
  await user.clear(screen.getByLabelText("Texto del título"));
  await user.type(screen.getByLabelText("Texto del título"), "Tu selección");
  expect(screen.getByTestId("draft")).toHaveTextContent("Tu selección");
  await user.click(screen.getByRole("button", { name: "Guardar cambios" }));
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: "Guardar cambios" }),
    ).toBeDisabled(),
  );
  expect(lastPayload.thanksPageConfig.extension).toEqual({ preserve: true });
  expect(lastPayload.thanksPageConfig.style.panelBg).toBe("#ab6789");
  expect(stored.thanksPageConfig.titleText).toBe("Tu selección");
});
it("avisa al salir con cambios y permite conservar el borrador", async () => {
  const user = userEvent.setup();
  mount();
  await screen.findByLabelText("Texto del título");
  await user.type(screen.getByLabelText("Texto del título"), " editado");
  const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
  await user.click(screen.getByRole("button", { name: "Páginas" }));
  expect(confirm).toHaveBeenCalledOnce();
  expect(screen.queryByText("Listado")).not.toBeInTheDocument();
  expect(screen.getByLabelText("Texto del título")).toHaveValue(
    "Tu thanks editado",
  );
});
it("bloquea guardar mientras carga la imagen y conserva el resto de los cambios", async () => {
  const user = userEvent.setup();
  mount();
  await screen.findByLabelText("Texto del título");
  await user.type(screen.getByLabelText("Texto del título"), " editado");
  await user.upload(
    screen.getByLabelText("Seleccionar imagen de Imagen del título"),
    new File(["image"], "titulo.png", { type: "image/png" }),
  );
  await waitFor(() => expect(uploadRelease).not.toBeNull());
  expect(
    screen.getByRole("button", { name: "Guardar cambios" }),
  ).toBeDisabled();
  uploadRelease();
  await screen.findByText(
    "Imagen cargada. Guarda los cambios para publicarla.",
  );
  expect(screen.getByLabelText("Texto del título")).toHaveValue(
    "Tu thanks editado",
  );
  await user.click(screen.getByRole("button", { name: "Guardar cambios" }));
  await waitFor(() =>
    expect(lastPayload.thanksPageConfig.titleImage).toContain(
      "res.cloudinary.com",
    ),
  );
});
it("mantiene el borrador si el servidor omite los cambios", async () => {
  dropSave = true;
  const user = userEvent.setup();
  mount();
  await screen.findByLabelText("Texto del título");
  await user.type(screen.getByLabelText("Texto del título"), " editado");
  await user.click(screen.getByRole("button", { name: "Guardar cambios" }));
  await screen.findByRole("alert");
  expect(screen.getByRole("alert")).toHaveTextContent(
    "no conservó todos los ajustes",
  );
  expect(screen.getByRole("button", { name: "Guardar cambios" })).toBeEnabled();
  expect(screen.getByLabelText("Texto del título")).toHaveValue(
    "Tu thanks editado",
  );
});

it("guarda textos de los próximos pasos y colores propios del diseño central", async () => {
  const user = userEvent.setup();
  mount();
  await screen.findByLabelText("Texto del título");
  await user.click(
    screen.getByRole("button", { name: "Próximos pasos", exact: true }),
  );
  const field = screen.getByLabelText("Título de preparación");
  await user.clear(field);
  await user.type(field, "Prepararemos tu selección");
  await user.click(screen.getByRole("button", { name: "Guardar cambios" }));
  await waitFor(() =>
    expect(stored.thanksPageConfig.preparationStepTitle).toBe(
      "Prepararemos tu selección",
    ),
  );
  expect(stored.thanksPageConfig.designVersion).toBe(3);
  expect(stored.thanksPageConfig.showVisualPanel).toBe(false);
  expect(stored.thanksPageConfig.style.panelBg).toBe("#ab6789");
});

it("restablece el diseño aprobado en el borrador y solo lo publica al guardar", async () => {
  const user = userEvent.setup();
  mount();
  await screen.findByLabelText("Texto del título");
  await user.click(screen.getByRole("button", { name: "Diseño", exact: true }));
  await user.click(
    screen.getByRole("button", { name: "Medidas y formas", exact: true }),
  );
  await user.click(
    screen.getByRole("button", {
      name: "Restablecer diseño aprobado",
      exact: true,
    }),
  );
  const draft = JSON.parse(screen.getByTestId("draft").textContent);
  expect(draft.thanksPageConfig.style.panelWidthPx).toBe(1000);
  expect(draft.thanksPageConfig.style.factValueColor).toBe("#74243e");
  expect(stored.thanksPageConfig.style.panelBg).toBe("#ab6789");
  expect(lastPayload).toBeNull();
  await user.click(
    screen.getByRole("button", { name: "Guardar cambios", exact: true }),
  );
  await waitFor(() =>
    expect(stored.thanksPageConfig.style.panelBg).toBe("#efb9b7"),
  );
  expect(stored.thanksPageConfig.titleText).toBe("Tu thanks");
  expect(stored.thanksPageConfig.extension).toEqual({ preserve: true });
});
