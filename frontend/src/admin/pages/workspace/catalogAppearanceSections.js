const fields = (scope, keys, title) => ({
  scope,
  keys: keys.split(" "),
  title,
});
const scene = (keys, title, extra = {}) => ({
  ...fields("presentation", keys, title),
  ...extra,
});
export const CATALOG_APPEARANCE_SECTIONS = {
  visual: {
    title: "Fondo y cristal",
    description:
      "El fondo, los colores generales y el acabado compartido del catálogo.",
    tabs: [
      {
        id: "background",
        title: "Fondo",
        blocks: [
          scene(
            "backgroundMode backgroundColor backgroundOpacity",
            "Fondo del catálogo",
            { backgroundImage: true },
          ),
        ],
      },
      {
        id: "glass",
        title: "Cristal",
        blocks: [
          scene(
            "glassColor glassOpacity glassBlur radius",
            "Acabado del cristal",
          ),
        ],
      },
      {
        id: "colors",
        title: "Colores",
        blocks: [scene("textColor accentColor", "Colores generales")],
      },
      {
        id: "themes",
        title: "Estilos predefinidos",
        blocks: [{ kind: "presets" }],
      },
    ],
  },
  header: {
    title: "Encabezado",
    description:
      "Personaliza el título y el contenedor que presenta el catálogo.",
    tabs: [
      { id: "content", title: "Contenido", content: true },
      {
        id: "material",
        title: "Cristal",
        blocks: [
          scene(
            "headerTint headerOpacity headerMaterialDepthColor headerMaterialDepth headerContrastColor headerContrast headerMaterialOpacity headerBlur headerLayers",
            "Superficie y profundidad",
          ),
        ],
      },
      {
        id: "light",
        title: "Bordes y luz",
        blocks: [
          scene(
            "headerEdgeColor headerEdgeWidth headerReflectionColor headerReflection headerShadowColor headerShadow",
            "Bordes, reflejos y sombra",
          ),
        ],
      },
      {
        id: "text",
        title: "Tipografía",
        blocks: [
          scene(
            "titleFont titleSize headerTextColor headerBadgeColor headerBadgeTint",
            "Título y distintivo",
          ),
        ],
      },
      {
        id: "size",
        title: "Medidas",
        blocks: [
          scene(
            "headerRadius headerHeight headerPadding",
            "Tamaño y espacio interior",
          ),
        ],
      },
      {
        id: "icon",
        title: "Adorno",
        blocks: [
          scene(
            "headerIcon headerIconColor headerIconSize headerIconOpacity",
            "Adorno del encabezado",
          ),
        ],
      },
    ],
  },
  grid: {
    title: "Distribución",
    description:
      "Organiza la cuadrícula, sus columnas y las herramientas para explorar los productos.",
    tabs: [
      {
        id: "composition",
        title: "Cuadrícula",
        blocks: [
          scene("layout maxWidth topSpacing gap", "Estructura y espacios"),
          fields("catalog", "limit", "Paginación"),
        ],
      },
      {
        id: "devices",
        title: "Escritorio y móvil",
        blocks: [
          fields("catalog", "columnsDesktop defaultColsDesktop", "Escritorio"),
          fields("catalog", "columnsTablet", "Tablet"),
          fields("catalog", "columnsMobile defaultColsMobile", "Móvil"),
        ],
      },
      {
        id: "tools",
        title: "Herramientas",
        blocks: [
          fields(
            "catalog",
            "showBreadcrumb showSearch showSort defaultSort showToolbar showResultCount",
            "Navegación, búsqueda y resultados",
          ),
        ],
      },
      {
        id: "view",
        title: "Botones de vista",
        blocks: [
          fields(
            "columnControlsUiConfig",
            "buttonBgColor buttonBorderColor buttonIconColor",
            "Estado normal",
          ),
          fields(
            "columnControlsUiConfig",
            "activeButtonBgColor activeButtonBorderColor activeButtonIconColor",
            "Estado seleccionado",
          ),
          fields(
            "columnControlsUiConfig",
            "hoverButtonBgColor hoverButtonBorderColor hoverButtonIconColor",
            "Al pasar el cursor",
          ),
          fields(
            "columnControlsUiConfig",
            "buttonRadiusPx buttonBorderWidthPx",
            "Forma y bordes",
          ),
        ],
      },
    ],
  },
  "card-style": {
    title: "Tarjetas de producto",
    description: "La imagen, la información y las acciones de cada producto.",
    tabs: [
      {
        id: "images",
        title: "Imágenes",
        blocks: [
          scene("imageRatio showPhotoCount", "Fotografía"),
          fields(
            "cardUiConfig",
            "imageFit imageBg showImageBg imageRadiusPx",
            "Presentación de la imagen",
          ),
        ],
      },
      {
        id: "text",
        title: "Texto",
        blocks: [
          fields(
            "cardUiConfig",
            "titleColor titleFontFamily",
            "Nombre del producto",
          ),
          scene("cardTitleSize", "Tamaño del nombre"),
          fields(
            "cardUiConfig",
            "priceColor oldPriceColor priceFontFamily",
            "Precio",
          ),
          scene("cardPriceSize", "Tamaño del precio"),
          fields(
            "cardUiConfig",
            "metaColor metaFontFamily",
            "Información adicional",
          ),
          scene("showDescription showOptions", "Datos visibles"),
        ],
      },
      {
        id: "surface",
        title: "Cristal y bordes",
        blocks: [
          fields(
            "cardUiConfig",
            "cardBg cardBorderColor cardBorderWidthPx cardRadiusPx showBorder cardShadowStyle showShadow",
            "Tarjeta",
          ),
          scene("rimStyle rimColor rimOpacity", "Acabado del borde"),
          fields(
            "cardUiConfig",
            "actionButtonBorderColor actionButtonBorderWidthPx",
            "Bordes de las acciones",
          ),
        ],
      },
      {
        id: "favorite",
        title: "Favorito",
        blocks: [
          fields(
            "cardUiConfig",
            "favoriteIconName favoriteIconColor favoriteActiveColor favoriteButtonBg favoriteButtonOpacity",
            "Icono y estados del favorito",
          ),
        ],
      },
      {
        id: "cart",
        title: "Carrito",
        blocks: [
          fields(
            "cardUiConfig",
            "cartIconName cartIconColor cartButtonBg cartButtonOpacity",
            "Icono y aspecto del carrito",
          ),
        ],
      },
    ],
  },
  "filter-style": {
    title: "Filtros",
    description:
      "Organiza las categorías, los colores y el precio que verá el visitante.",
    tabs: [
      {
        id: "visibility",
        title: "Contenido",
        blocks: [
          fields(
            "catalog",
            "showFilters showFilterFab",
            "Acceso a los filtros",
          ),
          fields(
            "filterUiConfig",
            "categoriesSearchEnabled showSelectedSummary showCounters showSectionIcons stickyHeader",
            "Contenido del panel",
          ),
        ],
      },
      {
        id: "colors",
        title: "Colores",
        blocks: [
          fields(
            "filterUiConfig",
            "panelBg panelBorderColor panelTitleColor panelSubtitleColor",
            "Contenedor y título",
          ),
          fields(
            "filterUiConfig",
            "sectionHeaderBg sectionHeaderTextColor",
            "Títulos de las secciones",
          ),
          fields(
            "filterUiConfig",
            "accentColor accentColor2 chipBg chipTextColor",
            "Opciones y selección",
          ),
        ],
      },
      {
        id: "text",
        title: "Texto",
        blocks: [
          fields(
            "filterUiConfig",
            "titleSizePx sectionTitleSizePx contentTextSizePx",
            "Tamaños de texto",
          ),
        ],
      },
      {
        id: "shape",
        title: "Bordes y espacios",
        blocks: [
          fields(
            "filterUiConfig",
            "radiusPx sectionRadiusPx borderWidthPx sectionGapPx colorDotSizePx shadowStyle",
            "Medidas y acabado",
          ),
          scene("filterSectionBorders", "Separación de las secciones"),
        ],
      },
      {
        id: "initial",
        title: "Selección inicial",
        blocks: [
          fields(
            "catalog",
            "initialColorsText initialMinPrice initialMaxPrice",
            "Filtros al abrir el catálogo",
          ),
        ],
      },
      {
        id: "motion",
        title: "Animación",
        blocks: [
          fields("filterUiConfig", "animation", "Transición de los filtros"),
        ],
      },
    ],
  },
  motion: {
    title: "Animaciones",
    description:
      "Controla cómo se mueven las capas de la escena al recorrer el catálogo.",
    tabs: [
      {
        id: "scene",
        title: "Movimiento de la escena",
        blocks: [scene("motion motionStrength", "Movimiento y profundidad")],
      },
    ],
  },
};
