import React, { useState } from "react";
import { afterEach, expect, it, vi } from "vitest";
import {
  cleanup,
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CatalogAppearancePanel from "./CatalogAppearancePanel";
import { buildSafeCatalogConfig } from "../../../components/catalog/catalogConfig";
import { adminFetch } from "../../../lib/api";
vi.mock("../../../lib/api", () => ({ adminFetch: vi.fn() }));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
const initial = () =>
  buildSafeCatalogConfig({
    title: "Mi catálogo",
    presentation: {
      styleVersion: 5,
      filterVersion: 1,
      headerVersion: 1,
      glassPaletteVersion: 2,
    },
    cardUiConfig: { imageFit: "contain" },
  });
function Editor({ collection }) {
  const [config, setConfig] = useState(() => collection
    ? buildSafeCatalogConfig({ ...initial(), collection }) : initial()),
    [section, setSection] = useState("visual"),
    [busy, setBusy] = useState(false);
  const change = (scope, patch) =>
    setConfig((current) =>
      scope === "catalog"
        ? { ...current, ...patch }
        : { ...current, [scope]: { ...current[scope], ...patch } },
    );
  return (
    <>
      <nav>
        {[
          "visual",
          "header",
          "grid",
          "card-style",
          "filter-style",
          "motion",
        ].map((key) => (
          <button
            key={key}
            onClick={() => setSection(key)}
          >{`Sección: ${key}`}</button>
        ))}
      </nav>
      <CatalogAppearancePanel
        key={section}
        section={section}
        config={config}
        onChange={change}
        onUploadingChange={setBusy}
      />
      <output data-testid="config">{JSON.stringify(config)}</output>
      <output data-testid="busy">{String(busy)}</output>
    </>
  );
}
it("Adorno carga la ilustración de una selección y conserva las ediciones durante la subida", async () => {
  let complete;
  adminFetch.mockImplementation(() => new Promise(resolve => { complete = resolve; }));
  render(<Editor collection={{ heroArtwork: "/catalog/crystal-complements.webp", artworkWidthPx: 320, extension: true }} />);
  fireEvent.click(screen.getByRole("button", { name: "Sección: header" }));
  fireEvent.click(screen.getByRole("tab", { name: "Adorno", exact: true }));
  expect(screen.queryByLabelText("Adorno del encabezado")).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Seleccionar imagen de Ilustración del catálogo"), {
    target: { files: [new File(["png"], "bautizos-cristal.png", { type: "image/png" })] },
  });
  expect(screen.getByTestId("busy")).toHaveTextContent("true");
  const [url, request] = adminFetch.mock.calls[0];
  expect(url).toMatch(/\/api\/uploads$/);
  expect(request.body.get("image").name).toBe("bautizos-cristal.png");
  fireEvent.change(screen.getByLabelText("Ancho de la ilustración (px)"), { target: { value: "280" } });
  fireEvent.click(screen.getByRole("tab", { name: "Tipografía", exact: true }));
  fireEvent.change(screen.getByLabelText("Tamaño del título de catálogo (px)"), { target: { value: "52" } });
  await act(async () => complete({ ok: true, json: async () => ({ url: "https://res.cloudinary.com/demo/image/upload/bautizos.png" }) }));
  await waitFor(() => expect(screen.getByTestId("busy")).toHaveTextContent("false"));
  expect(JSON.parse(screen.getByTestId("config").textContent)).toMatchObject({
    collection: { heroArtwork: "https://res.cloudinary.com/demo/image/upload/bautizos.png", artworkWidthPx: "280", extension: true },
    presentation: { titleSize: 52 },
  });
  fireEvent.click(screen.getByRole("tab", { name: "Adorno", exact: true }));
  fireEvent.click(screen.getByRole("button", { name: "Quitar imagen", exact: true }));
  expect(JSON.parse(screen.getByTestId("config").textContent).collection.heroArtwork).toBe("");
});
it("los catálogos anteriores conservan el selector de adorno que sí utiliza su encabezado", () => {
  render(<Editor />);
  fireEvent.click(screen.getByRole("button", { name: "Sección: header" }));
  fireEvent.click(screen.getByRole("tab", { name: "Adorno", exact: true }));
  expect(screen.getByLabelText("Adorno del encabezado")).toBeVisible();
  expect(screen.queryByLabelText("Seleccionar imagen de Ilustración del catálogo")).not.toBeInTheDocument();
});
it("agrupa por tema y conserva cambios de filtros, tarjetas y encabezado al navegar", async () => {
  const user = userEvent.setup();
  render(<Editor />);
  const before = JSON.parse(screen.getByTestId("config").textContent);
  expect(
    screen.getByRole("tab", { name: "Fondo", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  expect(
    screen.getByRole("button", {
      name: "Aplicar paleta de cristal",
      hidden: true,
    }),
  ).not.toBeVisible();
  await user.click(
    screen.getByRole("button", { name: "Sección: filter-style" }),
  );
  await user.click(screen.getByRole("tab", { name: "Bordes y espacios" }));
  fireEvent.change(screen.getByLabelText("Ancho borde (px)"), {
    target: { value: "0" },
  });
  await user.click(screen.getByRole("tab", { name: "Texto", exact: true }));
  fireEvent.change(screen.getByLabelText("Tamaño texto contenido (px)"), {
    target: { value: "15" },
  });
  await user.click(screen.getByRole("button", { name: "Sección: card-style" }));
  fireEvent.change(screen.getByLabelText("Ajuste de imagen"), {
    target: { value: "cover" },
  });
  await user.click(screen.getByRole("button", { name: "Sección: header" }));
  await user.click(screen.getByRole("tab", { name: "Tipografía" }));
  fireEvent.change(
    screen.getByLabelText("Tamaño del título de catálogo (px)"),
    { target: { value: "52" } },
  );
  await user.click(
    screen.getByRole("button", { name: "Sección: filter-style" }),
  );
  await user.click(screen.getByRole("tab", { name: "Texto", exact: true }));
  expect(screen.getByLabelText("Tamaño texto contenido (px)")).toHaveValue(15);
  const after = JSON.parse(screen.getByTestId("config").textContent);
  expect(after).toMatchObject({
    title: before.title,
    sourceMode: before.sourceMode,
    filterUiConfig: { borderWidthPx: 0, contentTextSizePx: 15 },
    cardUiConfig: { imageFit: "cover" },
    presentation: { titleSize: 52 },
  });
});
it("permite recorrer los apartados con teclado sin modificar la configuración", async () => {
  const user = userEvent.setup();
  render(<Editor />);
  const before = screen.getByTestId("config").textContent;
  const tab = screen.getByRole("tab", { name: "Fondo", exact: true });
  tab.focus();
  await user.keyboard("{ArrowRight}");
  expect(
    screen.getByRole("tab", { name: "Cristal", exact: true }),
  ).toHaveFocus();
  expect(screen.getByLabelText("Tinte del cristal")).toBeVisible();
  expect(screen.getByLabelText("Origen del fondo")).not.toBeVisible();
  await user.keyboard("{End}");
  expect(
    screen.getByRole("button", { name: "Aplicar paleta de cristal" }),
  ).toBeVisible();
  expect(screen.getByTestId("config").textContent).toBe(before);
});
it("completa una subida aunque cambies de categoría sin sobrescribir las otras ediciones", async () => {
  let complete;
  adminFetch.mockReturnValue(
    new Promise((resolve) => {
      complete = resolve;
    }),
  );
  const user = userEvent.setup();
  render(<Editor />);
  await user.selectOptions(screen.getByLabelText("Origen del fondo"), "custom");
  await user.upload(
    screen.getByLabelText("Subir imagen de fondo"),
    new File(["image"], "fondo.webp", { type: "image/webp" }),
  );
  expect(screen.getByTestId("busy")).toHaveTextContent("true");
  await user.click(screen.getByRole("button", { name: "Sección: card-style" }));
  fireEvent.change(screen.getByLabelText("Ajuste de imagen"), {
    target: { value: "cover" },
  });
  complete({
    ok: true,
    json: async () => ({ url: "https://example.test/fondo.webp" }),
  });
  await waitFor(() =>
    expect(screen.getByTestId("busy")).toHaveTextContent("false"),
  );
  expect(JSON.parse(screen.getByTestId("config").textContent)).toMatchObject({
    presentation: { backgroundImage: "https://example.test/fondo.webp" },
    cardUiConfig: { imageFit: "cover" },
  });
});
