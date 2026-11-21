import AdminImageUploadField from "../../media/AdminImageUploadField";
import { Input, Textarea } from "./ProductDetailEditorFields";
export default function MemoryGalleryEditor({ moment, patch, locked, busy }) {
  const update = (index, value) =>
    patch({
      gallery: moment.gallery.map((photo, i) =>
        i === index ? { ...photo, ...value } : photo,
      ),
    });
  return (
    <details className="rounded-xl border border-gray-200 p-4">
      <summary className="cursor-pointer font-medium">
        Galería del recuerdo ({moment.gallery.length}/8)
      </summary>
      <div className="mt-4 space-y-5">
        {moment.gallery.map((photo, index) => (
          <div
            key={index}
            className="space-y-3 rounded-xl border border-gray-200 p-3"
          >
            <AdminImageUploadField
              label={`Foto adicional ${index + 1}`}
              value={photo.image}
              disabled={locked}
              onChange={(image) => update(index, { image })}
              onBusyChange={(value) => busy(`gallery-${index}`, value)}
            />
            <Input
              label={`Descripción de foto ${index + 1}`}
              value={photo.alt}
              onChange={(event) => update(index, { alt: event.target.value })}
            />
            <Textarea
              label={`Pie de foto ${index + 1}`}
              aria-label={`Pie de foto ${index + 1}`}
              rows={2}
              value={photo.caption}
              onChange={(event) =>
                update(index, { caption: event.target.value })
              }
            />
            <button
              type="button"
              className="pages-button"
              disabled={locked}
              onClick={() =>
                patch({ gallery: moment.gallery.filter((_, i) => i !== index) })
              }
            >
              Eliminar foto {index + 1}
            </button>
          </div>
        ))}
        <button
          type="button"
          className="pages-button"
          disabled={locked || moment.gallery.length >= 8}
          onClick={() =>
            patch({
              gallery: [...moment.gallery, { image: "", alt: "", caption: "" }],
            })
          }
        >
          Añadir foto a la galería
        </button>
      </div>
    </details>
  );
}
