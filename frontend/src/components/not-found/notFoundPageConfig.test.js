import { expect, it } from "vitest";
import {
  buildSafeNotFoundPageConfig,
  notFoundMaterialConfig,
} from "./notFoundPageConfig";
import { notFoundEditorSections } from "../../admin/pages/workspace/notFoundEditorFields";
it("preserva el contrato anterior, extensiones y todos los controles del editor", () => {
  const config = buildSafeNotFoundPageConfig({
    extension: { keep: true },
    titleText: "Ruta no disponible",
    pageBg: "#abcdef",
    imageUrl: "/custom.webp",
    showHeader: false,
    cardBorderWidthPx: 0.75,
  });
  expect(config.extension).toEqual({ keep: true });
  expect(config.titleText).toBe("Ruta no disponible");
  expect(config.pageBg).toBe("#abcdef");
  expect(config.imageUrl).toBe("/custom.webp");
  expect(config.showHeader).toBe(false);
  expect(config.presentation.borderWidth).toBe(0.75);
  for (const [, fields] of Object.values(notFoundEditorSections).flat())
    for (const field of fields)
      if (field.scope !== "form")
        expect(
          field.scope === "presentation"
            ? config.presentation[field.key]
            : config[field.key],
          field.key,
        ).not.toBeUndefined();
});
it("valida enlaces, tipos, medidas y conserva brillo cero y bordes decimales", () => {
  const config = buildSafeNotFoundPageConfig({
    buttonLink: "https://evil.test",
    secondaryButtonLink: "//evil.test",
    breadcrumbRootLink: "/\\evil.test",
    titleImage: "javascript:bad()",
    cardPaddingPx: 70,
    cardRadiusPx: 55,
    titleFontSizePx: 900,
    showMessage: false,
    presentation: { borderWidth: 0.5, reflection: 0, glassOpacity: 0 },
  });
  expect(config.buttonLink).toBe("/");
  expect(config.secondaryButtonLink).toBe("/#categorias");
  expect(config.breadcrumbRootLink).toBe("/");
  expect(config.titleImage).toBe("");
  expect(config.titleFontSizePx).toBe(90);
  expect(config.showMessage).toBe(false);
  expect(config.presentation).toMatchObject({
    borderWidth: 0.5,
    reflection: 0,
    glassOpacity: 0,
  });
  const material = notFoundMaterialConfig(config);
  expect(material.style.cardRadiusPx).toBe(55);
  expect(material.style.cardPaddingPx).toBe(70);
  expect(buildSafeNotFoundPageConfig(config)).toEqual(config);
});
