import SystemPageEditor from "./workspace/SystemPageEditor";
import InformationAppearanceControls from "./workspace/InformationAppearanceControls";
import {
  normalizeInformationPage,
  validateInformationPage,
} from "../../components/information-page/informationPageConfig";
const tabs = [
  { id: "content", label: "Título y presentación", group: "content" },
  { id: "terms-index", label: "Índice y descarga", group: "content" },
  { id: "terms-support", label: "Ayuda e información", group: "content" },
  { id: "terms-design", label: "Composición de condiciones", group: "design" },
  { id: "claims-fields", label: "Formulario y campos", group: "content" },
  { id: "claims-actions", label: "Pestañas y mensajes", group: "content" },
  { id: "claims-guide", label: "Guía y contacto", group: "content" },
  { id: "claims-design", label: "Composición de PQR", group: "design" },
  { id: "returns-choices", label: "Opciones de atención", group: "content" },
  { id: "returns-journey", label: "Pasos de la solicitud", group: "content" },
  { id: "returns-support", label: "Ayuda y condiciones", group: "content" },
  { id: "returns-design", label: "Composición de cambios", group: "design" },
  { id: "shipping-journey", label: "Proceso de entrega", group: "content" },
  {
    id: "shipping-details",
    label: "Costo, plazo y cobertura",
    group: "content",
  },
  { id: "shipping-support", label: "Ayuda y enlaces", group: "content" },
  { id: "shipping-design", label: "Composición de envíos", group: "design" },
  { id: "help-topics", label: "Temas y categorías", group: "content" },
  { id: "help-questions", label: "Preguntas y respuestas", group: "content" },
  { id: "help-texts", label: "Buscador y mensajes", group: "content" },
  { id: "help-support", label: "Atención y enlaces", group: "content" },
  { id: "help-design", label: "Diseño del centro", group: "design" },
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
const resolveTabs = (tabs, form) =>
  tabs.filter((tab) => {
    const terms = form.systemRole === "consumer-terms";
    if (tab.id.startsWith("terms-")) return terms;
    const shipping = form.systemRole === "consumer-shipping";
    const returns = form.systemRole === "consumer-returns";
    const claims = form.systemRole === "consumer-claims";
    if (tab.id.startsWith("claims-")) return claims;
    if (tab.id.startsWith("returns-")) return returns;
    if (tab.id.startsWith("shipping-")) return shipping;
    if (
      (shipping || returns || claims || terms) &&
      (tab.id.startsWith("help-") ||
        tab.id.startsWith("contact-") ||
        ["moments", "journal-texts", "journal-design"].includes(tab.id))
    )
      return false;
    const layout = form.informationPageConfig.layout;
    if (tab.id.startsWith("help-")) return layout === "help";
    if (tab.id.startsWith("contact-")) return layout === "contact";
    if (["moments", "journal-texts", "journal-design"].includes(tab.id))
      return layout === "memory-table";
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
