const f = (key, label, type = "text", extra = {}) => ({
  key,
  label,
  type,
  ...extra,
});
const n = (key, label, min, max, step = 1) =>
  f(key, label, "number", { min, max, step });
const c = (key, label) => f(key, label, "color", { scope: "style" });
const t = (key, label, scope = "config") => f(key, label, "toggle", { scope });
const s = (key, label, options, scope = "config") =>
  f(key, label, "select", { options, scope });
const dimensions = (fields) =>
  fields.map((field) => ({ ...field, scope: "style" }));
export const thanksEditorSections = {
  content: [
    [
      "Encabezado",
      [
        s("titleMode", "Formato del título", [
          ["text", "Texto"],
          ["image", "Imagen"],
        ]),
        f("titleText", "Texto del título"),
        f("entryTitleText", "Título al entrar sin un pedido"),
        f("titleImage", "Imagen del título", "image"),
        f("titleImageAlt", "Descripción de la imagen del título"),
      ],
    ],
    [
      "Mensajes",
      [
        f("mainMessage", "Mensaje del pedido recibido", "textarea"),
        f("entryMessage", "Mensaje al entrar sin un pedido", "textarea"),
        f("helpText", "Texto de ayuda", "textarea"),
      ],
    ],
  ],
  summary: [
    [
      "Etiquetas del resumen",
      [
        f("summaryTitle", "Título del resumen"),
        f("orderNumberLabel", "Etiqueta del número de pedido"),
        f("customerLabel", "Etiqueta de cliente"),
        f("itemCountLabel", "Etiqueta de cantidad"),
        f("subtotalLabel", "Etiqueta del subtotal"),
        f("shippingLabel", "Etiqueta del envío"),
        f("totalLabel", "Etiqueta del total aprobado"),
        f("pendingTotalLabel", "Etiqueta del total pendiente"),
        f("itemSingularText", "Producto en singular"),
        f("itemPluralText", "Producto en plural"),
        f("detailsToggleText", "Enlace para desplegar el detalle"),
      ],
    ],
    [
      "Acciones",
      [
        f("continueButtonText", "Texto del botón principal"),
        f("continueButtonLink", "Destino del botón principal"),
        f("refreshButtonText", "Texto del botón para actualizar estado"),
        f("returnsButtonText", "Texto del botón de cambios y devoluciones"),
      ],
    ],
  ],
  steps: [
    [
      "Pasos informativos del pedido",
      [
        t("showNextSteps", "Mostrar próximos pasos"),
        f("nextStepsTitle", "Título de los próximos pasos"),
        f("paymentStepTitle", "Título de confirmación del pago"),
        f(
          "pendingStepText",
          "Mensaje mientras se confirma el pago",
          "textarea",
        ),
        f(
          "approvedStepText",
          "Mensaje cuando el pago está aprobado",
          "textarea",
        ),
        f(
          "attentionStepText",
          "Mensaje si el pago requiere atención",
          "textarea",
        ),
        f("preparationStepTitle", "Título de preparación"),
        f("preparationStepText", "Descripción de preparación", "textarea"),
        f("deliveryStepTitle", "Título de entrega"),
        f("deliveryStepText", "Descripción de entrega", "textarea"),
      ],
    ],
  ],
  gallery: [
    [
      "Reproducción",
      [
        t("showVisualPanel", "Mostrar galería debajo del resumen"),
        t("enabled", "Activar galería", "slider"),
        t("autoplay", "Reproducir automáticamente", "slider"),
        {
          ...n("intervalMs", "Intervalo entre imágenes (ms)", 1500, 12000, 100),
          scope: "slider",
        },
        s(
          "animation",
          "Transición",
          [
            ["fade", "Desvanecer"],
            ["slide", "Deslizar"],
            ["zoom", "Acercamiento suave"],
          ],
          "slider",
        ),
      ],
    ],
  ],
  background: [
    [
      "Fondo de la página",
      [
        s(
          "backgroundMode",
          "Origen del fondo",
          [
            ["continuity", "Fondo continuo de Inicio"],
            ["custom", "Fondo propio"],
          ],
          "presentation",
        ),
        c("pageBg", "Color del fondo propio"),
        f("backgroundImage", "Imagen de fondo", "image", {
          scope: "presentation",
          customOnly: true,
        }),
        f("mobileBackgroundImage", "Imagen de fondo móvil", "image", {
          scope: "presentation",
          customOnly: true,
        }),
      ],
    ],
    [
      "Material de cristal",
      [
        n("glassOpacity", "Opacidad del cristal", 0, 0.8, 0.01),
        n("glassBlur", "Desenfoque del cristal", 0, 24),
        n("borderWidth", "Grosor del borde", 0, 4, 0.25),
        n("reflection", "Intensidad del brillo", 0, 1, 0.05),
        n(
          "checkoutGlassOpacity",
          "Opacidad del cristal del botón",
          0,
          0.8,
          0.01,
        ),
        n("checkoutGlassBlur", "Desenfoque del botón", 0, 24),
      ].map((field) => ({ ...field, scope: "presentation" })),
    ],
  ],
  colors: [
    [
      "Superficie y textos",
      [
        c("panelBg", "Tinte del cristal"),
        c("panelBorderColor", "Color del brillo del borde"),
        c("visualBorderColor", "Borde de la galería"),
        c("textPrimaryColor", "Texto principal"),
        c("textSecondaryColor", "Texto secundario"),
        c("titleTextColor", "Color del título"),
        c("accentColor", "Color de acento"),
        c("lineColor", "Separadores y líneas de los pasos"),
        c("iconColor", "Iconos del resumen y símbolo superior"),
        c("statusBadgeBg", "Tinte del estado del pago"),
        c("statusBadgeTextColor", "Texto del estado del pago"),
      ],
    ],
    [
      "Botones y galería",
      [
        c("buttonBg", "Tinte del botón"),
        c("buttonTextColor", "Texto e icono del botón"),
        c("secondaryButtonBg", "Tinte del botón secundario"),
        c("secondaryButtonTextColor", "Texto del botón secundario"),
        c("badgeBg", "Fondo de la etiqueta visual"),
        c("badgeTextColor", "Texto de la etiqueta visual"),
        c("captionBg", "Fondo de la descripción visual"),
        c("captionTextColor", "Texto de la descripción visual"),
      ],
    ],
  ],
  layout: [
    [
      "Contenido",
      dimensions([
        n("contentMaxWidthPx", "Ancho máximo del contenido (px)", 900, 1800),
        n("contentTopPaddingPx", "Espacio superior (px)", 0, 240),
        s(
          "headingFontFamily",
          "Tipografía de títulos",
          [
            ["editorial", "Editorial elegante"],
            ["theme", "Tipografía global de títulos"],
            ["body", "Tipografía de lectura"],
          ],
          "style",
        ),
        n("titleFontSizePx", "Tamaño del título (px)", 18, 72),
        n(
          "titleImageHeightPx",
          "Alto máximo del título en imagen (px)",
          24,
          220,
        ),
        n("panelWidthPx", "Ancho máximo del resumen (px)", 280, 1200),
        n("medallionSizePx", "Diámetro del símbolo superior (px)", 56, 120),
        n("stepIconSizePx", "Diámetro de iconos de los pasos (px)", 36, 80),
        n("panelMinHeightPx", "Alto mínimo del resumen (px)", 0, 900),
        n("panelRadiusPx", "Radio del resumen (px)", 0, 40),
        n("panelPaddingPx", "Espacio interior del resumen (px)", 8, 64),
      ]),
    ],
    [
      "Galería",
      dimensions([
        n("visualWidthPx", "Ancho máximo de la galería (px)", 220, 900),
        n("visualHeightPx", "Alto de la galería (px)", 220, 760),
        n("visualRadiusPx", "Radio de la galería (px)", 0, 40),
      ]),
    ],
    [
      "Botones y profundidad",
      [
        {
          ...n("buttonRadiusPx", "Radio del botón (px)", 0, 40),
          scope: "style",
        },
        s(
          "buttonStyle",
          "Forma del botón",
          [
            ["pill", "Píldora"],
            ["rounded", "Redondeado"],
            ["square", "Esquinas suaves"],
          ],
          "style",
        ),
        s(
          "shadowStyle",
          "Profundidad",
          [
            ["none", "Sin sombra"],
            ["soft", "Suave"],
            ["medium", "Media"],
            ["strong", "Intensa"],
          ],
          "style",
        ),
      ],
    ],
  ],
  visibility: [
    [
      "Elementos generales",
      [
        t("useHeader", "Mostrar encabezado", "form"),
        t("useFooter", "Mostrar pie de página", "form"),
        t("showWhatsAppButton", "Mostrar WhatsApp"),
        t("showHelpText", "Mostrar texto de ayuda"),
        t("showContinueButton", "Mostrar botón principal"),
        t("showVisualPanel", "Mostrar galería debajo del resumen"),
      ],
    ],
    [
      "Datos del pedido",
      [
        t("showOrderNumber", "Mostrar número de pedido"),
        t("showPaymentStatus", "Mostrar estado del pago"),
        t("showCustomerName", "Mostrar cliente"),
        t("showItemCount", "Mostrar cantidad de productos"),
        t("showSubtotal", "Mostrar subtotal"),
        t("showShipping", "Mostrar envío"),
        t("showTotal", "Mostrar total"),
        t("showOrderDetails", "Permitir desplegar el detalle"),
        t("showNextSteps", "Mostrar próximos pasos"),
      ],
    ],
  ],
  settings: [
    [
      "Página del sistema",
      [
        f("slug", "Ruta fija", "readonly", { scope: "form" }),
        t("enabled", "Activar diseño personalizado", "form"),
      ],
    ],
  ],
};
