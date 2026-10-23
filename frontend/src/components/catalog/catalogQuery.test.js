import { describe, expect, it } from "vitest";
import { buildSafeCatalogConfig } from "./catalogConfig";
import {
  readCatalogQuery,
  writeCatalogQuery,
  buildCatalogProductQuery,
  catalogScopeParams,
} from "./catalogQuery";
const read = (search = "", config = {}, width = 1280) =>
  readCatalogQuery(
    new URLSearchParams(search),
    buildSafeCatalogConfig(config),
    width,
  );

describe("contrato del catálogo público", () => {
  it("usa precios y columnas configurados cuando la URL no los contiene", () => {
    expect(
      read("", {
        initialMinPrice: 12000,
        initialMaxPrice: 900000,
        columnsDesktop: 6,
        defaultColsDesktop: 6,
      }),
    ).toMatchObject({ priceRange: [12000, 900000], cols: 6, page: 1 });
    expect(read("min=30000", { initialMaxPrice: 900000 }).priceRange).toEqual([
      30000, 900000,
    ]);
  });
  it("distingue ausencia de filtros, filtros borrados y un precio gratuito", () => {
    const config = {
      initialCategoriesText: "Hogar",
      initialColorsText: "rojo",
    };
    expect(read("", config).categories).toEqual(["Hogar"]);
    expect(read("cats=&colors=&min=0&max=0", config)).toMatchObject({
      categories: [],
      colors: [],
      priceRange: [0, 0],
    });
  });
  it("normaliza enlaces externos inválidos y respeta el límite de tablet", () => {
    expect(
      read("page=-8&cols=100&sort=__proto__&min=-30&max=no"),
    ).toMatchObject({
      page: 1,
      cols: 4,
      sort: "-createdAt",
      priceRange: [0, 10000000],
    });
    expect(
      read("", { columnsTablet: 2, defaultColsDesktop: 6 }, 880).cols,
    ).toBe(2);
    expect(read("", {}, 390).cols).toBe(2);
  });
  it("conserva seguimiento externo y el estado completo al compartir una página", () => {
    const state = {
      ...read(),
      page: 4,
      categories: [],
      colors: ["rojo"],
      q: "Curso",
      sort: "price",
    };
    const params = writeCatalogQuery(
      new URLSearchParams("utm_source=campana"),
      state,
    );
    expect(params.get("utm_source")).toBe("campana");
    expect(read(params.toString())).toEqual(state);
  });
  it("combina el origen del catálogo con la búsqueda sin permitir productos privados", () => {
    const config = buildSafeCatalogConfig({
      sourceMode: "categories",
      allowedCategoriesText: "Hogar",
      onlyActive: false,
      limit: 200,
    });
    const params = buildCatalogProductQuery(config, {
      ...read("q=Libro&cats=Libros&page=2"),
      sort: "title",
    });
    expect(params.getAll("categoryScope")).toEqual(["Hogar"]);
    expect(params.getAll("category")).toEqual(["Libros"]);
    expect(params.get("status")).toBe("published");
    expect(params.get("limit")).toBe("100");
    expect(config.onlyActive).toBe(true);
    expect(
      catalogScopeParams(
        buildSafeCatalogConfig({
          sourceMode: "manual",
          manualProductIdsText: "uno, dos",
        }),
      ).getAll("productKeys"),
    ).toEqual(["uno", "dos"]);
  });
  it("conserva y normaliza los controles compartidos entre panel, tarjeta y vista pública", () => {
    const config = buildSafeCatalogConfig({
      showSearch: false,
      showSort: false,
      defaultSort: "price",
      showHeroBadge: false,
      heroBadge: "Temporada",
      cardUiConfig: {
        showBorder: false,
        showShadow: false,
        titleFontFamily: "inter",
      },
    });
    expect(buildSafeCatalogConfig(config)).toEqual(config);
    expect(config).toMatchObject({
      showSearch: false,
      showSort: false,
      defaultSort: "price",
      showHeroBadge: false,
      heroBadge: "Temporada",
      cardUiConfig: {
        showBorder: false,
        showShadow: false,
        titleFontFamily: "inter",
      },
    });
  });
});
