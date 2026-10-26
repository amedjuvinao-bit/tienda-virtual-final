import { notFoundEditorSections } from "./notFoundEditorFields";
import {
  RETURN_TEXTS,
  SEARCH_TEXTS,
} from "../../../components/service-pages/servicePageConfig";
const f = (key, label, type = "text", extra = {}) => ({
  key,
  label,
  type,
  ...extra,
});
const n = (key, label, min, max, extra = {}) =>
  f(key, label, "number", { min, max, ...extra });
const labels = {
  eyebrowText: "Antetítulo",
  titleText: "Texto del título",
  subtitleText: "Descripción de la página",
  createTitle: "Título de nueva solicitud",
  createDescription: "Descripción de nueva solicitud",
  historyTitle: "Título del historial",
  historyDescription: "Descripción del historial",
  emptyEligibleText: "Sin productos disponibles para devolución",
  emptyHistoryText: "Historial vacío",
  orderLabel: "Etiqueta de la orden",
  resolutionLabel: "Pregunta de solución",
  availableLabel: "Etiqueta de disponibilidad",
  untilLabel: "Etiqueta de fecha límite",
  policyLabel: "Etiqueta de política",
  windowLabel: "Etiqueta del plazo",
  daysLabel: "Unidad del plazo",
  reviewLabel: "Etiqueta de revisión",
  reviewText: "Aviso de revisión",
  incompatibleText: "Aviso de soluciones incompatibles",
  quantityLabel: "Etiqueta de cantidad",
  reasonLabel: "Etiqueta de motivo",
  detailLabel: "Etiqueta de detalle",
  requiredReasonPlaceholder: "Ayuda del motivo obligatorio",
  optionalReasonPlaceholder: "Ayuda del motivo opcional",
  commentPlaceholder: "Ayuda del comentario general",
  submitText: "Botón de enviar solicitud",
  sendingText: "Botón durante el envío",
  cancelText: "Botón de cancelar solicitud",
  downloadText: "Botón de descargar etiqueta",
  returnText: "Enlace de regreso",
  retryText: "Botón de reintentar",
  exchangeText: "Solución de cambio",
  creditText: "Solución de saldo a favor",
  refundText: "Solución de reembolso",
  reason_wrong_size: "Motivo de medida o presentación",
  reason_wrong_item: "Motivo de producto equivocado",
  reason_damaged: "Motivo de avería",
  reason_defective: "Motivo de defecto",
  reason_not_as_described: "Motivo de descripción",
  reason_changed_mind: "Motivo de cambio de decisión",
  reason_warranty: "Motivo de garantía",
  reason_other: "Otro motivo",
  idleTitle: "Título sin búsqueda",
  homeText: "Enlace de Inicio",
  breadcrumbText: "Etiqueta de la página",
  inputLabel: "Etiqueta del campo de búsqueda",
  placeholderText: "Ayuda del buscador",
  searchText: "Botón de buscar",
  idleText: "Mensaje antes de buscar",
  emptyText: "Mensaje sin coincidencias",
  errorText: "Mensaje al fallar la búsqueda",
  loadingText: "Mensaje durante la búsqueda",
  previousText: "Botón anterior",
  nextText: "Botón siguiente",
  pageLabel: "Etiqueta de página",
  ofLabel: "Separador de paginación",
  productSingular: "Producto en singular",
  productPlural: "Producto en plural",
  categoryText: "Nombre genérico de categoría",
};
export function serviceEditorSections(type) {
  const returns = type === "returns-page",
    defaults = returns ? RETURN_TEXTS : SEARCH_TEXTS;
  const contentKeys = ["eyebrowText", "titleText", "subtitleText"];
  const textKeys = returns
    ? [
        "createTitle",
        "createDescription",
        "historyTitle",
        "historyDescription",
        "resolutionLabel",
        "submitText",
        "sendingText",
        "cancelText",
        "downloadText",
        "returnText",
        "retryText",
        "exchangeText",
        "creditText",
        "refundText",
      ]
    : [
        "idleTitle",
        "homeText",
        "breadcrumbText",
        "inputLabel",
        "placeholderText",
        "searchText",
        "previousText",
        "nextText",
        "retryText",
      ];
  const fields = (keys) =>
    keys.map((key) =>
      f(
        key,
        labels[key] || key,
        key.endsWith("Description") || key.endsWith("Placeholder")
          ? "textarea"
          : "text",
      ),
    );
  const colors = [
    ["pageBg", "Fondo propio"],
    ["cardBg", "Tinte del cristal"],
    ["cardBorderColor", "Brillo del borde"],
    ["titleTextColor", "Color del título"],
    ["textPrimaryColor", "Texto principal"],
    ["textSecondaryColor", "Texto secundario"],
    ["accentColor", "Acentos e iconos"],
    ["lineColor", "Separadores"],
    ["buttonBg", "Tinte de los botones"],
    ["buttonTextColor", "Texto de los botones"],
    ["buttonBorderColor", "Borde de los botones"],
    ["inputBg", "Tinte de los campos"],
    ["inputTextColor", "Texto de los campos"],
    ["inputBorderColor", "Borde de los campos"],
  ];
  return {
    content: [
      [
        "Título y presentación",
        [
          f("titleMode", "Formato del título", "select", {
            options: [
              ["text", "Texto"],
              ["image", "Imagen"],
            ],
          }),
          ...fields(contentKeys),
          f("titleImage", "Imagen del título", "image"),
          f("titleImageAlt", "Descripción de la imagen del título"),
        ],
      ],
    ],
    texts: [
      [
        "Acciones y navegación",
        [
          ...fields(textKeys),
          ...(returns ? [f("returnLink", "Destino de regreso")] : []),
        ],
      ],
    ],
    messages: [
      [
        "Mensajes y etiquetas",
        fields(
          Object.keys(defaults).filter(
            (key) => ![...contentKeys, ...textKeys].includes(key),
          ),
        ),
      ],
    ],
    background: notFoundEditorSections.background.map(([title, fields]) => [
      title,
      fields.map((field) =>
        field.key === "pageBg" ? { ...field, scope: "style" } : field,
      ),
    ]),
    colors: [
      [
        "Colores de la página",
        colors.map(([key, label]) =>
          f(key, label, "color", { scope: "style" }),
        ),
      ],
    ],
    layout: [
      [
        "Espaciado y tipografía",
        [
          n("contentMaxWidthPx", "Ancho máximo (px)", 320, 1800),
          n("contentTopPaddingPx", "Espacio superior (px)", 0, 300),
          n("contentBottomPaddingPx", "Espacio inferior (px)", 0, 300),
          n("gapPx", "Separación (px)", 8, 60),
          n("titleFontSizePx", "Tamaño del título (px)", 18, 72),
          n(
            "titleImageHeightPx",
            "Alto máximo del título en imagen (px)",
            24,
            220,
          ),
          n("cardRadiusPx", "Radio de los paneles (px)", 0, 60, {
            scope: "style",
          }),
          n("cardPaddingPx", "Espacio interior (px)", 12, 80, {
            scope: "style",
          }),
          n("buttonRadiusPx", "Radio de los botones (px)", 0, 999, {
            scope: "style",
          }),
          f("shadowStyle", "Profundidad", "select", {
            scope: "style",
            options: [
              ["none", "Sin sombra"],
              ["soft", "Suave"],
              ["medium", "Media"],
              ["strong", "Intensa"],
            ],
          }),
        ],
      ],
      ...(!returns
        ? [
            [
              "Tarjetas de productos",
              [
                n("columns", "Columnas en escritorio", 2, 4),
                n("mobileColumns", "Columnas en móvil", 1, 2),
                f("imageRatio", "Proporción de las fotos", "select", {
                  options: [
                    ["3 / 4", "Vertical"],
                    ["4 / 5", "Retrato compacto"],
                    ["1 / 1", "Cuadrada"],
                  ],
                }),
                f("imageFit", "Ajuste de la foto", "select", {
                  options: [
                    ["cover", "Llenar de borde a borde"],
                    ["contain", "Imagen completa con márgenes"],
                  ],
                }),
              ],
            ],
          ]
        : []),
    ],
    visibility: [
      [
        "Elementos visibles",
        [
          f("useHeader", "Mostrar encabezado", "toggle", { scope: "form" }),
          f("useFooter", "Mostrar pie de página", "toggle", { scope: "form" }),
          f("showWhatsapp", "Mostrar WhatsApp", "toggle"),
          f("showTitle", "Mostrar título", "toggle"),
          f("showSubtitle", "Mostrar descripción", "toggle"),
          f("showEyebrow", "Mostrar antetítulo", "toggle"),
          ...(!returns
            ? [f("showBreadcrumb", "Mostrar ruta de navegación", "toggle")]
            : []),
        ],
      ],
    ],
    settings: [
      [
        "Página del sistema",
        [
          f("slug", "Ruta fija", "readonly", { scope: "form" }),
          f("enabled", "Activar diseño personalizado", "toggle", {
            scope: "form",
          }),
        ],
      ],
    ],
  };
}
