const f = (scope, key, label, type = "text", extra = {}) => ({
  scope,
  key,
  label,
  type,
  ...extra,
});
const content = (key, label, type, extra) =>
  f("content", key, label, type, extra);
const style = (key, label, type = "color", extra) =>
  f("style", key, label, type, extra);
const number = (scope, key, label, min, max, step = 1) =>
  f(scope, key, label, "number", { min, max, step });
export const favoriteEditorSections = {
  header: [
    [
      "Título y presentación",
      [
        content("titleMode", "Formato del título", "select", {
          options: [
            ["text", "Texto"],
            ["image", "Imagen"],
          ],
        }),
        content("titleText", "Texto del título"),
        content("titleImage", "Imagen del título", "image"),
        content("titleImageAlt", "Descripción de la imagen"),
        content("subtitleText", "Texto de presentación"),
      ],
    ],
    [
      "Ruta de navegación",
      [
        content("breadcrumbRootLabel", "Etiqueta de Inicio"),
        content("breadcrumbText", "Etiqueta de la página"),
      ],
    ],
  ],
  texts: [
    [
      "Lista vacía",
      [
        content("emptyTitle", "Título de la lista vacía"),
        content("emptyText", "Descripción de la lista vacía"),
        content("emptyButtonText", "Texto para explorar productos"),
        content("emptyButtonLink", "Destino para explorar productos"),
      ],
    ],
    [
      "Búsqueda y orden",
      [
        content("searchPlaceholder", "Texto del buscador"),
        content("sortLabel", "Etiqueta de orden"),
        content("sortSavedText", "Orden por fecha"),
        content("sortPriceAscText", "Orden por menor precio"),
        content("sortPriceDescText", "Orden por mayor precio"),
        content("sortNameText", "Orden por nombre"),
        content("noResultsText", "Mensaje sin coincidencias"),
        content("clearSearchText", "Texto para limpiar la búsqueda"),
      ],
    ],
    [
      "Acciones y contador",
      [
        content("countSingularText", "Contador en singular"),
        content("countLabelText", "Contador en plural"),
        content("addButtonText", "Texto para agregar al carrito"),
        content("selectOptionsText", "Texto para seleccionar opciones"),
        content("removeButtonText", "Texto para quitar un favorito"),
        content("detailButtonText", "Texto para ver el producto"),
        content("unavailableText", "Etiqueta sin disponibilidad"),
        content("retryButtonText", "Texto para reintentar"),
      ],
    ],
  ],
  background: [
    [
      "Fondo de la página",
      [
        f("presentation", "backgroundMode", "Origen del fondo", "select", {
          options: [
            ["continuity", "Fondo continuo de Inicio"],
            ["custom", "Fondo propio"],
          ],
        }),
        style("pageBg", "Color del fondo propio"),
        f("presentation", "backgroundImage", "Imagen de fondo", "image", {
          customOnly: true,
        }),
        f(
          "presentation",
          "mobileBackgroundImage",
          "Imagen de fondo móvil",
          "image",
          { customOnly: true },
        ),
      ],
    ],
    [
      "Material de cristal",
      [
        number(
          "presentation",
          "glassOpacity",
          "Opacidad del cristal",
          0,
          0.8,
          0.01,
        ),
        number("presentation", "glassBlur", "Desenfoque del cristal", 0, 24),
        number("presentation", "borderWidth", "Grosor del borde", 0, 4, 0.25),
        number(
          "presentation",
          "reflection",
          "Intensidad del brillo",
          0,
          1,
          0.05,
        ),
        number(
          "presentation",
          "checkoutGlassOpacity",
          "Opacidad del cristal de botones",
          0,
          0.8,
          0.01,
        ),
      ],
    ],
  ],
  colors: [
    [
      "Superficie y texto",
      [
        style("cardBg", "Tinte del cristal"),
        style("cardBorderColor", "Color del brillo del borde"),
        style("textPrimaryColor", "Texto principal"),
        style("textSecondaryColor", "Texto secundario"),
        style("accentColor", "Color de acento"),
        style("titleTextColor", "Color del título"),
        style("badgeTextColor", "Color de la ruta actual"),
      ],
    ],
    [
      "Productos y acciones",
      [
        style("priceColor", "Color del precio"),
        style("favoriteIconColor", "Color del corazón"),
        style("buttonBg", "Tinte del botón"),
        style("buttonTextColor", "Texto e iconos del botón"),
      ],
    ],
  ],
  cards: [
    [
      "Cuadrícula adaptable",
      [
        number("content", "cardsPerRowDesktop", "Columnas en escritorio", 1, 6),
        number("content", "cardsPerRowTablet", "Columnas en tableta", 1, 4),
        number("content", "cardsPerRowMobile", "Columnas en móvil", 1, 2),
        number("style", "gridGapPx", "Separación de tarjetas (px)", 8, 80),
      ],
    ],
    [
      "Imagen y tarjetas",
      [
        number(
          "style",
          "imageRatio",
          "Proporción de la imagen (ancho / alto)",
          0.55,
          1.5,
          0.05,
        ),
        style("imageFit", "Ajuste de la imagen", "select", {
          options: [
            ["contain", "Imagen completa"],
            ["cover", "Cubrir la superficie"],
          ],
        }),
        number("style", "cardTitleSizePx", "Tamaño del nombre (px)", 12, 28),
        number("style", "cardRadiusPx", "Radio de tarjetas (px)", 0, 40),
        style("shadowStyle", "Profundidad", "select", {
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
      "Espacio y medidas",
      [
        number("style", "contentTopPaddingPx", "Espacio superior (px)", 0, 300),
        number("style", "contentMaxWidthPx", "Ancho máximo (px)", 600, 1800),
        number("style", "titleFontSizePx", "Tamaño del título (px)", 18, 90),
        number(
          "style",
          "titleImageHeightPx",
          "Alto de la imagen del título (px)",
          40,
          300,
        ),
        number(
          "style",
          "cardPaddingPx",
          "Espacio interior del encabezado (px)",
          8,
          48,
        ),
        number("style", "buttonRadiusPx", "Radio de botones (px)", 0, 999),
      ],
    ],
  ],
  visibility: [
    [
      "Página y navegación",
      [
        f("form", "useHeader", "Mostrar encabezado", "toggle"),
        f("form", "useFooter", "Mostrar pie de página", "toggle"),
        content("showWhatsapp", "Mostrar WhatsApp", "toggle"),
        content("showBreadcrumb", "Mostrar ruta de navegación", "toggle"),
        content("showTitle", "Mostrar título", "toggle"),
        content("showCount", "Mostrar contador", "toggle"),
      ],
    ],
    [
      "Productos y herramientas",
      [
        content("showSearch", "Mostrar buscador", "toggle"),
        content("showSort", "Mostrar ordenamiento", "toggle"),
        content("showPrice", "Mostrar precios", "toggle"),
        content("showVariants", "Mostrar atributos de la selección", "toggle"),
        content(
          "showCartButton",
          "Mostrar botón de agregar al carrito",
          "toggle",
        ),
        content("showRemoveButton", "Permitir quitar favoritos", "toggle"),
        content(
          "showEmptyButton",
          "Mostrar botón de explorar productos",
          "toggle",
        ),
      ],
    ],
  ],
  settings: [
    [
      "Configuración de la página",
      [
        f("form", "name", "Nombre de la página", "readonly"),
        f("form", "slug", "Ruta fija", "readonly"),
        f("form", "enabled", "Página activa", "toggle"),
      ],
    ],
  ],
};
