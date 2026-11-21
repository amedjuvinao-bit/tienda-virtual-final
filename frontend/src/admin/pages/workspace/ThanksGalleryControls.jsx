import { useState } from "react";
import EditorSection from "./EditorSection";
import { Input } from "./ProductDetailEditorFields";
import AdminImageUploadField from "../../media/AdminImageUploadField";
export default function ThanksGalleryControls({
  config,
  onChange,
  saving,
  onUploadingChange,
}) {
  const slides = config.slider.slides;
  const [uploads, setUploads] = useState({});
  const busy = Object.values(uploads).some(Boolean);
  const patch = (index, key, value) =>
    onChange(
      slides.map((slide, i) =>
        i === index ? { ...slide, [key]: value } : slide,
      ),
    );
  const move = (index, offset) => {
    const next = [...slides];
    [next[index], next[index + offset]] = [next[index + offset], next[index]];
    onChange(next);
  };
  return (
    <EditorSection
      title="Imágenes de la galería"
      text="Carga las imágenes desde tu equipo. Sin imágenes se muestra un símbolo de agradecimiento sobre el cristal."
    >
      <div className="space-y-4">
        {slides.map((slide, index) => (
          <section
            key={slide.id}
            className="rounded-2xl border border-gray-200 p-4 space-y-3"
          >
            <div className="flex flex-wrap gap-2 items-center justify-between">
              <h3 className="font-semibold text-sm">Imagen {index + 1}</h3>
              <div className="flex flex-wrap gap-2 text-xs">
                <button
                  type="button"
                  disabled={saving || busy || index === 0}
                  onClick={() => move(index, -1)}
                  aria-label={`Subir imagen ${index + 1} de posición`}
                >
                  Subir posición
                </button>
                <button
                  type="button"
                  disabled={saving || busy || index === slides.length - 1}
                  onClick={() => move(index, 1)}
                  aria-label={`Bajar imagen ${index + 1} de posición`}
                >
                  Bajar posición
                </button>
                <button
                  type="button"
                  disabled={saving || busy}
                  onClick={() => onChange(slides.filter((_, i) => i !== index))}
                  aria-label={`Eliminar imagen ${index + 1}`}
                >
                  Eliminar
                </button>
              </div>
            </div>
            <AdminImageUploadField
              label={`Imagen ${index + 1} de la galería`}
              value={slide.image}
              disabled={saving}
              onChange={(value) => patch(index, "image", value)}
              onBusyChange={(value) => {
                setUploads((current) => ({ ...current, [slide.id]: value }));
                onUploadingChange(`slide-${slide.id}`, value);
              }}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label={`Descripción de imagen ${index + 1}`}
                value={slide.alt}
                onChange={(e) => patch(index, "alt", e.target.value)}
              />
              <Input
                label={`Etiqueta de imagen ${index + 1}`}
                value={slide.badge}
                onChange={(e) => patch(index, "badge", e.target.value)}
              />
              <Input
                label={`Texto de imagen ${index + 1}`}
                value={slide.caption}
                onChange={(e) => patch(index, "caption", e.target.value)}
              />
            </div>
          </section>
        ))}
      </div>
      <button
        type="button"
        className="pages-button mt-4"
        disabled={saving || busy || slides.length >= 20}
        onClick={() =>
          onChange([
            ...slides,
            {
              id: globalThis.crypto?.randomUUID?.() || `slide-${Date.now()}`,
              image: "",
              alt: "",
              badge: "",
              caption: "",
            },
          ])
        }
      >
        Agregar imagen
      </button>
    </EditorSection>
  );
}
