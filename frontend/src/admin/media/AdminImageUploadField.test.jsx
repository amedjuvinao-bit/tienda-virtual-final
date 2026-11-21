import React, { useState } from "react";
import { afterEach, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import AdminImageUploadField from "./AdminImageUploadField";
import ProductDetailAppearanceControls from "../pages/workspace/ProductDetailAppearanceControls";
import { buildSafeProductDetailConfig } from "../../components/product-detail/productDetailConfig";
import { adminFetch } from "../../lib/api";
vi.mock("../../lib/api", () => ({ adminFetch: vi.fn() }));
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});
const file = () => new File(["png"], "fondo.png", { type: "image/png" });
it("envía el archivo al backend y aplica la respuesta de Cloudinary sin pedir direcciones", async () => {
  const change = vi.fn(),
    busy = vi.fn();
  adminFetch.mockResolvedValue({
    ok: true,
    json: async () => ({
      url: "https://res.cloudinary.com/demo/image/upload/fondo.png",
    }),
  });
  render(
    <AdminImageUploadField
      label="Fondo"
      value=""
      onChange={change}
      onBusyChange={busy}
    />,
  );
  expect(screen.queryByRole("textbox")).toBeNull();
  const selected = file();
  fireEvent.change(screen.getByLabelText("Seleccionar imagen de Fondo"), {
    target: { files: [selected] },
  });
  await waitFor(() =>
    expect(change).toHaveBeenCalledWith(
      "https://res.cloudinary.com/demo/image/upload/fondo.png",
    ),
  );
  expect(adminFetch.mock.calls[0][0]).toMatch(/\/api\/uploads$/);
  expect(adminFetch.mock.calls[0][1].body.get("image")).toBe(selected);
  expect(busy.mock.calls.map((call) => call[0])).toEqual([true, false]);
});
it("conserva la imagen anterior cuando el archivo o la carga son rechazados", async () => {
  const change = vi.fn();
  render(
    <AdminImageUploadField
      label="Fondo"
      value="/anterior.webp"
      onChange={change}
    />,
  );
  fireEvent.change(screen.getByLabelText("Seleccionar imagen de Fondo"), {
    target: {
      files: [new File(["x"], "archivo.pdf", { type: "application/pdf" })],
    },
  });
  expect(adminFetch).not.toHaveBeenCalled();
  adminFetch.mockResolvedValue({
    ok: false,
    json: async () => ({ error: "No fue posible cargar la imagen" }),
  });
  fireEvent.change(screen.getByLabelText("Seleccionar imagen de Fondo"), {
    target: { files: [file()] },
  });
  await screen.findByText("No fue posible cargar la imagen");
  expect(change).not.toHaveBeenCalled();
  expect(screen.getByAltText("Fondo")).toHaveAttribute("src", "/anterior.webp");
});
it("cancela una carga al salir del control y no aplica respuestas atrasadas", async () => {
  let resolve;
  adminFetch.mockImplementation(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  const change = vi.fn(),
    busy = vi.fn();
  const view = render(
    <AdminImageUploadField
      label="Fondo"
      value=""
      onChange={change}
      onBusyChange={busy}
    />,
  );
  fireEvent.change(screen.getByLabelText("Seleccionar imagen de Fondo"), {
    target: { files: [file()] },
  });
  const signal = adminFetch.mock.calls[0][1].signal;
  view.unmount();
  expect(signal.aborted).toBe(true);
  await act(async () =>
    resolve({
      ok: true,
      json: async () => ({
        url: "https://res.cloudinary.com/demo/atrasada.png",
      }),
    }),
  );
  expect(change).not.toHaveBeenCalled();
  expect(busy).toHaveBeenLastCalledWith(false);
});
function Editor() {
  const [config, setConfig] = useState(() =>
    buildSafeProductDetailConfig({
      presentation: { backgroundMode: "custom", mediaVersion: 1 },
    }),
  );
  return (
    <>
      <ProductDetailAppearanceControls config={config} onChange={setConfig} />
      <button
        onClick={() =>
          setConfig((current) => ({
            ...current,
            titleOverride: "Editado durante la carga",
          }))
        }
      >
        Cambiar título
      </button>
      <output data-testid="draft">{JSON.stringify(config)}</output>
    </>
  );
}
it("conserva dos cargas simultáneas y los cambios del editor mientras se suben", async () => {
  const resolves = [];
  adminFetch.mockImplementation(
    () => new Promise((resolve) => resolves.push(resolve)),
  );
  render(<Editor />);
  fireEvent.change(
    screen.getByLabelText("Seleccionar imagen de Imagen de fondo"),
    { target: { files: [file()] } },
  );
  fireEvent.change(
    screen.getByLabelText(
      "Seleccionar imagen de Imagen de fondo móvil (opcional)",
    ),
    { target: { files: [file()] } },
  );
  fireEvent.click(screen.getByRole("button", { name: "Cambiar título" }));
  await act(async () => {
    resolves[0]({
      ok: true,
      json: async () => ({
        url: "https://res.cloudinary.com/demo/escritorio.png",
      }),
    });
    resolves[1]({
      ok: true,
      json: async () => ({ url: "https://res.cloudinary.com/demo/movil.png" }),
    });
  });
  expect(JSON.parse(screen.getByTestId("draft").textContent)).toMatchObject({
    titleOverride: "Editado durante la carga",
    presentation: {
      backgroundImage: "https://res.cloudinary.com/demo/escritorio.png",
      mobileBackgroundImage: "https://res.cloudinary.com/demo/movil.png",
    },
  });
});
