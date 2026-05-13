// src/admin/appearance/sections/SectionsPanel.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import api from "../../../lib/api";
import LookSectionUI from "./look/LookSectionUI";
import ComplementosSectionUI from "./complementos/ComplementosSectionUI";
import CategoriasSectionUI from "./categorias/CategoriasSectionUI";
import InstagramSectionUI from "./instagram/InstagramSectionUI";
import TiktokSectionUI from "./tiktok/TiktokSectionUI";
import InfoSectionUI from "./info/infoSectionUI";

import { Button, Field, Input, Toggle } from "./ui/UiComponents";
import {
  DEFAULT_STYLE,
  DEFAULT_TENDENCIA_CONFIG,
  clampNumber,
  buildSectionHref,
  normalizeTendenciaConfig,
} from "./ui/sectionHelpers";

import {
  SectionBadge,
  TabButton,
  ModalShell,
  ColorField,
  CardImageMover,
  getCardTextStyle,
} from "./ui/SectionsPanelUI";

// -----------------------------------------------------------------------------
// ✅ Google Fonts loader (para que las fuentes realmente se vean)
// -----------------------------------------------------------------------------
const GOOGLE_FONTS_HREF =
  "https://fonts.googleapis.com/css2?" +
  [
    "family=Inter:wght@300;400;500;600;700;800;900",
    "family=Poppins:wght@300;400;500;600;700;800;900",
    "family=Montserrat:wght@300;400;500;600;700;800;900",
    "family=Playfair+Display:wght@400;500;600;700;800;900",
    "family=DM+Serif+Display:ital@0;1",
    "family=Cormorant+Garamond:wght@300;400;500;600;700;800;900",
    "family=Lora:wght@300;400;500;600;700",
    "family=Nunito:wght@300;400;500;600;700;800;900",
    "family=Raleway:wght@300;400;500;600;700;800;900",
  ].join("&") +
  "&display=swap";

function ensureGoogleFontsLoaded() {
  try {
    const id = "rb-google-fonts";
    if (document.getElementById(id)) return;
    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href = GOOGLE_FONTS_HREF;
    document.head.appendChild(link);
  } catch (_) {}
}

// -----------------------------------------------------------------------------
// ✅ Lista de fuentes para dropdown (modernas y elegantes)
// -----------------------------------------------------------------------------
const CARD_FONT_OPTIONS = [
  { label: "Usar por defecto", value: "" },

  { label: "Inter (moderna)", value: 'Inter, system-ui, -apple-system, "Segoe UI", sans-serif' },
  { label: "Poppins (moderna)", value: 'Poppins, system-ui, -apple-system, "Segoe UI", sans-serif' },
  { label: "Montserrat (moderna)", value: 'Montserrat, system-ui, -apple-system, "Segoe UI", sans-serif' },
  { label: "Raleway (moderna)", value: 'Raleway, system-ui, -apple-system, "Segoe UI", sans-serif' },
  { label: "Nunito (suave)", value: 'Nunito, system-ui, -apple-system, "Segoe UI", sans-serif' },

  { label: "Playfair Display (elegante)", value: '"Playfair Display", Georgia, serif' },
  { label: "DM Serif Display (elegante)", value: '"DM Serif Display", Georgia, serif' },
  { label: "Cormorant Garamond (lujo)", value: '"Cormorant Garamond", Georgia, serif' },
  { label: "Lora (editorial)", value: '"Lora", Georgia, serif' },
];

// -----------------------------------------------------------------------------
// Catálogo de secciones del sitio
// -----------------------------------------------------------------------------
const SECTION_CATALOG = [
  { id: "tendencia", label: "En tendencia — tendencia" },
  { id: "look", label: "Look — look" },
  { id: "complementos", label: "Complementos — complementos" },
  { id: "categorias", label: "Categorías — categorias" },
  { id: "instagram", label: "Instagram — instagram" },
  { id: "tiktok", label: "TikTok — tiktok" },
  { id: "informacion", label: "Información — informacion" },
  { id: "separador1", label: "Separador 1 — separador1" },
  { id: "separador2", label: "Separador 2 — separador2" },
  { id: "newsletter", label: "Newsletter — newsletter" },
];

// -----------------------------------------------------------------------------
// ✅ Helpers: dinero / descuento
// -----------------------------------------------------------------------------
function moneyCOP(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "$0";
  return `$${Math.round(n).toLocaleString("es-CO")}`;
}

function calcFinalPriceByPercent(price, percent) {
  const p = Number(price);
  const d = Number(percent);
  if (!Number.isFinite(p) || p <= 0) return 0;
  if (!Number.isFinite(d) || d <= 0) return Math.round(p);
  const pct = clampNumber(d, 0, 95);
  const final = p * (1 - pct / 100);
  return Math.max(0, Math.round(final));
}

function normalizeDiscountFields(item) {
  const price = Number(item?.price ?? 0) || 0;
  const hasDiscount = typeof item?.hasDiscount === "boolean" ? item.hasDiscount : false;

  const discountPercentRaw = Number(item?.discountPercent);
  const discountPercent = Number.isFinite(discountPercentRaw)
    ? clampNumber(discountPercentRaw, 0, 95)
    : 0;

  const finalPriceRaw = Number(item?.finalPrice);
  const finalFromItem = Number.isFinite(finalPriceRaw) ? finalPriceRaw : price;

  if (!hasDiscount) {
    return {
      ...item,
      price,
      hasDiscount: false,
      discountPercent: 0,
      finalPrice: price,
    };
  }

  if (discountPercent > 0) {
    return {
      ...item,
      price,
      hasDiscount: true,
      discountPercent,
      finalPrice: calcFinalPriceByPercent(price, discountPercent),
    };
  }

  if (finalFromItem < price && price > 0) {
    const inferred = Math.round(((price - finalFromItem) / price) * 100);
    const safeInf = clampNumber(inferred, 1, 95);
    return {
      ...item,
      price,
      hasDiscount: true,
      discountPercent: safeInf,
      finalPrice: calcFinalPriceByPercent(price, safeInf),
    };
  }

  return {
    ...item,
    price,
    hasDiscount: true,
    discountPercent: 10,
    finalPrice: calcFinalPriceByPercent(price, 10),
  };
}

// -----------------------------------------------------------------------------
// ✅ Normalizador que NO pierde campos del watermark
// -----------------------------------------------------------------------------
function normalizeTendenciaConfigPlus(raw) {
  const src = raw && typeof raw === "object" ? raw : {};
  const base = normalizeTendenciaConfig({
    ...DEFAULT_TENDENCIA_CONFIG,
    ...src,
  });

  const titleImage = typeof src.titleImage === "string" ? src.titleImage : "";
  const watermarkImage = typeof src.watermarkImage === "string" ? src.watermarkImage : "";

  const watermarkSizePx = Number.isFinite(Number(src.watermarkSizePx))
    ? Number(src.watermarkSizePx)
    : 140;
  const watermarkOpacity = Number.isFinite(Number(src.watermarkOpacity))
    ? Number(src.watermarkOpacity)
    : 0.12;

  const posRaw = typeof src.watermarkPosition === "string" ? src.watermarkPosition : "br";
  const watermarkPosition = ["br", "tr", "bl", "tl"].includes(posRaw) ? posRaw : "br";

  const watermarkOffsetXPx = Number.isFinite(Number(src.watermarkOffsetXPx))
    ? Number(src.watermarkOffsetXPx)
    : 0;
  const watermarkOffsetYPx = Number.isFinite(Number(src.watermarkOffsetYPx))
    ? Number(src.watermarkOffsetYPx)
    : 0;

  const watermarkFree = typeof src.watermarkFree === "boolean" ? src.watermarkFree : false;
  const watermarkPosXPct = Number.isFinite(Number(src.watermarkPosXPct))
    ? Number(src.watermarkPosXPct)
    : 88;
  const watermarkPosYPct = Number.isFinite(Number(src.watermarkPosYPct))
    ? Number(src.watermarkPosYPct)
    : 86;
  const watermarkRotateDeg = Number.isFinite(Number(src.watermarkRotateDeg))
    ? Number(src.watermarkRotateDeg)
    : 0;

  return {
    ...base,
    titleImage,
    watermarkImage,
    watermarkSizePx,
    watermarkOpacity,
    watermarkPosition,
    watermarkOffsetXPx,
    watermarkOffsetYPx,
    watermarkFree,
    watermarkPosXPct: clampNumber(watermarkPosXPct, 0, 100),
    watermarkPosYPct: clampNumber(watermarkPosYPct, 0, 100),
    watermarkRotateDeg: clampNumber(watermarkRotateDeg, -180, 180),
  };
}

// -----------------------------------------------------------------------------
// Normalización de datos
// -----------------------------------------------------------------------------
function inferTypeFromId(id) {
  const hit = SECTION_CATALOG.find((s) => s.id === id);
  return hit ? hit.id : id || "tendencia";
}

function inferNameFromId(id) {
  const hit = SECTION_CATALOG.find((s) => s.id === id);
  if (hit) return hit.label.split("—")[0].trim();
  if (!id) return "Sección";
  return id.charAt(0).toUpperCase() + id.slice(1);
}

function normalizeSection(raw, index) {
  const safe = raw && typeof raw === "object" ? raw : {};
  const id =
    (typeof safe.id === "string" && safe.id.trim()) ||
    (typeof safe.type === "string" && safe.type.trim()) ||
    `section_${index + 1}`;

  const type = inferTypeFromId(safe.type || id);
  const name = (typeof safe.name === "string" && safe.name.trim()) || inferNameFromId(id);
  const enabled = typeof safe.enabled === "boolean" ? safe.enabled : true;

  const style = {
    ...DEFAULT_STYLE,
    ...(safe.style && typeof safe.style === "object" ? safe.style : {}),
  };

  let config = safe.config && typeof safe.config === "object" ? safe.config : {};

  if (type === "tendencia") {
    config = normalizeTendenciaConfigPlus({
      ...DEFAULT_TENDENCIA_CONFIG,
      ...config,
    });

    if (Array.isArray(config.products)) {
      config = {
        ...config,
        products: config.products.map((p) => normalizeDiscountFields(p)),
      };
    }
  }

  return { id, type, name, enabled, style, config };
}

function normalizeSectionsArray(theme) {
  const list = theme && theme.sections && Array.isArray(theme.sections) ? theme.sections : [];

  if (!list.length) {
    return [
      normalizeSection(
        {
          id: "tendencia",
          type: "tendencia",
          name: "En tendencia",
          config: DEFAULT_TENDENCIA_CONFIG,
        },
        0
      ),
    ];
  }

  return list.map((s, idx) => normalizeSection(s, idx));
}

// -----------------------------------------------------------------------------
// Helpers internos
// -----------------------------------------------------------------------------
function cloneSections(sections) {
  return sections.map((sec) => {
    const base = {
      ...sec,
      style: { ...sec.style },
      config:
        sec.type === "tendencia"
          ? normalizeTendenciaConfigPlus(sec.config)
          : { ...(sec.config || {}) },
    };

    if (base.type === "tendencia") {
      const cfg = normalizeTendenciaConfigPlus(base.config);
      const products = Array.isArray(cfg.products)
        ? cfg.products.map((p) => normalizeDiscountFields(p))
        : [];
      return { ...base, config: { ...cfg, products } };
    }

    return base;
  });
}

function extractAllImagesFromProduct(product) {
  if (!product || typeof product !== "object") return [];
  const images = new Set();

  if (typeof product.image === "string" && product.image.trim()) images.add(product.image.trim());

  if (Array.isArray(product.images)) {
    for (const img of product.images) {
      if (typeof img === "string" && img.trim()) images.add(img.trim());
      else if (img && typeof img === "object" && typeof img.url === "string" && img.url.trim()) {
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
        if (typeof g === "string" && g.trim()) images.add(g.trim());
        else if (g && typeof g === "object" && typeof g.url === "string" && g.url.trim()) {
          images.add(g.url.trim());
        }
      }
    }
  }

  if (typeof product.image1 === "string" && product.image1.trim()) images.add(product.image1.trim());
  if (typeof product.image2 === "string" && product.image2.trim()) images.add(product.image2.trim());

  return Array.from(images);
}

function buildTendenciaProductFromBackend(product) {
  if (!product || typeof product !== "object") return null;

  const images = extractAllImagesFromProduct(product);
  if (!images.length) return null;

  const price = Number(product.price ?? 0) || 0;

  const backendFinal = Number(product.finalPrice);
  const hasBackendFinal = Number.isFinite(backendFinal) && backendFinal > 0;
  const finalPrice = hasBackendFinal ? backendFinal : price;

  const base = {
    productId: String(product._id || product.id || ""),
    name: String(product.title || product.name || "").trim(),
    images,
    mainImage: images[0],
    hoverImage: images[1] || images[0],
    price,
    finalPrice,
    hasDiscount: false,
    discountPercent: 0,
  };

  const withBackendDiscount =
    price > 0 && finalPrice > 0 && finalPrice < price
      ? { ...base, hasDiscount: true, finalPrice }
      : base;

  return normalizeDiscountFields(withBackendDiscount);
}

// -----------------------------------------------------------------------------
// Tabs
// -----------------------------------------------------------------------------
function BasicTab({ section, onChange }) {
  const href = buildSectionHref(section.id);

  const handleTypeChange = (value) => {
    const found = SECTION_CATALOG.find((s) => s.id === value);
    onChange({
      type: value,
      name: found ? found.label.split("—")[0].trim() : section.name,
      config: value === "tendencia" ? normalizeTendenciaConfigPlus(section.config) : section.config || {},
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="text-xs text-neutral-500">
          <div>
            Editando: <b>{section.id}</b>
          </div>
          <div>Los cambios se guardan en theme.sections</div>
        </div>
        <SectionBadge enabled={section.enabled} supported />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Tipo de sección" hint="Solo categorías diseñadas" name="type">
          <select
            className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm"
            value={section.type}
            onChange={(e) => handleTypeChange(e.target.value)}
          >
            {SECTION_CATALOG.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Nombre interno" hint="Cómo lo ves en el panel" name="name">
          <Input
            value={section.name}
            onChange={(e) => onChange({ name: e.target.value })}
            placeholder="Ej: En tendencia"
          />
        </Field>

        <Field label="ID" hint="Fijo (no editable)" name="id">
          <Input value={section.id} readOnly />
        </Field>

        <Field label="Link de sección (ancla)" hint="Para botones del sitio" name="href">
          <div className="flex gap-2">
            <Input value={href} readOnly />
          </div>
        </Field>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[1fr,auto] items-center gap-4">
        <Field label="Título" hint="Visible (opcional)" name="config.title">
          <Input
            value={section.config?.title || ""}
            onChange={(e) => onChange({ config: { ...section.config, title: e.target.value } })}
            placeholder="EN TENDENCIA"
          />
        </Field>

        <Field label="Subtítulo / descripción" hint="Visible (opcional)" name="config.subtitle">
          <Input
            value={section.config?.subtitle || ""}
            onChange={(e) => onChange({ config: { ...section.config, subtitle: e.target.value } })}
            placeholder="Lo más vendido hoy"
          />
        </Field>
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-neutral-200 mt-4">
        <div className="text-xs text-neutral-500">
          Nota: este panel solo edita <code>theme.sections</code>. El guardado real lo hace el botón de “Guardar cambios”.
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-neutral-600">Activa</span>
          <Toggle checked={!!section.enabled} onChange={(checked) => onChange({ enabled: !!checked })} />
        </div>
      </div>
    </div>
  );
}

function ImageTab({ section, onChange, uploadToCloudinary, uploading }) {
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
            <label className="inline-flex items-center px-3 py-2 rounded-xl bg-neutral-900 text-white text-xs font-medium cursor-pointer shadow-sm hover:bg-neutral-800 transition">
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
              <label className="inline-flex items-center px-3 py-2 rounded-xl bg-neutral-900 text-white text-xs font-medium cursor-pointer shadow-sm hover:bg-neutral-800 transition">
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

function StylesTab({ section, onChange }) {
  const st = section.style || DEFAULT_STYLE;

  const patchStyle = (partial) => {
    onChange({ style: { ...st, ...partial } });
  };

  const cardTextStyle = getCardTextStyle(st);

  const buildInlineStyle = (prefix) => {
    const s = {};

    const fontFamily = typeof st?.[`${prefix}FontFamily`] === "string" ? st[`${prefix}FontFamily`].trim() : "";
    const color = typeof st?.[`${prefix}Color`] === "string" ? st[`${prefix}Color`].trim() : "";
    const sizePx = Number.isFinite(Number(st?.[`${prefix}SizePx`])) ? Number(st[`${prefix}SizePx`]) : 0;
    const weight = Number.isFinite(Number(st?.[`${prefix}Weight`])) ? Number(st[`${prefix}Weight`]) : 0;
    const italic = typeof st?.[`${prefix}Italic`] === "boolean" ? st[`${prefix}Italic`] : false;
    const underline = typeof st?.[`${prefix}Underline`] === "boolean" ? st[`${prefix}Underline`] : false;

    if (fontFamily) s.fontFamily = fontFamily;
    if (color) s.color = color;
    if (sizePx > 0) s.fontSize = sizePx;
    if (weight > 0) s.fontWeight = weight;
    if (italic) s.fontStyle = "italic";
    if (underline) s.textDecoration = "underline";

    return Object.keys(s).length ? s : undefined;
  };

  const FieldStyleEditor = ({ title, prefix, defaultSize = 12, sizeMin = 10, sizeMax = 32, weightDefault = 700 }) => {
    const inline = buildInlineStyle(prefix);

    const currentFont = typeof st?.[`${prefix}FontFamily`] === "string" ? st[`${prefix}FontFamily`] : "";
    const currentColor = typeof st?.[`${prefix}Color`] === "string" ? st[`${prefix}Color`] : "";
    const currentSize = Number.isFinite(Number(st?.[`${prefix}SizePx`])) ? Number(st[`${prefix}SizePx`]) : defaultSize;
    const currentWeight = Number.isFinite(Number(st?.[`${prefix}Weight`])) ? Number(st[`${prefix}Weight`]) : weightDefault;
    const currentItalic = typeof st?.[`${prefix}Italic`] === "boolean" ? st[`${prefix}Italic`] : false;
    const currentUnderline = typeof st?.[`${prefix}Underline`] === "boolean" ? st[`${prefix}Underline`] : false;

    return (
      <div className="rounded-2xl border border-neutral-200 bg-white p-4">
        <div className="text-sm font-semibold text-neutral-900 mb-2">{title}</div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field label="Fuente" name={`style.${prefix}FontFamily`}>
            <select
              className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm"
              value={currentFont || ""}
              onChange={(e) => patchStyle({ [`${prefix}FontFamily`]: e.target.value })}
            >
              {CARD_FONT_OPTIONS.map((opt) => (
                <option key={opt.label} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Tamaño (px)" name={`style.${prefix}SizePx`} hint={`${sizeMin}–${sizeMax}`}>
            <Input
              type="number"
              min={sizeMin}
              max={sizeMax}
              value={currentSize}
              onChange={(e) =>
                patchStyle({
                  [`${prefix}SizePx`]: clampNumber(Number(e.target.value) || defaultSize, sizeMin, sizeMax),
                })
              }
            />
          </Field>

          <Field label="Peso (negrita)" name={`style.${prefix}Weight`} hint="200–900">
            <Input
              type="number"
              min={200}
              max={900}
              value={currentWeight}
              onChange={(e) =>
                patchStyle({
                  [`${prefix}Weight`]: clampNumber(Number(e.target.value) || weightDefault, 200, 900),
                })
              }
            />
          </Field>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-4">
          <ColorField
            label="Color"
            value={currentColor || ""}
            onChange={(value) => patchStyle({ [`${prefix}Color`]: value })}
          />

          <div className="flex items-center gap-4">
            <label className="inline-flex items-center gap-2 text-xs text-neutral-700">
              <input
                type="checkbox"
                className="h-3 w-3 rounded border-neutral-300"
                checked={!!currentItalic}
                onChange={(e) => patchStyle({ [`${prefix}Italic`]: !!e.target.checked })}
              />
              Cursiva
            </label>
            <label className="inline-flex items-center gap-2 text-xs text-neutral-700">
              <input
                type="checkbox"
                className="h-3 w-3 rounded border-neutral-300"
                checked={!!currentUnderline}
                onChange={(e) => patchStyle({ [`${prefix}Underline`]: !!e.target.checked })}
              />
              Subrayado
            </label>
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-dashed border-neutral-200 bg-neutral-50 px-3 py-2 text-xs">
          <div className="text-[11px] text-neutral-500 mb-1">Preview</div>
          <div className="text-sm" style={inline}>
            {title} — ejemplo
          </div>
        </div>
      </div>
    );
  };

  const cfg = section.type === "tendencia" ? normalizeTendenciaConfigPlus(section.config) : section.config || {};
  const cardFields = cfg?.cardFields && typeof cfg.cardFields === "object" ? cfg.cardFields : {};

  const patchCardFields = (partial) => {
    if (section.type !== "tendencia") return;
    onChange({
      config: {
        ...cfg,
        cardFields: {
          ...cardFields,
          ...partial,
        },
      },
    });
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-neutral-200 bg-white p-4">
        <div className="text-sm font-semibold text-neutral-900 mb-2">Texto dentro de Cards (general)</div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field label="Fuente (texto cards)" name="style.cardTextFontFamily">
            <select
              className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm"
              value={st.cardTextFontFamily || ""}
              onChange={(e) => patchStyle({ cardTextFontFamily: e.target.value })}
            >
              {CARD_FONT_OPTIONS.map((opt) => (
                <option key={opt.label} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Tamaño texto cards (px)" name="style.cardTextSizePx" hint="10–32">
            <Input
              type="number"
              min={10}
              max={32}
              value={st.cardTextSizePx ?? 15}
              onChange={(e) =>
                patchStyle({ cardTextSizePx: clampNumber(Number(e.target.value) || 15, 10, 32) })
              }
            />
          </Field>

          <Field label="Peso (negrita) texto cards" name="style.cardTextWeight" hint="200–900">
            <Input
              type="number"
              min={200}
              max={900}
              value={st.cardTextWeight ?? 700}
              onChange={(e) =>
                patchStyle({ cardTextWeight: clampNumber(Number(e.target.value) || 700, 200, 900) })
              }
            />
          </Field>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-4">
          <ColorField
            label="Color texto cards"
            value={st.cardTextColor || ""}
            onChange={(value) => patchStyle({ cardTextColor: value })}
          />

          <div className="flex items-center gap-4">
            <label className="inline-flex items-center gap-2 text-xs text-neutral-700">
              <input
                type="checkbox"
                className="h-3 w-3 rounded border-neutral-300"
                checked={!!st.cardTextItalic}
                onChange={(e) => patchStyle({ cardTextItalic: !!e.target.checked })}
              />
              Cursiva
            </label>
            <label className="inline-flex items-center gap-2 text-xs text-neutral-700">
              <input
                type="checkbox"
                className="h-3 w-3 rounded border-neutral-300"
                checked={!!st.cardTextUnderline}
                onChange={(e) => patchStyle({ cardTextUnderline: !!e.target.checked })}
              />
              Subrayado
            </label>
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-dashed border-neutral-200 bg-neutral-50 px-3 py-2 text-xs">
          <div className="text-[11px] text-neutral-500 mb-1">Preview (texto de card)</div>
          <div className="text-sm" style={cardTextStyle}>
            Título de card
          </div>
          <div className="text-xs" style={cardTextStyle}>
            Subtítulo de card / descripción
          </div>
          <div className="text-xs mt-1" style={cardTextStyle}>
            Precio: $111.111 — Tallas: 6 / 8
          </div>
        </div>
      </div>

      <FieldStyleEditor title="Título del producto (cardTitle*)" prefix="cardTitle" defaultSize={12} sizeMin={10} sizeMax={20} weightDefault={800} />
      <FieldStyleEditor title="Precio (cardPrice*)" prefix="cardPrice" defaultSize={14} sizeMin={10} sizeMax={22} weightDefault={800} />
      <FieldStyleEditor title="Atributos: Tallas / Colores (cardMeta*)" prefix="cardMeta" defaultSize={11} sizeMin={9} sizeMax={18} weightDefault={700} />
      <FieldStyleEditor title="Descripción / Features (cardDesc*)" prefix="cardDesc" defaultSize={11} sizeMin={9} sizeMax={18} weightDefault={600} />

      {section.type === "tendencia" ? (
        <div className="rounded-2xl border border-neutral-200 bg-white p-4 space-y-3">
          <div className="text-sm font-semibold text-neutral-900">Qué mostrar en el card (Tendencia)</div>
          <div className="text-xs text-neutral-500">
            Esto se guarda en <code>config.cardFields</code> y lo lee el frontend para mostrar/ocultar bloques.
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="flex items-center justify-between gap-3 rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2">
              <span className="text-xs text-neutral-700">Mostrar Tallas</span>
              <Toggle
                checked={typeof cardFields.showSizes === "boolean" ? cardFields.showSizes : true}
                onChange={(v) => patchCardFields({ showSizes: !!v })}
              />
            </label>

            <label className="flex items-center justify-between gap-3 rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2">
              <span className="text-xs text-neutral-700">Mostrar Colores</span>
              <Toggle
                checked={typeof cardFields.showColors === "boolean" ? cardFields.showColors : true}
                onChange={(v) => patchCardFields({ showColors: !!v })}
              />
            </label>

            <label className="flex items-center justify-between gap-3 rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2">
              <span className="text-xs text-neutral-700">Mostrar Features</span>
              <Toggle
                checked={typeof cardFields.showFeatures === "boolean" ? cardFields.showFeatures : true}
                onChange={(v) => patchCardFields({ showFeatures: !!v })}
              />
            </label>

            <label className="flex items-center justify-between gap-3 rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2">
              <span className="text-xs text-neutral-700">Mostrar Descripción</span>
              <Toggle
                checked={typeof cardFields.showDescription === "boolean" ? cardFields.showDescription : true}
                onChange={(v) => patchCardFields({ showDescription: !!v })}
              />
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="Máximo tallas a mostrar" hint="2–20 (para evitar chorizo)" name="config.cardFields.maxSizesToShow">
              <Input
                type="number"
                min={2}
                max={20}
                value={Number.isFinite(Number(cardFields.maxSizesToShow)) ? Number(cardFields.maxSizesToShow) : 6}
                onChange={(e) => patchCardFields({ maxSizesToShow: clampNumber(Number(e.target.value) || 6, 2, 20) })}
              />
            </Field>
          </div>
        </div>
      ) : null}

      <div className="rounded-2xl border border-neutral-200 bg-white p-4 space-y-4">
        <div className="text-sm font-semibold text-neutral-900 mb-1">Estilos (sección)</div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <ColorField label="Fondo" value={st.bgColor} onChange={(value) => patchStyle({ bgColor: value })} />
          <ColorField label="Texto" value={st.textColor} onChange={(value) => patchStyle({ textColor: value })} />
          <ColorField label="Acento" value={st.accentColor} onChange={(value) => patchStyle({ accentColor: value })} />

          <Field label="Título (px)" name="style.titleSizePx" hint="18–96">
            <Input
              type="number"
              min={18}
              max={96}
              value={st.titleSizePx}
              onChange={(e) =>
                patchStyle({ titleSizePx: clampNumber(Number(e.target.value) || st.titleSizePx, 18, 96) })
              }
            />
          </Field>

          <Field label="Peso título" name="style.titleWeight" hint="200–900">
            <Input
              type="number"
              min={200}
              max={900}
              value={st.titleWeight}
              onChange={(e) =>
                patchStyle({ titleWeight: clampNumber(Number(e.target.value) || st.titleWeight, 200, 900) })
              }
            />
          </Field>

          <Field label="Peso subtítulo" name="style.subtitleWeight" hint="200–900">
            <Input
              type="number"
              min={200}
              max={900}
              value={st.subtitleWeight}
              onChange={(e) =>
                patchStyle({ subtitleWeight: clampNumber(Number(e.target.value) || st.subtitleWeight, 200, 900) })
              }
            />
          </Field>

          <Field label="Subtítulo (px)" name="style.subtitleSizePx" hint="10–40">
            <Input
              type="number"
              min={10}
              max={40}
              value={st.subtitleSizePx}
              onChange={(e) =>
                patchStyle({ subtitleSizePx: clampNumber(Number(e.target.value) || st.subtitleSizePx, 10, 40) })
              }
            />
          </Field>

          <Field label="Radio cards (px)" name="style.cardRadiusPx" hint="0–60">
            <Input
              type="number"
              min={0}
              max={60}
              value={st.cardRadiusPx}
              onChange={(e) =>
                patchStyle({ cardRadiusPx: clampNumber(Number(e.target.value) || st.cardRadiusPx, 0, 60) })
              }
            />
          </Field>

          <Field label="Alto imagen items (px)" name="style.imageHeightPx" hint="160–500">
            <Input
              type="number"
              min={160}
              max={500}
              value={st.imageHeightPx}
              onChange={(e) =>
                patchStyle({ imageHeightPx: clampNumber(Number(e.target.value) || st.imageHeightPx, 160, 500) })
              }
            />
          </Field>

          <Field label="Espaciado (px)" name="style.spacingPx" hint="0–60">
            <Input
              type="number"
              min={0}
              max={60}
              value={st.spacingPx}
              onChange={(e) =>
                patchStyle({ spacingPx: clampNumber(Number(e.target.value) || st.spacingPx, 0, 60) })
              }
            />
          </Field>
        </div>
      </div>
    </div>
  );
}

function ProductsTab({ section, onChange, uploadToCloudinary }) {
  const cfgRaw = normalizeTendenciaConfigPlus(section.config);

  const cfg = useMemo(() => {
    const products = Array.isArray(cfgRaw.products) ? cfgRaw.products.map((p) => normalizeDiscountFields(p)) : [];
    return { ...cfgRaw, products };
  }, [cfgRaw]);

  const [search, setSearch] = useState("");
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
          params: { all: 1, q, limit: 24 },
        });

        const list = Array.isArray(data) ? data : [];
        const mapped = list.map((p) => buildTendenciaProductFromBackend(p)).filter(Boolean);

        if (!alive) return;
        setResults(mapped);
      } catch (e) {
        console.error("Error buscando productos para tendencia:", e);
        if (!alive) return;
        setResults([]);
        setError("No pude buscar productos. Revisa /api/products?all=1&q=...");
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
  };

  const handleRemoveProduct = (productId) => {
    patchConfig({
      products: (cfg.products || []).filter((p) => p.productId !== productId),
    });
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

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-neutral-200 bg-white p-4 space-y-4">
        <div className="text-sm font-semibold text-neutral-900">Productos en tendencia (desde BD)</div>
        <div className="text-xs text-neutral-500">
          Escribe las iniciales del producto y te aparecen resultados con vista previa. Luego eliges foto Principal y Hover.
          <br />
          ✅ Ahora también puedes <b>activar descuento</b> y poner el <b>%</b> por cada producto.
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Máximo de productos" hint="Ej: 4" name="config.maxItems">
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

          <Field label="Buscar producto" hint="Escribe: vestido, zapato, etc." name="productSearch">
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
                    ID: <span className="font-mono">{p.productId}</span>
                  </div>

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
        <div className="text-xs font-semibold text-neutral-900">Productos seleccionados</div>
        <div className="text-[11px] text-neutral-500">
          Selecciona foto Principal y Hover. Se guarda en: <b> config.products[i].mainImage</b> y <b>config.products[i].hoverImage</b>
          <br />
          ✅ Descuento por producto: <b>config.products[i].hasDiscount</b> y <b>config.products[i].discountPercent</b> (y se calcula <b>finalPrice</b>).
        </div>

        {!cfg.products?.length ? <div className="text-xs text-neutral-500">Aún no has seleccionado productos para esta sección.</div> : null}

        {cfg.products?.map((itemRaw) => {
          const item = normalizeDiscountFields(itemRaw);

          return (
            <div key={item.productId} className="border border-neutral-200 rounded-xl p-3 bg-neutral-50">
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-neutral-900 line-clamp-2">
                    {item.name || "Producto"} <span className="text-[11px] text-neutral-500 font-mono">({item.productId})</span>
                  </div>

                  <div className="mt-3 rounded-xl border border-neutral-200 bg-white p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-[11px] text-neutral-600">
                        <b>Precio base:</b> <span className="font-mono">{moneyCOP(item.price)}</span>
                        {item.hasDiscount ? (
                          <>
                            {" "}
                            — <b>Final:</b> <span className="font-mono">{moneyCOP(item.finalPrice)}</span>{" "}
                            <span className="text-rose-700 font-semibold">(-{Number(item.discountPercent || 0)}%)</span>
                          </>
                        ) : null}
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-neutral-600">Descuento</span>
                        <Toggle checked={!!item.hasDiscount} onChange={(v) => handleChangeDiscount(item.productId, { hasDiscount: !!v })} />
                      </div>
                    </div>

                    {item.hasDiscount ? (
                      <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
                        <Field label="Descuento (%)" hint="1–95" name={`products.${item.productId}.discountPercent`}>
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

                        <Field label="Precio final (auto)" hint="Se calcula" name={`products.${item.productId}.finalPrice`}>
                          <Input value={moneyCOP(item.finalPrice)} readOnly />
                        </Field>

                        <Field label="Precio tachado (auto)" hint="Es el precio base" name={`products.${item.productId}.price`}>
                          <Input value={moneyCOP(item.price)} readOnly />
                        </Field>
                      </div>
                    ) : (
                      <div className="mt-2 text-[11px] text-neutral-500">Descuento apagado: se mostrará solo el precio normal.</div>
                    )}
                  </div>

                  <div className="mt-3 grid grid-cols-1 md:grid-cols-[auto,1fr] gap-3">
                    <div className="flex flex-col gap-2">
                      <div className="text-[11px] text-neutral-500">Principal (mainImage)</div>
                      <div className="rounded-lg border border-neutral-300 overflow-hidden h-24 w-24 bg-white flex items-center justify-center">
                        {item.mainImage ? <img src={item.mainImage} alt="Principal" className="h-full w-full object-cover" /> : <span className="text-[11px] text-neutral-400">Sin imagen</span>}
                      </div>

                      <div className="text-[11px] text-neutral-500">Hover (hoverImage)</div>
                      <div className="rounded-lg border border-neutral-300 overflow-hidden h-24 w-24 bg-white flex items-center justify-center">
                        {item.hoverImage ? <img src={item.hoverImage} alt="Hover" className="h-full w-full object-cover" /> : <span className="text-[11px] text-neutral-400">Sin imagen</span>}
                      </div>
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

function PreviewTab({ section }) {
  const st = section.style || DEFAULT_STYLE;
  const cfgRaw = normalizeTendenciaConfigPlus(section.config);

  const cfg = useMemo(() => {
    const products = Array.isArray(cfgRaw.products) ? cfgRaw.products.map((p) => normalizeDiscountFields(p)) : [];
    return { ...cfgRaw, products };
  }, [cfgRaw]);

  const cardStyle = {
    borderRadius: `${st.cardRadiusPx ?? 18}px`,
    background: "#f3f3f3",
    padding: "12px",
  };

  const cardTextStyle = getCardTextStyle(st);

  const inlineTitle = (() => {
    const s = {};
    const f = typeof st?.cardTitleFontFamily === "string" ? st.cardTitleFontFamily.trim() : "";
    const c = typeof st?.cardTitleColor === "string" ? st.cardTitleColor.trim() : "";
    const sz = Number.isFinite(Number(st?.cardTitleSizePx)) ? Number(st.cardTitleSizePx) : 0;
    const w = Number.isFinite(Number(st?.cardTitleWeight)) ? Number(st.cardTitleWeight) : 0;
    const it = typeof st?.cardTitleItalic === "boolean" ? st.cardTitleItalic : false;
    const un = typeof st?.cardTitleUnderline === "boolean" ? st.cardTitleUnderline : false;
    if (f) s.fontFamily = f;
    if (c) s.color = c;
    if (sz > 0) s.fontSize = sz;
    if (w > 0) s.fontWeight = w;
    if (it) s.fontStyle = "italic";
    if (un) s.textDecoration = "underline";
    return Object.keys(s).length ? s : cardTextStyle;
  })();

  const inlinePrice = (() => {
    const s = {};
    const f = typeof st?.cardPriceFontFamily === "string" ? st.cardPriceFontFamily.trim() : "";
    const c = typeof st?.cardPriceColor === "string" ? st.cardPriceColor.trim() : "";
    const sz = Number.isFinite(Number(st?.cardPriceSizePx)) ? Number(st.cardPriceSizePx) : 0;
    const w = Number.isFinite(Number(st?.cardPriceWeight)) ? Number(st.cardPriceWeight) : 0;
    const it = typeof st?.cardPriceItalic === "boolean" ? st.cardPriceItalic : false;
    const un = typeof st?.cardPriceUnderline === "boolean" ? st.cardPriceUnderline : false;
    if (f) s.fontFamily = f;
    if (c) s.color = c;
    if (sz > 0) s.fontSize = sz;
    if (w > 0) s.fontWeight = w;
    if (it) s.fontStyle = "italic";
    if (un) s.textDecoration = "underline";
    return Object.keys(s).length ? s : cardTextStyle;
  })();

  const inlineMeta = (() => {
    const s = {};
    const f = typeof st?.cardMetaFontFamily === "string" ? st.cardMetaFontFamily.trim() : "";
    const c = typeof st?.cardMetaColor === "string" ? st.cardMetaColor.trim() : "";
    const sz = Number.isFinite(Number(st?.cardMetaSizePx)) ? Number(st.cardMetaSizePx) : 0;
    const w = Number.isFinite(Number(st?.cardMetaWeight)) ? Number(st.cardMetaWeight) : 0;
    const it = typeof st?.cardMetaItalic === "boolean" ? st.cardMetaItalic : false;
    const un = typeof st?.cardMetaUnderline === "boolean" ? st.cardMetaUnderline : false;
    if (f) s.fontFamily = f;
    if (c) s.color = c;
    if (sz > 0) s.fontSize = sz;
    if (w > 0) s.fontWeight = w;
    if (it) s.fontStyle = "italic";
    if (un) s.textDecoration = "underline";
    return Object.keys(s).length ? s : cardTextStyle;
  })();

  const inlineDesc = (() => {
    const s = {};
    const f = typeof st?.cardDescFontFamily === "string" ? st.cardDescFontFamily.trim() : "";
    const c = typeof st?.cardDescColor === "string" ? st.cardDescColor.trim() : "";
    const sz = Number.isFinite(Number(st?.cardDescSizePx)) ? Number(st.cardDescSizePx) : 0;
    const w = Number.isFinite(Number(st?.cardDescWeight)) ? Number(st.cardDescWeight) : 0;
    const it = typeof st?.cardDescItalic === "boolean" ? st.cardDescItalic : false;
    const un = typeof st?.cardDescUnderline === "boolean" ? st.cardDescUnderline : false;
    if (f) s.fontFamily = f;
    if (c) s.color = c;
    if (sz > 0) s.fontSize = sz;
    if (w > 0) s.fontWeight = w;
    if (it) s.fontStyle = "italic";
    if (un) s.textDecoration = "underline";
    return Object.keys(s).length ? s : cardTextStyle;
  })();

  const fields = cfg?.cardFields && typeof cfg.cardFields === "object" ? cfg.cardFields : {};
  const showSizes = typeof fields.showSizes === "boolean" ? fields.showSizes : true;
  const showColors = typeof fields.showColors === "boolean" ? fields.showColors : true;
  const showFeatures = typeof fields.showFeatures === "boolean" ? fields.showFeatures : true;
  const showDescription = typeof fields.showDescription === "boolean" ? fields.showDescription : true;

  const wm = {
    image: typeof cfg.watermarkImage === "string" && cfg.watermarkImage.trim() ? cfg.watermarkImage.trim() : "/icons/ROSA.png",
    sizePx: clampNumber(Number(cfg.watermarkSizePx ?? 140) || 140, 40, 320),
    opacity: clampNumber(Number(cfg.watermarkOpacity ?? 0.12) || 0.12, 0, 1),
    free: !!cfg.watermarkFree,
    xPct: clampNumber(Number(cfg.watermarkPosXPct ?? 88) || 88, 0, 100),
    yPct: clampNumber(Number(cfg.watermarkPosYPct ?? 86) || 86, 0, 100),
    rot: clampNumber(Number(cfg.watermarkRotateDeg ?? 0) || 0, -180, 180),
    pos: ["br", "tr", "bl", "tl"].includes(cfg.watermarkPosition) ? cfg.watermarkPosition : "br",
    offX: clampNumber(Number(cfg.watermarkOffsetXPx ?? 0) || 0, -60, 120),
    offY: clampNumber(Number(cfg.watermarkOffsetYPx ?? 0) || 0, -60, 120),
  };

  const wmCornerStyle = (() => {
    const basePad = 10;
    const x = basePad + (wm.offX ?? 0);
    const y = basePad + (wm.offY ?? 0);

    if (wm.pos === "tr") return { right: x, top: y };
    if (wm.pos === "bl") return { left: x, bottom: y };
    if (wm.pos === "tl") return { left: x, top: y };
    return { right: x, bottom: y };
  })();

  return (
    <div className="space-y-4">
      <div className="text-sm font-semibold text-neutral-900">Vista previa (admin)</div>
      <div className="text-xs text-neutral-500 mb-2">Esta preview es solo del panel admin. ✅ Aquí ya debe verse el <b>descuento</b> si lo activas.</div>

      <div className="rounded-2xl p-4" style={{ backgroundColor: st.bgColor, color: st.textColor }}>
        <div
          className="font-semibold tracking-wide mb-1"
          style={{
            fontSize: st.titleSizePx,
            fontWeight: st.titleWeight,
            color: st.accentColor || st.textColor,
          }}
        >
          {section.config?.title || "EN TENDENCIA"}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {(cfg.products || []).slice(0, cfg.maxItems || 4).map((itemRaw) => {
            const item = normalizeDiscountFields(itemRaw);

            return (
              <div key={item.productId} style={cardStyle}>
                <div className="h-40 rounded-xl overflow-hidden bg-white mb-2 relative">
                  {item.mainImage ? (
                    <img src={item.mainImage} alt={item.name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center text-[11px] text-neutral-400">Sin imagen</div>
                  )}

                  {wm.image ? (
                    <img
                      src={wm.image}
                      alt=""
                      draggable={false}
                      className="absolute pointer-events-none select-none"
                      style={{
                        width: wm.sizePx,
                        height: "auto",
                        opacity: wm.opacity,
                        transform: wm.free ? `translate(-50%, -50%) rotate(${wm.rot}deg)` : `rotate(${wm.rot}deg)`,
                        ...(wm.free
                          ? { left: `${wm.xPct}%`, top: `${wm.yPct}%` }
                          : { ...wmCornerStyle }),
                      }}
                    />
                  ) : null}

                  {item.hasDiscount ? (
                    <div className="absolute top-2 left-2 rounded-full bg-rose-600 text-white text-[10px] font-semibold px-2 py-1 shadow">
                      -{Number(item.discountPercent || 0)}%
                    </div>
                  ) : null}
                </div>

                <div className="text-xs font-semibold" style={inlineTitle}>
                  {item.name || "Producto sin nombre"}
                </div>

                <div className="text-[11px] mt-1" style={inlinePrice}>
                  {item.hasDiscount ? (
                    <div className="flex items-center gap-2 flex-wrap">
                      <span>{moneyCOP(item.finalPrice)} COP</span>
                      <span className="line-through text-neutral-400">{moneyCOP(item.price)}</span>
                    </div>
                  ) : (
                    <span>{moneyCOP(item.price)} COP</span>
                  )}
                </div>

                {showSizes || showColors ? (
                  <div className="text-[10px] mt-2" style={inlineMeta}>
                    {showSizes ? "Tallas: 2 / 4 / 6 / 8" : null}
                    {showSizes && showColors ? " — " : null}
                    {showColors ? "Colores: 3" : null}
                  </div>
                ) : null}

                {showFeatures ? (
                  <div className="text-[10px] mt-2" style={inlineDesc}>
                    • Popelina • Suave • Edición limitada
                  </div>
                ) : null}

                {showDescription ? (
                  <div className="text-[10px] mt-2" style={inlineDesc}>
                    Vestido corto color amarillo estampado (ejemplo).
                  </div>
                ) : null}
              </div>
            );
          })}

          {!(cfg.products || []).length ? (
            <div className="rounded-xl border border-dashed border-neutral-300 bg-neutral-50 px-4 py-3 text-xs text-neutral-500" style={cardStyle}>
              Aún no hay productos en tendencia configurados.
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Componente principal
// -----------------------------------------------------------------------------
export default function SectionsPanel({ theme, setPath, uploading, setUploading, uploadToCloudinary }) {
  const initialSections = useMemo(() => normalizeSectionsArray(theme || {}), [theme]);

  const [sections, setSections] = useState(() => cloneSections(initialSections));
  const [editingId, setEditingId] = useState(null);
  const [activeTab, setActiveTab] = useState("basic");

  const pushTimerRef = useRef(null);
  const lastIncomingFromThemeRef = useRef(JSON.stringify(initialSections));
  const lastPushedToParentRef = useRef(JSON.stringify(initialSections));

  useEffect(() => {
    ensureGoogleFontsLoaded();
  }, []);

  useEffect(() => {
    return () => {
      if (pushTimerRef.current) {
        clearTimeout(pushTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const normalizedIncoming = normalizeSectionsArray(theme || {});
    const incomingSerialized = JSON.stringify(normalizedIncoming);

    if (incomingSerialized === lastIncomingFromThemeRef.current) return;

    lastIncomingFromThemeRef.current = incomingSerialized;

    if (incomingSerialized === lastPushedToParentRef.current) return;

    if (editingId) return;

    setSections(cloneSections(normalizedIncoming));
  }, [theme, editingId]);

  useEffect(() => {
    if (typeof setPath !== "function") return;

    const normalizedForParent = sections.map((sec, idx) => normalizeSection(sec, idx));
    const serialized = JSON.stringify(normalizedForParent);

    if (serialized === lastPushedToParentRef.current) return;

    if (pushTimerRef.current) {
      clearTimeout(pushTimerRef.current);
    }

    pushTimerRef.current = setTimeout(() => {
      lastPushedToParentRef.current = serialized;
      lastIncomingFromThemeRef.current = serialized;
      setPath("sections", normalizedForParent);
    }, 120);

    return () => {
      if (pushTimerRef.current) {
        clearTimeout(pushTimerRef.current);
      }
    };
  }, [sections, setPath]);

  const selected = useMemo(() => sections.find((s) => s.id === editingId) || null, [sections, editingId]);

  const isLookSection = useMemo(() => {
    if (!selected) return false;
    return selected.id === "look" || selected.type === "look";
  }, [selected]);

  const isComplementosSection = useMemo(() => {
    if (!selected) return false;
    return selected.id === "complementos" || selected.type === "complementos";
  }, [selected]);

  const isCategoriasSection = useMemo(() => {
    if (!selected) return false;
    return selected.id === "categorias" || selected.type === "categorias";
  }, [selected]);

  const isInstagramSection = useMemo(() => {
    if (!selected) return false;
    return selected.id === "instagram" || selected.type === "instagram";
  }, [selected]);

  const isTiktokSection = useMemo(() => {
    if (!selected) return false;
    return selected.id === "tiktok" || selected.type === "tiktok";
  }, [selected]);

  const isInfoSection = useMemo(() => {
    if (!selected) return false;
    return selected.id === "informacion" || selected.type === "informacion";
  }, [selected]);

  

  const updateSections = (updater) => {
    setSections((prev) => {
      const base = cloneSections(prev);
      const next = typeof updater === "function" ? updater(base) : updater;
      return cloneSections(next);
    });
  };

  const patchSection = (id, partial) => {
    updateSections((prev) =>
      prev.map((sec) => {
        if (sec.id !== id) return sec;

        const nextPartial = typeof partial === "function" ? partial(sec) : partial || {};

        const merged = {
          ...sec,
          ...nextPartial,
          style: {
            ...(sec.style || {}),
            ...(nextPartial.style || {}),
          },
          config: {
            ...(sec.config || {}),
            ...(nextPartial.config || {}),
          },
        };

        if (merged.type === "tendencia") {
          merged.config = normalizeTendenciaConfigPlus(merged.config);
        }

        return merged;
      })
    );
  };

  const handleChangeSelected = (partial) => {
    if (!selected) return;
    patchSection(selected.id, partial);
  };

  const openEditor = (id) => {
    setEditingId(id);
    setActiveTab("basic");
  };

  const closeEditor = () => {
    setEditingId(null);
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-neutral-200 bg-white p-4">
        <div className="flex items-center justify-between gap-4 mb-3">
          <div>
            <div className="text-sm font-semibold text-neutral-900">Secciones de la página</div>
            <div className="text-xs text-neutral-500">
              Aquí configuras cada bloque. Se guarda en <code>theme.sections</code>.
            </div>
          </div>
        </div>

        <div className="overflow-x-auto -mx-4 md:mx-0">
          <table className="min-w-full text-xs">
            <thead>
              <tr className="border-b border-neutral-200 text-neutral-500">
                <th className="py-2 px-4 text-left font-medium">ID</th>
                <th className="py-2 px-4 text-left font-medium">Nombre interno</th>
                <th className="py-2 px-4 text-left font-medium">Tipo</th>
                <th className="py-2 px-4 text-left font-medium">Link</th>
                <th className="py-2 px-4 text-left font-medium">Estado</th>
                <th className="py-2 px-4 text-right font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {sections.map((sec) => {
                const isSupported =
                  sec.type === "tendencia" ||
                  sec.type === "look" ||
                  sec.id === "look" ||
                  sec.type === "complementos" ||
                  sec.id === "complementos" ||
                  sec.type === "categorias" ||
                  sec.id === "categorias"||
                  sec.type === "instagram" ||
                  sec.id === "instagram"||
                  sec.type === "tiktok" ||
                  sec.id === "tiktok"||
                  sec.type === "informacion" ||
                  sec.id === "informacion";

                return (
                  <tr key={sec.id} className="border-b border-neutral-100 last:border-0">
                    <td className="py-2 px-4 font-mono text-[11px]">{sec.id}</td>
                    <td className="py-2 px-4 text-xs text-neutral-900">{sec.name}</td>
                    <td className="py-2 px-4 text-[11px] text-neutral-600">{inferTypeFromId(sec.type)}</td>
                    <td className="py-2 px-4 text-[11px] text-neutral-500">{buildSectionHref(sec.id)}</td>
                    <td className="py-2 px-4">
                      <SectionBadge enabled={sec.enabled} supported={isSupported} />
                    </td>
                    <td className="py-2 px-4 text-right">
                      <Button size="sm" type="button" onClick={() => openEditor(sec.id)}>
                        Editar
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {selected ? (
      <ModalShell onClose={closeEditor} title={`Editar sección: ${selected.name}`}>
        {isLookSection ? (
          <LookSectionUI
            theme={{ sections }}
            setPath={(path, value) => {
              if (path !== "sections") return;
              const nextSections = Array.isArray(value)
                ? value.map((sec, idx) => normalizeSection(sec, idx))
                : [];
              setSections(cloneSections(nextSections));
            }}
            uploadToCloudinary={uploadToCloudinary}
          />
        ) : isComplementosSection ? (
          <ComplementosSectionUI
            theme={{ sections }}
            setPath={(path, value) => {
              if (path !== "sections") return;
              const nextSections = Array.isArray(value)
                ? value.map((sec, idx) => normalizeSection(sec, idx))
                : [];
              setSections(cloneSections(nextSections));
            }}
            uploadToCloudinary={uploadToCloudinary}
          />
        ) : isCategoriasSection ? (
          <CategoriasSectionUI
            theme={{ sections }}
            setPath={(path, value) => {
              if (path !== "sections") return;
              const nextSections = Array.isArray(value)
                ? value.map((sec, idx) => normalizeSection(sec, idx))
                : [];
              setSections(cloneSections(nextSections));
            }}
            uploadToCloudinary={uploadToCloudinary}
          />
        ) : isInstagramSection ? (
          <InstagramSectionUI
            theme={{ sections }}
            setPath={(path, value) => {
              if (path !== "sections") return;
              const nextSections = Array.isArray(value)
                ? value.map((sec, idx) => normalizeSection(sec, idx))
                : [];
              setSections(cloneSections(nextSections));
            }}
            uploadToCloudinary={uploadToCloudinary}
          />
          ) : isTiktokSection ? (
          <TiktokSectionUI
            theme={{ sections }}
            setPath={(path, value) => {
              if (path !== "sections") return;
              const nextSections = Array.isArray(value)
                ? value.map((sec, idx) => normalizeSection(sec, idx))
                : [];
              setSections(cloneSections(nextSections));
            }}
            uploadToCloudinary={uploadToCloudinary}
          />
          ) : isInfoSection ? (
          <InfoSectionUI
            theme={{ sections }}
            setPath={(path, value) => {
              if (path !== "sections") return;
              const nextSections = Array.isArray(value)
                ? value.map((sec, idx) => normalizeSection(sec, idx))
                : [];
              setSections(cloneSections(nextSections));
            }}
            uploadToCloudinary={uploadToCloudinary}
            uploading={uploading}
          />
        ) : (
          <>
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <div className="text-sm font-semibold text-neutral-900">Editar sección: {selected.name}</div>
                <div className="text-xs text-neutral-500">
                  Editando: <b>{selected.id}</b> — Cambios se guardan en <code>theme.sections</code>
                </div>
              </div>
              <button type="button" onClick={closeEditor} className="text-xs text-neutral-500 hover:text-neutral-800">
                Cerrar
              </button>
            </div>

            <div className="flex items-center justify-between gap-4 mb-4">
              <div className="flex flex-wrap gap-2">
                <TabButton active={activeTab === "basic"} onClick={() => setActiveTab("basic")}>
                  Básico
                </TabButton>
                <TabButton active={activeTab === "image"} onClick={() => setActiveTab("image")}>
                  Imagen
                </TabButton>
                <TabButton active={activeTab === "styles"} onClick={() => setActiveTab("styles")}>
                  Estilos
                </TabButton>
                <TabButton active={activeTab === "products"} onClick={() => setActiveTab("products")}>
                  Productos
                </TabButton>
                <TabButton active={activeTab === "preview"} onClick={() => setActiveTab("preview")}>
                  Preview
                </TabButton>
              </div>

              <SectionBadge enabled={selected.enabled} supported />
            </div>

            <div className="border-t border-neutral-200 pt-4">
              {activeTab === "basic" ? <BasicTab section={selected} onChange={handleChangeSelected} /> : null}

              {activeTab === "image" && selected.type === "tendencia" ? (
                <ImageTab
                  section={selected}
                  onChange={handleChangeSelected}
                  uploadToCloudinary={uploadToCloudinary}
                  uploading={uploading}
                />
              ) : null}

              {activeTab === "styles" ? <StylesTab section={selected} onChange={handleChangeSelected} /> : null}

              {activeTab === "products" && selected.type === "tendencia" ? (
                <ProductsTab section={selected} onChange={handleChangeSelected} uploadToCloudinary={uploadToCloudinary} />
              ) : null}

              {activeTab === "preview" ? <PreviewTab section={selected} /> : null}
            </div>
          </>
        )}
      </ModalShell>
      ) : null}
    </div>
  );
}
