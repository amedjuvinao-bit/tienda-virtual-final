// src/admin/appearance/sections/editor/CardsEditor.jsx
import React, { useMemo, useRef, useState } from "react";
import { Field, Input, Button } from "../ui/UiComponents";

/**
 * CardsEditor
 * - Edita selected.items
 * - Soporta:
 *   image, hoverImage, title, subtitle, link, fit, posX, posY
 * - Incluye "mover imagen" por drag para guardar posX/posY
 *
 * Props esperadas (las nuevas son opcionales):
 * - selected (section)
 * - patchItem(index, patch)
 * - addItem()
 * - removeItem?(index)
 * - moveItem?(index, "up"|"down")
 * - uploading? (bool)
 * - uploadToCloudinary?(file) => Promise<url>
 * - imageHeightPx? (number)  // si no, usa selected.style.imageHeightPx o 260
 * - radiusPx? (number)       // si no, usa selected.style.cardRadiusPx o 18
 */

const DEFAULT_ITEM_IMAGE = {
  fit: "cover", // cover | contain
  posX: 50,
  posY: 50,
};

function clampNumber(n, { min, max, fallback }) {
  const x = Number(n);
  if (!Number.isFinite(x)) return fallback;
  if (typeof min === "number" && x < min) return min;
  if (typeof max === "number" && x > max) return max;
  return x;
}

function normalizeItem(it) {
  const raw = it && typeof it === "object" ? it : {};
  const fit = raw.fit === "contain" ? "contain" : "cover";
  const posX = clampNumber(raw.posX, { min: 0, max: 100, fallback: DEFAULT_ITEM_IMAGE.posX });
  const posY = clampNumber(raw.posY, { min: 0, max: 100, fallback: DEFAULT_ITEM_IMAGE.posY });

  return {
    image: typeof raw.image === "string" ? raw.image : "",
    hoverImage: typeof raw.hoverImage === "string" ? raw.hoverImage : "",
    title: typeof raw.title === "string" ? raw.title : "",
    subtitle: typeof raw.subtitle === "string" ? raw.subtitle : "",
    link: typeof raw.link === "string" ? raw.link : "",
    fit,
    posX,
    posY,
  };
}

function useDragPosition({ onChange }) {
  const ref = useRef(null);
  const draggingRef = useRef(false);

  const pointerToPercent = (e) => {
    const el = ref.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();

    const x = clampNumber(((e.clientX - rect.left) / rect.width) * 100, { min: 0, max: 100, fallback: 50 });
    const y = clampNumber(((e.clientY - rect.top) / rect.height) * 100, { min: 0, max: 100, fallback: 50 });

    return { x, y };
  };

  const onPointerDown = (e) => {
    if (!ref.current) return;
    draggingRef.current = true;
    ref.current.setPointerCapture?.(e.pointerId);
    const p = pointerToPercent(e);
    if (p) onChange?.(p.x, p.y);
  };

  const onPointerMove = (e) => {
    if (!draggingRef.current) return;
    const p = pointerToPercent(e);
    if (p) onChange?.(p.x, p.y);
  };

  const onPointerUp = () => {
    draggingRef.current = false;
  };

  return { ref, onPointerDown, onPointerMove, onPointerUp };
}

function CardImageMover({ item, heightPx, radiusPx, onChange }) {
  const it = useMemo(() => normalizeItem(item), [item]);

  const drag = useDragPosition({
    onChange: (x, y) => onChange?.({ posX: Math.round(x), posY: Math.round(y) }),
  });

  const h = clampNumber(heightPx, { min: 120, max: 680, fallback: 260 });
  const r = clampNumber(radiusPx, { min: 0, max: 40, fallback: 18 });

  return (
    <div className="mt-3 rounded-xl border border-neutral-200 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-extrabold text-neutral-900">Ajuste de imagen (mover)</div>
          <div className="text-xs text-neutral-500">Arrastra dentro del cuadro para ajustar posX/posY.</div>
        </div>

        <div className="flex gap-2">
          <select
            className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-400"
            value={it.fit}
            onChange={(e) => onChange?.({ fit: e.target.value })}
          >
            <option value="cover">Cover</option>
            <option value="contain">Contain</option>
          </select>

          <Button type="button" variant="ghost" onClick={() => onChange?.({ posX: 50, posY: 50 })}>
            Centrar
          </Button>
        </div>
      </div>

      <div
        ref={drag.ref}
        onPointerDown={drag.onPointerDown}
        onPointerMove={drag.onPointerMove}
        onPointerUp={drag.onPointerUp}
        className="mt-3 rounded-xl overflow-hidden border border-neutral-200 bg-neutral-100 relative touch-none select-none"
        style={{ height: h, borderRadius: r }}
        title="Arrastra para mover"
      >
        {it.image ? (
          <img
            src={it.image}
            alt=""
            className="absolute inset-0 w-full h-full"
            style={{
              objectFit: it.fit || "cover",
              objectPosition: `${Number(it.posX ?? 50)}% ${Number(it.posY ?? 50)}%`,
            }}
            draggable={false}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-neutral-500">Sin imagen</div>
        )}

        <div className="absolute bottom-2 right-2 text-[11px] bg-white/80 border border-neutral-200 rounded-lg px-2 py-1">
          X: <b>{it.posX}</b> — Y: <b>{it.posY}</b>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <Field label="X" hint="0–100">
          <Input
            type="number"
            min={0}
            max={100}
            value={it.posX}
            onChange={(e) => onChange?.({ posX: clampNumber(e.target.value, { min: 0, max: 100, fallback: 50 }) })}
          />
        </Field>
        <Field label="Y" hint="0–100">
          <Input
            type="number"
            min={0}
            max={100}
            value={it.posY}
            onChange={(e) => onChange?.({ posY: clampNumber(e.target.value, { min: 0, max: 100, fallback: 50 }) })}
          />
        </Field>
      </div>
    </div>
  );
}

export default function CardsEditor({
  selected,
  patchItem,
  addItem,
  removeItem,
  moveItem,
  uploading,
  uploadToCloudinary,
  imageHeightPx,
  radiusPx,
}) {
  const items = Array.isArray(selected?.items) ? selected.items : [];
  const [openIdx, setOpenIdx] = useState(0);

  const safeOpenIdx = Math.max(0, Math.min(openIdx, Math.max(0, items.length - 1)));
  const current = items[safeOpenIdx];
  const it = normalizeItem(current);

  const height = imageHeightPx ?? selected?.style?.imageHeightPx ?? 260;
  const radius = radiusPx ?? selected?.style?.cardRadiusPx ?? 18;

  const uploadImage = async (file, onUrl) => {
    if (!file) return;
    if (!uploadToCloudinary) return;
    try {
      const url = await uploadToCloudinary(file);
      if (typeof url === "string" && url) onUrl?.(url);
    } catch (e) {
      console.error(e);
      alert("No se pudo subir la imagen. Revisa consola.");
    }
  };

  return (
    <div className="rounded-2xl border border-neutral-200 p-4">
      <div className="flex justify-between items-center gap-3">
        <div className="text-sm font-extrabold text-neutral-900">Cards</div>

        <Button variant="primary" onClick={addItem} type="button">
          + Agregar
        </Button>
      </div>

      {/* Lista compacta */}
      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-2">
        {items.length ? (
          items.map((row, idx) => {
            const r = normalizeItem(row);
            const active = idx === safeOpenIdx;
            return (
              <button
                key={idx}
                type="button"
                onClick={() => setOpenIdx(idx)}
                className={[
                  "text-left rounded-xl border p-3 transition flex items-center gap-3",
                  active ? "border-neutral-900 bg-neutral-50" : "border-neutral-200 hover:bg-neutral-50",
                ].join(" ")}
              >
                <div className="w-[64px] h-[48px] rounded-lg overflow-hidden border border-neutral-200 bg-neutral-100 flex items-center justify-center shrink-0">
                  {r.image ? <img src={r.image} alt="" className="w-full h-full object-cover" /> : <span className="text-[11px] text-neutral-500">Sin img</span>}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-bold text-neutral-900 line-clamp-1">{r.title?.trim() ? r.title : `Card #${idx + 1}`}</div>
                  <div className="text-xs text-neutral-500 line-clamp-1">{r.link?.trim() ? r.link : "Sin link"}</div>
                </div>
              </button>
            );
          })
        ) : (
          <div className="text-sm text-neutral-600 col-span-full">No hay cards. Crea una con <b>+ Agregar</b>.</div>
        )}
      </div>

      {/* Editor */}
      {items.length ? (
        <div className="mt-4 rounded-2xl border border-neutral-200 p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="text-sm font-extrabold text-neutral-900">Editando: Card #{safeOpenIdx + 1}</div>

            <div className="flex gap-1">
              <Button
                variant="ghost"
                className="px-2 py-1"
                type="button"
                title="Subir"
                disabled={!moveItem || safeOpenIdx === 0}
                onClick={() => moveItem?.(safeOpenIdx, "up")}
              >
                ↑
              </Button>
              <Button
                variant="ghost"
                className="px-2 py-1"
                type="button"
                title="Bajar"
                disabled={!moveItem || safeOpenIdx === items.length - 1}
                onClick={() => moveItem?.(safeOpenIdx, "down")}
              >
                ↓
              </Button>
              <Button
                variant="danger"
                className="px-2 py-1"
                type="button"
                title="Eliminar"
                disabled={!removeItem}
                onClick={() => removeItem?.(safeOpenIdx)}
              >
                ✕
              </Button>
            </div>
          </div>

          {/* mover imagen */}
          <CardImageMover
            item={it}
            heightPx={height}
            radiusPx={radius}
            onChange={(patch) => patchItem?.(safeOpenIdx, patch)}
          />

          <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Imagen principal */}
            <Field label="Imagen principal" hint="image">
              <div className="flex gap-2">
                <Input
                  value={it.image}
                  onChange={(e) => patchItem?.(safeOpenIdx, { image: e.target.value })}
                  placeholder="https://..."
                />
                <label className="cursor-pointer shrink-0">
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    disabled={!!uploading || !uploadToCloudinary}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      uploadImage(file, (url) => patchItem?.(safeOpenIdx, { image: url }));
                      e.target.value = "";
                    }}
                  />
                  <span
                    className={[
                      "inline-flex items-center justify-center rounded-lg px-3 py-2 text-sm font-semibold",
                      uploading || !uploadToCloudinary ? "bg-neutral-200 text-neutral-500" : "bg-neutral-900 text-white hover:bg-neutral-800",
                    ].join(" ")}
                  >
                    Subir
                  </span>
                </label>
              </div>
            </Field>

            {/* Hover image */}
            <Field label="Imagen hover" hint="hoverImage (se muestra al pasar el mouse)">
              <div className="flex gap-2">
                <Input
                  value={it.hoverImage}
                  onChange={(e) => patchItem?.(safeOpenIdx, { hoverImage: e.target.value })}
                  placeholder="https://... (segunda imagen)"
                />
                <label className="cursor-pointer shrink-0">
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    disabled={!!uploading || !uploadToCloudinary}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      uploadImage(file, (url) => patchItem?.(safeOpenIdx, { hoverImage: url }));
                      e.target.value = "";
                    }}
                  />
                  <span
                    className={[
                      "inline-flex items-center justify-center rounded-lg px-3 py-2 text-sm font-semibold",
                      uploading || !uploadToCloudinary ? "bg-neutral-200 text-neutral-500" : "bg-neutral-900 text-white hover:bg-neutral-800",
                    ].join(" ")}
                  >
                    Subir
                  </span>
                </label>
              </div>

              {/* mini preview hover */}
              <div className="mt-2 grid grid-cols-2 gap-2">
                <div className="rounded-xl border border-neutral-200 bg-neutral-50 overflow-hidden h-[90px] flex items-center justify-center">
                  {it.image ? <img src={it.image} alt="" className="w-full h-full object-cover" /> : <span className="text-xs text-neutral-500">Sin image</span>}
                </div>
                <div className="rounded-xl border border-neutral-200 bg-neutral-50 overflow-hidden h-[90px] flex items-center justify-center">
                  {it.hoverImage ? <img src={it.hoverImage} alt="" className="w-full h-full object-cover" /> : <span className="text-xs text-neutral-500">Sin hoverImage</span>}
                </div>
              </div>
            </Field>

            <Field label="Link" hint="Ej: /producto/123 o /lo-nuevo">
              <Input
                value={it.link}
                onChange={(e) => patchItem?.(safeOpenIdx, { link: e.target.value })}
                placeholder="/producto/123"
              />
            </Field>

            <Field label="Título" hint="(opcional)">
              <Input
                value={it.title}
                onChange={(e) => patchItem?.(safeOpenIdx, { title: e.target.value })}
                placeholder="Vestido..."
              />
            </Field>

            <Field label="Subtítulo" hint="(opcional)">
              <Input
                value={it.subtitle}
                onChange={(e) => patchItem?.(safeOpenIdx, { subtitle: e.target.value })}
                placeholder="Talla..."
              />
            </Field>
          </div>
        </div>
      ) : null}
    </div>
  );
}