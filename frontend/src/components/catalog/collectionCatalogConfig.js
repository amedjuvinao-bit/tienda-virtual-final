import { catalogImageUrl } from "./catalogPresentation";
export function buildCollectionCatalog(raw = {}) {
  const c = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  const text = (key, fallback = "") =>
    typeof c[key] === "string" ? c[key].slice(0, 500) : fallback;
  const n = Number(c.artworkWidthPx);
  return {
    ...c,
    heroArtwork: catalogImageUrl(c.heroArtwork),
    heroArtworkAlt: text("heroArtworkAlt"),
    showArtwork: c.showArtwork !== false,
    artworkWidthPx:
      c.artworkWidthPx !== "" && c.artworkWidthPx != null && Number.isFinite(n)
        ? Math.max(120, Math.min(460, n))
        : 320,
    searchPlaceholder: text("searchPlaceholder", "Buscar en esta selección…"),
    missingImageText: text("missingImageText", "Imagen próximamente"),
    categoriesTitle: text("categoriesTitle", "Categorías"),
    filteredEmptyTitle: text("filteredEmptyTitle", "No hay coincidencias"),
    filteredEmptyText: text(
      "filteredEmptyText",
      "Prueba otros filtros o limpia la búsqueda para explorar esta selección.",
    ),
  };
}
