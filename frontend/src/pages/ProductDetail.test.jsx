// @vitest-environment jsdom

import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import api from "../lib/api";
import ProductDetail from "./ProductDetail";

const { addToCartMock } = vi.hoisted(() => ({
  addToCartMock: vi.fn(),
}));

vi.mock("react-router-dom", () => ({
  useParams: () => ({ id: "demo-smartphone" }),
}));

vi.mock("../lib/api", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

vi.mock("../context/CartContext", () => ({
  useCart: () => ({ addToCart: addToCartMock }),
}));

vi.mock("../context/FavoritesContext", () => ({
  useFavorites: () => ({
    isFavorite: () => false,
    toggleFavorite: vi.fn(),
  }),
}));

vi.mock("../lib/productSeo", () => ({
  applyProductSeo: () => () => {},
}));

vi.mock("../components/product-detail/ProductDetailView", () => ({
  default: ({
    product,
    selectedSize,
    selectedColor,
    setSelectedColor,
    selectedAttributes,
    onVariantAttributeChange,
    onAddToCart,
  }) => (
    <div>
      <img
        data-testid="variant-image"
        src={product.image}
        alt={product.title}
      />
      <span data-testid="variant-price">{product.price}</span>
      <span data-testid="variant-size">{selectedSize}</span>
      <span data-testid="variant-color">{selectedColor}</span>
      <span data-testid="variant-ram">{selectedAttributes?.ram}</span>
      <span data-testid="variant-connectivity">
        {selectedAttributes?.conectividad}
      </span>
      <button
        type="button"
        onClick={() => setSelectedColor("Dorado")}
      >
        Elegir dorado
      </button>
      <button
        type="button"
        onClick={() => onVariantAttributeChange("ram", "12 GB")}
      >
        Elegir 12 GB RAM
      </button>
      <button type="button" onClick={onAddToCart}>
        Añadir variante
      </button>
    </div>
  ),
}));

const DEMO_PRODUCT = {
  _id: "demo-smartphone",
  title: "DEMO Smartphone X Pro",
  image: "https://example.com/general.jpg",
  images: ["https://example.com/general-gallery.jpg"],
  price: 1899000,
  sizes: ["128 GB", "256 GB"],
  colors: ["#111827", "#d4af37"],
  variantAxes: [
    { key: "capacidad", label: "Capacidad", values: ["128 GB", "256 GB"] },
    { key: "ram", label: "RAM", values: ["8 GB", "12 GB"] },
    { key: "color", label: "Color", values: ["Negro", "Dorado"] },
    { key: "conectividad", label: "Conectividad", values: ["5G", "Wi-Fi"] },
  ],
  variants: [
    {
      variantKey: "v2__capacidad=128%20gb__color=negro__conectividad=5g__ram=8%20gb",
      size: "128 GB",
      color: "#111827",
      attributes: [
        { key: "capacidad", label: "Capacidad", value: "128 GB" },
        { key: "ram", label: "RAM", value: "8 GB" },
        { key: "color", label: "Color", value: "Negro" },
        { key: "conectividad", label: "Conectividad", value: "5G" },
      ],
      price: 1899000,
      image: "https://example.com/128-negro.jpg",
      images: ["https://example.com/128-negro-gallery.jpg"],
      active: true,
      sortOrder: 0,
    },
    {
      variantKey: "v2__capacidad=256%20gb__color=dorado__conectividad=wi-fi__ram=12%20gb",
      size: "256 GB",
      color: "#d4af37",
      attributes: [
        { key: "capacidad", label: "Capacidad", value: "256 GB" },
        { key: "ram", label: "RAM", value: "12 GB" },
        { key: "color", label: "Color", value: "Dorado" },
        { key: "conectividad", label: "Conectividad", value: "Wi-Fi" },
      ],
      price: 2249000,
      image: "https://example.com/256-dorado.jpg",
      images: ["https://example.com/256-dorado-gallery.jpg"],
      active: true,
      sortOrder: 1,
    },
  ],
};

describe("ProductDetail con variantes", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    addToCartMock.mockClear();
    api.get.mockImplementation(async (url) => {
      if (url === "/api/pages") {
        return { data: [] };
      }

      return { data: DEMO_PRODUCT };
    });
  });

  it("cambia a la foto, precio y combinación válida de la variante elegida", async () => {
    render(<ProductDetail />);

    await waitFor(() => {
      expect(screen.getByTestId("variant-image")).toHaveAttribute(
        "src",
        "https://example.com/128-negro.jpg"
      );
    });

    fireEvent.click(
      screen.getByRole("button", { name: "Elegir dorado" })
    );

    await waitFor(() => {
      expect(screen.getByTestId("variant-image")).toHaveAttribute(
        "src",
        "https://example.com/256-dorado.jpg"
      );
      expect(screen.getByTestId("variant-price")).toHaveTextContent(
        "2249000"
      );
      expect(screen.getByTestId("variant-size")).toHaveTextContent(
        "256 GB"
      );
      expect(screen.getByTestId("variant-color")).toHaveTextContent(
        "Dorado"
      );
    });
  });

  it("selecciona una combinación completa de cuatro atributos", async () => {
    render(<ProductDetail />);

    await waitFor(() => {
      expect(screen.getByTestId("variant-ram")).toHaveTextContent("8 GB");
      expect(screen.getByTestId("variant-connectivity")).toHaveTextContent("5G");
    });

    fireEvent.click(
      screen.getByRole("button", { name: "Elegir 12 GB RAM" })
    );

    await waitFor(() => {
      expect(screen.getByTestId("variant-image")).toHaveAttribute(
        "src",
        "https://example.com/256-dorado.jpg"
      );
      expect(screen.getByTestId("variant-price")).toHaveTextContent("2249000");
      expect(screen.getByTestId("variant-ram")).toHaveTextContent("12 GB");
      expect(screen.getByTestId("variant-connectivity")).toHaveTextContent("Wi-Fi");
    });

    fireEvent.click(
      screen.getByRole("button", { name: "Añadir variante" })
    );

    expect(addToCartMock).toHaveBeenCalledWith(
      expect.objectContaining({
        variantKey: "v2__capacidad=256%20gb__color=dorado__conectividad=wi-fi__ram=12%20gb",
        variantAttributes: expect.arrayContaining([
          expect.objectContaining({ key: "ram", value: "12 GB" }),
          expect.objectContaining({
            key: "conectividad",
            value: "Wi-Fi",
          }),
        ]),
      })
    );
  });
});
