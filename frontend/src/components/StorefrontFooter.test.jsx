import React from "react";
import { afterEach, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import StorefrontFooter from "./StorefrontFooter";
import FooterSection from "./FooterSection";
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
