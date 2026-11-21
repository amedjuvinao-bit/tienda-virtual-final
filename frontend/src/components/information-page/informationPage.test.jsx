import React from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { StorefrontSettingsContext } from "../../context/StorefrontSettingsContext";
import InformationPageView from "./InformationPageView";
import {
  buildInformationConfig,
  normalizeInformationPage,
  validateInformationPage,
} from "./informationPageConfig";
vi.mock("../Header", () => ({ default: () => <div data-testid="header" /> }));
vi.mock("../StorefrontFooter", () => ({
  default: () => <div data-testid="footer" />,
}));
vi.mock("../WhatsAppButton", () => ({ default: () => null }));
afterEach(cleanup);
it("preserves extensions, empty sections, decimal and zero material settings", () => {
  const raw = {
    extension: { keep: true },
    sections: [],
    style: { cardRadiusPx: 0 },
    presentation: { borderWidth: 0.75, reflection: 0 },
  };
  const config = buildInformationConfig(raw);
  expect(config.extension).toEqual(raw.extension);
  expect(config.sections).toEqual([]);
  expect(config.presentation).toMatchObject({
    borderWidth: 0.75,
    reflection: 0,
  });
  expect(config.style.cardRadiusPx).toBe(0);
  const body = "Contenido extenso. ".repeat(1500);
  expect(buildInformationConfig({ sections: [{ body }] }).sections[0].body).toBe(body);
  expect(
    normalizeInformationPage({ name: "Ayuda", slug: "ayuda" })
      .informationPageConfig,
  ).toMatchObject({ titleText: "Ayuda", sections: [] });
  expect(
    normalizeInformationPage({
      name: "Nosotros",
      slug: "nosotros",
      systemRole: "about",
    }).informationPageConfig.sections,
  ).toHaveLength(2);
});
it("keeps safe paragraph text, unique anchors and rejects unsafe public actions", () => {
  const config = buildInformationConfig({
    actionHref: "javascript:alert(1)",
    sections: [{ id: "x", body: "<script>bad()</script>" }, { id: "x" }],
  });
  expect(config.actionHref).toBe("");
  expect(new Set(config.sections.map((s) => s.id)).size).toBe(2);
  expect(validateInformationPage({ name: "Ayuda", slug: "mal slug" })).toMatch(
    /dirección/,
  );
  expect(
    validateInformationPage({
      name: "Ayuda",
      slug: "ayuda",
      informationPageConfig: { actionHref: "/admin/ordenes" },
    }),
  ).toMatch(/destino/);
});
it("renders optional images, native FAQ and editable sections without executing HTML", () => {
  render(
    <MemoryRouter>
      <StorefrontSettingsContext.Provider
        value={{ theme: { colors: { background: "#efd4db" } } }}
      >
        <InformationPageView
          page={{
            name: "Mi negocio",
            pageType: "information",
            useHeader: false,
            useFooter: false,
            informationPageConfig: {
              titleText: "Nuestra propuesta",
              sections: [
                {
                  id: "history",
                  type: "split",
                  title: "Historia",
                  body: "<script>bad()</script>",
                  image: "/story.webp",
                },
                {
                  id: "questions",
                  type: "faq",
                  title: "Preguntas",
                  items: [
                    { title: "¿Cómo consulto?", body: "Por nuestros canales." },
                  ],
                },
                { id: "hidden", title: "Secreto", enabled: false },
              ],
            },
          }}
        />
      </StorefrontSettingsContext.Provider>
    </MemoryRouter>,
  );
  expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
    "Nuestra propuesta",
  );
  expect(screen.getByText("<script>bad()</script>")).toBeInTheDocument();
  expect(document.querySelector("script")).toBeNull();
  expect(screen.queryByTestId("header")).not.toBeInTheDocument();
  expect(screen.queryByTestId("footer")).not.toBeInTheDocument();
  expect(screen.queryByText("Secreto")).not.toBeInTheDocument();
  expect(document.querySelector(".information-faq details")).toHaveTextContent(
    "Por nuestros canales.",
  );
  fireEvent.error(document.querySelector(".information-story img"));
  expect(document.querySelector(".information-story")).toHaveAttribute(
    "data-image",
    "false",
  );
});
