import React from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import ReturnsPageEditor from "./ReturnsPageEditor";
import SearchPageEditor from "./SearchPageEditor";
vi.mock("./workspace/PageLivePreview", () => ({
  default: ({ draft }) => (
    <output data-testid="draft">{JSON.stringify(draft)}</output>
  ),
}));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
for (const [type, key, Editor] of [
  ["returns-page", "returnsPageConfig", ReturnsPageEditor],
  ["search-page", "searchPageConfig", SearchPageEditor],
]) {
  it(`${type}: edita por temas, guarda y recarga contenido y colores sin perder extensiones`, async () => {
    let stored = {
      _id: "service",
      pageType: type,
      [key]: { titleText: "Original", extension: { keep: true } },
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
    const mount = () =>
      render(
        <MemoryRouter initialEntries={["/edit/service"]}>
          <Routes>
            <Route path="/edit/:id" element={<Editor />} />
          </Routes>
        </MemoryRouter>,
      );
    const user = userEvent.setup();
    const view = mount();
    const title = await screen.findByLabelText("Texto del título");
    await user.clear(title);
    await user.type(title, "Tu tienda");
    await user.click(
      screen.getByRole("button", { name: "Diseño", exact: true }),
    );
    await user.click(
      screen.getByRole("button", { name: "Colores", exact: true }),
    );
    const draft = JSON.parse(screen.getByTestId("draft").textContent);
    expect(draft[key].titleText).toBe("Tu tienda");
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));
    await screen.findByText(
      "Cambios guardados. La página pública ya usa esta configuración.",
    );
    expect(writes).toBe(1);
    expect(stored[key].extension).toEqual({ keep: true });
    view.unmount();
    mount();
    expect(await screen.findByLabelText("Texto del título")).toHaveValue(
      "Tu tienda",
    );
  });
}
