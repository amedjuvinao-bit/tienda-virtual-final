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
it("aplica la composición aprobada una vez y conserva después la personalización", () => {
  const migrated = buildSafeProductDetailConfig({
    titleOverride: "Mi producto",
    style: { primaryTextColor: "#00ffff" },
  });
  expect(migrated.titleOverride).toBe("Mi producto");
  expect(migrated.thumbnailPosition).toBe("overlay");
  expect(migrated.style.primaryTextColor).toBe("#592837");
  const edited = buildSafeProductDetailConfig({
    ...migrated,
    presentation: {
      ...migrated.presentation,
      glassOpacity: 0,
      glassBlur: 0,
      reflection: 0,
    },
    style: {
      ...migrated.style,
      primaryTextColor: "#203040",
      borderWidthPx: 0.25,
    },
  });
  expect(edited.style.primaryTextColor).toBe("#203040");
  expect(edited.style.borderWidthPx).toBe(0.25);
  expect(edited.presentation).toMatchObject({
    glassOpacity: 0,
    glassBlur: 0,
    reflection: 0,
  });
  expect(buildSafeProductDetailConfig(edited)).toEqual(edited);
});
