import React from "react";
import { afterEach, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import {
  buildInformationConfig,
  informationConfigForPage,
} from "./informationPageConfig";
import {
  buildMemoryJournal,
  memoryDate,
  memoryWindow,
  validateMemoryJournal,
  visibleMemories,
} from "./memoryJournalConfig";
import MemoryTable from "./MemoryTable";
afterEach(cleanup);
const moments = [
  {
    id: "first",
    title: "Primer día",
    image: "/one.webp",
    date: "2026-01-12",
    category: "Equipo",
    story: "Historia del primer día",
  },
  {
    id: "second",
    title: "Un logro",
    image: "/two.webp",
    date: "2026-06-03",
    category: "Celebraciones",
    story: "Una historia completa",
    gallery: [
      {
        image: "/extra.webp",
        alt: "Otro ángulo",
        caption: "Nuestro encuentro",
      },
    ],
  },
  {
    id: "third",
    title: "Nuestro equipo",
    image: "/three.webp",
    date: "2026-11-15",
    category: "Equipo",
  },
  { id: "hidden", title: "Oculto", image: "/private.webp", enabled: false },
];
function Location() {
  const location = useLocation();
  return <output data-testid="url">{location.search}</output>;
}
function mount(raw = {}, preview = false, url = "/nosotros") {
  const config = buildInformationConfig({
    layout: "memory-table",
    journal: { moments, featuredId: "second", ...raw },
  });
  render(
    <MemoryRouter initialEntries={[url]}>
      <Location />
      <MemoryTable config={config} name="Nosotros" preview={preview} />
    </MemoryRouter>,
  );
  return config;
}
it("adopts the approved layout only for Nosotros and preserves content and custom settings", () => {
  const page = {
    name: "Nosotros",
    systemRole: "about",
    informationPageConfig: {
      titleText: "Nuestra identidad",
      extension: { keep: true },
      sections: [
        {
          id: "a",
          title: "Un recuerdo real",
          image: "/real.webp",
          body: "Nuestra historia",
        },
      ],
      presentation: { borderWidth: 0, reflection: 0 },
    },
  };
  const config = informationConfigForPage(page);
  expect(config.layout).toBe("memory-table");
  expect(config.titleText).toBe("Nuestra identidad");
  expect(config.journal.moments[0]).toMatchObject({
    title: "Un recuerdo real",
    image: "/real.webp",
    story: "Nuestra historia",
    date: "",
  });
  expect(config.extension).toEqual({ keep: true });
  expect(config.presentation).toMatchObject({ borderWidth: 0, reflection: 0 });
  expect(informationConfigForPage({ name: "Ayuda" }).layout).toBe("editorial");
});
it("validates calendar dates and visible covers, keeps extensions and sorts without inventing dates", () => {
  expect(memoryDate("2026-02-31")).toBe("");
  expect(memoryDate("2024-02-29")).toBe("2024-02-29");
  const journal = buildMemoryJournal({
    moments: [...moments].reverse(),
    extension: { keep: true },
    photoRadiusPx: 0,
    photoShadow: 0,
  });
  expect(visibleMemories(journal).map((m) => m.id)).toEqual([
    "first",
    "second",
    "third",
  ]);
  expect(journal.extension).toEqual({ keep: true });
  expect(journal.photoRadiusPx).toBe(0);
  expect(journal.photoShadow).toBe(0);
  expect(buildMemoryJournal({ closeText: "" }).closeText).toBe(
    "Cerrar recuerdo",
  );
  expect(
    validateMemoryJournal({
      moments: [{ enabled: true, title: "Falta foto" }],
    }),
  ).toMatch(/foto principal/);
  expect(
    validateMemoryJournal({ moments: [{ enabled: false, title: "Borrador" }] }),
  ).toBe("");
  const many = Array.from({ length: 40 }, (_, i) => ({ id: String(i) }));
  expect(memoryWindow(many, "39")).toHaveLength(7);
  expect(memoryWindow(many, "39").at(-1).id).toBe("39");
});
it("filters moments, selects by timeline and opens the full story/gallery with a stable URL", () => {
  mount();
  expect(
    document.querySelector('[data-active="true"][data-memory-id]'),
  ).toHaveAttribute("data-memory-id", "second");
  expect(screen.queryByText("Oculto")).not.toBeInTheDocument();
  fireEvent.click(
    screen.getByRole("button", { name: "Entrar al recuerdo", exact: true }),
  );
  const dialog = screen.getByRole("dialog");
  expect(dialog).toHaveTextContent("Una historia completa");
  expect(screen.getByTestId("url")).toHaveTextContent("momento=second");
  fireEvent.click(
    within(dialog).getByRole("button", { name: "Fotos de este recuerdo 2" }),
  );
  expect(
    within(dialog.querySelector("figure")).getByAltText("Otro ángulo"),
  ).toHaveAttribute("src", "/extra.webp");
  fireEvent.keyDown(document, { key: "Escape" });
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(document.body.style.overflow).not.toBe("hidden");
  fireEvent.click(screen.getByRole("button", { name: "Equipo", exact: true }));
  expect(
    document.querySelectorAll(".memory-canvas .memory-photo"),
  ).toHaveLength(2);
  fireEvent.click(
    screen.getByRole("button", { name: "Línea de tiempo: Primer día" }),
  );
  expect(
    document.querySelector('[data-active="true"][data-memory-id]'),
  ).toHaveAttribute("data-memory-id", "first");
});
it("restores a deep-linked memory and never opens a hidden entry", () => {
  mount({}, false, "/nosotros?origen=correo&momento=second");
  expect(screen.getByRole("dialog")).toHaveTextContent("Un logro");
  fireEvent.click(screen.getByRole("button", { name: "Cerrar recuerdo" }));
  expect(screen.getByTestId("url").textContent).toBe("?origen=correo");
  cleanup();
  mount({}, false, "/nosotros?momento=hidden");
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});
it("keeps illustrative photos confined to the preview and out of the saved journal", () => {
  const config = mount({ moments: [] }, true);
  expect(screen.getByText(/Estos ejemplos no se guardan/)).toBeInTheDocument();
  expect(document.querySelectorAll(".memory-photo")).toHaveLength(6);
  expect(config.journal.moments).toEqual([]);
  cleanup();
  mount({ moments: [] });
  expect(document.querySelector(".memory-photo")).toBeNull();
  expect(
    document.querySelector('image[href="/diary/preview-atlas.webp"]'),
  ).toBeNull();
  expect(
    screen.getByText("Nuestra historia sigue creciendo"),
  ).toBeInTheDocument();
});
