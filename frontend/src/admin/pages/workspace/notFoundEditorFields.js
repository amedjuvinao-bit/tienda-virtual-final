const field = (key, label, type = "text", extra = {}) => ({
  key,
  label,
  type,
  ...extra,
});
const number = (key, label, min, max, step = 1) =>
  field(key, label, "number", { min, max, step });
const color = (key, label) => field(key, label, "color");
const toggle = (key, label) => field(key, label, "toggle");
export const notFoundEditorSections = {
  content: [
    [
      "Título y mensaje",
      [
        field("titleMode", "Formato del título", "select", {
          options: [
            ["text", "Texto"],
            ["image", "Imagen"],
          ],
        }),
        field("titleText", "Texto del título"),
        field("titleImage", "Imagen del título", "image"),
        field("titleImageAlt", "Descripción de la imagen del título"),
        field("messageText", "Mensaje de la página", "textarea"),
      ],
    ],
    [
      "Ilustración y código",
      [
        field("imageUrl", "Ilustración", "image"),
        field("imageAlt", "Descripción de la ilustración"),
        field("codeText", "Código visible"),
      ],
    ],
  ],
  navigation: [
    [
      "Navegación y acciones",
      [
        field("buttonText", "Texto del botón principal"),
        field("buttonLink", "Destino del botón principal"),
        field("secondaryButtonText", "Texto del enlace secundario"),
        field("secondaryButtonLink", "Destino del enlace secundario"),
      ],
    ],
    [
      "Ruta de navegación",
      [
        field("breadcrumbRootLabel", "Etiqueta de Inicio"),
        field("breadcrumbRootLink", "Destino de Inicio"),
        field("breadcrumbText", "Etiqueta de la página"),
      ],
    ],
  ],
  background: [
    [
      "Fondo de la página",
      [
        field("backgroundMode", "Origen del fondo", "select", {
          scope: "presentation",
          options: [
            ["continuity", "Fondo continuo de Inicio"],
            ["custom", "Fondo propio"],
          ],
        }),
        color("pageBg", "Color del fondo propio"),
        field("backgroundImage", "Imagen de fondo", "image", {
          scope: "presentation",
          customOnly: true,
        }),
        field("mobileBackgroundImage", "Imagen de fondo móvil", "image", {
          scope: "presentation",
          customOnly: true,
        }),
      ],
    ],
    [
      "Material de cristal",
      [
        number("glassOpacity", "Opacidad del cristal", 0, 0.8, 0.01),
        number("glassBlur", "Desenfoque del cristal", 0, 24),
        number("borderWidth", "Grosor del borde", 0, 4, 0.25),
        number("reflection", "Intensidad del brillo", 0, 1, 0.05),
      ].map((f) => ({ ...f, scope: "presentation" })),
    ],
    [
      "Botón de cristal",
      [
        number(
          "checkoutGlassOpacity",
          "Opacidad del cristal del botón",
          0,
          0.8,
          0.01,
        ),
        number("checkoutGlassBlur", "Desenfoque del botón", 0, 24),
      ].map((f) => ({ ...f, scope: "presentation" })),
    ],
  ],
  colors: [
    [
      "Superficie y texto",
      [
        color("cardBg", "Tinte del cristal"),
        color("cardBorderColor", "Color del brillo del borde"),
        color("textPrimaryColor", "Texto principal"),
        color("textSecondaryColor", "Texto del mensaje"),
        color("titleTextColor", "Color del título"),
        color("accentColor", "Color de acento"),
        color("breadcrumbColor", "Color de la ruta de navegación"),
      ],
    ],
    [
      "Código y acciones",
      [
        color("codeColor", "Color del código y símbolo"),
        color("buttonBg", "Tinte del botón principal"),
        color("buttonTextColor", "Texto e icono del botón principal"),
        color("buttonBorderColor", "Borde del botón principal"),
        color("secondaryButtonColor", "Color del enlace secundario"),
      ],
    ],
  ],
  layout: [
    [
      "Contenedor y espacio",
      [
        number(
          "contentMaxWidthPx",
          "Ancho máximo del contenido (px)",
          320,
          1800,
        ),
        number("contentTopPaddingPx", "Espacio superior (px)", 0, 300),
        number("contentBottomPaddingPx", "Espacio inferior (px)", 0, 300),
        number("cardPaddingPx", "Espacio interior máximo (px)", 12, 80),
        number("cardRadiusPx", "Radio del contenedor (px)", 0, 60),
        number("gapPx", "Separación de contenido e ilustración (px)", 12, 100),
        field("shadowStyle", "Profundidad", "select", {
          options: [
            ["none", "Sin sombra"],
            ["soft", "Suave"],
            ["medium", "Media"],
            ["strong", "Intensa"],
          ],
        }),
      ],
    ],
    [
      "Textos e imágenes",
      [
        number("titleFontSizePx", "Tamaño del título (px)", 18, 90),
        number(
          "titleImageHeightPx",
          "Alto máximo de la imagen del título (px)",
          24,
          260,
        ),
        number("messageFontSizePx", "Tamaño del mensaje (px)", 12, 28),
        number("codeFontSizePx", "Tamaño del código (px)", 48, 240),
        number(
          "imageMaxWidthPx",
          "Ancho máximo de la ilustración (px)",
          100,
          700,
        ),
        number("imageRadiusPx", "Radio de la ilustración (px)", 0, 60),
      ],
    ],
    [
      "Botones",
      [
        number("buttonFontSizePx", "Tamaño del texto del botón (px)", 10, 24),
        number("buttonRadiusPx", "Radio del botón (px)", 0, 999),
        field("buttonStyle", "Acabado del botón", "select", {
          options: [
            ["solid", "Cristal tintado"],
            ["outline", "Solo borde"],
            ["ghost", "Solo texto"],
          ],
        }),
      ],
    ],
  ],
  visibility: [
    [
      "Encabezado y pie",
      [
        toggle("useHeader", "Mostrar encabezado"),
        toggle("useFooter", "Mostrar pie de página"),
      ]
        .map((f) => ({ ...f, scope: "form" }))
        .concat([
          toggle("showWhatsapp", "Mostrar WhatsApp"),
          toggle("showBreadcrumb", "Mostrar ruta de navegación"),
        ]),
    ],
    [
      "Contenido y acciones",
      [
        toggle("showTitle", "Mostrar título"),
        toggle("showMessage", "Mostrar mensaje"),
        toggle("showImage", "Mostrar ilustración"),
        toggle("showCode", "Mostrar código si no hay ilustración"),
        toggle("showButton", "Mostrar botón principal"),
        toggle("showSecondaryButton", "Mostrar enlace secundario"),
      ],
    ],
  ],
  settings: [
    [
      "Página del sistema",
      [
        field("slug", "Ruta fija", "readonly", { scope: "form" }),
        { ...toggle("enabled", "Activar diseño personalizado"), scope: "form" },
      ],
    ],
  ],
};
