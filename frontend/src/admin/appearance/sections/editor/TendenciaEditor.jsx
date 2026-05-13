// src/admin/appearance/sections/editor/TendenciaEditor.jsx
import React, { useEffect, useMemo, useState } from "react";
import { Field, Input, Button } from "../ui/UiComponents";
import { clampNumber, normalizeTendenciaConfig } from "../ui/sectionHelpers";

/**
 * TendenciaEditor
 * Panel de control SOLO para la sección "tendencia".
 *
 * Edita selected.config:
 * - titleImage
 * - watermarkImage
 * - maxItems
 * - products: [{ productId, discountEnabled, discountPercent }]
 *
 * Props:
 * - selected (section)
 * - patchSelectedConfig(patch)
 * - uploading
 * - uploadToCloudinary(file) => Promise<url>
 * - apiSearchProducts(term) => Promise<[{id,title,price,cover}]>   (la conectamos en el paso 2)
 */

export default function TendenciaEditor({
  selected,
  patchSelectedConfig,
  uploading,
  uploadToCloudinary,
  apiSearchProducts,
}) {
  const cfg = useMemo(() => normalizeTendenciaConfig(selected?.config), [selected]);

  // buscador
  const [q, setQ] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  // debounce búsqueda
  useEffect(() => {
    let t = null;
    setErr("");

    if (!q.trim()) {
      setResults([]);
      setLoading(false);
      return;
    }

    t = setTimeout(async () => {
      if (!apiSearchProducts) return;
      setLoading(true);
      try {
        const list = await apiSearchProducts(q.trim());
        setResults(Array.isArray(list) ? list : []);
        setLoading(false);
      } catch (e) {
        setResults([]);
        setLoading(false);
        setErr("No se pudo buscar productos.");
      }
    }, 350);

    return () => clearTimeout(t);
  }, [q, apiSearchProducts]);

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

  const addProduct = (productId) => {
    const id = String(productId || "").trim();
    if (!id) return;

    const exists = (cfg.products || []).some((p) => String(p.productId) === id);
    if (exists) {
      alert("Ese producto ya está agregado en tendencia.");
      return;
    }

    const maxItems = clampNumber(cfg.maxItems, { min: 0, max: 24, fallback: 4 });
    const next = [...(cfg.products || []), { productId: id, discountEnabled: false, discountPercent: 0 }];
    const limited = maxItems > 0 ? next.slice(0, maxItems) : next;

    patchSelectedConfig?.({ ...cfg, products: limited });
  };

  const removeProduct = (idx) => {
    const next = [...(cfg.products || [])];
    next.splice(idx, 1);
    patchSelectedConfig?.({ ...cfg, products: next });
  };

  const moveProduct = (idx, dir) => {
    const next = [...(cfg.products || [])];
    const target = dir === "up" ? idx - 1 : idx + 1;
    if (target < 0 || target >= next.length) return;
    const tmp = next[idx];
    next[idx] = next[target];
    next[target] = tmp;
    patchSelectedConfig?.({ ...cfg, products: next });
  };

  const patchProduct = (idx, patch) => {
    const next = [...(cfg.products || [])];
    next[idx] = { ...next[idx], ...patch };

    next[idx].discountEnabled = !!next[idx].discountEnabled;
    next[idx].discountPercent = clampNumber(next[idx].discountPercent, { min: 0, max: 90, fallback: 0 });

    patchSelectedConfig?.({ ...cfg, products: next });
  };

  return (
    <div className="rounded-2xl border border-neutral-200 p-4">
      <div className="text-sm font-extrabold text-neutral-900">Panel: Tendencia</div>
      <div className="text-xs text-neutral-500 mt-1">
        Aquí controlas el encabezado, marca de agua, máximo de productos y selección desde BD.
      </div>

      {/* ===== IMÁGENES ===== */}
      <div className="mt-4 rounded-2xl border border-neutral-200 p-4">
        <div className="text-sm font-extrabold text-neutral-900">Imágenes</div>

        <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* titleImage */}
          <Field label="Imagen de título" hint="config.titleImage">
            <div className="flex gap-2">
              <Input
                value={cfg.titleImage || ""}
                onChange={(e) => patchSelectedConfig?.({ ...cfg, titleImage: e.target.value })}
                placeholder="https://... o /EnTendencia.png"
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
                    uploadImage(file, (url) => patchSelectedConfig?.({ ...cfg, titleImage: url }));
                    e.target.value = "";
                  }}
                />
                <span
                  className={[
                    "inline-flex items-center justify-center rounded-lg px-3 py-2 text-sm font-semibold",
                    uploading || !uploadToCloudinary
                      ? "bg-neutral-200 text-neutral-500"
                      : "bg-neutral-900 text-white hover:bg-neutral-800",
                  ].join(" ")}
                >
                  Subir
                </span>
              </label>
            </div>

            <div className="mt-2 rounded-xl border border-neutral-200 bg-neutral-50 overflow-hidden h-[110px] flex items-center justify-center">
              {cfg.titleImage ? (
                <img src={cfg.titleImage} alt="" className="w-full h-full object-contain" />
              ) : (
                <span className="text-xs text-neutral-500">Sin imagen</span>
              )}
            </div>

            <div className="mt-2">
              <Button type="button" variant="ghost" onClick={() => patchSelectedConfig?.({ ...cfg, titleImage: "" })}>
                Quitar
              </Button>
            </div>
          </Field>

          {/* watermarkImage */}
          <Field label="Marca de agua" hint="config.watermarkImage">
            <div className="flex gap-2">
              <Input
                value={cfg.watermarkImage || ""}
                onChange={(e) => patchSelectedConfig?.({ ...cfg, watermarkImage: e.target.value })}
                placeholder="https://... o /icons/ROSA.png"
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
                    uploadImage(file, (url) => patchSelectedConfig?.({ ...cfg, watermarkImage: url }));
                    e.target.value = "";
                  }}
                />
                <span
                  className={[
                    "inline-flex items-center justify-center rounded-lg px-3 py-2 text-sm font-semibold",
                    uploading || !uploadToCloudinary
                      ? "bg-neutral-200 text-neutral-500"
                      : "bg-neutral-900 text-white hover:bg-neutral-800",
                  ].join(" ")}
                >
                  Subir
                </span>
              </label>
            </div>

            <div className="mt-2 rounded-xl border border-neutral-200 bg-neutral-50 overflow-hidden h-[110px] flex items-center justify-center">
              {cfg.watermarkImage ? (
                <img src={cfg.watermarkImage} alt="" className="w-full h-full object-contain" />
              ) : (
                <span className="text-xs text-neutral-500">Sin watermark</span>
              )}
            </div>

            <div className="mt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => patchSelectedConfig?.({ ...cfg, watermarkImage: "" })}
              >
                Quitar
              </Button>
            </div>
          </Field>
        </div>
      </div>

      {/* ===== CONFIG ===== */}
      <div className="mt-4 rounded-2xl border border-neutral-200 p-4">
        <div className="text-sm font-extrabold text-neutral-900">Configuración</div>

        <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Máximo de productos" hint="config.maxItems (0–24)">
            <Input
              type="number"
              min={0}
              max={24}
              value={cfg.maxItems ?? 4}
              onChange={(e) =>
                patchSelectedConfig?.({
                  ...cfg,
                  maxItems: clampNumber(e.target.value, { min: 0, max: 24, fallback: 4 }),
                })
              }
            />
            <div className="text-xs text-neutral-500 mt-1">
              Si pones 4, solo se guardarán 4 aunque agregues más.
            </div>
          </Field>

          <Field label="Buscar producto" hint="se agrega a config.products">
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Escribe para buscar..." />
            {err ? <div className="mt-2 text-xs text-rose-700">{err}</div> : null}
          </Field>
        </div>

        {/* resultados */}
        <div className="mt-4">
          <div className="text-sm font-extrabold text-neutral-900">Resultados</div>
          <div className="mt-2 rounded-xl border border-neutral-200 overflow-hidden">
            {loading ? (
              <div className="p-3 text-sm text-neutral-600">Buscando…</div>
            ) : results.length ? (
              <div className="divide-y">
                {results.map((p) => (
                  <div key={p.id} className="p-3 flex items-center gap-3">
                    <div className="w-12 h-12 rounded-lg overflow-hidden border bg-neutral-100 shrink-0 flex items-center justify-center">
                      {p.cover ? <img src={p.cover} alt="" className="w-full h-full object-cover" /> : <span className="text-[10px]">img</span>}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-bold text-neutral-900 line-clamp-1">{p.title}</div>
                      <div className="text-xs text-neutral-500 line-clamp-1">
                        ID: <span className="font-mono">{p.id}</span>
                      </div>
                      {p.price != null ? (
                        <div className="text-xs text-neutral-600">
                          Precio: <b>${Number(p.price).toLocaleString()}</b>
                        </div>
                      ) : null}
                    </div>
                    <Button type="button" variant="primary" onClick={() => addProduct(p.id)}>
                      Agregar
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-3 text-sm text-neutral-600">Escribe para buscar productos.</div>
            )}
          </div>
        </div>

        {/* seleccionados */}
        <div className="mt-5">
          <div className="text-sm font-extrabold text-neutral-900">Seleccionados</div>

          <div className="mt-2 rounded-xl border border-neutral-200 overflow-hidden">
            {(cfg.products || []).length ? (
              <div className="divide-y">
                {(cfg.products || []).map((r, idx) => (
                  <div key={`${r.productId}_${idx}`} className="p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-neutral-900">
                          #{idx + 1} — <span className="font-mono">{r.productId}</span>
                        </div>
                        <div className="text-xs text-neutral-500 mt-1">Este id lo usa el frontend para cargar el producto.</div>
                      </div>

                      <div className="flex gap-1">
                        <Button variant="ghost" className="px-2 py-1" type="button" disabled={idx === 0} onClick={() => moveProduct(idx, "up")}>
                          ↑
                        </Button>
                        <Button variant="ghost" className="px-2 py-1" type="button" disabled={idx === (cfg.products || []).length - 1} onClick={() => moveProduct(idx, "down")}>
                          ↓
                        </Button>
                        <Button variant="danger" className="px-2 py-1" type="button" onClick={() => removeProduct(idx)}>
                          ✕
                        </Button>
                      </div>
                    </div>

                    <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                      <Field label="Descuento activo" hint="discountEnabled">
                        <div className="flex items-center justify-between rounded-lg border border-neutral-200 px-3 py-2">
                          <div className="text-sm font-semibold text-neutral-700">{r.discountEnabled ? "Sí" : "No"}</div>
                          <button
                            type="button"
                            onClick={() => patchProduct(idx, { discountEnabled: !r.discountEnabled })}
                            className={[
                              "relative inline-flex h-6 w-11 items-center rounded-full border transition",
                              r.discountEnabled ? "bg-neutral-900 border-neutral-900" : "bg-neutral-200 border-neutral-200",
                            ].join(" ")}
                          >
                            <span
                              className={[
                                "inline-block h-5 w-5 transform rounded-full bg-white transition",
                                r.discountEnabled ? "translate-x-5" : "translate-x-1",
                              ].join(" ")}
                            />
                          </button>
                        </div>
                      </Field>

                      <Field label="Porcentaje" hint="discountPercent (0–90)">
                        <Input
                          type="number"
                          min={0}
                          max={90}
                          value={r.discountPercent ?? 0}
                          onChange={(e) =>
                            patchProduct(idx, {
                              discountPercent: clampNumber(e.target.value, { min: 0, max: 90, fallback: 0 }),
                            })
                          }
                        />
                        <div className="text-xs text-neutral-500 mt-1">
                          Solo aplica si “Descuento activo” está en Sí.
                        </div>
                      </Field>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-3 text-sm text-neutral-600">
                Aún no has agregado productos. Usa el buscador y presiona <b>Agregar</b>.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}