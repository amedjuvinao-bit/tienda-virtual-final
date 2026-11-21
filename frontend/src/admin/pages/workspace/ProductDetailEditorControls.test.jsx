import React, { useState } from "react";
import { afterEach, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { EditorSections } from "./EditorSection";
import ProductDetailPurchaseControls from "./ProductDetailPurchaseControls";
import ProductDetailTypographyControls from "./ProductDetailTypographyControls";
import ProductDetailAppearanceControls from "./ProductDetailAppearanceControls";
import { buildSafeProductDetailConfig } from "../../../components/product-detail/productDetailConfig";
afterEach(cleanup);
function Editor() {
  const [tab, setTab] = useState("purchase"),
    [config, setConfig] = useState(() => buildSafeProductDetailConfig({}));
  return (
    <>
      <nav>
        {["purchase", "typography", "appearance"].map((key) => (
          <button key={key} onClick={() => setTab(key)}>
            {key}
          </button>
        ))}
      </nav>
      <EditorSections key={tab}>
        {tab === "purchase" && (
          <ProductDetailPurchaseControls
            config={config}
            onChange={(patch) => setConfig((value) => ({ ...value, ...patch }))}
          />
        )}
        {tab === "typography" && (
          <ProductDetailTypographyControls
            style={config.style}
            onChange={(patch) =>
              setConfig((value) => ({
                ...value,
                style: { ...value.style, ...patch },
              }))
            }
          />
        )}
        {tab === "appearance" && (
          <ProductDetailAppearanceControls
            config={config}
            onChange={setConfig}
          />
        )}
      </EditorSections>
      <button
        onClick={() =>
          setConfig((value) => buildSafeProductDetailConfig(value))
        }
      >
        Guardar
      </button>
      <output data-testid="saved">{JSON.stringify(config)}</output>
    </>
  );
}
it("conserva compra, tipografías y carrusel móvil al cambiar de categoría y guardar", () => {
  render(<Editor />);
  fireEvent.click(screen.getByRole("button", { name: "Botón de compra" }));
  fireEvent.change(screen.getByLabelText("Texto del botón de compra"), {
    target: { value: "Solicitar producto" },
  });
  fireEvent.change(screen.getByLabelText("Icono del botón de compra"), {
    target: { value: "bag-heart" },
  });
  fireEvent.click(screen.getByLabelText("Mostrar botón de compra"));
  fireEvent.click(screen.getByRole("button", { name: "typography" }));
  fireEvent.change(screen.getByLabelText("Tipografía del título"), {
    target: { value: "arial" },
  });
  fireEvent.change(screen.getByLabelText("Tamaño título (px)"), {
    target: { value: "38" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Precio del producto" }));
  fireEvent.change(screen.getByLabelText("Tipografía del precio"), {
    target: { value: "georgia" },
  });
  fireEvent.click(screen.getByRole("button", { name: "appearance" }));
  fireEvent.click(
    screen.getByRole("button", { name: "Productos relacionados" }),
  );
  fireEvent.change(screen.getByLabelText("Tarjetas visibles en móvil"), {
    target: { value: "1" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
  const saved = JSON.parse(screen.getByTestId("saved").textContent);
  expect(saved).toMatchObject({
    showAddToCart: false,
    addToCartText: "Solicitar producto",
    addToCartIconName: "bag-heart",
    style: {
      titleFontFamily: "arial",
      priceFontFamily: "georgia",
      titleSizePx: 38,
    },
    presentation: { relatedMobileCount: 1 },
  });
  fireEvent.click(screen.getByRole("button", { name: "purchase" }));
  fireEvent.click(screen.getByRole("button", { name: "Botón de compra" }));
  expect(screen.getByLabelText("Texto del botón de compra")).toHaveValue(
    "Solicitar producto",
  );
  expect(screen.getByLabelText("Mostrar botón de compra")).not.toBeChecked();
  expect(
    screen
      .getByLabelText("Texto del botón de compra")
      .closest(".page-editor-section"),
  ).toHaveTextContent("Botón de compra");
  expect(buildSafeProductDetailConfig(saved)).toEqual(saved);
});
