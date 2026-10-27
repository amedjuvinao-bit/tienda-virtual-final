import SystemPageEditor from "./workspace/SystemPageEditor";
import InformationAppearanceControls from "./workspace/InformationAppearanceControls";
import {
  normalizeInformationPage,
  validateInformationPage,
} from "../../components/information-page/informationPageConfig";
const tabs = [
  { id: "content", label: "Título y presentación", group: "content" },
  { id: "contact-channels", label: "Canales de contacto", group: "content" },
  { id: "contact-hours", label: "Horarios de atención", group: "content" },
  { id: "contact-location", label: "Ubicación y mapa", group: "content" },
  { id: "contact-texts", label: "Textos de contacto", group: "content" },
  { id: "contact-design", label: "Composición de contacto", group: "design" },
  { id: "moments", label: "Recuerdos y fotografías", group: "content" },
  { id: "journal-texts", label: "Textos del diario", group: "content" },
  { id: "journal-design", label: "Mesa y fotografías", group: "design" },
  { id: "sections", label: "Secciones de contenido", group: "content" },
  { id: "actions", label: "Navegación y botón", group: "content" },
  { id: "background", label: "Fondo y cristal", group: "design" },
  { id: "colors", label: "Colores", group: "design" },
  { id: "layout", label: "Medidas y tipografía", group: "design" },
  { id: "visibility", label: "Visibilidad", group: "options" },
  { id: "settings", label: "Identidad y publicación", group: "settings" },
];
const resolveTabs = (tabs, form) => tabs.filter(tab => {
  const layout = form.informationPageConfig.layout;
  if (tab.id.startsWith("contact-")) return layout === "contact";
  if (["moments", "journal-texts", "journal-design"].includes(tab.id)) return layout === "memory-table";
  return true;
});
export default function InformationPageEditor() {
  return (
    <SystemPageEditor
      pageType="information"
      label="Página informativa"
      normalizePage={normalizeInformationPage}
      validatePage={validateInformationPage}
      usePageName
      lockNavigationDuringUpload
      tabs={tabs}
      resolveTabs={resolveTabs}
      Controls={InformationAppearanceControls}
    />
  );
}
