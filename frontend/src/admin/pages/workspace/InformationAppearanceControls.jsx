import MemoryMomentsEditor from "./MemoryMomentsEditor";
import MemoryDesignControls from "./MemoryDesignControls";
import ContactAppearanceControls from "./ContactAppearanceControls";
import HelpTopicsEditor from "./HelpTopicsEditor";
import HelpQuestionsEditor from "./HelpQuestionsEditor";
import HelpAppearanceControls from "./HelpAppearanceControls";
import ServiceAppearanceControls from "./ServiceAppearanceControls";
import InformationSectionsEditor from "./InformationSectionsEditor";
import { serviceEditorSections } from "./serviceEditorFields";
const f = (key, label, type = "text", extra = {}) => ({
  key,
  label,
  type,
  ...extra,
});
export default function InformationAppearanceControls(props) {
  if (props.topic === "help-topics") return <HelpTopicsEditor {...props} />;
  if (props.topic === "help-questions") return <HelpQuestionsEditor {...props} />;
  if (props.topic.startsWith("help-")) return <HelpAppearanceControls {...props} />;
  if (props.topic.startsWith("contact-")) return <ContactAppearanceControls {...props} />;
  if (props.topic === "moments") return <MemoryMomentsEditor {...props} />;
  if (["journal-texts", "journal-design"].includes(props.topic))
    return <MemoryDesignControls {...props} />;
  if (props.topic === "sections")
    return <InformationSectionsEditor {...props} />;
  const common = serviceEditorSections("returns-page");
  const sections = {
    ...common,
    content: common.content.map(([title, fields]) => [
      title,
      [
        {
          key: "layout",
          label: "Diseño de la página",
          type: "select",
          options: [
            ["help", "Centro de ayuda"],
            ["contact", "Contacto y ubicación"],
            ["memory-table", "Mesa de recuerdos"],
            ["editorial", "Página de lectura"],
          ],
        },
        ...fields,
      ],
    ]),
    actions: [
      [
        "Navegación y llamada a la acción",
        [
          f("navigationTitle", "Título de la navegación"),
          f("actionText", "Texto del botón"),
          f("actionHref", "Destino del botón"),
        ],
      ],
    ],
    colors: common.colors.map(([title, fields]) => [
      title,
      fields.filter((field) => !field.key.startsWith("input")),
    ]),
    layout: [
      ...common.layout,
      [
        "Lectura y navegación",
        [
          f("bodyFontSizePx", "Tamaño del texto (px)", "number", {
            scope: "style",
            min: 12,
            max: 22,
          }),
          f(
            "sectionTitleSizePx",
            "Tamaño de títulos de sección (px)",
            "number",
            { scope: "style", min: 18, max: 56 },
          ),
          f("navigationWidthPx", "Ancho de navegación (px)", "number", {
            scope: "style",
            min: 180,
            max: 360,
          }),
        ],
      ],
    ],
    visibility: [
      [
        "Elementos visibles",
        [
          ...common.visibility[0][1],
          f("showNavigation", "Mostrar navegación de secciones", "toggle"),
        ],
      ],
    ],
    settings: [
      [
        "Identidad y publicación",
        [
          f("name", "Nombre en el panel", "text", { scope: "form" }),
          f(
            "slug",
            "Dirección de la página",
            ["about", "contact", "help"].includes(props.form.systemRole) ? "readonly" : "text",
            { scope: "form" },
          ),
          f("enabled", "Página activa", "toggle", { scope: "form" }),
        ],
      ],
    ],
  };
  return (
    <ServiceAppearanceControls
      {...props}
      configKey="informationPageConfig"
      sections={sections}
      settingsHelp={
        String(props.form.systemRole || "").startsWith("consumer-")
          ? "La identidad, el plazo y los derechos se conectan con Configuración → Consumidor y PQR. Aquí editas título, apariencia y secciones complementarias; no se reducen los derechos legales. La dirección se conserva."
          : props.form.systemRole === "help"
          ? "Esta página está conectada con Preguntas frecuentes, Ayuda y Centro de ayuda. Su dirección se conserva; puedes administrar sus temas, respuestas y diseño."
          : props.form.systemRole === "contact"
          ? "Esta página abre Contacto y, si no existe una página propia de sede, Nuestra sede. Puedes editar el contenido y el diseño; la dirección se conserva para mantener sus enlaces."
          : props.form.systemRole === "about"
          ? "Esta página está conectada con Nosotros y Nuestra historia. Puedes editar su nombre, contenido y diseño; su dirección se conserva para mantener los enlaces."
          : "Los enlaces de esta página usan /pagina/ seguido de su dirección. Al cambiarla, actualiza los enlaces que la abren."
      }
    />
  );
}
