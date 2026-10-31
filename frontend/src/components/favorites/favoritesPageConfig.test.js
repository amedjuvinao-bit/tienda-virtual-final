import { expect, it } from "vitest";
import { buildSafeFavoritesPageConfig } from "./favoritesPageConfig";
import { favoriteEditorSections } from "../../admin/pages/workspace/favoriteEditorFields";
it("llena la imagen incluso con el antiguo ajuste guardado y permite elegir otro ajuste desde el editor", () => {
  expect(buildSafeFavoritesPageConfig({}).style.imageFit).toBe("cover");
  expect(
    buildSafeFavoritesPageConfig({ style: { imageFit: "contain" } }).style
      .imageFit,
  ).toBe("cover");
  const explicit = buildSafeFavoritesPageConfig({
    style: { imageFit: "contain", imageFitConfigured: true },
  });
  expect(buildSafeFavoritesPageConfig(explicit).style.imageFit).toBe("contain");
});
it("mantiene todos los controles en un solo contrato y conserva extensiones", () => {
  const config = buildSafeFavoritesPageConfig({
    extra: true,
    content: { extra: true },
    style: { custom: true },
  });
  expect(config.extra).toBe(true);
  expect(config.content.extra).toBe(true);
  expect(config.style.custom).toBe(true);
  for (const [, fields] of Object.values(favoriteEditorSections).flat())
    for (const f of fields)
      if (f.scope !== "form")
        expect(config[f.scope][f.key], f.key).not.toBeUndefined();
});
it("normaliza columnas, brillo y rutas sin crear bordes ni enlaces externos", () => {
  const config = buildSafeFavoritesPageConfig({
    content: {
      cardsPerRowDesktop: 2.7,
      cardsPerRowMobile: 99,
      emptyButtonLink: "//evil.test",
    },
    presentation: { reflection: 0, borderWidth: 0.75 },
  });
  expect(config.content.cardsPerRowDesktop).toBe(3);
  expect(config.content.cardsPerRowMobile).toBe(2);
  expect(config.content.emptyButtonLink).toBe("/#categorias");
  expect(config.presentation.reflection).toBe(0);
  expect(config.presentation.borderWidth).toBe(0.75);
});
