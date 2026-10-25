import { expect, it } from "vitest";
import { buildSafeProductDetailConfig } from "./productDetailConfig";
it("mantiene los valores estables al abrir, guardar y volver a normalizar", () => {
  const config = buildSafeProductDetailConfig({
    style: {
      reviewBorderRadius: 0,
      favoriteButtonOpacity: 0,
      addToCartBorderWidthPx: 0,
      reviewBgOpacity: 0,
    },
  });
  expect(config.style.buttonRadiusPx).toBeLessThanOrEqual(40);
  expect(buildSafeProductDetailConfig(config)).toEqual(config);
  expect(config.style).toMatchObject({
    reviewBorderRadius: 0,
    favoriteButtonOpacity: 0,
    addToCartBorderWidthPx: 0,
    reviewBgOpacity: 0,
  });
});
