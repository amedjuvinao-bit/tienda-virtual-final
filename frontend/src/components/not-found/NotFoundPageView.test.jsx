import React from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import NotFoundPageView from "./NotFoundPageView";
import { StorefrontSettingsContext } from "../../context/StorefrontSettingsContext";
vi.mock("../Header", () => ({
  default: () => <header>Encabezado público</header>,
}));
vi.mock("../FooterSection", () => ({
  default: () => <footer>Pie público</footer>,
}));
vi.mock("../WhatsAppButton", () => ({
  default: () => <button>WhatsApp</button>,
}));
const mount = (ui) => render(<MemoryRouter>{ui}</MemoryRouter>);
afterEach(cleanup);
it("muestra ilustración, navegación y ajustes que antes la página ignoraba", () => {
  const { container } = mount(
    <NotFoundPageView
      page={{
        useHeader: false,
        useFooter: false,
        notFoundPageConfig: {
          titleText: "No encontramos esta página",
          messageText: "Mensaje configurado",
          imageUrl: "/illustration.webp",
          imageAlt: "Ilustración propia",
          buttonText: "Ir a productos",
          buttonLink: "/pagina/catalogo",
          secondaryButtonText: "Ver novedades",
          secondaryButtonLink: "/pagina/novedades",
          showWhatsapp: false,
          cardRadiusPx: 35,
        },
      }}
    />,
  );
  expect(
    screen.getByRole("heading", { name: "No encontramos esta página" }),
  ).toBeInTheDocument();
  expect(screen.getByAltText("Ilustración propia")).toHaveAttribute(
    "src",
    "/illustration.webp",
  );
  expect(screen.queryByText("Encabezado público")).not.toBeInTheDocument();
  expect(screen.queryByText("Pie público")).not.toBeInTheDocument();
  expect(screen.queryByText("WhatsApp")).not.toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Ir a productos" })).toHaveAttribute(
    "href",
    "/pagina/catalogo",
  );
  expect(screen.getByRole("link", { name: "Ver novedades" })).toHaveAttribute(
    "href",
    "/pagina/novedades",
  );
  expect(
    container
      .querySelector(".notfound-storefront")
      .style.getPropertyValue("--cart-radius"),
  ).toBe("35px");
});
it("recupera título e ilustración fallidos y elimina el hueco si el código está oculto", () => {
  const { container } = mount(
    <NotFoundPageView
      page={{
        notFoundPageConfig: {
          titleMode: "image",
          titleImage: "/bad-title.png",
          titleText: "Título de respaldo",
          titleImageAlt: "Título propio",
          imageUrl: "/bad-art.png",
          imageAlt: "Arte propio",
          showCode: false,
        },
      }}
    />,
  );
  fireEvent.error(screen.getByAltText("Título propio"));
  fireEvent.error(screen.getByAltText("Arte propio"));
  expect(
    screen.getByRole("heading", { name: "Título de respaldo" }),
  ).toBeInTheDocument();
  expect(container.querySelector(".notfound-panel")).toHaveAttribute(
    "data-has-art",
    "false",
  );
  expect(container.querySelector(".notfound-art")).not.toBeInTheDocument();
});
it("honra todos los elementos ocultos sin perder el encabezado accesible", () => {
  const { container } = mount(
    <NotFoundPageView
      page={{
        notFoundPageConfig: {
          showTitle: false,
          showMessage: false,
          showBreadcrumb: false,
          showButton: false,
          showSecondaryButton: false,
          showImage: false,
          showCode: false,
          showHeader: false,
          showFooter: false,
          showWhatsapp: false,
        },
      }}
    />,
  );
  expect(
    screen.getByRole("heading", { name: "Página no encontrada" }),
  ).toHaveClass("sr-only");
  expect(screen.queryByRole("link")).not.toBeInTheDocument();
  expect(container.querySelector(".notfound-art")).not.toBeInTheDocument();
});
it("continúa el fondo de Inicio y mantiene una salida si se desactiva el diseño", () => {
  const { container } = mount(
    <StorefrontSettingsContext.Provider
      value={{
        theme: {
          colors: { background: "#abcabc" },
          global: {
            sectionMotion: { journey: { backgroundImage: "/home.webp" } },
          },
        },
      }}
    >
      <NotFoundPageView
        page={{
          enabled: false,
          notFoundPageConfig: {
            titleText: "Personalizado",
            buttonLink: "//evil.test",
          },
        }}
      />
    </StorefrontSettingsContext.Provider>,
  );
  expect(screen.queryByText("Personalizado")).not.toBeInTheDocument();
  expect(
    screen.getByRole("link", { name: "Volver al inicio" }),
  ).toHaveAttribute("href", "/");
  expect(container.querySelector(".notfound-storefront")).toHaveStyle({
    backgroundImage: 'url("/home.webp")',
  });
});
it("ofrece reintento sin perder la navegación de recuperación", () => {
  const retry = vi.fn();
  mount(
    <NotFoundPageView
      configError="No pudimos cargar esta página por completo."
      onRetry={retry}
    />,
  );
  expect(screen.getByRole("alert")).toHaveTextContent("No pudimos");
  fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
  expect(retry).toHaveBeenCalledOnce();
  expect(
    screen.getByRole("link", { name: "Volver al inicio" }),
  ).toHaveAttribute("href", "/");
});
