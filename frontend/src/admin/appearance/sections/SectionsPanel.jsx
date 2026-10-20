import { normalizeCategoriasSection } from './categorias/categoriasSectionHelpers';
import { normalizeComplementosSection } from './complementos/complementosSectionHelpers';
// src/admin/appearance/sections/SectionsPanel.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { CircleAlert, CircleCheck, CircleHelp, Eye, EyeOff, Heart, Images, Info, Music2, Pencil, Shirt, Sparkles } from 'lucide-react';
import api from "../../../lib/api";
import LookSectionUI from "./look/LookSectionUI";
import ComplementosSectionUI from "./complementos/ComplementosSectionUI";
import CategoriasSectionUI from "./categorias/CategoriasSectionUI";
import InstagramSectionUI from "./instagram/InstagramSectionUI";
import TiktokSectionUI from "./tiktok/TiktokSectionUI";
import InfoSectionUI from "./info/infoSectionUI";
import { getSectionOverview } from './sectionsOverviewModel';
import './sectionsOverview.css';
import SectionEditorSteps from './ui/SectionEditorSteps';
import SectionEditorCardTabs from './ui/SectionEditorCardTabs';
import SectionEditorPostPicker from './ui/SectionEditorPostPicker';
import StorefrontSectionPreview from './ui/StorefrontSectionPreview';
import { InstagramEditorFeedProvider } from '../../../components/instagram/InstagramEditorFeed';
import { normalizeTrendingPresentation } from '../../../components/trendingPresentation';
import boutiqueBackdrop from '../../../assets/trending-vitrine-boutique.webp';
import TrendingMobileColorsEditor from './editor/TrendingMobileColorsEditor';

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
];

const OVERVIEW_ICONS = {
  tendencia: Sparkles,
  look: Shirt,
  complementos: Heart,
  categorias: Images,
  instagram: Images,
  tiktok: Music2,
  informacion: Info,
};

const OVERVIEW_STATUS = {
  ready: { label: 'Configurada', icon: CircleCheck },
  'needs-content': { label: 'Falta contenido', icon: CircleAlert },
  hidden: { label: 'Oculta', icon: EyeOff },
  unsupported: { label: 'Sin editor', icon: CircleHelp },
};

const OVERVIEW_FILTERS = [
  { id: 'all', label: 'Todas' },
  { id: 'ready', label: 'Configuradas' },
  { id: 'needs-content', label: 'Por completar' },
  { id: 'hidden', label: 'Ocultas' },
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
    presentation: normalizeTrendingPresentation(src.presentation),
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

  if (type === "categorias") return normalizeCategoriasSection({ ...safe, id, type, name, enabled });
  if (type === "complementos") return normalizeComplementosSection({ ...safe, id, type, name, enabled });

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
        <Field label="Tipo de sección" hint="Fijo para mantener el contenido de esta sección" name="type">
          <Input value={section.type} readOnly />
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

function StylesTab({ section, onChange, uploadToCloudinary }) {
  const st = section.style || DEFAULT_STYLE;
  const [uploadingBackground, setUploadingBackground] = useState(false);
  const [backgroundError, setBackgroundError] = useState("");

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
    const floatingColorKey = { cardTitle: "cardTitleColor", cardPrice: "cardPriceColor", cardMeta: "cardMetaColor", cardDesc: "cardDescColor" }[prefix];
    const floatingSizeKey = { cardTitle: "productTitleSizePx", cardPrice: "priceSizePx", cardMeta: "metaSizePx", cardDesc: "descSizePx" }[prefix];
    const isFloating = presentation.mode === "floatingGlass";
    const inline = { ...buildInlineStyle(prefix), ...(isFloating && floatingColorKey ? { color: presentation[floatingColorKey], fontSize: presentation[floatingSizeKey] } : {}) };

    const currentFont = typeof st?.[`${prefix}FontFamily`] === "string" ? st[`${prefix}FontFamily`] : "";
    const currentColor = isFloating && floatingColorKey ? presentation[floatingColorKey] : typeof st?.[`${prefix}Color`] === "string" ? st[`${prefix}Color`] : "";
    const currentSize = isFloating && floatingSizeKey ? presentation[floatingSizeKey] : Number.isFinite(Number(st?.[`${prefix}SizePx`])) ? Number(st[`${prefix}SizePx`]) : defaultSize;
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
              onChange={(e) => isFloating && floatingSizeKey
                ? patchPresentation({ [floatingSizeKey]: clampNumber(Number(e.target.value) || defaultSize, sizeMin, sizeMax) })
                : patchStyle({ [`${prefix}SizePx`]: clampNumber(Number(e.target.value) || defaultSize, sizeMin, sizeMax) })}
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
            onChange={(value) => isFloating && floatingColorKey ? patchPresentation({ [floatingColorKey]: value }) : patchStyle({ [`${prefix}Color`]: value })}
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
  const presentation = normalizeTrendingPresentation(cfg.presentation);
  const patchPresentation = (partial) => onChange({ config: { ...cfg, presentation: normalizeTrendingPresentation({ ...presentation, ...partial }) } });
  const numericPresentationField = (key, label, min, max, step = 1) => (
    <Field label={label} name={`config.presentation.${key}`} key={key}>
      <Input type="number" aria-label={label} min={min} max={max} step={step} value={presentation[key]}
        onChange={(event) => patchPresentation({ [key]: clampNumber(Number(event.target.value), min, max) })} />
    </Field>
  );
  const colorPresentationField = (key, label) => (
    <ColorField key={key} label={label} value={presentation[key]} onChange={(value) => patchPresentation({ [key]: value })} />
  );
  const uploadBackground = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !uploadToCloudinary) return;
    setBackgroundError("");
    setUploadingBackground(true);
    try {
      const url = await uploadToCloudinary(file);
      if (!url || !normalizeTrendingPresentation({ backgroundImage: url }).backgroundImage) throw new Error("No se recibió una imagen válida de Cloudinary.");
      patchPresentation({ backgroundImage: url, backdropMode: "custom" });
    } catch (error) {
      setBackgroundError(error?.message || "No se pudo cargar el fondo.");
    } finally {
      setUploadingBackground(false);
    }
  };

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
    <SectionEditorCardTabs label="Diseño de Tendencia" labels={['Plantilla', 'Móvil', 'Texto general', 'Campos de la tarjeta', 'Datos visibles', 'Tarjetas y espacio']}>
      <div className="space-y-4 rounded-2xl border border-neutral-200 bg-white p-4">
        <div>
          <h3 className="text-sm font-semibold text-neutral-900">Elige cómo se muestran los productos</h3>
          <p className="mt-1 text-xs text-neutral-600">La vista previa muestra la tienda con los productos que elegiste. Cambia de plantilla sin perder los ajustes de la otra.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            { mode: "classic", label: "Tarjeta actual", hint: "Imagen y detalles en una sola tarjeta", preview: "rounded-t-xl rounded-b-xl" },
            { mode: "floatingGlass", label: "Vitrina flotante", hint: "Foto protagonista y ficha de vidrio separada", preview: "rounded-2xl" },
          ].map((option) => (
            <button key={option.mode} type="button" aria-pressed={presentation.mode === option.mode}
              onClick={() => patchPresentation({ mode: option.mode })}
              className={`rounded-2xl border-2 p-3 text-left transition ${presentation.mode === option.mode ? "border-rose-500 bg-rose-50/50" : "border-neutral-200 hover:border-rose-200"}`}>
              <span className="block text-sm font-semibold">{option.label}</span>
              <span className="block text-xs text-neutral-600">{option.hint}</span>
              <span aria-hidden="true" className="mt-3 flex h-16 max-w-28 flex-col gap-1">
                <span className={`block flex-1 border border-rose-200 bg-gradient-to-br from-rose-100 via-white to-amber-100 ${option.preview}`} style={option.mode === "floatingGlass" ? { backgroundImage: `url(${boutiqueBackdrop})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined} />
                {option.mode === "floatingGlass" ? <span className="block h-4 rounded-lg border border-amber-200 bg-white/70 shadow-sm" /> : null}
              </span>
            </button>
          ))}
        </div>
        {presentation.mode === "floatingGlass" ? (
          <div className="space-y-3">
            <p className="text-xs text-neutral-600">Las fotos y los artículos se editan en Contenido → Productos. Los colores de Pasarela se ajustan en Móvil; las fichas de escritorio, en las opciones de esta pestaña.</p>
            <details className="rounded-xl border border-neutral-200 p-3">
              <summary className="cursor-pointer text-sm font-semibold">Título de la vitrina</summary>
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Mostrar título como" name="config.presentation.titleMode">
                  <select className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm" value={presentation.titleMode} onChange={(event) => patchPresentation({ titleMode: event.target.value })}>
                    <option value="text">Texto editable</option><option value="image">Imagen del título</option>
                  </select>
                </Field>
                {presentation.titleMode === "text" ? <>
                  <Field label="Texto" name="config.title"><Input value={cfg.title || ""} placeholder="EN TENDENCIA" onChange={(event) => onChange({ config: { ...cfg, title: event.target.value } })} /></Field>
                  {colorPresentationField("titleColor", "Color del título")}
                  {numericPresentationField("titleSizePx", "Tamaño máximo del título (px)", 20, 80)}
                  <Field label="Fuente del título" name="config.presentation.titleFontFamily">
                    <select className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm" value={presentation.titleFontFamily} onChange={(event) => patchPresentation({ titleFontFamily: event.target.value })}>
                      {[{ label: "Clásica elegante", value: "Georgia, serif" }, ...CARD_FONT_OPTIONS.filter((item) => item.value)].map((item) => <option key={item.label} value={item.value}>{item.label}</option>)}
                    </select>
                  </Field>
                </> : <p className="text-xs text-neutral-600">Carga la imagen del título en Contenido → Imágenes.</p>}
              </div>
            </details>
            <details className="rounded-xl border border-neutral-200 p-3" open>
              <summary className="cursor-pointer text-sm font-semibold">Fondo y luz</summary>
              <p className="mt-2 text-xs text-neutral-600">El fondo floral ocupa el ancho completo de la sección. Puedes cambiarlo por un color o tu propia imagen.</p>
              <div className="mt-3 grid grid-cols-3 gap-2" role="group" aria-label="Tipo de fondo">
                {[
                  { value: "boutique", label: "Floral incluido" },
                  { value: "color", label: "Color y luz" },
                  { value: "custom", label: "Mi imagen" },
                ].map((option) => (
                  <button key={option.value} type="button" aria-pressed={presentation.backdropMode === option.value}
                    onClick={() => patchPresentation({ backdropMode: option.value })}
                    className={`rounded-xl border px-2 py-2 text-xs ${presentation.backdropMode === option.value ? "border-rose-500 bg-rose-50 text-rose-950" : "border-neutral-200 bg-white text-neutral-700"}`}>
                    {option.label}
                  </button>
                ))}
              </div>
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                {colorPresentationField("backgroundColor", "Color de fondo")}
                {colorPresentationField("glowColor", "Color de la luz ambiental")}
                {numericPresentationField("glowStrength", "Intensidad de luz (0–1)", 0, 1, .05)}
                <Field label="Cargar mi imagen de fondo" name="config.presentation.backgroundImage">
                  <input type="file" accept="image/*" aria-label="Cargar mi imagen de fondo" onChange={uploadBackground} disabled={uploadingBackground} className="block w-full text-xs" />
                  {uploadingBackground ? <span role="status" className="text-xs">Cargando imagen…</span> : null}
                  {backgroundError ? <span role="alert" className="text-xs text-red-700">{backgroundError}</span> : null}
                  {presentation.backgroundImage ? <button type="button" onClick={() => patchPresentation({ backgroundImage: "", backdropMode: "boutique" })} className="mt-1 text-xs underline">Volver al floral incluido</button> : null}
                  {presentation.backdropMode === "custom" && !presentation.backgroundImage ? <span className="block text-xs text-amber-800">Carga una imagen para verla en la vitrina.</span> : null}
                </Field>
              </div>
              <div className="mt-3 rounded-xl border border-rose-200/70 bg-rose-50/40 p-3">
                <div className="text-xs font-semibold text-rose-950">Profundidad del escenario</div>
                <p className="mt-1 text-xs text-neutral-600">Separa visualmente la pared, ilumina los productos y da apoyo al suelo. Puedes llevar Profundidad a 0 para apagar el efecto.</p>
                <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[["sceneDepth", "Profundidad", 1, "%"], ["sceneLight", "Luz detrás de las fotos", 1, "%"], ["sceneBlurPx", "Desenfoque de la pared", 12, "px"]].map(([key, label, max, unit]) => (
                    <label key={key} className="block text-xs text-neutral-800">
                      <span className="flex items-center justify-between gap-2"><span>{label}</span><strong>{unit === "%" ? `${Math.round(presentation[key] * 100)}%` : `${presentation[key]} px`}</strong></span>
                      <input type="range" aria-label={label} min={0} max={max} step={unit === "%" ? .05 : 1} value={presentation[key]}
                        onChange={(event) => patchPresentation({ [key]: Number(event.target.value) })} className="mt-2 w-full accent-rose-600" />
                    </label>
                  ))}
                </div>
              </div>
            </details>
            <details className="rounded-xl border border-neutral-200 p-3">
              <summary className="cursor-pointer text-sm font-semibold">Vidrio y bordes</summary>
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                {colorPresentationField("glassColor", "Color del vidrio")}
                {colorPresentationField("borderColor", "Color del borde")}
                {numericPresentationField("glassOpacity", "Opacidad del vidrio (0,25–1)", .25, 1, .05)}
                {numericPresentationField("blurPx", "Desenfoque (px)", 0, 40)}
                {numericPresentationField("borderOpacity", "Opacidad del borde (0–1)", 0, 1, .05)}
                {numericPresentationField("borderWidthPx", "Grosor del borde (px)", 0, 4, .5)}
                {numericPresentationField("shadowStrength", "Intensidad de sombra (0–1)", 0, 1, .05)}
              </div>
            </details>
            <details className="rounded-xl border border-neutral-200 p-3">
              <summary className="cursor-pointer text-sm font-semibold">Letras de las fichas</summary>
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                {colorPresentationField("cardTitleColor", "Nombre del producto")}
                {colorPresentationField("cardPriceColor", "Precio")}
                {colorPresentationField("cardMetaColor", "Tallas y colores")}
                {colorPresentationField("cardDescColor", "Descripción y características")}
                {colorPresentationField("cardMutedColor", "Precio anterior")}
              </div>
              <p className="mt-2 text-xs text-neutral-600">La tipografía y los tamaños siguen disponibles en «Campos de la tarjeta».</p>
              {numericPresentationField("oldPriceSizePx", "Precio anterior (px)", 8, 15)}
            </details>
            <details className="rounded-xl border border-neutral-200 p-3">
              <summary className="cursor-pointer text-sm font-semibold">Forma y botones</summary>
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                {numericPresentationField("imageHeightPx", "Alto de la foto (px)", 240, 600)}
                {numericPresentationField("imageRadiusPx", "Redondeo de la foto (px)", 0, 60)}
                {numericPresentationField("dockRadiusPx", "Redondeo de la ficha (px)", 0, 60)}
                {numericPresentationField("dockGapPx", "Separación foto/ficha (px)", 0, 30)}
                {numericPresentationField("dockPaddingPx", "Espacio interior de la ficha (px)", 8, 30)}
                {numericPresentationField("hoverLiftPx", "Elevación al pasar el mouse (px)", 0, 18)}
                {numericPresentationField("actionSizePx", "Tamaño de los botones (px)", 28, 52)}
                {colorPresentationField("actionColor", "Color de los iconos")}
                {colorPresentationField("actionBackgroundColor", "Fondo de los botones")}
                <Toggle checked={presentation.ornamentEnabled} label="Decoración junto al título" onChange={(value) => patchPresentation({ ornamentEnabled: !!value })} />
                <Toggle checked={presentation.showWatermark} label="Mostrar marca de agua en las fichas" onChange={(value) => patchPresentation({ showWatermark: !!value })} />
                <Toggle checked={presentation.showDescription} label="Mostrar descripción y características" onChange={(value) => patchPresentation({ showDescription: !!value })} />
              </div>
            </details>
          </div>
        ) : null}
      </div>
      <div>
        {presentation.mode === "floatingGlass"
          ? <TrendingMobileColorsEditor presentation={presentation} onChange={patchPresentation} uploadToCloudinary={uploadToCloudinary} />
          : <p className="rounded-2xl border border-neutral-200 bg-white p-4 text-sm text-neutral-600">Selecciona Vitrina flotante en Plantilla para personalizar los colores de Pasarela en móvil.</p>}
      </div>
      <div className="rounded-2xl border border-neutral-200 bg-white p-4">
        <div className="text-sm font-semibold text-neutral-900 mb-2">Texto de todas las tarjetas</div>

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

      <div className="grid gap-3">
        <FieldStyleEditor title="Título del producto" prefix="cardTitle" defaultSize={12} sizeMin={10} sizeMax={20} weightDefault={800} />
        <FieldStyleEditor title="Precio" prefix="cardPrice" defaultSize={14} sizeMin={10} sizeMax={22} weightDefault={800} />
        <FieldStyleEditor title="Tallas y colores" prefix="cardMeta" defaultSize={12} sizeMin={12} sizeMax={18} weightDefault={700} />
        <FieldStyleEditor title="Descripción y características" prefix="cardDesc" defaultSize={11} sizeMin={9} sizeMax={18} weightDefault={600} />
      </div>

      {section.type === "tendencia" ? (
        <div className="rounded-2xl border border-neutral-200 bg-white p-4 space-y-3">
          <div className="text-sm font-semibold text-neutral-900">Qué mostrar en el card (Tendencia)</div>
          <div className="text-xs text-neutral-500">
            Elige qué información verá el cliente en cada tarjeta.
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
    </SectionEditorCardTabs>
  );
}

function ProductsTab({ section, onChange, uploadToCloudinary }) {
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
      <div className="text-base font-semibold text-neutral-900">Así se verá En tendencia</div>
      <div className="text-sm text-neutral-600 mb-2">Revisa imágenes, textos y precios antes de guardar.</div>

      <div
        data-admin-storefront-preview="true"
        className="rounded-2xl p-4"
        style={{ backgroundColor: st.bgColor, color: st.textColor }}
      >
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
export default function SectionsPanel({ theme, setPath, disabled = false, uploading, setUploading, uploadToCloudinary }) {
  const initialSections = useMemo(() => normalizeSectionsArray(theme || {}), [theme]);

  const [sections, setSections] = useState(() => cloneSections(initialSections));
  const [editingId, setEditingId] = useState(null);
  const [activeTab, setActiveTab] = useState("basic");
  const [overviewFilter, setOverviewFilter] = useState('all');

  const lastIncomingFromThemeRef = useRef(JSON.stringify(initialSections));
  const lastPushedToParentRef = useRef(JSON.stringify(initialSections));

  useEffect(() => {
    ensureGoogleFontsLoaded();
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

    lastPushedToParentRef.current = serialized;
    lastIncomingFromThemeRef.current = serialized;
    setPath("sections", normalizedForParent);
  }, [sections, setPath]);

  const selected = useMemo(() => sections.find((s) => s.id === editingId) || null, [sections, editingId]);
  const overview = useMemo(() => sections.map((section) => ({
    section,
    ...getSectionOverview(section, sections),
  })), [sections]);
  const visibleOverview = overviewFilter === 'all'
    ? overview
    : overview.filter((item) => item.status === overviewFilter);

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
      <section className="sections-overview" aria-label="Vista general de secciones">
        <div className="sections-overview__head">
          <div>
            <h2>Secciones de la tienda</h2>
            <p>Elige un bloque para editarlo. Guarda los cambios con el botón lateral.</p>
          </div>
          <div className="sections-overview__stats" role="group" aria-label="Resumen de secciones">
            <span className="sections-overview__stat"><strong>{overview.filter((item) => item.status === 'ready').length}</strong> configuradas</span>
            <span className="sections-overview__stat"><strong>{overview.filter((item) => item.status === 'needs-content').length}</strong> por completar</span>
            <span className="sections-overview__stat"><strong>{overview.filter((item) => item.status === 'hidden').length}</strong> ocultas</span>
          </div>
        </div>
        <div className="sections-overview__filters" role="group" aria-label="Filtrar secciones">
          {OVERVIEW_FILTERS.map((filter) => (
            <button
              key={filter.id}
              type="button"
              className="sections-overview__filter"
              aria-pressed={overviewFilter === filter.id}
              onClick={() => setOverviewFilter(filter.id)}
            >{filter.label}</button>
          ))}
        </div>
        <div className="sections-overview__grid">
          {visibleOverview.map(({ section, label, status, detail }) => {
            const Icon = OVERVIEW_ICONS[section.id] || CircleHelp;
            const StatusIcon = OVERVIEW_STATUS[status].icon;
            return (
              <article className="sections-overview__card" data-status={status} key={section.id}>
                <span className="sections-overview__icon" aria-hidden="true"><Icon /></span>
                <div className="sections-overview__content">
                  <h3 title={section.name}>{label}</h3>
                  <p>{detail}</p>
                  <span className="sections-overview__status" data-status={status}><StatusIcon aria-hidden="true" />{OVERVIEW_STATUS[status].label}</span>
                </div>
                {status !== 'unsupported' && <div className="sections-overview__actions">
                  <button
                    type="button"
                    role="switch"
                    className="sections-overview__toggle"
                    aria-label={`Mostrar ${label} en la tienda`}
                    aria-checked={section.enabled !== false}
                    title={section.enabled === false ? `Mostrar ${label}` : `Ocultar ${label}`}
                    onClick={() => patchSection(section.id, { enabled: section.enabled === false })}
                  >{section.enabled === false ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}</button>
                  <button
                    type="button"
                    className="sections-overview__edit"
                    aria-label={`Editar ${label}`}
                    title={`Editar ${label}`}
                    onClick={() => openEditor(section.id)}
                  ><Pencil aria-hidden="true" /></button>
                </div>}
              </article>
            );
          })}
        </div>
        {!visibleOverview.length && <p className="sections-overview__empty">No hay secciones en este estado.</p>}
      </section>

      {selected ? (
      <ModalShell onClose={closeEditor} title={`Editar sección: ${selected.name}`} disabled={disabled}>
        <InstagramEditorFeedProvider enabled={isInstagramSection}>
        <div className="section-editor-layout">
        <div className="section-editor-layout__form">
        {isLookSection ? (
          <LookSectionUI
            theme={{ ...theme, sections }}
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
            theme={{ ...theme, sections }}
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
            theme={{ ...theme, sections }}
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
            theme={{ ...theme, sections }}
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
            theme={{ ...theme, sections }}
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
            theme={{ ...theme, sections }}
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
            <SectionEditorSteps value={["image", "products"].includes(activeTab) ? "basic" : activeTab} onChange={setActiveTab} sectionName="En tendencia" items={[
              { value: "basic", label: "Contenido", hint: "Define el título, las imágenes y los productos de la sección." },
              { value: "styles", label: "Diseño", hint: "Ajusta colores, tarjetas, tipografía y efectos." },
            ]} />
            {["basic", "image", "products"].includes(activeTab) && (
              <nav className="section-editor-substeps mt-3" aria-label="Opciones de contenido">
                {[{ value: "basic", label: "Textos" }, { value: "image", label: "Imágenes" }, { value: "products", label: "Productos" }].map((item) => (
                  <button key={item.value} type="button" aria-pressed={activeTab === item.value} onClick={() => setActiveTab(item.value)}>{item.label}</button>
                ))}
              </nav>
            )}

            <div className="pt-4">
              {activeTab === "basic" ? <BasicTab section={selected} onChange={handleChangeSelected} /> : null}

              {activeTab === "image" && selected.type === "tendencia" ? (
                <ImageTab
                  section={selected}
                  onChange={handleChangeSelected}
                  uploadToCloudinary={uploadToCloudinary}
                  uploading={uploading}
                />
              ) : null}

              {activeTab === "styles" ? <StylesTab section={selected} onChange={handleChangeSelected} uploadToCloudinary={uploadToCloudinary} /> : null}

              {activeTab === "products" && selected.type === "tendencia" ? (
                <ProductsTab section={selected} onChange={handleChangeSelected} uploadToCloudinary={uploadToCloudinary} />
              ) : null}

            </div>
          </>
        )}
        </div>
        <aside className="section-editor-layout__preview">
          <StorefrontSectionPreview section={selected} theme={{ ...theme, sections }} />
        </aside>
        </div>
        </InstagramEditorFeedProvider>
      </ModalShell>
      ) : null}
    </div>
  );
}
