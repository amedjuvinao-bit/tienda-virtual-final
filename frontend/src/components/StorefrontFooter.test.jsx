import React from "react";
import { afterEach, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import StorefrontFooter from "./StorefrontFooter";
import FooterSection from "./FooterSection";
import { MemoryRouter } from "react-router-dom";
import { StorefrontSettingsContext } from "../context/StorefrontSettingsContext";
import ConsumerLinks from "./consumer/ConsumerLinks";
const theme = {
  footer: {
    editorial: {
      backgroundMode: "satin",
      brandName: "Mi tienda",
      brandMode: "text",
      headingColor: "#651234",
    },
    copyright: "Texto legal propio",
  },
};
afterEach(cleanup);

function renderHomeLegalLinks(footerTheme, pathname = "/") {
  return render(
    <MemoryRouter initialEntries={[pathname]}>
      <StorefrontSettingsContext.Provider value={{ theme: footerTheme }}>
        {pathname === "/" && (
          <FooterSection
            theme={footerTheme}
            preview
            legalLinks={<ConsumerLinks embedded />}
          />
        )}
        <ConsumerLinks />
      </StorefrontSettingsContext.Provider>
    </MemoryRouter>,
  );
}

it("integra una sola navegación legal en el fondo del footer de inicio", () => {
  renderHomeLegalLinks(theme);
  const links = screen.getAllByRole("navigation", {
    name: "Información y protección al consumidor",
  });
  expect(links).toHaveLength(1);
  expect(screen.getByRole("contentinfo")).toContainElement(links[0]);
  expect(links[0].style.backgroundImage).toBe("");
  expect(links[0].style.backgroundColor).toBe("transparent");
  expect(screen.getByRole("link", { name: "SIC · Protección al consumidor" }))
    .toHaveAttribute("href", "https://www.sic.gov.co/");
  expect(screen.getByRole("button", { name: "Cookies y preferencias" }))
    .toBeInTheDocument();
});

it.each(["disabled", "classic"])("conserva los enlaces globales con el footer %s", (mode) => {
  renderHomeLegalLinks({
    ...theme,
    footer: { ...theme.footer, ...(mode === "disabled" ? { enabled: false } : { layout: "classic" }) },
  });
  const links = screen.getAllByRole("navigation", {
    name: "Información y protección al consumidor",
  });
  expect(links).toHaveLength(1);
  expect(links[0]).not.toHaveClass("consumer-legal-links--embedded");
});

it("mantiene los enlaces de otras páginas y los excluye del panel administrativo", () => {
  const view = renderHomeLegalLinks(theme, "/envios");
  expect(screen.getByRole("navigation", { name: "Información y protección al consumidor" }))
    .toBeInTheDocument();
  view.unmount();
  renderHomeLegalLinks(theme, "/admin/dashboard");
  expect(screen.queryByRole("navigation", { name: "Información y protección al consumidor" }))
    .not.toBeInTheDocument();
});
it("continúa el fondo de la página y conserva el marco y los contenidos del footer", () => {
  const { container } = render(<StorefrontFooter theme={theme} preview />);
  const footer = screen.getByRole("contentinfo");
  expect(footer.style.backgroundImage).toBe("none");
  expect(footer.style.backgroundColor).toBe("transparent");
  expect(footer).toHaveAttribute("data-glass", "polished");
  expect(container.querySelector(".cpv-page")).toHaveAttribute(
    "data-background",
    "continuity",
  );
  expect(container.querySelector(".cpv-page").style.background).toBe(
    "transparent",
  );
  expect(container.querySelector(".cpv-footer .footer-ed")).toBe(footer);
  expect(footer.style.getPropertyValue("--fe-ink")).toBe("#651234");
  expect(
    screen.getByText("Mi tienda", { selector: ".footer-ed__brand-name" }),
  ).toBeInTheDocument();
  expect(screen.getByText("Texto legal propio")).toBeInTheDocument();
});
it("conserva los fondos configurados donde no se pide continuidad", () => {
  const { rerender } = render(<FooterSection theme={theme} />);
  expect(screen.getByRole("contentinfo").style.backgroundImage).toContain(
    "editorial-satin-v2.webp",
  );
  rerender(
    <StorefrontFooter
      theme={{
        footer: {
          editorial: {
            backgroundMode: "image",
            backgroundImage: "/own-footer.webp",
          },
        },
      }}
    />,
  );
  expect(screen.getByRole("contentinfo").style.backgroundImage).toBe("none");
});
it("respeta un footer desactivado sin dejar espacio vacío", () => {
  const { container } = render(
    <StorefrontFooter theme={{ footer: { enabled: false } }} />,
  );
  expect(container).toBeEmptyDOMElement();
});
it("el modelo clásico también hereda el fondo sin una barra inferior opaca", () => {
  const classic = {
    footer: {
      layout: "classic",
      bgColor: "#abcdef",
      bottomBarBg: "#fedcba",
      copyright: "Legal clásico",
    },
  };
  const { rerender } = render(<StorefrontFooter theme={classic} />);
  expect(screen.getByRole("contentinfo").style.backgroundColor).toBe(
    "transparent",
  );
  expect(
    screen.getByText("Legal clásico").parentElement.style.backgroundColor,
  ).toBe("transparent");
  rerender(<FooterSection theme={classic} />);
  expect(screen.getByRole("contentinfo")).toHaveStyle({
    backgroundColor: "#abcdef",
  });
});
