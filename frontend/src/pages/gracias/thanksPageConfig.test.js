import { expect, it } from "vitest";
import {
  buildSafeThanksPageConfig,
  thanksMaterialConfig,
} from "./thanksPageConfig";
it("conserva ajustes existentes, extensiones y una galería vacía", () => {
  const raw = {
    extension: { keep: true },
    titleText: "Personalizado",
    slider: { slides: [], extra: 8 },
    style: { panelBg: "#aabbcc", custom: 4 },
    presentation: { extra: true, borderWidth: 0 },
  };
  const config = buildSafeThanksPageConfig(raw);
  expect(config.extension).toEqual(raw.extension);
  expect(config.slider).toMatchObject({ slides: [], extra: 8 });
  expect(config.style).toMatchObject({ panelBg: "#aabbcc", custom: 4 });
  expect(config.presentation).toMatchObject({
    backgroundMode: "continuity",
    extra: true,
    borderWidth: 0,
  });
  expect(buildSafeThanksPageConfig(config)).toEqual(config);
  expect(thanksMaterialConfig(config).style.cardBg).toBe("#aabbcc");
});
it("limita medidas, conserva ceros y rechaza imágenes y destinos inseguros", () => {
  const config = buildSafeThanksPageConfig({
    continueButtonLink: "javascript:alert(1)",
    titleImage: "javascript:alert(1)",
    style: { panelMinHeightPx: 0, panelRadiusPx: 0, visualHeightPx: 99999 },
    slider: {
      slides: [
        null,
        { id: "a", image: "javascript:x" },
        {
          id: "b",
          image: "https://res.cloudinary.com/demo/b.webp",
          extra: true,
        },
      ],
    },
  });
  expect(config.continueButtonLink).toBe("/");
  expect(config.titleImage).toBe("");
  expect(config.style).toMatchObject({
    panelMinHeightPx: 0,
    panelRadiusPx: 0,
    visualHeightPx: 760,
  });
  expect(config.slider.slides[0].image).toBe("");
  expect(config.slider.slides[1].extra).toBe(true);
});
