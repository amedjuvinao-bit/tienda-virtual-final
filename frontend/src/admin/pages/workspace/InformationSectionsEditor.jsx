import { useState } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import EditorSection from "./EditorSection";
import { Input, Select, Toggle } from "./ProductDetailEditorFields";
import AdminImageUploadField from "../../media/AdminImageUploadField";
const TYPES = {
  text: "Texto",
  split: "Texto e imagen",
  values: "Tarjetas informativas",
  faq: "Preguntas frecuentes",
};
function Area({ label, value, onChange }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-gray-700">
        {label}
      </span>
      <textarea
        aria-label={label}
        rows={5}
        value={value}
        onChange={onChange}
        className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-800"
      />
    </label>
  );
}
export default function InformationSectionsEditor({
  form,
  onChange,
  saving,
  onUploadingChange,
}) {
  const [selected, setSelected] = useState(""),
    [newType, setNewType] = useState("text"),
    [busy, setBusy] = useState({});
  const sections = form.informationPageConfig.sections;
  const current =
    sections.find((section) => section.id === selected) || sections[0];
  const locked = saving || Object.values(busy).some(Boolean);
  const update = (fn) =>
    onChange((page) => ({
      ...page,
      informationPageConfig: {
        ...page.informationPageConfig,
        sections: fn(page.informationPageConfig.sections),
      },
    }));
  const patch = (id, value) =>
    update((list) =>
      list.map((section) =>
        section.id === id ? { ...section, ...value } : section,
      ),
    );
  const add = () => {
    const id = `section-${globalThis.crypto?.randomUUID?.() || Date.now().toString(36)}`;
    update((list) => [
      ...list,
      {
        id,
        type: newType,
        title: "Nueva sección",
        body: "",
        image: "",
        imageAlt: "",
        imagePosition: "right",
        enabled: true,
        items: [],
      },
    ]);
    setSelected(id);
  };
  const move = (id, delta) =>
    update((list) => {
      const next = [...list],
        from = next.findIndex((s) => s.id === id),
        to = from + delta;
      if (to < 0 || to >= next.length) return list;
      [next[from], next[to]] = [next[to], next[from]];
      return next;
    });
  const itemPatch = (index, value) =>
    update((list) =>
      list.map((section) =>
        section.id !== current.id
          ? section
          : {
              ...section,
              items: section.items.map((item, i) =>
                i === index ? { ...item, ...value } : item,
              ),
            },
      ),
    );
  return (
    <EditorSection
      title="Secciones de la página"
      text="Organiza la historia, imágenes opcionales, tarjetas y preguntas. Los textos se muestran como contenido, sin ejecutar código HTML."
    >
      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <Select
          label="Tipo de nueva sección"
          value={newType}
          onChange={(event) => setNewType(event.target.value)}
          disabled={locked}
        >
          {Object.entries(TYPES).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
        <button
          type="button"
          className="pages-button"
          onClick={add}
          disabled={locked || sections.length >= 24}
        >
          <Plus size={16} />
          Añadir sección
        </button>
      </div>
      <div
        className="my-5 flex flex-wrap gap-2"
        aria-label="Secciones de contenido"
      >
        {sections.map((section, index) => (
          <button
            type="button"
            className="pages-button"
            key={section.id}
            aria-pressed={section.id === current?.id}
            onClick={() => setSelected(section.id)}
            disabled={locked}
          >
            {index + 1}. {section.title || TYPES[section.type]}
          </button>
        ))}
      </div>
      {!current ? (
        <p className="text-sm text-gray-600">
          Añade una sección para empezar. La página también puede mostrar solo
          su presentación y botón.
        </p>
      ) : (
        <div className="space-y-5">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="pages-button"
              aria-label="Subir sección"
              disabled={locked || sections[0].id === current.id}
              onClick={() => move(current.id, -1)}
            >
              <ArrowUp size={16} />
            </button>
            <button
              type="button"
              className="pages-button"
              aria-label="Bajar sección"
              disabled={locked || sections.at(-1).id === current.id}
              onClick={() => move(current.id, 1)}
            >
              <ArrowDown size={16} />
            </button>
            <button
              type="button"
              className="pages-button"
              disabled={locked}
              onClick={() => {
                if (window.confirm("¿Eliminar esta sección del borrador?"))
                  update((list) =>
                    list.filter((section) => section.id !== current.id),
                  );
              }}
            >
              <Trash2 size={16} />
              Eliminar sección
            </button>
            <Toggle
              label="Mostrar esta sección"
              checked={current.enabled}
              onChange={(enabled) => patch(current.id, { enabled })}
            />
          </div>
          <Input
            label="Título de la sección"
            value={current.title}
            onChange={(event) =>
              patch(current.id, { title: event.target.value })
            }
          />
          {["text", "split"].includes(current.type) ? (
            <>
              <Area
                label="Contenido de la sección"
                value={current.body}
                onChange={(event) =>
                  patch(current.id, { body: event.target.value })
                }
              />
              <AdminImageUploadField
                label="Imagen de la sección (opcional)"
                value={current.image}
                disabled={locked}
                onChange={(image) => patch(current.id, { image })}
                onBusyChange={(value) => {
                  const key = `information-${current.id}`;
                  setBusy((old) => ({ ...old, [key]: value }));
                  onUploadingChange(key, value);
                }}
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  label="Descripción de la imagen"
                  value={current.imageAlt}
                  onChange={(event) =>
                    patch(current.id, { imageAlt: event.target.value })
                  }
                />
                <Select
                  label="Posición de la imagen"
                  value={current.imagePosition}
                  onChange={(event) =>
                    patch(current.id, { imagePosition: event.target.value })
                  }
                >
                  <option value="right">Derecha</option>
                  <option value="left">Izquierda</option>
                </Select>
              </div>
            </>
          ) : (
            <div className="space-y-5">
              {current.items.map((item, index) => (
                <div
                  key={index}
                  className="space-y-3 rounded-xl border border-gray-200 p-4"
                >
                  <Input
                    label={`${current.type === "faq" ? "Pregunta" : "Título de tarjeta"} ${index + 1}`}
                    value={item.title}
                    onChange={(event) =>
                      itemPatch(index, { title: event.target.value })
                    }
                  />
                  <Area
                    label={`${current.type === "faq" ? "Respuesta" : "Texto de tarjeta"} ${index + 1}`}
                    value={item.body}
                    onChange={(event) =>
                      itemPatch(index, { body: event.target.value })
                    }
                  />
                  <button
                    type="button"
                    className="pages-button"
                    onClick={() =>
                      patch(current.id, {
                        items: current.items.filter((_, i) => i !== index),
                      })
                    }
                  >
                    Eliminar elemento {index + 1}
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="pages-button"
                disabled={current.items.length >= 20}
                onClick={() =>
                  patch(current.id, {
                    items: [...current.items, { title: "", body: "" }],
                  })
                }
              >
                <Plus size={16} />
                {current.type === "faq" ? "Añadir pregunta" : "Añadir tarjeta"}
              </button>
            </div>
          )}
        </div>
      )}
    </EditorSection>
  );
}
