import { describe, expect, it } from "vitest";
import {
  buildServicePageConfig,
  normalizeServicePage,
} from "./servicePageConfig";
import { serviceEditorSections } from "../../admin/pages/workspace/serviceEditorFields";
import {
  pageEditorPath,
  pagePublicPath,
  pageMeta,
} from "../../admin/pages/workspace/pageModel";
describe("configuración de páginas públicas de servicio", () => {
  for (const type of ["returns-page", "search-page"]) {
    it(`${type}: normaliza sin perder extensiones y conserva cada control`, () => {
      const config = buildServicePageConfig(
        {
          extension: { keep: true },
          style: { cardRadiusPx: 60, cardPaddingPx: 80, buttonBg: "#123456" },
          presentation: { glassOpacity: 4, borderWidth: -1, extension: true },
          titleImage: "javascript:alert(1)",
          returnLink: "//evil.test",
        },
        type,
      );
      expect(config.extension).toEqual({ keep: true });
      expect(config.style.buttonBg).toBe("#123456");
      expect(config.style.cardRadiusPx).toBe(60);
      expect(config.style.cardPaddingPx).toBe(80);
      expect(config.presentation.glassOpacity).toBe(0.8);
      expect(config.presentation.borderWidth).toBe(0);
      expect(config.titleImage).toBe("");
      expect(config.returnLink).toBe("/");
      expect(buildServicePageConfig(config, type)).toEqual(config);
      for (const sections of Object.values(serviceEditorSections(type)))
        for (const [, fields] of sections)
          for (const field of fields) {
            if (field.scope === "form") continue;
            expect(
              field.scope ? config[field.scope][field.key] : config[field.key],
              field.key,
            ).not.toBeUndefined();
          }
    });
  }
  it("fija identidad y enlaza ambos editores sin publicar un enlace ficticio de orden", () => {
    const page = normalizeServicePage(
      { enabled: false, returnsPageConfig: { showHeader: false } },
      "returns-page",
    );
    expect(page.slug).toBe("devoluciones");
    expect(page.enabled).toBe(false);
    expect(page.useHeader).toBe(false);
    expect(pageEditorPath({ ...page, _id: "123" })).toBe(
      "/admin/returns-page/123",
    );
    expect(pageMeta(page).requiresOrder).toBe(true);
    expect(pagePublicPath(page)).toBe("/devoluciones/:orderId");
    expect(pagePublicPath({ slug: "buscar", pageType: "search-page" })).toBe(
      "/buscar",
    );
  });
});
