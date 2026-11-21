import { clampInt, clampNumber, parseCsvArray } from "./catalogConfig";

export const CATALOG_SORTS = [
  ["-createdAt", "Más recientes"],
  ["createdAt", "Más antiguos"],
  ["title", "Nombre: A a Z"],
  ["-title", "Nombre: Z a A"],
  ["price", "Menor precio"],
  ["-price", "Mayor precio"],
];
const MAX_PRICE = 10_000_000;
export function readCatalogQuery(params, config, width = 1280) {
  const maxCols =
    width < 768
      ? config.columnsMobile
      : width < 1024
        ? config.columnsTablet
        : config.columnsDesktop;
  const defaultCols =
    width < 768 ? config.defaultColsMobile : config.defaultColsDesktop;
  const money = (key, fallback) =>
    params.has(key) && params.get(key).trim() !== ""
      ? clampNumber(params.get(key), 0, MAX_PRICE, fallback)
      : fallback;
  const min = money("min", config.initialMinPrice),
    max = money("max", config.initialMaxPrice);
  const sort = params.get("sort") || config.defaultSort;
  return {
    categories: parseCsvArray(
      params.has("cats") ? params.get("cats") : config.initialCategoriesText,
    ).slice(0, 30),
    colors: parseCsvArray(
      params.has("colors") ? params.get("colors") : config.initialColorsText,
    ).slice(0, 30),
    priceRange: [Math.min(min, max), Math.max(min, max)],
    cols: clampInt(
      params.has("cols") ? params.get("cols") : defaultCols,
      1,
      maxCols,
      Math.min(defaultCols, maxCols),
    ),
    page: clampInt(params.get("page"), 1, 100000, 1),
    q: String(params.get("q") || "")
      .normalize("NFKC")
      .trim()
      .replace(/\s+/g, " ")
      .slice(0, 160),
    sort: CATALOG_SORTS.some(([key]) => key === sort)
      ? sort
      : config.defaultSort,
  };
}
export function writeCatalogQuery(params, state) {
  const next = new URLSearchParams(params);
  next.set("cats", state.categories.join(","));
  next.set("colors", state.colors.join(","));
  next.set("min", String(state.priceRange[0]));
  next.set("max", String(state.priceRange[1]));
  next.set("cols", String(state.cols));
  if (state.page > 1) next.set("page", String(state.page));
  else next.delete("page");
  if (state.q) next.set("q", state.q);
  else next.delete("q");
  next.set("sort", state.sort);
  return next;
}
export function catalogScopeParams(config) {
  const params = new URLSearchParams();
  if (config.sourceMode === "categories")
    parseCsvArray(config.allowedCategoriesText)
      .slice(0, 30)
      .forEach((v) => params.append("categoryScope", v));
  if (config.sourceMode === "manual")
    parseCsvArray(config.manualProductIdsText)
      .slice(0, 100)
      .forEach((v) => params.append("productKeys", v));
  return params;
}
export function hasEmptyCatalogScope(config) {
  return (
    (config.sourceMode === "categories" &&
      !parseCsvArray(config.allowedCategoriesText).length) ||
    (config.sourceMode === "manual" &&
      !parseCsvArray(config.manualProductIdsText).length)
  );
}
export function buildCatalogProductQuery(config, state) {
  const params = catalogScopeParams(config);
  params.set("page", String(state.page));
  params.set("limit", String(config.limit || 24));
  params.set("status", "published");
  params.set("sort", state.sort);
  if (state.q) params.set("q", state.q);
  params.set("minPrice", String(state.priceRange[0]));
  params.set("maxPrice", String(state.priceRange[1]));
  state.categories.forEach((v) => params.append("category", v));
  state.colors.forEach((v) => params.append("color", v));
  return params;
}
