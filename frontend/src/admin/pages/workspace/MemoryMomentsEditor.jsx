import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import EditorSection from "./EditorSection";
import { Input, Select, Textarea, Toggle } from "./ProductDetailEditorFields";
import AdminImageUploadField from "../../media/AdminImageUploadField";
import MemoryGalleryEditor from "./MemoryGalleryEditor";
import { visibleMemories } from "../../../components/information-page/memoryJournalConfig";
export default function MemoryMomentsEditor({
  form,
  onChange,
  saving,
  onUploadingChange,
}) {
  const [selected, setSelected] = useState(""),
    [uploads, setUploads] = useState({});
  const journal = form.informationPageConfig.journal,
    moments = journal.moments;
  const current = moments.find((m) => m.id === selected) || moments[0];
  const locked = saving || Object.values(uploads).some(Boolean);
  const update = (fn) =>
    onChange((page) => ({
      ...page,
      informationPageConfig: {
        ...page.informationPageConfig,
        journal: fn(page.informationPageConfig.journal),
      },
    }));
  const patch = (value) =>
    update((j) => ({
      ...j,
      moments: j.moments.map((m) =>
        m.id === current.id ? { ...m, ...value } : m,
      ),
    }));
  const busy = (key, value) => {
    const id = `memory-${current.id}-${key}`;
    setUploads((old) => ({ ...old, [id]: value }));
    onUploadingChange(id, value);
  };
  const add = () => {
    const id = `moment-${globalThis.crypto?.randomUUID?.() || Date.now().toString(36)}`;
    update((j) => ({
      ...j,
      moments: [
        ...j.moments,
        {
          id,
          title: "Nuevo recuerdo",
          summary: "",
          story: "",
          date: "",
          category: "",
          image: "",
          imageAlt: "",
          enabled: true,
          gallery: [],
          focalX: 50,
          focalY: 50,
        },
      ],
    }));
    setSelected(id);
  };
  return (
    <EditorSection
      title="Recuerdos y fotografías"
      text="Cada recuerdo tiene una foto principal y puede incluir una historia y más imágenes. Las categorías se convierten automáticamente en filtros. Solo aparecen los recuerdos visibles con título y foto."
    >
      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <Select
          label="Recuerdo para editar"
          value={current?.id || ""}
          disabled={locked || !moments.length}
          onChange={(event) => setSelected(event.target.value)}
        >
          {!moments.length && (
            <option value="">Todavía no hay recuerdos</option>
          )}
          {moments.map((m, i) => (
            <option key={m.id} value={m.id}>
              {i + 1}. {m.title || "Sin título"}
              {m.enabled ? "" : " (oculto)"}
            </option>
          ))}
        </Select>
        <button
          type="button"
          className="pages-button"
          disabled={locked || moments.length >= 60}
          onClick={add}
        >
          <Plus size={16} />
          Añadir recuerdo
        </button>
      </div>
      <p className="my-4 text-sm text-gray-600">
        {visibleMemories(journal).length} recuerdos listos para mostrarse ·{" "}
        {moments.length}/60 creados
      </p>
      {!current ? (
        <p className="text-sm text-gray-600">
          Añade tus propias fotografías para publicar la mesa de recuerdos. Los
          ejemplos de la vista previa no se guardan ni aparecen en la página
          pública.
        </p>
      ) : (
        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <Toggle
              label="Mostrar este recuerdo"
              checked={current.enabled}
              onChange={(enabled) => patch({ enabled })}
            />
            <Toggle
              label="Destacar al abrir la página"
              checked={journal.featuredId === current.id}
              onChange={(featured) =>
                update((j) => ({
                  ...j,
                  featuredId: featured ? current.id : "",
                }))
              }
            />
          </div>
          <Input
            label="Título del recuerdo"
            value={current.title}
            maxLength={180}
            onChange={(event) => patch({ title: event.target.value })}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Fecha del recuerdo (opcional)"
              type="date"
              value={current.date}
              onChange={(event) => patch({ date: event.target.value })}
            />
            <Input
              label="Categoría del recuerdo"
              value={current.category}
              maxLength={80}
              placeholder="Ej. Nuestro equipo"
              onChange={(event) => patch({ category: event.target.value })}
            />
          </div>
          <AdminImageUploadField
            label="Foto principal del recuerdo"
            value={current.image}
            disabled={locked}
            onChange={(image) => patch({ image })}
            onBusyChange={(value) => busy("cover", value)}
          />
          <Input
            label="Descripción de la foto principal"
            value={current.imageAlt}
            onChange={(event) => patch({ imageAlt: event.target.value })}
          />
          <details className="rounded-xl border border-gray-200 p-4">
            <summary className="cursor-pointer font-medium">
              Ajustar el encuadre de la foto
            </summary>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Input
                label="Posición horizontal (%)"
                type="number"
                min={0}
                max={100}
                value={current.focalX}
                onChange={(event) => patch({ focalX: event.target.value })}
              />
              <Input
                label="Posición vertical (%)"
                type="number"
                min={0}
                max={100}
                value={current.focalY}
                onChange={(event) => patch({ focalY: event.target.value })}
              />
            </div>
          </details>
          <Textarea
            label="Descripción breve"
            aria-label="Descripción breve"
            rows={2}
            value={current.summary}
            onChange={(event) => patch({ summary: event.target.value })}
          />
          <Textarea
            label="Historia completa"
            aria-label="Historia completa"
            rows={6}
            value={current.story}
            onChange={(event) => patch({ story: event.target.value })}
          />
          <MemoryGalleryEditor
            moment={current}
            patch={patch}
            locked={locked}
            busy={busy}
          />
          <button
            type="button"
            className="pages-button"
            disabled={locked}
            onClick={() => {
              if (window.confirm("¿Eliminar este recuerdo del borrador?"))
                update((j) => ({
                  ...j,
                  featuredId: j.featuredId === current.id ? "" : j.featuredId,
                  moments: j.moments.filter((m) => m.id !== current.id),
                }));
            }}
          >
            <Trash2 size={16} />
            Eliminar recuerdo
          </button>
        </div>
      )}
    </EditorSection>
  );
}
