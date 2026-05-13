// src/components/admin/ImageSection.jsx
import React from "react";

/**
 * Componente de UI para manejar:
 *  - image (portada, 1 sola)
 *  - images (galería, máx. 5)
 *
 * No sube a Cloudinary: solo gestiona selección, previews y orden.
 * Requiere que el padre pase: image, setImage, images, setImages.
 * Acepta tanto URLs (strings) como File objects.
 */
export default function ImageSection({ image, setImage, images = [], setImages }) {
  const MAX = 5;

  // Helpers para normalizar a preview src
  const getSrc = (item) => {
    if (!item) return "";
    if (typeof item === "string") return item;
    if (item instanceof File) return URL.createObjectURL(item);
    return "";
  };

  const onPickCover = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImage(file);
  };

  const onPickGallery = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    // concatena, deduplica por nombre/URL y limita a 5
    const next = [...images, ...files];

    // Dedup sencilla: por name si File, por string si URL
    const seen = new Set();
    const deduped = [];
    for (const item of next) {
      const key = typeof item === "string" ? item : item.name;
      if (key && !seen.has(key)) {
        seen.add(key);
        deduped.push(item);
      }
    }

    setImages(deduped.slice(0, MAX));
    e.target.value = ""; // permite volver a seleccionar lo mismo
  };

  const removeFromGallery = (idx) => {
    const next = images.filter((_, i) => i !== idx);
    setImages(next);
  };

  const makeCoverFromGallery = (idx) => {
    const chosen = images[idx];
    setImage(chosen);
    // opcional: no lo removemos de galería, solo evitamos repetir visualmente
  };

  const clearCover = () => setImage("");

  // Galería visible (sin repetir portada exacta si es string)
  const coverSrc = getSrc(image);
  const visibleGallery = images.filter((g) => getSrc(g) !== coverSrc);

  return (
    <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* CARD PORTADA */}
      <div className="rounded-2xl border border-[#E9D6AA] bg-white shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b bg-[#fff8fb]">
          <h3 className="text-sm font-semibold text-[#D4AF37] tracking-wide">Imagen portada</h3>
          <p className="text-xs text-gray-500">Se mostrará primero en el detalle del producto.</p>
        </div>

        <div className="p-5">
          <label className="inline-flex items-center px-4 py-2 rounded-full border border-pink-200 hover:border-pink-400 cursor-pointer text-pink-600 text-sm bg-pink-50/50">
            <input type="file" accept="image/*" className="hidden" onChange={onPickCover} />
            Seleccionar archivo
          </label>

          {/* Vista previa portada */}
          <div className="mt-4">
            <div className="relative w-full aspect-[3/4] rounded-xl border-2 border-[#D4AF37] overflow-hidden bg-[linear-gradient(45deg,#f3f4f6_25%,transparent_25%),linear-gradient(-45deg,#f3f4f6_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#f3f4f6_75%),linear-gradient(-45deg,transparent_75%,#f3f4f6_75%)] bg-[length:16px_16px] bg-[position:0_0,0_8px,8px_-8px,-8px_0]">
              {coverSrc ? (
                <>
                  <img src={coverSrc} alt="Portada" className="w-full h-full object-cover" />
                  <span className="absolute top-2 left-2 text-[10px] uppercase tracking-widest bg-[#D4AF37] text-white px-2 py-1 rounded-full shadow">
                    Portada
                  </span>
                  <button
                    type="button"
                    onClick={clearCover}
                    className="absolute top-2 right-2 text-xs px-2 py-1 rounded-full bg-white/90 hover:bg-white border shadow"
                  >
                    Quitar
                  </button>
                </>
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm">
                  Sin portada seleccionada
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* CARD GALERÍA */}
      <div className="rounded-2xl border border-[#E9D6AA] bg-white shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b bg-[#fff8fb] flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-[#D4AF37] tracking-wide">Galería (hasta 5)</h3>
            <p className="text-xs text-gray-500">Puedes elegir varias imágenes a la vez.</p>
          </div>
          <span className="text-xs text-gray-500">{visibleGallery.length} / 5</span>
        </div>

        <div className="p-5">
          <label className="inline-flex items-center px-4 py-2 rounded-full border border-pink-200 hover:border-pink-400 cursor-pointer text-pink-600 text-sm bg-pink-50/50">
            <input type="file" accept="image/*" multiple className="hidden" onChange={onPickGallery} />
            Elegir archivos
          </label>

          {/* Grid de miniaturas */}
          <div className="mt-4 grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {visibleGallery.map((item, idx) => {
              const src = getSrc(item);
              return (
                <div key={src + idx} className="relative group rounded-xl border border-[#E9D6AA] overflow-hidden">
                  <img src={src} alt={`gal-${idx}`} className="w-full h-28 object-cover" />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                  <div className="absolute top-1 left-1 text-[10px] bg-white/90 px-1.5 py-0.5 rounded">
                    {idx + 1}
                  </div>
                  <div className="absolute top-1 right-1 flex gap-1">
                    <button
                      type="button"
                      title="Usar como portada"
                      onClick={() => makeCoverFromGallery(idx)}
                      className="text-[10px] px-1.5 py-0.5 rounded bg-white/90 hover:bg-white border"
                    >
                      Portada
                    </button>
                    <button
                      type="button"
                      title="Quitar"
                      onClick={() => removeFromGallery(idx)}
                      className="text-[10px] px-1.5 py-0.5 rounded bg-white/90 hover:bg-white border"
                    >
                      Quitar
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Hint de simetría */}
          <p className="mt-3 text-[11px] text-gray-500">
            Consejo: usa imágenes con orientación similar para una cuadrícula más simétrica.
          </p>
        </div>
      </div>
    </section>
  );
}
