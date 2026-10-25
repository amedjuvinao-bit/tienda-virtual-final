import React from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import ProductDetailView from "./ProductDetailView";
vi.mock("../Header", () => ({
  default: () => <div>Encabezado de tienda</div>,
}));
vi.mock("../FooterSection", () => ({
  default: () => <div>Pie de tienda</div>,
}));
vi.mock("../WhatsAppButton", () => ({ default: () => null }));
afterEach(() => cleanup());
const product = {
  _id: "p1",
  title: "Producto",
  price: 80000,
  originalPrice: 100000,
  image: "/primera.webp",
  images: ["/primera.webp", "/segunda.webp"],
  reviews: [],
};
const config = {
  showPickupBlock: false,
  showBenefits: false,
  showReviewsSection: false,
  showAccordionBlock: false,
};
const props = {
  product,
  config,
  withChrome: false,
  quantity: 1,
  setQuantity: vi.fn(),
  onAddToCart: vi.fn(),
  onToggleFavorite: vi.fn(),
};
it("aplica los controles de título, subtítulo, precio anterior, flechas y bordes", () => {
  const view = render(
    <ProductDetailView
      {...props}
      config={{
        ...config,
        titleMode: "image",
        titleImage: "/titulo.png",
        titleImageAlt: "Mi título",
        subtitle: "Mi subtítulo",
        showOriginalPrice: false,
        showArrows: false,
        style: { borderWidthPx: 3 },
      }}
    />,
  );
  expect(screen.getByAltText("Mi título")).toHaveAttribute(
    "src",
    "/titulo.png",
  );
  expect(screen.getByText("Mi subtítulo")).toBeInTheDocument();
  expect(view.container.querySelector(".pd-price-original")).toBeNull();
  expect(
    screen.queryByRole("button", { name: "Ver imagen siguiente" }),
  ).toBeNull();
  expect(
    view.container.querySelector(".pd-main-img-wrap").style.borderWidth,
  ).toBe("3px");
  fireEvent.error(screen.getByAltText("Mi título"));
  expect(
    screen.getByRole("heading", { name: "Producto", level: 1 }),
  ).toBeInTheDocument();
});
it("navega imágenes sin perder la selección cuando llegan reseñas y la reinicia al cambiar de variante", () => {
  const view = render(<ProductDetailView {...props} />);
  fireEvent.click(screen.getByRole("button", { name: "Ver imagen siguiente" }));
  expect(view.container.querySelector(".pd-main-img")).toHaveAttribute(
    "src",
    "/segunda.webp",
  );
  view.rerender(
    <ProductDetailView
      {...props}
      product={{
        ...product,
        reviews: [{ name: "Ana", rating: 5, comment: "Bien" }],
      }}
    />,
  );
  expect(view.container.querySelector(".pd-main-img")).toHaveAttribute(
    "src",
    "/segunda.webp",
  );
  view.rerender(
    <ProductDetailView
      {...props}
      product={{
        ...product,
        selectedVariantKey: "otra",
        image: "/otra.webp",
        images: ["/otra.webp"],
      }}
    />,
  );
  expect(view.container.querySelector(".pd-main-img")).toHaveAttribute(
    "src",
    "/otra.webp",
  );
});
it("respeta encabezado, pie y los iconos de beneficios configurados", () => {
  const view = render(
    <ProductDetailView
      {...props}
      withChrome
      config={{
        ...config,
        showHeader: false,
        showFooter: false,
        showBenefits: true,
        benefit1Icon: "/beneficio.png",
      }}
    />,
  );
  expect(screen.queryByText("Encabezado de tienda")).toBeNull();
  expect(screen.queryByText("Pie de tienda")).toBeNull();
  expect(
    view.container.querySelector('img[src="/beneficio.png"]'),
  ).not.toBeNull();
});
it("bloquea la compra y comunica el estado del favorito", () => {
  render(<ProductDetailView {...props} purchaseUnavailable isFavorite />);
  expect(screen.getByRole("button", { name: "No disponible" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Favorito" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  expect(
    screen.getByRole("button", { name: "Disminuir cantidad" }),
  ).toBeDisabled();
});
