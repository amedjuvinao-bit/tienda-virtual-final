import { useState } from "react";
import { ArrowUp, ArrowDown, Plus, Trash2 } from "lucide-react";
import EditorSection from "./EditorSection";
import { Input, Select, Textarea, Toggle } from "./ProductDetailEditorFields";
export default function HelpQuestionsEditor({ form, onChange, saving }) {
  const [topicId, setTopicId] = useState(""),
    [questionId, setQuestionId] = useState("");
  const topics = form.informationPageConfig.help.categories,
    topic = topics.find((c) => c.id === topicId) || topics[0];
  const current =
      topic?.questions.find((q) => q.id === questionId) || topic?.questions[0],
    index = topic?.questions.indexOf(current);
  const update = (fn) =>
    onChange((page) => ({
      ...page,
      informationPageConfig: {
        ...page.informationPageConfig,
        help: {
          ...page.informationPageConfig.help,
          categories: page.informationPageConfig.help.categories.map((c) =>
            c.id === topic.id ? { ...c, questions: fn(c.questions) } : c,
          ),
        },
      },
    }));
  const patch = (value) =>
    update((all) =>
      all.map((q) => (q.id === current.id ? { ...q, ...value } : q)),
    );
  const add = () => {
    const id = `pregunta-${globalThis.crypto?.randomUUID?.() || Date.now().toString(36)}`;
    update((all) => [
      ...all,
      {
        id,
        question: "",
        answer: "",
        enabled: false,
        actionText: "",
        actionHref: "",
      },
    ]);
    setQuestionId(id);
  };
  const move = (delta) =>
    update((all) => {
      const next = [...all],
        position = next.findIndex((q) => q.id === current.id);
      [next[position], next[position + delta]] = [
        next[position + delta],
        next[position],
      ];
      return next;
    });
  return (
    <EditorSection
      title="Preguntas y respuestas"
      text="El contenido inicial describe el funcionamiento de la tienda. Mantén actualizadas las respuestas cuando cambien las condiciones de tu negocio. Las preguntas nuevas empiezan ocultas hasta que decidas publicarlas."
    >
      {!topic ? (
        <p className="text-sm text-gray-600">
          Añade primero un tema en Temas y categorías.
        </p>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <Select
              label="Tema de las preguntas"
              value={topic.id}
              onChange={(event) => {
                setTopicId(event.target.value);
                setQuestionId("");
              }}
            >
              {topics.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title || "Sin nombre"}
                </option>
              ))}
            </Select>
            <Select
              label="Pregunta para editar"
              value={current?.id || ""}
              disabled={!topic.questions.length}
              onChange={(event) => setQuestionId(event.target.value)}
            >
              {!topic.questions.length && (
                <option value="">Todavía no hay preguntas</option>
              )}
              {topic.questions.map((q, i) => (
                <option key={q.id} value={q.id}>
                  {i + 1}. {q.question || "Sin pregunta"}
                  {q.enabled ? "" : " (oculta)"}
                </option>
              ))}
            </Select>
          </div>
          <button
            type="button"
            className="pages-button mt-4"
            disabled={saving || topic.questions.length >= 30}
            onClick={add}
          >
            <Plus size={16} />
            Añadir pregunta
          </button>
          {current && (
            <>
              <div className="mt-4 grid gap-4">
                <Input
                  label="Pregunta"
                  value={current.question}
                  onChange={(event) => patch({ question: event.target.value })}
                />
                <Textarea
                  label="Respuesta publicada"
                  aria-label="Respuesta publicada"
                  value={current.answer}
                  onChange={(event) => patch({ answer: event.target.value })}
                />
                <Toggle
                  label="Publicar esta respuesta"
                  checked={current.enabled}
                  onChange={(enabled) => patch({ enabled })}
                />
              </div>
              <details className="mt-4 rounded-xl border border-gray-200 p-4">
                <summary className="cursor-pointer text-sm font-medium">
                  Acción opcional de la respuesta
                </summary>
                <p className="my-3 text-sm text-gray-600">
                  Puedes enlazar al catálogo, carrito, favoritos, Contacto u
                  otra página pública. Deja ambos campos vacíos si la respuesta
                  no necesita un botón.
                </p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Input
                    label="Texto de la acción de respuesta"
                    value={current.actionText}
                    onChange={(event) =>
                      patch({ actionText: event.target.value })
                    }
                  />
                  <Input
                    label="Destino de la acción de respuesta"
                    value={current.actionHref}
                    onChange={(event) =>
                      patch({ actionHref: event.target.value })
                    }
                  />
                </div>
              </details>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="pages-button"
                  disabled={index <= 0}
                  onClick={() => move(-1)}
                >
                  <ArrowUp size={15} />
                  Subir pregunta
                </button>
                <button
                  type="button"
                  className="pages-button"
                  disabled={index === topic.questions.length - 1}
                  onClick={() => move(1)}
                >
                  <ArrowDown size={15} />
                  Bajar pregunta
                </button>
                <button
                  type="button"
                  className="pages-button"
                  onClick={() =>
                    update((all) => all.filter((q) => q.id !== current.id))
                  }
                >
                  <Trash2 size={15} />
                  Eliminar pregunta del borrador
                </button>
              </div>
            </>
          )}
        </>
      )}
    </EditorSection>
  );
}
