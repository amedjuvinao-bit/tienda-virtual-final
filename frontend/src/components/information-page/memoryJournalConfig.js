import { catalogImageUrl } from "../catalog/catalogPresentation";
const object = (v) =>
  v && typeof v === "object" && !Array.isArray(v) ? v : {};
const text = (v, fallback = "") => (typeof v === "string" ? v : fallback);
const bound = (v, min, max, fallback) =>
  v !== "" && v != null && Number.isFinite(Number(v))
    ? Math.max(min, Math.min(max, Number(v)))
    : fallback;
export const MEMORY_LABELS = {
  allText: "Todos los recuerdos",
  openText: "Entrar al recuerdo",
  selectText: "Seleccionar recuerdo",
  listText: "Ver como lista",
  tableText: "Ver mesa de recuerdos",
  zoomInText: "Acercar",
  zoomOutText: "Alejar",
  previousText: "Recuerdo anterior",
  nextText: "Recuerdo siguiente",
  closeText: "Cerrar recuerdo",
  timelineText: "Línea de tiempo",
  noDateText: "Sin fecha",
  emptyTitle: "Nuestra historia sigue creciendo",
  emptyText:
    "Pronto compartiremos aquí nuevos recuerdos y momentos de nuestro negocio.",
  galleryText: "Fotos de este recuerdo",
};
export function memoryDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) return "";
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
    ? value
    : "";
}
export function formatMemoryDate(value, short = false) {
  return value
    ? new Intl.DateTimeFormat("es", {
        day: "numeric",
        month: short ? "short" : "long",
        ...(short ? {} : { year: "numeric" }),
        timeZone: "UTC",
      }).format(new Date(`${value}T12:00:00Z`))
    : "";
}
export function buildMemoryJournal(raw, sections = []) {
  const source = object(raw),
    seen = new Set();
  const imported = sections
    .filter((s) => catalogImageUrl(s.image))
    .map((s) => ({
      id: `section-${s.id}`,
      title: s.title,
      story: s.body,
      image: s.image,
      imageAlt: s.imageAlt,
      enabled: s.enabled !== false,
    }));
  const moments = (Array.isArray(source.moments) ? source.moments : imported)
    .slice(0, 60)
    .map((raw, index) => {
      const m = object(raw);
      let id =
        text(m.id, `moment-${index + 1}`)
          .replace(/[^\w-]/g, "")
          .slice(0, 100) || `moment-${index + 1}`;
      while (seen.has(id)) id += `-${index + 1}`;
      seen.add(id);
      return {
        ...m,
        id,
        title: text(m.title),
        summary: text(m.summary),
        story: text(m.story),
        date: memoryDate(m.date),
        category: text(m.category).trim(),
        image: catalogImageUrl(m.image),
        imageAlt: text(m.imageAlt),
        enabled: m.enabled !== false,
        focalX: bound(m.focalX, 0, 100, 50),
        focalY: bound(m.focalY, 0, 100, 50),
        gallery: (Array.isArray(m.gallery) ? m.gallery : [])
          .slice(0, 8)
          .map((photo) => ({
            ...object(photo),
            image: catalogImageUrl(photo?.image),
            alt: text(photo?.alt),
            caption: text(photo?.caption),
          })),
      };
    });
  return {
    ...source,
    ...Object.fromEntries(
      Object.entries(MEMORY_LABELS).map(([key, value]) => [
        key,
        typeof source[key] === "string" && source[key].trim()
          ? source[key]
          : value,
      ]),
    ),
    moments,
    featuredId: text(source.featuredId),
    photoRadiusPx: bound(source.photoRadiusPx, 0, 40, 24),
    boardHeightPx: bound(source.boardHeightPx, 480, 900, 620),
    photoShadow: bound(source.photoShadow, 0, 1, 0.22),
    headingFont: source.headingFont === "theme" ? "theme" : "editorial",
    showDates: source.showDates !== false,
    showFilters: source.showFilters !== false,
    showTimeline: source.showTimeline !== false,
    showZoom: source.showZoom !== false,
    motion: source.motion !== false,
    showSections: source.showSections === true,
    showFooterAction: source.showFooterAction === true,
  };
}
export function visibleMemories(journal) {
  return journal.moments
    .filter((m) => m.enabled && m.title.trim() && m.image)
    .map((m, index) => ({ m, index }))
    .sort((a, b) =>
      a.m.date && b.m.date
        ? a.m.date.localeCompare(b.m.date) || a.index - b.index
        : a.m.date
          ? -1
          : b.m.date
            ? 1
            : a.index - b.index,
    )
    .map((item) => item.m);
}
export function memoryWindow(moments, selected, count = 7) {
  const index = Math.max(
    0,
    moments.findIndex((m) => m.id === selected),
  );
  const start = Math.max(
    0,
    Math.min(index - Math.floor(count / 2), moments.length - count),
  );
  return moments.slice(start, start + count);
}
export function validateMemoryJournal(journal) {
  for (const moment of journal?.moments || []) {
    if (
      moment.enabled &&
      (!moment.title?.trim() || !catalogImageUrl(moment.image))
    )
      return "Cada recuerdo visible necesita un título y una foto principal. Puedes ocultarlo mientras lo preparas.";
    if (moment.date && !memoryDate(moment.date))
      return "Revisa la fecha de los recuerdos: debe ser una fecha válida.";
  }
  return "";
}
