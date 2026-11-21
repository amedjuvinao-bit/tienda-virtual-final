import EditorSection from "./EditorSection";
import { Input, Select, Textarea, Toggle } from "./ProductDetailEditorFields";
const LABELS = {
  allText: "Filtro de todos los recuerdos",
  openText: "Botón de abrir recuerdo",
  selectText: "Acción de seleccionar recuerdo",
  listText: "Botón de vista en lista",
  tableText: "Botón de mesa de recuerdos",
  zoomInText: "Botón de acercar",
  zoomOutText: "Botón de alejar",
  previousText: "Recuerdo anterior",
  nextText: "Recuerdo siguiente",
  closeText: "Cerrar recuerdo",
  timelineText: "Nombre de la línea de tiempo",
  noDateText: "Recuerdos sin fecha",
  galleryText: "Nombre de la galería",
  emptyTitle: "Título cuando no hay recuerdos",
  emptyText: "Mensaje cuando no hay recuerdos",
};
export default function MemoryDesignControls({ form, onChange, topic }) {
  const journal = form.informationPageConfig.journal;
  const patch = (key, value) =>
    onChange((page) => ({
      ...page,
      informationPageConfig: {
        ...page.informationPageConfig,
        journal: { ...page.informationPageConfig.journal, [key]: value },
      },
    }));
  if (topic === "journal-texts")
    return (
      <EditorSection
        title="Textos del diario"
        text="Personaliza los controles que ven tus visitantes. Los nombres de los filtros proceden de las categorías de tus recuerdos."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          {Object.entries(LABELS).map(([key, label]) =>
            key === "emptyText" ? (
              <Textarea
                key={key}
                label={label}
                aria-label={label}
                value={journal[key]}
                onChange={(event) => patch(key, event.target.value)}
              />
            ) : (
              <Input
                key={key}
                label={label}
                value={journal[key]}
                onChange={(event) => patch(key, event.target.value)}
              />
            ),
          )}
        </div>
      </EditorSection>
    );
  return (
    <EditorSection
      title="Mesa y fotografías"
      text="La foto destacada ocupa el centro; la línea de tiempo recorre los recuerdos por fecha. En móvil la composición se adapta para conservar la lectura y los controles."
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Select
          label="Tipografía del diario"
          value={journal.headingFont}
          onChange={(event) => patch("headingFont", event.target.value)}
        >
          <option value="editorial">Editorial elegante</option>
          <option value="theme">Tipografía global</option>
        </Select>
        <Input
          label="Alto de la mesa en escritorio (px)"
          type="number"
          min={480}
          max={900}
          value={journal.boardHeightPx}
          onChange={(event) => patch("boardHeightPx", event.target.value)}
        />
        <Input
          label="Radio de las fotografías (px)"
          type="number"
          min={0}
          max={40}
          value={journal.photoRadiusPx}
          onChange={(event) => patch("photoRadiusPx", event.target.value)}
        />
        <Input
          label="Profundidad de las fotografías"
          type="number"
          min={0}
          max={1}
          step={0.05}
          value={journal.photoShadow}
          onChange={(event) => patch("photoShadow", event.target.value)}
        />
        {[
          ["motion", "Animar cambios de recuerdo"],
          ["showDates", "Mostrar fechas"],
          ["showFilters", "Mostrar filtros por categoría"],
          ["showTimeline", "Mostrar línea de tiempo"],
          ["showZoom", "Mostrar controles de acercamiento"],
          ["showSections", "Mostrar secciones adicionales debajo"],
          ["showFooterAction", "Mostrar botón de regreso debajo"],
        ].map(([key, label]) => (
          <Toggle
            key={key}
            label={label}
            checked={journal[key]}
            onChange={(value) => patch(key, value)}
          />
        ))}
      </div>
    </EditorSection>
  );
}
