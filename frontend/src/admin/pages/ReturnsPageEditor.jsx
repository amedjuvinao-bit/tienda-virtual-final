import SystemPageEditor from "./workspace/SystemPageEditor";
import ServiceAppearanceControls from "./workspace/ServiceAppearanceControls";
import { normalizeServicePage } from "../../components/service-pages/servicePageConfig";
const normalize = (page) => normalizeServicePage(page, "returns-page");
const tabs = [
  { id: "content", label: "Título y presentación", group: "content" },
  { id: "texts", label: "Textos y acciones", group: "content" },
  { id: "messages", label: "Mensajes y etiquetas", group: "content" },
  { id: "background", label: "Fondo y cristal", group: "design" },
  { id: "colors", label: "Colores", group: "design" },
  { id: "layout", label: "Medidas y formas", group: "design" },
  { id: "visibility", label: "Visibilidad", group: "options" },
  { id: "settings", label: "Configuración", group: "settings" },
];
export default function ReturnsPageEditor() {
  return (
    <SystemPageEditor
      pageType="returns-page"
      label="Cambios y devoluciones"
      normalizePage={normalize}
      tabs={tabs}
      Controls={ServiceAppearanceControls}
    />
  );
}
