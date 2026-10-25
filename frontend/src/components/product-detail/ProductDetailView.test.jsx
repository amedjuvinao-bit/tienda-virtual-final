import React from "react";
import { afterEach, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render as testingRender,
  screen,
} from "@testing-library/react";
import ProductDetailView from "./ProductDetailView";
import { MemoryRouter } from "react-router-dom";
const render = (ui) => testingRender(ui, { wrapper: MemoryRouter });
vi.mock("./ProductDetailRelatedProducts", () => ({ default: () => null }));
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
it("mantiene la compra al ocultar cantidad y coloca favorito junto al carrito", () => {
  const add = vi.fn();
  const view = render(
    <ProductDetailView
      {...props}
      onAddToCart={add}
      config={{ ...config, showQuantity: false }}
    />,
  );
  expect(
    screen.queryByRole("button", { name: "Aumentar cantidad" }),
  ).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Añadir al carrito" }));
  expect(add).toHaveBeenCalledOnce();
  expect(
    view.container.querySelector(".pd-purchase-actions .pd-fav-btn"),
  ).not.toBeNull();
});
it("organiza descripción, entrega y reseñas en pestañas accesibles sin perder el formulario", () => {
  render(
    <ProductDetailView
      {...props}
      product={{ ...product, description: "Descripción real del producto" }}
      config={{
        ...config,
        showReviewsSection: true,
        showReviewForm: true,
        showAccordionBlock: true,
        accordionText1: "Entrega en el plazo acordado",
      }}
    />,
  );
  expect(screen.getByRole("tabpanel")).toHaveTextContent(
    "Descripción real del producto",
  );
  fireEvent.click(screen.getByRole("tab", { name: "Entrega" }));
  expect(screen.getByRole("tabpanel")).toHaveTextContent(
    "Entrega en el plazo acordado",
  );
  fireEvent.keyDown(screen.getByRole("tab", { name: "Entrega" }), {
    key: "ArrowRight",
  });
  expect(screen.getByRole("tab", { name: "Reseñas" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  expect(screen.getByRole("button", { name: "Publicar reseña" })).toBeVisible();
  fireEvent.keyDown(screen.getByRole("tab", { name: "Reseñas" }), {
    key: "Home",
  });
  expect(screen.getByRole("tab", { name: "Descripción" })).toHaveFocus();
});
it("usa muestras visuales para colores con nombre y respeta la selección canónica", () => {
  const change = vi.fn();
  render(
    <ProductDetailView
      {...props}
      variantAxes={[
        { key: "color", label: "Color", values: ["negro", "azul"] },
      ]}
      selectedAttributes={{ color: "azul" }}
      onVariantAttributeChange={change}
    />,
  );
  const blue = screen.getByRole("button", { name: "Color: Azul" });
  expect(blue).toHaveAttribute("aria-pressed", "true");
  expect(blue).toHaveClass("pd-color-dot");
  fireEvent.click(screen.getByRole("button", { name: "Color: Negro" }));
  expect(change).toHaveBeenCalledWith("color", "negro");
});
it("aplica las fuentes configuradas, el icono de compra y su visibilidad", async () => {
  const { buildSafeProductDetailConfig } = await import(
    "./productDetailConfig"
  );
  const saved = buildSafeProductDetailConfig(config);
  const custom = {
    ...saved,
    addToCartText: "Solicitar",
    addToCartIconName: "bag-heart",
    style: {
      ...saved.style,
      titleFontFamily: "arial",
      priceFontFamily: "georgia",
    },
  };
  const view = render(<ProductDetailView {...props} config={custom} />);
  expect(
    view.container
      .querySelector(".pd-storefront")
      .style.getPropertyValue("--pd-title-font"),
  ).toBe("Arial, sans-serif");
  expect(
    view.container
      .querySelector(".pd-storefront")
      .style.getPropertyValue("--pd-price-font"),
  ).toBe("Georgia, serif");
  expect(
    screen
      .getByRole("button", { name: "Solicitar" })
      .querySelector(".lucide-heart"),
  ).not.toBeNull();
  view.rerender(
    <ProductDetailView
      {...props}
      config={{ ...custom, showAddToCart: false }}
    />,
  );
  expect(screen.queryByRole("button", { name: "Solicitar" })).toBeNull();
  expect(screen.getByRole("button", { name: "Favorito" })).toBeInTheDocument();
});
