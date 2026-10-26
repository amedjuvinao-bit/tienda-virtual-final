import { expect, it } from "vitest";
import { buildSafeCheckoutPageConfig } from "./checkoutPageConfig";
import { getItemQuantity, getItemLineTotal } from "./checkoutPageModel";
it("conserva ajustes existentes y extensiones en un contrato común e idempotente", () => {
  const raw = {
    extension: { keep: true },
    style: {
      sectionCardBg: "#abc123",
      inputStyle: "pill",
      confirmButtonStyle: "pill",
      shadowStyle: "strong",
      labelTextColor: "#123456",
      custom: 7,
    },
    presentation: { borderWidth: 0, extra: true },
  };
  const config = buildSafeCheckoutPageConfig(raw);
  expect(config).toMatchObject(raw);
  expect(config.presentation.backgroundMode).toBe("continuity");
  expect(buildSafeCheckoutPageConfig(config)).toEqual(config);
});
it("limita medidas y rechaza imágenes inseguras sin forzar fotografías predeterminadas", () => {
  const config = buildSafeCheckoutPageConfig({
    titleImage: "javascript:alert(1)",
    paymentMethodsImage: "javascript:x",
    style: { inputRadiusPx: 0, inputHeightPx: 999 },
  });
  expect(config.titleImage).toBe("");
  expect(config.paymentMethodsImage).toBe("");
  expect(config.style.inputRadiusPx).toBe(0);
  expect(config.style.inputHeightPx).toBe(80);
});
it("usa las cantidades y precios alternativos cuando el valor principal es nulo", () => {
  expect(getItemQuantity({ quantity: null, qty: 2 })).toBe(2);
  expect(getItemLineTotal({ lineTotal: 0, price: 10000, quantity: 2 })).toBe(0);
  expect(
    getItemLineTotal({ price: null, unitPrice: 10000, quantity: null, qty: 2 }),
  ).toBe(20000);
});
