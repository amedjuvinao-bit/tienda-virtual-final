import React from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import NotFound from "./NotFound";
vi.mock("../components/Header", () => ({ default: () => null }));
vi.mock("../components/FooterSection", () => ({ default: () => null }));
vi.mock("../components/WhatsAppButton", () => ({ default: () => null }));
vi.mock("../components/StorefrontLoadingScreen", () => ({
  default: () => <div aria-label="Indicador configurado" />,
}));
const mount = () =>
  render(
    <MemoryRouter initialEntries={["/ruta-inexistente"]}>
      <NotFound />
    </MemoryRouter>,
  );
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
it("espera la configuración con el indicador compartido y permite reintentar un fallo", async () => {
  let release;
  const fetch = vi
    .fn()
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    )
    .mockResolvedValue({
      ok: true,
      json: async () => ({
        pageType: "notfound-page",
        notFoundPageConfig: { titleText: "Ruta recuperada" },
      }),
    });
  vi.stubGlobal("fetch", fetch);
  mount();
  expect(screen.getByLabelText("Indicador configurado")).toBeInTheDocument();
  release({ ok: false });
  await screen.findByRole("alert");
  fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
  expect(
    await screen.findByRole("heading", { name: "Ruta recuperada" }),
  ).toBeInTheDocument();
  expect(fetch).toHaveBeenCalledTimes(2);
});
it("aborta la petición al salir y no muestra el contenido temporal por defecto", () => {
  let signal;
  vi.stubGlobal(
    "fetch",
    vi.fn((_url, options) => {
      signal = options.signal;
      return new Promise(() => {});
    }),
  );
  const view = mount();
  expect(screen.queryByRole("heading")).not.toBeInTheDocument();
  view.unmount();
  expect(signal.aborted).toBe(true);
});
