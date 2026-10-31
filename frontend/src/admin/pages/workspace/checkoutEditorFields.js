const f = (key, label, type = "text", extra = {}) => ({
  key,
  label,
  type,
  ...extra,
});
const n = (key, label, min, max, step = 1) =>
  f(key, label, "number", { min, max, step, scope: "style" });
const c = (key, label) => f(key, label, "color", { scope: "style" });
const t = (key, label, scope = "config") => f(key, label, "toggle", { scope });
const s = (key, label, options, scope = "style") =>
  f(key, label, "select", { options, scope });
export const checkoutEditorSections = {
  content: [
    [
      "Título y presentación",
      [
        s(
          "titleMode",
          "Formato del título",
          [
            ["text", "Texto"],
            ["image", "Imagen"],
          ],
          "config",
        ),
        f("titleText", "Texto del título"),
        f("titleImage", "Imagen del título", "image"),
        f("titleImageAlt", "Descripción de la imagen del título"),
        f("subtitleText", "Texto de presentación", "textarea"),
      ],
    ],
    [
      "Ruta de navegación",
      [
        f("breadcrumbHomeText", "Etiqueta de Inicio"),
        f("breadcrumbCurrentText", "Etiqueta de la página"),
      ],
    ],
  ],
  contact: [
    [
      "Datos de contacto",
      [
        f("contactSectionTitle", "Título de contacto"),
        f("nameLabelText", "Etiqueta de nombres"),
        f("lastnameLabelText", "Etiqueta de apellidos"),
        f("emailLabelText", "Etiqueta de correo o teléfono"),
        f("phoneLabelText", "Etiqueta de teléfono"),
        f("documentLabelText", "Etiqueta de identificación"),
        f("newsletterText", "Texto de novedades"),
      ],
    ],
    [
      "Entrega y facturación",
      [
        f("deliverySectionTitle", "Título de entrega"),
        f("cityLabelText", "Etiqueta de ciudad"),
        f("addressLabelText", "Etiqueta de dirección"),
        f("billingSectionTitle", "Título de facturación"),
        f("billingToggleText", "Texto para dirección fiscal diferente"),
      ],
    ],
  ],
  summary: [
    [
      "Resumen del pedido",
      [
        f("orderSummaryTitle", "Título del resumen"),
        f("subtotalLabelText", "Etiqueta del subtotal"),
        f("totalLabelText", "Etiqueta del total"),
        f("shippingMessageText", "Ayuda de impuestos y envío", "textarea"),
      ],
    ],
    [
      "Pago y confianza",
      [
        f("paymentSectionTitle", "Título de pago"),
        f("confirmButtonText", "Texto del botón de pago"),
        f("policiesText", "Texto de confianza", "textarea"),
        f("paymentMethodsImage", "Imagen de métodos de pago", "image"),
        f("paymentMethodsImageAlt", "Descripción de métodos de pago"),
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
      "Contenedores y textos",
      [
        c("sectionCardBg", "Tinte de los paneles"),
        c("sectionCardBorderColor", "Brillo del borde de paneles"),
        c("summaryBg", "Tinte del resumen"),
        c("summaryBorderColor", "Brillo del borde del resumen"),
        c("lineColor", "Líneas divisorias"),
        c("textPrimaryColor", "Texto principal"),
        c("textSecondaryColor", "Texto secundario"),
        c("titleTextColor", "Color del título"),
        c("accentColor", "Color de acento"),
        c("breadcrumbTextColor", "Texto de la ruta"),
        c("breadcrumbLinkColor", "Enlace de la ruta"),
      ],
    ],
    [
      "Campos de entrada",
      [
        c("inputBg", "Tinte de los campos"),
        c("inputBorderColor", "Borde de los campos"),
        c("inputTextColor", "Texto de los campos"),
        c("inputPlaceholderColor", "Texto de ejemplo"),
        c("labelTextColor", "Etiquetas de los campos"),
      ],
    ],
    [
      "Totales y botón",
      [
        c("subtotalTextColor", "Etiqueta del subtotal"),
        c("subtotalValueColor", "Valor del subtotal"),
        c("totalTextColor", "Etiqueta del total"),
        c("totalValueColor", "Valor del total"),
        c("confirmButtonBg", "Tinte del botón de pago"),
        c("confirmButtonTextColor", "Texto e icono del botón"),
      ],
    ],
  ],
  layout: [
    [
      "Contenido y paneles",
      [
        n("contentMaxWidthPx", "Ancho máximo del contenido (px)", 900, 1800),
        n("contentTopPaddingPx", "Espacio superior (px)", 0, 240),
        n("titleFontSizePx", "Tamaño del título (px)", 18, 72),
        n(
          "titleImageHeightPx",
          "Alto máximo del título en imagen (px)",
          24,
          220,
        ),
        n("sectionCardRadiusPx", "Radio de los paneles (px)", 0, 40),
        n(
          "sectionCardPaddingPx",
          "Espacio interior de los paneles (px)",
          8,
          48,
        ),
        n("summaryRadiusPx", "Radio del resumen (px)", 0, 40),
        s("shadowStyle", "Profundidad", [
          ["none", "Sin sombra"],
          ["soft", "Suave"],
          ["medium", "Media"],
          ["strong", "Intensa"],
        ]),
      ],
    ],
    [
      "Campos y acciones",
      [
        n("inputRadiusPx", "Radio de los campos (px)", 0, 40),
        n("inputHeightPx", "Altura de los campos (px)", 36, 80),
        s("inputStyle", "Forma de los campos", [
          ["rounded", "Radio personalizado"],
          ["pill", "Píldora"],
          ["square", "Esquinas suaves"],
        ]),
        n("confirmButtonRadiusPx", "Radio del botón de pago (px)", 0, 40),
        s("confirmButtonStyle", "Forma del botón", [
          ["rounded", "Radio personalizado"],
          ["pill", "Píldora"],
          ["square", "Esquinas suaves"],
        ]),
        n(
          "paymentMethodsImageHeightPx",
          "Alto máximo de métodos de pago (px)",
          24,
          140,
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
        t("showBreadcrumb", "Mostrar ruta de navegación"),
        t("showProgress", "Mostrar progreso de compra"),
      ],
    ],
    [
      "Contenido y opciones",
      [
        t("showContactSection", "Mostrar título de contacto"),
        t("showDeliverySection", "Mostrar título de entrega"),
        t("showBillingSection", "Solicitar datos fiscales adicionales"),
        t("showOrderSummary", "Mostrar resumen del pedido"),
        t("showCoupon", "Mostrar código de descuento"),
        t("showPaymentMethodsImage", "Mostrar imagen de métodos de pago"),
        t("showNewsletterCheckbox", "Mostrar opción de novedades"),
        t("showPoliciesText", "Mostrar texto de confianza"),
        t("showConfirmButton", "Mostrar botón de pago"),
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
