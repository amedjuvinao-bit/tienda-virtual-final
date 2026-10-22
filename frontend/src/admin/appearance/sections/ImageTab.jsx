import { useEffect, useMemo, useRef, useState } from "react";
import { Button, Field, Input } from "./ui/UiComponents";
import { clampNumber } from "./ui/sectionHelpers";
import { normalizeTendenciaConfigPlus } from "./sectionEditorModel";

export default function ImageTab({ section, onChange, uploadToCloudinary, uploading }) {
  const cfg = useMemo(() => normalizeTendenciaConfigPlus(section.config), [section.config]);
  const latestConfigRef = useRef(cfg);

  const previewBoxRef = useRef(null);
  const draggingRef = useRef(false);
  const pointerIdRef = useRef(null);
  const previewPosRef = useRef({
    x: clampNumber(cfg.watermarkPosXPct ?? 88, 0, 100),
    y: clampNumber(cfg.watermarkPosYPct ?? 86, 0, 100),
  });

  const [previewPos, setPreviewPos] = useState(() => ({
    x: clampNumber(cfg.watermarkPosXPct ?? 88, 0, 100),
    y: clampNumber(cfg.watermarkPosYPct ?? 86, 0, 100),
  }));

  useEffect(() => {
    latestConfigRef.current = cfg;

    if (!draggingRef.current) {
      const next = {
        x: clampNumber(cfg.watermarkPosXPct ?? 88, 0, 100),
        y: clampNumber(cfg.watermarkPosYPct ?? 86, 0, 100),
      };
      previewPosRef.current = next;
      setPreviewPos(next);
    }
  }, [cfg]);

  const patchConfig = (partialOrUpdater) => {
    const current = normalizeTendenciaConfigPlus(latestConfigRef.current);
    const partial =
      typeof partialOrUpdater === "function" ? partialOrUpdater(current) : partialOrUpdater || {};

    const next = normalizeTendenciaConfigPlus({
      ...current,
      ...partial,
      titleImage:
        Object.prototype.hasOwnProperty.call(partial, "titleImage")
          ? partial.titleImage
          : current.titleImage,
      watermarkImage:
        Object.prototype.hasOwnProperty.call(partial, "watermarkImage")
          ? partial.watermarkImage
          : current.watermarkImage,
    });

    latestConfigRef.current = next;
    onChange({ config: next });
  };

  const handleUpload = async (field, file) => {
    if (!uploadToCloudinary || !file) return;
    const url = await uploadToCloudinary(file);
    if (!url) return;
    patchConfig({ [field]: url });
  };

  const pointerToPercent = (clientX, clientY) => {
    const el = previewBoxRef.current;
    if (!el) return null;

    const rect = el.getBoundingClientRect();
    if (!rect || rect.width <= 0 || rect.height <= 0) return null;

    const x = clampNumber(((clientX - rect.left) / rect.width) * 100, 0, 100);
    const y = clampNumber(((clientY - rect.top) / rect.height) * 100, 0, 100);

    return { x, y };
  };

  const updatePreviewOnly = (clientX, clientY) => {
    const next = pointerToPercent(clientX, clientY);
    if (!next) return;
    previewPosRef.current = next;
    setPreviewPos(next);
  };

  const commitPreviewToConfig = () => {
    const { x, y } = previewPosRef.current || { x: 88, y: 86 };

    patchConfig({
      watermarkFree: true,
      watermarkPosXPct: clampNumber(x, 0, 100),
      watermarkPosYPct: clampNumber(y, 0, 100),
    });
  };

  const onPreviewPointerDown = (e) => {
    if (!previewBoxRef.current) return;
    if (typeof e.button === "number" && e.button !== 0) return;

    draggingRef.current = true;
    pointerIdRef.current = e.pointerId ?? null;

    try {
      previewBoxRef.current.setPointerCapture?.(e.pointerId);
    } catch (_) {}

    e.preventDefault?.();
    e.stopPropagation?.();

    updatePreviewOnly(e.clientX, e.clientY);
  };

  const onPreviewPointerMove = (e) => {
    if (!draggingRef.current) return;
    if (pointerIdRef.current != null && e.pointerId != null && e.pointerId !== pointerIdRef.current) return;

    e.preventDefault?.();
    updatePreviewOnly(e.clientX, e.clientY);
  };

  const finishPreviewDrag = (e) => {
    if (!draggingRef.current) return;
    if (pointerIdRef.current != null && e?.pointerId != null && e.pointerId !== pointerIdRef.current) return;

    if (e && Number.isFinite(e.clientX) && Number.isFinite(e.clientY)) {
      updatePreviewOnly(e.clientX, e.clientY);
    }

    draggingRef.current = false;

    try {
      previewBoxRef.current?.releasePointerCapture?.(pointerIdRef.current);
    } catch (_) {}

    pointerIdRef.current = null;
    commitPreviewToConfig();
  };

  return (
    <div className="space-y-6">
      <Field label="Imagen de título" hint="Se guarda en config.titleImage" name="config.titleImage">
        <div className="flex flex-col gap-3">
          {cfg.titleImage ? (
            <div className="flex items-center gap-3">
              <div className="relative h-20 rounded-xl overflow-hidden border border-neutral-300 bg-white flex items-center justify-center px-4">
                <img src={cfg.titleImage} alt="Título sección" className="max-h-full w-auto object-contain" />
              </div>
              <Button kind="ghost" size="sm" onClick={() => patchConfig({ titleImage: "" })}>
                Quitar
              </Button>
            </div>
          ) : (
            <div className="text-xs text-neutral-500">No hay imagen de título seleccionada.</div>
          )}

          <div className="flex items-center gap-3">
            <Input
              value={cfg.titleImage}
              onChange={(e) => patchConfig({ titleImage: e.target.value })}
              placeholder="https://..."
            />
            <label className="inline-flex items-center px-3 py-2 rounded-xl section-editor-accent text-white text-xs font-medium cursor-pointer shadow-sm section-editor-accent-hover transition">
              <span className="mr-1">{uploading ? "Subiendo..." : "Subir"}</span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                disabled={uploading}
                onChange={(e) => handleUpload("titleImage", e.target.files?.[0] || null)}
              />
            </label>
          </div>
        </div>
      </Field>

      <Field label="Marca de agua (watermark)" hint="Se guarda en config.watermarkImage" name="config.watermarkImage">
        <div className="space-y-4">
          <div className="flex flex-col gap-3">
            {cfg.watermarkImage ? (
              <div className="flex items-center gap-3">
                <div className="relative h-16 w-32 rounded-xl overflow-hidden border border-neutral-300 bg-white flex items-center justify-center">
                  <img src={cfg.watermarkImage} alt="Watermark" className="max-h-full max-w-full object-contain opacity-70" />
                </div>
                <Button kind="ghost" size="sm" onClick={() => patchConfig({ watermarkImage: "" })}>
                  Quitar
                </Button>
              </div>
            ) : (
              <div className="text-xs text-neutral-500">No hay imagen de marca de agua aún.</div>
            )}

            <div className="flex items-center gap-3">
              <Input
                value={cfg.watermarkImage}
                onChange={(e) => patchConfig({ watermarkImage: e.target.value })}
                placeholder="https://..."
              />
              <label className="inline-flex items-center px-3 py-2 rounded-xl section-editor-accent text-white text-xs font-medium cursor-pointer shadow-sm section-editor-accent-hover transition">
                <span className="mr-1">{uploading ? "Subiendo..." : "Subir"}</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={uploading}
                  onChange={(e) => handleUpload("watermarkImage", e.target.files?.[0] || null)}
                />
              </label>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Tamaño (px)" hint="40–320" name="config.watermarkSizePx">
              <Input
                type="number"
                min={40}
                max={320}
                value={cfg.watermarkSizePx ?? 140}
                onChange={(e) =>
                  patchConfig({
                    watermarkSizePx: clampNumber(Number(e.target.value) || 140, 40, 320),
                  })
                }
              />
            </Field>

            <Field label="Opacidad" hint="0.00–1.00" name="config.watermarkOpacity">
              <Input
                type="number"
                step="0.01"
                min={0}
                max={1}
                value={cfg.watermarkOpacity ?? 0.12}
                onChange={(e) =>
                  patchConfig({
                    watermarkOpacity: clampNumber(Number(e.target.value), 0, 1),
                  })
                }
              />
            </Field>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Field label="Modo" hint="Esquinas o libre" name="config.watermarkFree">
              <select
                className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm"
                value={cfg.watermarkFree ? "free" : "corner"}
                onChange={(e) => {
                  const willBeFree = e.target.value === "free";

                  if (willBeFree) {
                    const next = {
                      x: clampNumber(cfg.watermarkPosXPct ?? 88, 0, 100),
                      y: clampNumber(cfg.watermarkPosYPct ?? 86, 0, 100),
                    };
                    previewPosRef.current = next;
                    setPreviewPos(next);
                  }

                  patchConfig({
                    watermarkFree: willBeFree,
                  });
                }}
              >
                <option value="corner">Esquinas + offsets</option>
                <option value="free">Libre (arrastrar en preview)</option>
              </select>
            </Field>

            <Field label="Rotación (°)" hint="-180 a 180" name="config.watermarkRotateDeg">
              <Input
                type="number"
                min={-180}
                max={180}
                value={Number.isFinite(Number(cfg.watermarkRotateDeg)) ? Number(cfg.watermarkRotateDeg) : 0}
                onChange={(e) =>
                  patchConfig({
                    watermarkRotateDeg: clampNumber(Number(e.target.value) || 0, -180, 180),
                  })
                }
              />
            </Field>

            <Field label="Reset posición" hint="Vuelve a abajo-derecha" name="config.watermarkReset">
              <Button
                type="button"
                kind="ghost"
                onClick={() => {
                  const next = { x: 88, y: 86 };
                  previewPosRef.current = next;
                  setPreviewPos(next);

                  patchConfig({
                    watermarkFree: false,
                    watermarkPosition: "br",
                    watermarkOffsetXPx: 0,
                    watermarkOffsetYPx: 0,
                    watermarkPosXPct: 88,
                    watermarkPosYPct: 86,
                    watermarkRotateDeg: 0,
                  });
                }}
              >
                Reset
              </Button>
            </Field>
          </div>

          {!cfg.watermarkFree ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Field label="Posición" hint="Esquina base" name="config.watermarkPosition">
                  <select
                    className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm"
                    value={cfg.watermarkPosition || "br"}
                    onChange={(e) =>
                      patchConfig({
                        watermarkPosition: ["br", "tr", "bl", "tl"].includes(e.target.value) ? e.target.value : "br",
                      })
                    }
                  >
                    <option value="br">Abajo derecha (br)</option>
                    <option value="tr">Arriba derecha (tr)</option>
                    <option value="bl">Abajo izquierda (bl)</option>
                    <option value="tl">Arriba izquierda (tl)</option>
                  </select>
                </Field>

                <Field label="Offset X (px)" hint="-60 a 120" name="config.watermarkOffsetXPx">
                  <Input
                    type="number"
                    min={-60}
                    max={120}
                    value={Number.isFinite(Number(cfg.watermarkOffsetXPx)) ? Number(cfg.watermarkOffsetXPx) : 0}
                    onChange={(e) =>
                      patchConfig({
                        watermarkOffsetXPx: clampNumber(Number(e.target.value) || 0, -60, 120),
                      })
                    }
                  />
                </Field>

                <Field label="Offset Y (px)" hint="-60 a 120" name="config.watermarkOffsetYPx">
                  <Input
                    type="number"
                    min={-60}
                    max={120}
                    value={Number.isFinite(Number(cfg.watermarkOffsetYPx)) ? Number(cfg.watermarkOffsetYPx) : 0}
                    onChange={(e) =>
                      patchConfig({
                        watermarkOffsetYPx: clampNumber(Number(e.target.value) || 0, -60, 120),
                      })
                    }
                  />
                </Field>
              </div>

              <div className="text-[11px] text-neutral-500">
                Tip: primero eliges la <b>posición</b> (esquina) y luego con los <b>offsets</b> la mueves fino.
              </div>
            </>
          ) : null}

          {cfg.watermarkFree ? (
            <div className="rounded-2xl border border-neutral-200 bg-white p-3">
              <div className="text-xs font-semibold text-neutral-900 mb-2">
                Preview libre (arrastra la flor dentro del recuadro)
              </div>

              <div
                data-admin-storefront-preview="true"
                ref={previewBoxRef}
                className="relative w-full max-w-[520px] h-[220px] rounded-xl border border-neutral-200 bg-white overflow-hidden touch-none"
                onPointerDown={onPreviewPointerDown}
                onPointerMove={onPreviewPointerMove}
                onPointerUp={finishPreviewDrag}
                onPointerCancel={finishPreviewDrag}
                onLostPointerCapture={finishPreviewDrag}
              >
                <div className="absolute inset-0 bg-neutral-50" />

                {cfg.watermarkImage ? (
                  <img
                    src={cfg.watermarkImage}
                    alt=""
                    draggable={false}
                    className="absolute pointer-events-none select-none"
                    style={{
                      width: cfg.watermarkSizePx,
                      height: "auto",
                      opacity: cfg.watermarkOpacity,
                      left: `${clampNumber(previewPos.x, 0, 100)}%`,
                      top: `${clampNumber(previewPos.y, 0, 100)}%`,
                      transform: `translate(-50%, -50%) rotate(${clampNumber(cfg.watermarkRotateDeg ?? 0, -180, 180)}deg)`,
                    }}
                  />
                ) : null}

                <div className="absolute left-3 top-3 text-[11px] text-neutral-500 bg-white/80 border border-neutral-200 rounded-lg px-2 py-1">
                  X: {Math.round(previewPos.x ?? 0)}% · Y: {Math.round(previewPos.y ?? 0)}%
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </Field>
    </div>
  );
}
