import React from "react";
import SystemPageEditor from "./workspace/SystemPageEditor";
import NotFoundAppearanceControls from "./workspace/NotFoundAppearanceControls";
import { buildSafeNotFoundPageConfig } from "../../components/not-found/notFoundPageConfig";
const tabs = [
  { id: "content", label: "Título e ilustración", group: "content" },
  { id: "navigation", label: "Textos y navegación", group: "content" },
  { id: "background", label: "Fondo y cristal", group: "design" },
  { id: "colors", label: "Colores", group: "design" },
  { id: "layout", label: "Medidas y formas", group: "design" },
  { id: "visibility", label: "Visibilidad", group: "options" },
  { id: "settings", label: "Configuración", group: "settings" },
];
function normalizePage(page) {
  return {
    name: "Not Found",
    slug: "not-found",
    pageType: "notfound-page",
    enabled: page.enabled !== false,
    useHeader:
      page.useHeader !== false && page.notFoundPageConfig?.showHeader !== false,
    useFooter:
      page.useFooter !== false && page.notFoundPageConfig?.showFooter !== false,
    blocks: [],
    notFoundPageConfig: buildSafeNotFoundPageConfig(page.notFoundPageConfig),
  };
}
export default function NotFoundPageEditor() {
  return (
    <SystemPageEditor
      pageType="notfound-page"
      label="Página no encontrada"
      normalizePage={normalizePage}
      tabs={tabs}
      Controls={NotFoundAppearanceControls}
    />
  );
}
