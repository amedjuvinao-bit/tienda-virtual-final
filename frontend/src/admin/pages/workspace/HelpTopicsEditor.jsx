import { useState } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import EditorSection from "./EditorSection";
import { Input, Select, Toggle } from "./ProductDetailEditorFields";
const iconLabels = [
  ["package", "Pedido"],
  ["credit-card", "Pago"],
  ["truck", "Entrega"],
  ["refresh", "Cambio"],
  ["help", "Ayuda"],
  ["heart", "Favorito"],
  ["shopping-bag", "Compra"],
  ["tag", "Etiqueta"],
];
export default function HelpTopicsEditor({ form, onChange, saving }) {
  const [selected, setSelected] = useState("");
  const topics = form.informationPageConfig.help.categories;
  const current = topics.find((c) => c.id === selected) || topics[0],
    index = topics.indexOf(current);
  const update = (fn) =>
    onChange((page) => ({
      ...page,
      informationPageConfig: {
        ...page.informationPageConfig,
        help: {
          ...page.informationPageConfig.help,
          categories: fn(page.informationPageConfig.help.categories),
        },
      },
    }));
  const patch = (value) =>
    update((all) =>
      all.map((c) => (c.id === current.id ? { ...c, ...value } : c)),
    );
  const move = (delta) =>
    update((all) => {
      const next = [...all],
        position = next.findIndex((c) => c.id === current.id);
      [next[position], next[position + delta]] = [
        next[position + delta],
        next[position],
      ];
      return next;
    });
  const add = () => {
    const id = `tema-${globalThis.crypto?.randomUUID?.() || Date.now().toString(36)}`;
    update((all) => [
      ...all,
      {
        id,
        title: "Nuevo tema",
        heading: "",
        icon: "help",
        enabled: true,
        questions: [],
      },
    ]);
    setSelected(id);
  };
  return (
    <EditorSection
      title="Temas y categorías"
      text="Agrupa las preguntas por lo que necesita consultar el visitante. Un tema aparece en público cuando está visible y tiene al menos una respuesta completa y publicada."
    >
      <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
        <Select
          label="Tema para editar"
          value={current?.id || ""}
          disabled={!topics.length}
          onChange={(event) => setSelected(event.target.value)}
        >
          {!topics.length && <option value="">Todavía no hay temas</option>}
          {topics.map((c) => (
            <option value={c.id} key={c.id}>
              {c.title || "Sin nombre"}
              {c.enabled ? "" : " (oculto)"}
            </option>
          ))}
        </Select>
        <button
          type="button"
          className="pages-button"
          disabled={saving || topics.length >= 12}
          onClick={add}
        >
          <Plus size={16} />
          Añadir tema
        </button>
      </div>
      {current && (
        <>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Input
              label="Nombre del tema"
              value={current.title}
              onChange={(event) => patch({ title: event.target.value })}
            />
            <Input
              label="Título del panel de respuestas"
              value={current.heading}
              onChange={(event) => patch({ heading: event.target.value })}
            />
            <Select
              label="Icono del tema"
              value={current.icon}
              onChange={(event) => patch({ icon: event.target.value })}
            >
              {iconLabels.map(([value, label]) => (
                <option value={value} key={value}>
                  {label}
                </option>
              ))}
            </Select>
            <Toggle
              label="Mostrar tema"
              checked={current.enabled}
              onChange={(enabled) => patch({ enabled })}
            />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              className="pages-button"
              disabled={index <= 0}
              onClick={() => move(-1)}
            >
              <ArrowUp size={15} />
              Subir tema
            </button>
            <button
              type="button"
              className="pages-button"
              disabled={index === topics.length - 1}
              onClick={() => move(1)}
            >
              <ArrowDown size={15} />
              Bajar tema
            </button>
            <button
              type="button"
              className="pages-button"
              onClick={() =>
                update((all) => all.filter((c) => c.id !== current.id))
              }
            >
              <Trash2 size={15} />
              Eliminar tema del borrador
            </button>
          </div>
          <p className="mt-4 text-sm text-gray-600">
            {current.questions.length} preguntas en este tema. Edita sus
            respuestas en Preguntas y respuestas.
          </p>
        </>
      )}
    </EditorSection>
  );
}
