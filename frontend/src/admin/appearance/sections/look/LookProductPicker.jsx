// src/admin/appearance/sections/look/LookProductPicker.jsx
import React, { useEffect, useMemo, useState } from "react";
import api from "../../../../lib/api";
import { Button, Input } from "../ui/UiComponents";
import { LOOK_MAX_PRODUCTS } from "./lookSectionHelpers";

function uniqBy(arr, keyFn) {
  const out = [];
  const seen = new Set();

  for (const item of Array.isArray(arr) ? arr : []) {
    const key = keyFn(item);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }

  return out;
}

function extractProductId(product) {
  return String(product?._id || product?.id || product?.productId || "").trim();
}

function extractProductTitle(product) {
  return String(product?.title || product?.name || product?.subtitle || "Producto").trim();
}

function extractProductPrice(product) {
  const n = Number(product?.price ?? product?.finalPrice ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function isHexColor(value) {
  return typeof value === "string" && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value.trim());
}

function extractAllColors(product) {
  const raw = Array.isArray(product?.colors) ? product.colors : [];
  return raw
    .map((c) => {
      if (typeof c === "string") return c.trim();
      if (typeof c?.hex === "string") return c.hex.trim();
      if (typeof c?.value === "string") return c.value.trim();
      if (typeof c?.color === "string") return c.color.trim();
      return "";
    })
    .filter((v) => isHexColor(v));
}

function extractAllImagesFromProduct(product) {
  if (!product || typeof product !== "object") return [];

  const images = new Set();

  if (typeof product.image === "string" && product.image.trim()) images.add(product.image.trim());
  if (typeof product.image1 === "string" && product.image1.trim()) images.add(product.image1.trim());
  if (typeof product.image2 === "string" && product.image2.trim()) images.add(product.image2.trim());

  if (Array.isArray(product.images)) {
    for (const img of product.images) {
      if (typeof img === "string" && img.trim()) {
        images.add(img.trim());
      } else if (img && typeof img === "object" && typeof img.url === "string" && img.url.trim()) {
        images.add(img.url.trim());
      }
    }
  }

  if (product.images && typeof product.images === "object") {
    if (typeof product.images.cover === "string" && product.images.cover.trim()) {
      images.add(product.images.cover.trim());
    }

    if (Array.isArray(product.images.gallery)) {
      for (const g of product.images.gallery) {
        if (typeof g === "string" && g.trim()) {
          images.add(g.trim());
        } else if (g && typeof g === "object" && typeof g.url === "string" && g.url.trim()) {
          images.add(g.url.trim());
        }
      }
    }
  }

  return Array.from(images);
}

function normalizeBackendList(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.products)) return data.products;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.data)) return data.data;
  return [];
}

function moneyCOP(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "$0";
  return `$${Math.round(n).toLocaleString("es-CO")}`;
}

export default function LookProductPicker({
  value,
  onChange,
  onPick,
  maxItems = LOOK_MAX_PRODUCTS,
  title = "Productos de la sección LOOK",
}) {
  const selectedList = Array.isArray(value) ? value : [];
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);
  const [error, setError] = useState("");

  const selectedIds = useMemo(() => {
    return new Set(
      selectedList
        .map((item) => String(item?.productId || "").trim())
        .filter(Boolean)
    );
  }, [selectedList]);

  const selectedCount = selectedList.length;

  useEffect(() => {
    const q = String(query || "").trim();

    if (!q) {
      setResults([]);
      setError("");
      setLoading(false);
      return;
    }

    let alive = true;

    const timer = setTimeout(async () => {
      setLoading(true);
      setError("");

      try {
        const res = await api.get("/api/products", {
          params: {
            q,
            limit: 12,
            all: 1,
          },
        });

        const raw = normalizeBackendList(res?.data);

        const mapped = uniqBy(raw, (product) => extractProductId(product))
          .map((product) => {
            const productId = extractProductId(product);
            const titleText = extractProductTitle(product);
            const price = extractProductPrice(product);
            const images = extractAllImagesFromProduct(product);
            const colors = extractAllColors(product);

            return {
              raw: product,
              productId,
              title: titleText,
              price,
              image: images[0] || "",
              mainImage: images[0] || "",
              hoverImage: images[1] || images[0] || "",
              colors,
            };
          })
          .filter((item) => item.productId);

        if (!alive) return;
        setResults(mapped);
      } catch (err) {
        console.error("LookProductPicker search error:", err);
        if (!alive) return;
        setResults([]);
        setError("No pude buscar productos en la base de datos.");
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    }, 350);

    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [query]);

  const addResult = (result) => {
    const pid = String(result?.productId || "").trim();
    if (!pid) return;
    if (selectedIds.has(pid)) return;
    if (selectedList.length >= maxItems) return;

    const item = {
      productId: pid,
      title: result?.title || "Producto",
      mainImage: result?.mainImage || result?.image || "",
      hoverImage: result?.hoverImage || result?.mainImage || result?.image || "",
      image: result?.image || result?.mainImage || "",
      price: Number(result?.price || 0) || 0,
      colors: Array.isArray(result?.colors) ? result.colors : [],
    };

    if (typeof onPick === "function") {
      onPick(item, result);
      return;
    }

    onChange?.([...(Array.isArray(selectedList) ? selectedList : []), item]);
  };

  const removeItem = (productId) => {
    const pid = String(productId || "").trim();
    onChange?.(
      selectedList.filter((item) => String(item?.productId || "").trim() !== pid)
    );
  };

  const moveItem = (index, direction) => {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= selectedList.length) return;

    const next = [...selectedList];
    const temp = next[index];
    next[index] = next[nextIndex];
    next[nextIndex] = temp;
    onChange?.(next);
  };

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-4">
      <div className="text-sm font-extrabold text-neutral-900 mb-1">{title}</div>
      <div className="text-sm text-neutral-500 mb-4">
        Busca productos del backend y agrega hasta <b>{maxItems}</b>.
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-2">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por nombre del producto..."
        />
        <Button
          type="button"
          kind="secondary"
          onClick={() => setQuery((prev) => String(prev || "").trim())}
          disabled={loading}
        >
          {loading ? "Buscando..." : "Buscar"}
        </Button>
      </div>

      {error ? <div className="mt-3 text-xs text-rose-700">{error}</div> : null}

      {loading ? (
        <div className="mt-3 text-xs text-neutral-500">Buscando productos…</div>
      ) : null}

      {!!results.length && (
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
          {results.map((result) => {
            const already = selectedIds.has(result.productId);
            const blocked = !already && selectedCount >= maxItems;

            return (
              <div
                key={result.productId}
                className="rounded-xl border border-neutral-200 bg-neutral-50 p-3 flex gap-3"
              >
                <div className="w-16 h-16 rounded-lg border border-neutral-200 bg-white overflow-hidden shrink-0">
                  {result.image ? (
                    <img
                      src={result.image}
                      alt={result.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-[10px] text-neutral-400">
                      Sin imagen
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="text-sm font-bold text-neutral-900 line-clamp-2">
                    {result.title}
                  </div>

                  <div className="text-xs text-neutral-500 mt-1">
                    ID: {result.productId}
                  </div>

                  <div className="text-xs text-neutral-700 mt-1">
                    Precio: {moneyCOP(result.price)}
                  </div>

                  {result.colors.length ? (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {result.colors.slice(0, 6).map((color) => (
                        <span
                          key={`${result.productId}_${color}`}
                          className="w-4 h-4 rounded-full border border-neutral-200"
                          style={{ backgroundColor: color }}
                          title={color}
                        />
                      ))}
                    </div>
                  ) : null}
                </div>

                <div className="shrink-0">
                  <Button
                    type="button"
                    kind={already ? "ghost" : "primary"}
                    disabled={already || blocked}
                    onClick={() => addResult(result)}
                  >
                    {already ? "Agregado" : blocked ? "Límite" : "Agregar"}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-5">
        <div className="text-xs font-bold text-neutral-700 mb-2">
          Seleccionados ({selectedList.length}/{maxItems})
        </div>

        {!selectedList.length ? (
          <div className="text-sm text-neutral-500">Aún no has agregado productos.</div>
        ) : (
          <div className="space-y-2">
            {selectedList.map((item, index) => {
              const pid = String(item?.productId || "").trim();

              return (
                <div
                  key={`${pid}_${index}`}
                  className="rounded-xl border border-neutral-200 bg-white p-3 flex items-center gap-3"
                >
                  <div className="w-14 h-14 rounded-lg border border-neutral-200 bg-neutral-50 overflow-hidden shrink-0">
                    {item?.mainImage || item?.image ? (
                      <img
                        src={item?.mainImage || item?.image}
                        alt={item?.title || pid}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[10px] text-neutral-400">
                        —
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-bold text-neutral-900 line-clamp-1">
                      {item?.title || "Producto"}
                    </div>
                    <div className="text-xs text-neutral-500 line-clamp-1">{pid}</div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      type="button"
                      kind="ghost"
                      size="sm"
                      onClick={() => moveItem(index, -1)}
                    >
                      ↑
                    </Button>
                    <Button
                      type="button"
                      kind="ghost"
                      size="sm"
                      onClick={() => moveItem(index, 1)}
                    >
                      ↓
                    </Button>
                    <Button
                      type="button"
                      kind="ghost"
                      size="sm"
                      onClick={() => removeItem(pid)}
                    >
                      Quitar
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}