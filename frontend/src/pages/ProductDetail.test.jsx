// @vitest-environment jsdom

import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import api from "../lib/api";
import ProductDetail from "./ProductDetail";

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
  useCart: () => ({ addToCart: vi.fn() }),
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
      <button
        type="button"
        onClick={() => setSelectedColor("Dorado")}
      >
        Elegir dorado
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
  variants: [
    {
      variantKey: "128-gb__111827",
      size: "128 GB",
      color: "#111827",
      price: 1899000,
      image: "https://example.com/128-negro.jpg",
      images: ["https://example.com/128-negro-gallery.jpg"],
      active: true,
      sortOrder: 0,
    },
    {
      variantKey: "256-gb__d4af37",
      size: "256 GB",
      color: "#d4af37",
      price: 2249000,
      image: "https://example.com/256-dorado.jpg",
      images: ["https://example.com/256-dorado-gallery.jpg"],
      active: true,
      sortOrder: 1,
    },
  ],
};

describe("ProductDetail con variantes", () => {
  beforeEach(() => {
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
});
