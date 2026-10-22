import { useEffect, useMemo, useState } from "react";
import api from "../../../lib/api";
import SectionEditorPostPicker from "./ui/SectionEditorPostPicker";
import { Button, Field, Input, Toggle } from "./ui/UiComponents";
import { clampNumber } from "./ui/sectionHelpers";
import { CardImageMover } from "./ui/SectionsPanelUI";
import { moneyCOP, normalizeDiscountFields, normalizeTendenciaConfigPlus, buildTendenciaProductFromBackend } from "./sectionEditorModel";

export default function ProductsTab({ section, onChange, uploadToCloudinary }) {
  const cfgRaw = normalizeTendenciaConfigPlus(section.config);

  const cfg = useMemo(() => {
    const products = Array.isArray(cfgRaw.products) ? cfgRaw.products.map((p) => normalizeDiscountFields(p)) : [];
    return { ...cfgRaw, products };
  }, [cfgRaw]);

  const [search, setSearch] = useState("");
  const [activeProductId, setActiveProductId] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState([]);
  const [error, setError] = useState("");

  const patchConfig = (partial) => {
    const next = { ...cfg, ...partial };
    if (Array.isArray(next.products)) {
      next.products = next.products.map((p) => normalizeDiscountFields(p));
    }
    onChange({ config: next });
  };

  useEffect(() => {
    const q = search.trim();
    if (!q) {
      setResults([]);
      setError("");
      setSearching(false);
      return;
    }

    let alive = true;
    const t = setTimeout(async () => {
      setSearching(true);
      setError("");
      try {
        const { data } = await api.get("/api/products", {
          params: { page: 1, q, limit: 24, sort: "title" },
        });

        const list = Array.isArray(data?.products) ? data.products : [];
        const mapped = list.map((p) => buildTendenciaProductFromBackend(p)).filter(Boolean);

        if (!alive) return;
        setResults(mapped);
      } catch (e) {
        console.error("Error buscando productos para tendencia:", e);
        if (!alive) return;
        setResults([]);
        setError("No pude buscar productos. Revisa la búsqueda paginada.");
      } finally {
        if (!alive) return;
        setSearching(false);
      }
    }, 350);

    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [search]);

  const handleAddProduct = (prod) => {
    const existing = cfg.products || [];
    const already = existing.find((p) => p.productId === prod.productId);
    if (already) return;

    const normalized = normalizeDiscountFields(prod);

    patchConfig({
      products: [...existing, normalized].slice(0, cfg.maxItems || 4),
    });
    setActiveProductId(normalized.productId);
  };

  const handleRemoveProduct = (productId) => {
    patchConfig({
      products: (cfg.products || []).filter((p) => p.productId !== productId),
    });
    if (activeProductId === productId) setActiveProductId('');
  };

  const handleChangeImages = (productId, imagesPatch) => {
    patchConfig({
      products: (cfg.products || []).map((p) =>
        p.productId === productId ? normalizeDiscountFields({ ...p, ...imagesPatch }) : p
      ),
    });
  };

  const handleChangeDiscount = (productId, patch) => {
    patchConfig({
      products: (cfg.products || []).map((p) => {
        if (p.productId !== productId) return p;

        const next = { ...p, ...patch };

        if (patch && Object.prototype.hasOwnProperty.call(patch, "hasDiscount") && patch.hasDiscount === false) {
          next.discountPercent = 0;
          next.finalPrice = Number(next.price ?? 0) || 0;
        }

        return normalizeDiscountFields(next);
      }),
    });
  };

  const activeId = cfg.products?.some((item) => item.productId === activeProductId)
    ? activeProductId : cfg.products?.[0]?.productId;

  return (
    <div className="section-product-editor space-y-4">
      <div className="rounded-2xl border border-neutral-200 bg-white p-4 space-y-4">
        <div className="section-product-editor__heading">
          <div><h3>Elige los productos</h3><p>Busca en el catálogo y personaliza las imágenes y el descuento de cada tarjeta.</p></div>
          <span>{cfg.products?.length || 0} de {cfg.maxItems || 4}</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Cantidad máxima de tarjetas">
            <Input
              type="number"
              min={1}
              max={12}
              value={cfg.maxItems ?? 4}
              onChange={(e) =>
                patchConfig({
                  maxItems: clampNumber(Number(e.target.value) || 4, 1, 12),
                })
              }
            />
          </Field>

          <Field label="Buscar en el catálogo" hint="Escribe el nombre de un producto.">
            <div className="flex gap-2">
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Ej: vestido..." />
              <Button
                kind="ghost"
                type="button"
                onClick={() => {
                  setSearch("");
                  setResults([]);
                  setError("");
                }}
              >
                Limpiar
              </Button>
            </div>
            {searching ? <div className="mt-2 text-[11px] text-neutral-500">Buscando…</div> : null}
            {error ? <div className="mt-2 text-[11px] text-rose-700">{error}</div> : null}
          </Field>
        </div>
      </div>

      {!!results.length && (
        <div className="rounded-2xl border border-neutral-200 bg-white p-4">
          <div className="text-xs font-semibold text-neutral-900 mb-2">Resultados</div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {results.map((p) => (
              <button
                key={p.productId}
                type="button"
                onClick={() => handleAddProduct(p)}
                className="flex items-center gap-3 rounded-xl border border-neutral-200 bg-neutral-50 p-2 text-left hover:border-neutral-400 transition"
              >
                <div className="h-16 w-16 rounded-lg overflow-hidden bg-white border border-neutral-200 flex items-center justify-center">
                  <img src={p.mainImage} alt={p.name} className="h-full w-full object-cover" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-neutral-900 line-clamp-2">{p.name || "Producto sin nombre"}</div>
                  <div className="text-[11px] text-neutral-500 mt-1">
                    {p.hasDiscount ? (
                      <>
                        <span className="font-mono">{moneyCOP(p.finalPrice)}</span>{" "}
                        <span className="line-through text-neutral-400 font-mono">{moneyCOP(p.price)}</span>{" "}
                        <span className="text-rose-700 font-semibold">-{Number(p.discountPercent || 0)}%</span>
                      </>
                    ) : (
                      <span className="font-mono">{moneyCOP(p.price)}</span>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-neutral-200 bg-white p-4 space-y-4">
        <div className="section-product-editor__heading"><div><h3>Tarjetas seleccionadas</h3><p>Elige cuál foto aparece primero y cuál al pasar el cursor.</p></div></div>

        {!cfg.products?.length ? <div className="text-xs text-neutral-500">Aún no has seleccionado productos para esta sección.</div> : null}

        <SectionEditorPostPicker posts={(cfg.products || []).map((item) => ({ id: item.productId, image: item.mainImage }))}
          activeIndex={Math.max(0, (cfg.products || []).findIndex((item) => item.productId === activeId))}
          onSelect={(index) => setActiveProductId(cfg.products[index]?.productId || '')}
          label="Tendencia" itemName="tarjeta" />

        {cfg.products?.map((itemRaw) => {
          const item = normalizeDiscountFields(itemRaw);

          return (
            <div key={item.productId} hidden={item.productId !== activeId} className="section-product-editor__card border border-neutral-200 rounded-xl p-3 bg-neutral-50">
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-neutral-900 line-clamp-2">
                    {item.name || "Producto"}
                  </div>

                  <div className="mt-3 rounded-xl border border-neutral-200 bg-white p-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="text-xs text-neutral-700">
                        <b>Precio:</b> {moneyCOP(item.price)}
                        {item.hasDiscount ? <span className="ml-2 font-semibold text-rose-700">→ {moneyCOP(item.finalPrice)}</span> : null}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-neutral-600">Aplicar descuento</span>
                        <Toggle checked={!!item.hasDiscount} onChange={(v) => handleChangeDiscount(item.productId, { hasDiscount: !!v })} />
                      </div>
                    </div>

                    {item.hasDiscount ? (
                      <div className="mt-3 max-w-[180px]">
                        <Field label="Porcentaje de descuento" hint="Entre 1 y 95 %">
                          <Input
                            type="number"
                            min={1}
                            max={95}
                            value={Number(item.discountPercent || 0)}
                            onChange={(e) =>
                              handleChangeDiscount(item.productId, {
                                discountPercent: clampNumber(Number(e.target.value) || 0, 0, 95),
                              })
                            }
                          />
                        </Field>
                      </div>
                    ) : null}
                  </div>

                  <div className="mt-3 space-y-3">
                    <div className="section-product-editor__photos">
                      {[{ label: 'Foto principal', src: item.mainImage }, { label: 'Al pasar el cursor', src: item.hoverImage }].map(({ label, src }) => (
                        <div className="section-product-editor__photo" key={label}>
                          {src ? <img src={src} alt={label} /> : <span>Sin imagen</span>}
                          <strong>{label}</strong>
                        </div>
                      ))}
                    </div>
                    <CardImageMover
                      item={item}
                      uploadToCloudinary={uploadToCloudinary}
                      onChangeImages={(imagesPatch) => handleChangeImages(item.productId, imagesPatch)}
                    />
                  </div>
                </div>

                <button
                  type="button"
                  className="ml-2 inline-flex h-7 w-7 items-center justify-center rounded-full border border-neutral-300 text-xs text-neutral-500 hover:bg-red-50 hover:text-red-600 hover:border-red-300 transition"
                  onClick={() => handleRemoveProduct(item.productId)}
                  title="Quitar"
                >
                  ×
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
