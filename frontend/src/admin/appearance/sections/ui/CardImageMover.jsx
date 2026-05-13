// src/admin/appearance/sections/ui/CardImageMover.jsx
import React from "react";
import { Button, Field, Input } from "./UiComponents";
import useDragPosition from "../hooks/useDragPosition";
import { clampNumber } from "./sectionHelpers";

// Debe ser idéntico a tu archivo original
const DEFAULT_ITEM_IMAGE = {
  fit: "cover", // cover | contain
  posX: 50, // 0..100 (%)
  posY: 50, // 0..100 (%)
};

function normalizeItem(it) {
  const raw = it && typeof it === "object" ? it : {};
  const fit = raw.fit === "contain" ? "contain" : "cover";
  const posX = clampNumber(raw.posX, { min: 0, max: 100, fallback: DEFAULT_ITEM_IMAGE.posX });
  const posY = clampNumber(raw.posY, { min: 0, max: 100, fallback: DEFAULT_ITEM_IMAGE.posY });

  return {
    image: typeof raw?.image === "string" ? raw.image : "",
    title: typeof raw?.title === "string" ? raw.title : "",
    subtitle: typeof raw?.subtitle === "string" ? raw.subtitle : "",
    link: typeof raw?.link === "string" ? raw.link : "",
    fit,
    posX,
    posY,
  };
}

// ============================================
// ✅ Componente para mover la imagen (posX/posY)
// (mismo que estaba dentro de SectionsPanel.jsx)
// ============================================
export default function CardImageMover({ item, heightPx, radiusPx, onChange }) {
  const it = normalizeItem(item);
  const drag = useDragPosition({
    onChange: (x, y) => {
      onChange?.({ posX: Math.round(x), posY: Math.round(y) });
    },
  });

  return (
    <div className="mt-3 rounded-xl border border-neutral-200 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-extrabold text-neutral-900">Ajuste de imagen (mover)</div>
          <div className="text-xs text-neutral-500">
            Arrastra dentro del cuadro para ajustar posX/posY.
          </div>
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

          <Button
            type="button"
            variant="ghost"
            onClick={() => onChange?.({ posX: 50, posY: 50 })}
            title="Centrar"
          >
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
        style={{
          height: clampNumber(heightPx, { min: 120, max: 680, fallback: 260 }),
          borderRadius: clampNumber(radiusPx, { min: 0, max: 40, fallback: 18 }),
        }}
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
          <div className="absolute inset-0 flex items-center justify-center text-sm text-neutral-500">
            Sin imagen
          </div>
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
            onChange={(e) =>
              onChange?.({
                posX: clampNumber(e.target.value, { min: 0, max: 100, fallback: 50 }),
              })
            }
          />
        </Field>
        <Field label="Y" hint="0–100">
          <Input
            type="number"
            min={0}
            max={100}
            value={it.posY}
            onChange={(e) =>
              onChange?.({
                posY: clampNumber(e.target.value, { min: 0, max: 100, fallback: 50 }),
              })
            }
          />
        </Field>
      </div>
    </div>
  );
}