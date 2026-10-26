import { expect, it } from "vitest";
import {
  buildSafeThanksPageConfig,
  thanksMaterialConfig,
} from "./thanksPageConfig";
it("conserva ajustes existentes, extensiones y una galería vacía", () => {
  const raw = {
    designVersion: 3,
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
    designVersion: 3,
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

it("aplica el diseño aprobado completo una sola vez y conserva imágenes y contenido", () => {
  const config = buildSafeThanksPageConfig({
    showVisualPanel: true,
    titleText: "¡Gracias por tu compra!",
    style: {
      titleTextColor: "#db2777",
      panelWidthPx: 540,
      buttonBg: "#123456",
    },
    slider: { slides: [{ id: "real", image: "/real.webp" }] },
  });
  expect(config.designVersion).toBe(3);
  expect(config.titleText).toBe("Gracias por tu pedido");
  expect(config.showVisualPanel).toBe(false);
  expect(config.slider.slides[0].image).toBe("/real.webp");
  expect(config.style.panelWidthPx).toBe(1000);
  expect(config.style.buttonBg).toBe("#a52c53");
  expect(config.style.titleTextColor).toBe("#74243e");
  expect(config.presentation.checkoutGlassOpacity).toBe(0.8);
  expect(buildSafeThanksPageConfig(config)).toEqual(config);
  expect(
    buildSafeThanksPageConfig({
      ...config,
      showVisualPanel: true,
      style: { ...config.style, panelWidthPx: 540 },
    }).showVisualPanel,
  ).toBe(true);
  expect(
    buildSafeThanksPageConfig({
      ...config,
      style: { ...config.style, panelWidthPx: 540 },
    }).style.panelWidthPx,
  ).toBe(540);
});

it("corrige el ancho y el contraste de la configuración de la captura sin rehacer la página", () => {
  const old = {
    designVersion: 2,
    titleText: "Gracias por tu pedido",
    usefulExtension: { keep: true },
    style: {
      panelWidthPx: 640,
      accentColor: "#ffc7e0",
      panelBg: "#fbd1da",
      panelMinHeightPx: 800,
    },
    presentation: {
      backgroundMode: "custom",
      backgroundImage: "/mi-fondo.webp",
      mobileBackgroundImage: "/mi-movil.webp",
      borderWidth: 1,
      glassOpacity: 0.6,
    },
    slider: { slides: [{ id: "a", image: "/guardada.webp" }] },
  };
  const config = buildSafeThanksPageConfig(old);
  expect(config.style).toMatchObject({
    panelWidthPx: 1000,
    accentColor: "#a52c53",
    factValueColor: "#74243e",
    panelMinHeightPx: 0,
  });
  expect(config.presentation).toMatchObject({
    backgroundMode: "custom",
    backgroundImage: "/mi-fondo.webp",
    mobileBackgroundImage: "/mi-movil.webp",
    borderWidth: 2.75,
    glassOpacity: 0.12,
  });
  expect(config.usefulExtension).toEqual({ keep: true });
  expect(config.slider.slides[0].image).toBe("/guardada.webp");
  expect(
    buildSafeThanksPageConfig({
      ...config,
      style: { ...config.style, factValueColor: "#123456", panelWidthPx: 640 },
      presentation: { ...config.presentation, borderWidth: 0 },
    }),
  ).toMatchObject({
    style: { factValueColor: "#123456", panelWidthPx: 640 },
    presentation: { borderWidth: 0 },
  });
});
