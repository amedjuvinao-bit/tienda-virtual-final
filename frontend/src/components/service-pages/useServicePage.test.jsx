import React from "react";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import useServicePage from "./useServicePage";
function Probe() {
  const state = useServicePage("returns-page");
  return (
    <>
      <output>
        {state.loading ? "loading" : state.error || state.config.titleText}
      </output>
      <button onClick={state.retry}>Retry</button>
    </>
  );
}
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
it("carga la configuración correcta y permite reintentar sin ocultar errores", async () => {
  let calls = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      ++calls === 1
        ? { ok: false }
        : {
            ok: true,
            json: async () => ({
              pageType: "returns-page",
              returnsPageConfig: { titleText: "Tu centro de ayuda" },
            }),
          },
    ),
  );
  render(
    <MemoryRouter>
      <Probe />
    </MemoryRouter>,
  );
  await screen.findByText("No pudimos cargar la configuración de esta página.");
  fireEvent.click(screen.getByText("Retry"));
  await screen.findByText("Tu centro de ayuda");
});
it("aborta al desmontar y rechaza configuraciones de otro tipo", async () => {
  let signal;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url, options) => {
      signal = options.signal;
      return { ok: true, json: async () => ({ pageType: "search-page" }) };
    }),
  );
  const view = render(
    <MemoryRouter>
      <Probe />
    </MemoryRouter>,
  );
  await screen.findByText("La configuración no corresponde a esta página.");
  view.unmount();
  expect(signal.aborted).toBe(true);
});
