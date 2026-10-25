import React from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import CartPageEditor from "./CartPageEditor";
vi.mock("./workspace/PageLivePreview", () => ({
  default: ({ draft }) => (
    <output data-testid="draft">{JSON.stringify(draft)}</output>
  ),
}));
let stored, lastPayload, failSave, dropSave, uploadRelease;
beforeEach(() => {
  stored = {
    _id: "cart",
    name: "Carrito",
    slug: "carrito",
    pageType: "cart-page",
    useHeader: true,
    useFooter: true,
    cartPageConfig: {
      titleMode: "text",
      titleText: "Tu carrito",
      extension: { preserve: true },
      modal: { widthPx: 430 },
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
    <MemoryRouter initialEntries={["/admin/cart-page/cart"]}>
      <Routes>
        <Route path="/admin/cart-page/:id" element={<CartPageEditor />} />
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
  expect(lastPayload.cartPageConfig.extension).toEqual({ preserve: true });
  expect(lastPayload.cartPageConfig.modal.widthPx).toBe(430);
  expect(stored.cartPageConfig.titleText).toBe("Tu selección");
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
    "Tu carrito editado",
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
    "Tu carrito editado",
  );
  await user.click(screen.getByRole("button", { name: "Guardar cambios" }));
  await waitFor(() =>
    expect(lastPayload.cartPageConfig.titleImage).toContain(
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
    "Tu carrito editado",
  );
});
