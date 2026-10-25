import React, { useState } from "react";
import { afterEach, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import ProductDetailAppearanceControls from "./ProductDetailAppearanceControls";
import { EditorSections } from "./EditorSection";
import { buildSafeProductDetailConfig } from "../../../components/product-detail/productDetailConfig";
afterEach(cleanup);
function Editor() {
  const [config, setConfig] = useState(() =>
    buildSafeProductDetailConfig({
      titleOverride: "Mi producto",
      addToCartText: "Comprar",
      style: { borderWidthPx: 1 },
    }),
  );
  return (
    <>
      <EditorSections>
        <ProductDetailAppearanceControls
          config={config}
          onChange={(next) => setConfig(buildSafeProductDetailConfig(next))}
        />
      </EditorSections>
      <output data-testid="draft">{JSON.stringify(config)}</output>
    </>
  );
}
it("conserva fondo, grosor decimal, reflejo cero y textos al cambiar de categoría", () => {
  render(<Editor />);
  fireEvent.change(screen.getByLabelText("Origen del fondo"), {
    target: { value: "custom" },
  });
  fireEvent.change(screen.getByLabelText("Imagen de fondo (enlace)"), {
    target: { value: "/fondo-propio.webp" },
  });
  fireEvent.click(
    screen.getByRole("button", { name: "Textura y borde del cristal" }),
  );
  fireEvent.change(screen.getByLabelText("Grosor del borde (px)"), {
    target: { value: "0.25" },
  });
  fireEvent.change(screen.getByLabelText("Brillo del borde (0–1)"), {
    target: { value: "0" },
  });
  fireEvent.click(
    screen.getByRole("button", { name: "Pestañas y navegación" }),
  );
  fireEvent.change(screen.getByLabelText("Nombre de la pestaña descripción"), {
    target: { value: "Características" },
  });
  const config = JSON.parse(screen.getByTestId("draft").textContent);
  expect(config.presentation).toMatchObject({
    backgroundMode: "custom",
    backgroundImage: "/fondo-propio.webp",
    reflection: 0,
    descriptionLabel: "Características",
  });
  expect(config.style.borderWidthPx).toBe(0.25);
  expect(config.titleOverride).toBe("Mi producto");
  expect(config.addToCartText).toBe("Comprar");
  expect(buildSafeProductDetailConfig(config)).toEqual(config);
});
