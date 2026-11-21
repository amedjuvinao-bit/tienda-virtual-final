import EditorSection from "./EditorSection";
import { Input, Textarea, Toggle } from "./ProductDetailEditorFields";
const labels = {
  searchLabel: "Etiqueta accesible del buscador",
  searchPlaceholder: "Ayuda dentro del buscador",
  clearSearchText: "Acción de limpiar búsqueda",
  topicsTitle: "Título de los temas",
  resultsTitle: "Título de resultados",
  resultSingular: "Resultado en singular",
  resultPlural: "Resultados en plural",
  emptyTitle: "Título sin resultados",
  emptyText: "Mensaje sin resultados",
  noContentText: "Mensaje sin respuestas publicadas",
  supportTitle: "Título de atención",
  supportText: "Descripción de atención",
  supportAction: "Texto del botón de atención",
  supportHref: "Destino del botón de atención",
  showSearch: "Mostrar buscador",
  showSupport: "Mostrar franja de atención",
  openFirst: "Abrir la primera respuesta del tema",
  editorialHeading: "Usar tipografía editorial",
  motion: "Animar los controles",
  showSections: "Mostrar secciones adicionales",
  showFooterAction: "Mostrar botón de regreso",
};
export default function HelpAppearanceControls({ form, onChange, topic }) {
  const h = form.informationPageConfig.help;
  const patch = (key, value) =>
    onChange((page) => ({
      ...page,
      informationPageConfig: {
        ...page.informationPageConfig,
        help: { ...page.informationPageConfig.help, [key]: value },
      },
    }));
  const field = (key) =>
    typeof h[key] === "boolean" ? (
      <Toggle
        key={key}
        label={labels[key]}
        checked={h[key]}
        onChange={(value) => patch(key, value)}
      />
    ) : ["emptyText", "noContentText", "supportText"].includes(key) ? (
      <div key={key} className="sm:col-span-2">
        <Textarea
          aria-label={labels[key]}
          label={labels[key]}
          value={h[key]}
          onChange={(event) => patch(key, event.target.value)}
        />
      </div>
    ) : (
      <Input
        key={key}
        label={labels[key]}
        value={h[key]}
        onChange={(event) => patch(key, event.target.value)}
      />
    );
  const section = (title, keys, text) => (
    <EditorSection key={title} title={title} text={text}>
      <div className="grid gap-4 sm:grid-cols-2">{keys.map(field)}</div>
    </EditorSection>
  );
  if (topic === "help-support")
    return section(
      "Atención y enlaces",
      [
        "showSupport",
        "supportTitle",
        "supportText",
        "supportAction",
        "supportHref",
      ],
      "La franja de atención dirige a Contacto de forma predeterminada. Puedes personalizar su destino con otro enlace público seguro.",
    );
  if (topic === "help-design")
    return section(
      "Diseño del centro",
      [
        "openFirst",
        "editorialHeading",
        "motion",
        "showSections",
        "showFooterAction",
      ],
      "Los colores, material del cristal, bordes, ancho de navegación y tipografía se editan en los temas de Diseño. La navegación permanece visible al bajar en escritorio y se organiza en filas en móvil.",
    );
  return (
    <>
      {section(
        "Buscador y temas",
        [
          "showSearch",
          "searchLabel",
          "searchPlaceholder",
          "clearSearchText",
          "topicsTitle",
          "resultsTitle",
          "resultSingular",
          "resultPlural",
        ],
        "La búsqueda encuentra coincidencias en los temas y en las preguntas y respuestas publicadas, sin distinguir acentos ni mayúsculas.",
      )}
      {section("Mensajes y estados", [
        "emptyTitle",
        "emptyText",
        "noContentText",
      ])}
    </>
  );
}
