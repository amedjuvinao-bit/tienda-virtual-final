import SystemPageEditor from "./workspace/SystemPageEditor";
import ThanksAppearanceControls from "./workspace/ThanksAppearanceControls";
import { buildSafeThanksPageConfig } from "../../pages/gracias/thanksPageConfig";
const tabs = [
  { id: "content", label: "Título y mensajes", group: "content" },
  { id: "summary", label: "Resumen y acciones", group: "content" },
  { id: "gallery", label: "Galería visual", group: "content" },
  { id: "background", label: "Fondo y cristal", group: "design" },
  { id: "colors", label: "Colores", group: "design" },
  { id: "layout", label: "Medidas y formas", group: "design" },
  { id: "visibility", label: "Visibilidad", group: "options" },
  { id: "settings", label: "Configuración", group: "settings" },
];
function normalizePage(page) {
  return {
    name: "Gracias",
    slug: "gracias",
    pageType: "thanks-page",
    enabled: page.enabled !== false,
    useHeader:
      page.useHeader !== false && page.thanksPageConfig?.showHeader !== false,
    useFooter:
      page.useFooter !== false && page.thanksPageConfig?.showFooter !== false,
    blocks: [],
    thanksPageConfig: buildSafeThanksPageConfig(page.thanksPageConfig),
  };
}
export default function ThanksPageEditor() {
  return (
    <SystemPageEditor
      pageType="thanks-page"
      label="Agradecimiento y resultado del pedido"
      normalizePage={normalizePage}
      tabs={tabs}
      Controls={ThanksAppearanceControls}
    />
  );
}
