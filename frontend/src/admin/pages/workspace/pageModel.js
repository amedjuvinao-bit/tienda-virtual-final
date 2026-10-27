export const PAGE_TYPES = {
  information: {
    label: "Informativa",
    description: "Presenta tu negocio, información de atención o preguntas frecuentes.",
    path: "information-page",
  },
  custom: {
    label: "Personalizada",
    description:
      "Combina secciones para contar tu historia o presentar una campaña.",
    path: "paginas",
  },
  catalog: {
    label: "Catálogo",
    description:
      "Muestra productos con categorías, filtros y una selección propia.",
    path: "catalogo",
  },
  "product-detail": {
    label: "Detalle del producto",
    description: "Define la presentación de la ficha de tus productos.",
    path: "product-detail",
  },
  "cart-page": {
    label: "Carrito",
    path: "cart-page",
    system: true,
    slug: "carrito",
  },
  "checkout-page": {
    label: "Finalizar compra",
    path: "checkout-page",
    system: true,
    slug: "checkout",
  },
  "thanks-page": {
    label: "Confirmación de compra",
    path: "thanks-page",
    system: true,
    slug: "gracias",
  },
  "favorites-page": {
    label: "Favoritos",
    path: "favorites-page",
    system: true,
    slug: "favoritos",
  },
  "returns-page": {
    label: "Cambios y devoluciones",
    path: "returns-page",
    system: true,
    slug: "devoluciones",
    publicPath: "/devoluciones/:orderId",
    requiresOrder: true,
  },
  "search-page": {
    label: "Búsqueda",
    path: "search-page",
    system: true,
    slug: "buscar",
  },
  "notfound-page": {
    label: "Página no encontrada",
    path: "notfound-page",
    system: true,
    slug: "not-found",
  },
};
export function pageMeta(page) {
  if (page?.systemRole === "help") return {
    ...PAGE_TYPES.information, system: true, slug: "preguntas-frecuentes", publicPath: "/preguntas-frecuentes",
  };
  if (page?.systemRole === "contact") return {
    ...PAGE_TYPES.information, system: true, slug: "contacto", publicPath: "/contacto",
  };
  if (page?.systemRole === "about") return {
    ...PAGE_TYPES.information, system: true, slug: "nosotros", publicPath: "/nosotros",
  };
  return (
    Object.values(PAGE_TYPES).find(
      (meta) =>
        meta.system && meta.slug === String(page?.slug || "").toLowerCase(),
    ) ||
    PAGE_TYPES[String(page?.pageType || "").toLowerCase()] ||
    PAGE_TYPES.custom
  );
}
export function pageEditorPath(page) {
  return `/admin/${pageMeta(page).path}/${encodeURIComponent(page._id)}`;
}
export function pagePublicPath(page) {
  if (pageMeta(page).publicPath) return pageMeta(page).publicPath;
  return `${pageMeta(page).system ? "/" : "/pagina/"}${encodeURIComponent(page.slug || "")}`;
}
export function slugify(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}
export function normalizeSearch(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es")
    .trim();
}
export function filterPages(pages, query, type = "all", state = "all") {
  const term = normalizeSearch(query);
  return pages.filter((page) => {
    const meta = pageMeta(page);
    return (
      (!term ||
        normalizeSearch(`${page.name} ${page.slug} ${meta.label}`).includes(
          term,
        )) &&
      (type === "all" ||
        (type === "system"
          ? meta.system
          : type === "custom"
            ? !meta.system
            : page.pageType === type)) &&
      (state === "all" ||
        (state === "active" ? page.enabled !== false : page.enabled === false))
    );
  });
}
export function sortPages(pages) {
  return [...pages].sort(
    (a, b) =>
      Number(!!pageMeta(b).system) - Number(!!pageMeta(a).system) ||
      String(a.name || "").localeCompare(String(b.name || ""), "es"),
  );
}
export function newPageForm() {
  return {
    name: "",
    slug: "",
    pageType: "custom",
    enabled: true,
    useHeader: true,
    useFooter: true,
  };
}
