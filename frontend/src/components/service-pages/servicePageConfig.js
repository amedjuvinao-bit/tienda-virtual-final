import { buildSafeCartPageConfig, safePath } from "../cart/cartPageConfig";
import { catalogImageUrl } from "../catalog/catalogPresentation";
export const SERVICE_PAGE_DEFINITIONS = {
  "returns-page": {
    slug: "devoluciones",
    key: "returnsPageConfig",
    name: "Cambios y devoluciones",
  },
  "search-page": { slug: "buscar", key: "searchPageConfig", name: "Búsqueda" },
};
export const RETURN_TEXTS = {
  eyebrowText: "Centro de posventa",
  titleText: "Cambios y devoluciones",
  subtitleText:
    "Consulta el avance o crea una solicitud sin repetir tus datos.",
  orderLabel: "Orden",
  createTitle: "Crear una solicitud",
  createDescription: "Selecciona solo los productos que deseas devolver.",
  historyTitle: "Mis solicitudes",
  historyDescription:
    "Aquí verás autorización, guía, recepción y solución final.",
  emptyEligibleText:
    "Todavía no hay productos entregados disponibles para devolución.",
  emptyHistoryText: "Aún no tienes solicitudes.",
  resolutionLabel: "¿Cómo quieres resolverlo?",
  availableLabel: "Disponible",
  untilLabel: "hasta",
  policyLabel: "Política",
  windowLabel: "Ventana",
  daysLabel: "días desde la entrega",
  reviewLabel: "requiere revisión",
  reviewText:
    "Tu solicitud será revisada por el equipo antes de autorizar la devolución.",
  incompatibleText:
    "Los productos seleccionados no comparten una solución disponible.",
  quantityLabel: "Cantidad",
  reasonLabel: "Motivo",
  detailLabel: "Detalle",
  requiredReasonPlaceholder: "Describe el motivo (obligatorio)",
  optionalReasonPlaceholder: "Detalle adicional (opcional)",
  commentPlaceholder: "Comentario general (opcional)",
  submitText: "Enviar solicitud",
  sendingText: "Enviando…",
  cancelText: "Cancelar solicitud",
  downloadText: "Descargar etiqueta RMA",
  returnText: "Volver a la tienda",
  retryText: "Reintentar",
  exchangeText: "Cambio de producto",
  creditText: "Saldo a favor",
  refundText: "Reembolso",
  reason_wrong_size: "Medida o presentación incorrecta",
  reason_wrong_item: "Producto equivocado",
  reason_damaged: "Llegó averiado",
  reason_defective: "Defecto de fabricación",
  reason_not_as_described: "No coincide con la descripción",
  reason_changed_mind: "Cambio de decisión",
  reason_warranty: "Garantía",
  reason_other: "Otro motivo",
};
export const SEARCH_TEXTS = {
  eyebrowText: "Explora nuestro catálogo",
  titleText: "Resultados de búsqueda",
  subtitleText: "Encuentra productos por nombre, categoría o referencia.",
  idleTitle: "¿Qué estás buscando?",
  homeText: "Inicio",
  breadcrumbText: "Buscar",
  inputLabel: "Buscar productos",
  placeholderText: "Nombre, categoría o referencia",
  searchText: "Buscar",
  idleText: "Escribe una palabra para explorar el catálogo.",
  emptyText: "No encontramos productos. Prueba con otra búsqueda.",
  errorText: "No pudimos cargar los resultados. Inténtalo de nuevo.",
  loadingText: "Cargando productos…",
  retryText: "Reintentar",
  previousText: "Anterior",
  nextText: "Siguiente",
  pageLabel: "Página",
  ofLabel: "de",
  productSingular: "producto",
  productPlural: "productos",
  categoryText: "Categoría",
};
const object = (value) =>
  value && typeof value === "object" && !Array.isArray(value) ? value : {};
const bounded = (value, min, max, fallback) =>
  Number.isFinite(Number.parseFloat(value))
    ? Math.min(max, Math.max(min, Number.parseFloat(value)))
    : fallback;
export function buildServicePageConfig(raw, type) {
  const source = object(raw),
    style = object(source.style),
    presentation = object(source.presentation);
  const material = buildSafeCartPageConfig({ style, presentation });
  material.style.checkoutButtonRadiusPx = bounded(
    style.checkoutButtonRadiusPx,
    0,
    999,
    999,
  );
  material.style.cardRadiusPx = bounded(style.cardRadiusPx, 0, 60, 24);
  material.style.cardPaddingPx = bounded(style.cardPaddingPx, 12, 80, 24);
  const defaults = type === "returns-page" ? RETURN_TEXTS : SEARCH_TEXTS;
  return {
    ...source,
    ...Object.fromEntries(
      Object.entries(defaults).map(([key, fallback]) => [
        key,
        typeof source[key] === "string" && source[key].trim()
          ? source[key]
          : fallback,
      ]),
    ),
    titleMode: source.titleMode === "image" ? "image" : "text",
    titleImage: catalogImageUrl(source.titleImage),
    titleImageAlt:
      typeof source.titleImageAlt === "string"
        ? source.titleImageAlt
        : defaults.titleText,
    titleImageHeightPx: bounded(source.titleImageHeightPx, 24, 220, 80),
    titleFontSizePx: bounded(source.titleFontSizePx, 18, 72, 36),
    contentMaxWidthPx: bounded(source.contentMaxWidthPx, 320, 1800, 1200),
    contentTopPaddingPx: bounded(source.contentTopPaddingPx, 0, 300, 28),
    contentBottomPaddingPx: bounded(source.contentBottomPaddingPx, 0, 300, 48),
    gapPx: bounded(source.gapPx, 8, 60, 20),
    columns: Math.round(bounded(source.columns, 2, 4, 4)),
    mobileColumns: Math.round(bounded(source.mobileColumns, 1, 2, 2)),
    imageRatio: ["3 / 4", "4 / 5", "1 / 1"].includes(source.imageRatio)
      ? source.imageRatio
      : "3 / 4",
    imageFit: source.imageFit === "contain" ? "contain" : "cover",
    returnLink: safePath(source.returnLink, "/"),
    showTitle: source.showTitle !== false,
    showSubtitle: source.showSubtitle !== false,
    showEyebrow: source.showEyebrow !== false,
    showBreadcrumb: source.showBreadcrumb !== false,
    showHeader: source.showHeader !== false,
    showFooter: source.showFooter !== false,
    showWhatsapp: source.showWhatsapp === true,
    style: {
      ...style,
      ...material.style,
      buttonBg: style.buttonBg || material.style.accentColor,
      buttonTextColor: style.buttonTextColor || material.style.textPrimaryColor,
      buttonBorderColor:
        style.buttonBorderColor || material.style.cardBorderColor,
      inputBg: style.inputBg || material.style.cardBg,
      inputTextColor: style.inputTextColor || material.style.textPrimaryColor,
      inputBorderColor:
        style.inputBorderColor || material.style.cardBorderColor,
      titleTextColor: style.titleTextColor || material.style.textPrimaryColor,
      lineColor: style.lineColor || material.style.cardBorderColor,
      buttonRadiusPx: bounded(style.buttonRadiusPx, 0, 999, 999),
    },
    presentation: {
      ...material.presentation,
      backgroundImage: catalogImageUrl(presentation.backgroundImage),
      mobileBackgroundImage: catalogImageUrl(
        presentation.mobileBackgroundImage,
      ),
    },
  };
}
export function normalizeServicePage(page, type) {
  const definition = SERVICE_PAGE_DEFINITIONS[type];
  const config = buildServicePageConfig(page[definition.key], type);
  return {
    name: definition.name,
    slug: definition.slug,
    pageType: type,
    enabled: page.enabled !== false,
    useHeader: page.useHeader !== false && config.showHeader,
    useFooter: page.useFooter !== false && config.showFooter,
    blocks: [],
    [definition.key]: config,
  };
}
