// src/admin/appearance/sections/instagram/InstagramSectionUI.jsx

import React, { useMemo, useState } from "react";
import { Instagram } from "lucide-react";
import { Field, Input, Toggle } from "../ui/UiComponents";
import {
  normalizeInstagramSection,
  INSTAGRAM_SECTION_ID,
  INSTAGRAM_BADGE_GRADIENT_OPTIONS,
  INSTAGRAM_GALLERY_MODE_OPTIONS,
  INSTAGRAM_HOVER_LOGO_STYLE_OPTIONS,
  INSTAGRAM_WATERMARK_POSITION_OPTIONS,
} from "./instagramSectionHelpers";

const FONT_OPTIONS = [
  { label: "Usar por defecto", value: "" },
  { label: "Inter", value: 'Inter, system-ui, -apple-system, "Segoe UI", sans-serif' },
  { label: "Poppins", value: 'Poppins, system-ui, -apple-system, "Segoe UI", sans-serif' },
  { label: "Montserrat", value: 'Montserrat, system-ui, -apple-system, "Segoe UI", sans-serif' },
  { label: "Raleway", value: 'Raleway, system-ui, -apple-system, "Segoe UI", sans-serif' },
  { label: "Nunito", value: 'Nunito, system-ui, -apple-system, "Segoe UI", sans-serif' },
  { label: "Playfair Display", value: '"Playfair Display", Georgia, serif' },
  { label: "Cormorant Garamond", value: '"Cormorant Garamond", Georgia, serif' },
  { label: "Lora", value: '"Lora", Georgia, serif' },
  { label: "DM Serif Display", value: '"DM Serif Display", Georgia, serif' },
];

const COLOR_PRESETS = [
  "#111111",
  "#ffffff",
  "#f72585",
  "#b5179e",
  "#7209b7",
  "#560bad",
  "#480ca8",
  "#3a0ca3",
  "#4361ee",
  "#4895ef",
  "#4cc9f0",
  "#ff4d6d",
  "#ff758f",
  "#ff8fa3",
  "#c9184a",
  "#a4133c",
  "#d4a373",
  "#e9c46a",
  "#2a9d8f",
  "#84a59d",
];

function clampNumber(value, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}

function getInstagramSection(theme) {
  const sections = Array.isArray(theme?.sections) ? theme.sections : [];
  const found = sections.find((s) => {
    const id = typeof s?.id === "string" ? s.id.trim().toLowerCase() : "";
    const type = typeof s?.type === "string" ? s.type.trim().toLowerCase() : "";
    return id === INSTAGRAM_SECTION_ID || type === INSTAGRAM_SECTION_ID;
  });

  return normalizeInstagramSection(found);
}

function updateInstagramInsideSections(sections, nextInstagramSection) {
  const list = Array.isArray(sections) ? sections : [];
  let found = false;

  const next = list.map((sec) => {
    const id = typeof sec?.id === "string" ? sec.id.trim().toLowerCase() : "";
    const type = typeof sec?.type === "string" ? sec.type.trim().toLowerCase() : "";

    if (id === INSTAGRAM_SECTION_ID || type === INSTAGRAM_SECTION_ID) {
      found = true;
      return normalizeInstagramSection(nextInstagramSection);
    }

    return sec;
  });

  if (!found) {
    next.push(normalizeInstagramSection(nextInstagramSection));
  }

  return next;
}

function GradientPreview({ value }) {
  const styleMap = {
    none: "#ffffff",
    instagram:
      "linear-gradient(135deg, #feda75 0%, #fa7e1e 25%, #d62976 50%, #962fbf 75%, #4f5bd5 100%)",
    "pink-orange":
      "linear-gradient(135deg, #ff4d6d 0%, #ff758f 40%, #ffb703 100%)",
    "purple-pink":
      "linear-gradient(135deg, #7209b7 0%, #b5179e 50%, #f72585 100%)",
    golden:
      "linear-gradient(135deg, #f4d35e 0%, #e9c46a 50%, #d4a373 100%)",
    ocean:
      "linear-gradient(135deg, #4361ee 0%, #4895ef 50%, #4cc9f0 100%)",
    mint:
      "linear-gradient(135deg, #95d5b2 0%, #74c69d 50%, #52b788 100%)",
  };

  const background = styleMap[value] || "#ffffff";

  return (
    <div
      className="h-10 rounded-xl border border-neutral-200"
      style={{
        background,
      }}
    />
  );
}

function ColorPresets({ value, onChange }) {
  return (
    <div className="flex flex-wrap gap-2">
      {COLOR_PRESETS.map((color) => {
        const active = value === color;
        return (
          <button
            key={color}
            type="button"
            onClick={() => onChange(color)}
            title={color}
            className={[
              "h-7 w-7 rounded-full border-2 transition",
              active ? "border-neutral-900 scale-110" : "border-white hover:scale-105",
            ].join(" ")}
            style={{ backgroundColor: color }}
          />
        );
      })}
    </div>
  );
}

function buildBadgeBackground(config) {
  const gradient = config.profileBadgeGradient || "none";

  if (gradient === "instagram") {
    return "linear-gradient(135deg, #feda75 0%, #fa7e1e 25%, #d62976 50%, #962fbf 75%, #4f5bd5 100%)";
  }
  if (gradient === "pink-orange") {
    return "linear-gradient(135deg, #ff4d6d 0%, #ff758f 40%, #ffb703 100%)";
  }
  if (gradient === "purple-pink") {
    return "linear-gradient(135deg, #7209b7 0%, #b5179e 50%, #f72585 100%)";
  }
  if (gradient === "golden") {
    return "linear-gradient(135deg, #f4d35e 0%, #e9c46a 50%, #d4a373 100%)";
  }
  if (gradient === "ocean") {
    return "linear-gradient(135deg, #4361ee 0%, #4895ef 50%, #4cc9f0 100%)";
  }
  if (gradient === "mint") {
    return "linear-gradient(135deg, #95d5b2 0%, #74c69d 50%, #52b788 100%)";
  }

  return config.profileBadgeBgColor || "#ffffff";
}

function isSafeRasterImage(file) {
  if (!file) return false;
  const allowed = ["image/png", "image/jpeg", "image/jpg", "image/webp"];
  return allowed.includes(file.type);
}

function renderPreviewHoverLogo(config) {
  const logoStyle = (config.hoverLogoStyle || "glyph").toLowerCase();
  const logoSizePx = clampNumber(config.hoverLogoSizePx ?? 74, 20, 220);
  const logoOpacity = clampNumber(config.hoverLogoOpacity ?? 0.32, 0.05, 1);
  const logoColor = config.hoverLogoColor || "#ffffff";
  const customHoverLogo = config.hoverLogoImage || config.instagramLogo || "";

  const sharedStyle = {
    width: `${logoSizePx}px`,
    height: `${logoSizePx}px`,
    opacity: logoOpacity,
    objectFit: "contain",
    filter: "drop-shadow(0 2px 10px rgba(0,0,0,0.18))",
  };

  if ((logoStyle === "custom-image" || logoStyle === "square") && customHoverLogo) {
    return (
      <img
        src={customHoverLogo}
        alt="Instagram"
        draggable={false}
        style={sharedStyle}
      />
    );
  }

  if (logoStyle === "outline") {
    return (
      <Instagram
        strokeWidth={1.6}
        style={{
          ...sharedStyle,
          color: logoColor,
        }}
      />
    );
  }

  return (
    <Instagram
      strokeWidth={2}
      style={{
        ...sharedStyle,
        color: logoColor,
      }}
    />
  );
}

function getWatermarkAnchor(position) {
  switch ((position || "custom").toLowerCase()) {
    case "center":
      return { x: 50, y: 50 };
    case "top-left":
      return { x: 12, y: 12 };
    case "top-center":
      return { x: 50, y: 12 };
    case "top-right":
      return { x: 88, y: 12 };
    case "middle-left":
      return { x: 12, y: 50 };
    case "middle-right":
      return { x: 88, y: 50 };
    case "bottom-left":
      return { x: 12, y: 88 };
    case "bottom-center":
      return { x: 50, y: 88 };
    case "bottom-right":
      return { x: 88, y: 88 };
    default:
      return null;
  }
}

export default function InstagramSectionUI({
  theme,
  setPath,
  uploadToCloudinary,
  uploading = false,
}) {
  const [uploadError, setUploadError] = useState("");
  const [logoPreviewError, setLogoPreviewError] = useState(false);
  const [previewHoveredId, setPreviewHoveredId] = useState(null);

  const section = useMemo(() => getInstagramSection(theme), [theme]);
  const config = section.config || {};
  const posts = Array.isArray(config.posts) ? config.posts : [];

  function pushSection(nextSection) {
    if (typeof setPath !== "function") return;
    const currentSections = Array.isArray(theme?.sections) ? theme.sections : [];
    const nextSections = updateInstagramInsideSections(currentSections, nextSection);
    setPath("sections", nextSections);
  }

  function patchSection(partial) {
    pushSection({
      ...section,
      ...partial,
      config: {
        ...(section.config || {}),
        ...((partial && partial.config) || {}),
      },
    });
  }

  function updateConfig(key, value) {
    if (key === "instagramLogo") {
      setLogoPreviewError(false);
    }

    patchSection({
      config: {
        ...config,
        [key]: value,
      },
    });
  }

  function updatePost(index, key, value) {
    const nextPosts = [...posts];
    nextPosts[index] = {
      ...nextPosts[index],
      [key]: value,
    };
    updateConfig("posts", nextPosts);
  }

  function addPost() {
    const nextPosts = [
      ...posts,
      {
        id: `post_${posts.length + 1}`,
        image: "",
        link: "",
        enabled: true,
      },
    ];
    updateConfig("posts", nextPosts);
  }

  function removePost(index) {
    const nextPosts = posts.filter((_, i) => i !== index);
    updateConfig("posts", nextPosts);
  }

  async function handleUploadConfigImage(key, file) {
    if (!file || typeof uploadToCloudinary !== "function") return;

    setUploadError("");

    try {
      if (
        (key === "instagramLogo" || key === "hoverLogoImage" || key === "watermarkImage") &&
        !isSafeRasterImage(file)
      ) {
        throw new Error("La imagen debe ser PNG, JPG o WEBP. No uses SVG.");
      }

      const url = await uploadToCloudinary(file);
      if (!url) {
        throw new Error("No se recibió una URL válida al subir la imagen.");
      }

      if (key === "instagramLogo") {
        setLogoPreviewError(false);
      }

      updateConfig(key, url);
    } catch (error) {
      console.error(`Error subiendo ${key}:`, error);
      const message =
        error?.message || "No se pudo subir la imagen. Intenta con PNG, JPG o WEBP.";
      setUploadError(message);
      alert(message);
    }
  }

  async function handleUploadPostImage(index, file) {
    if (!file || typeof uploadToCloudinary !== "function") return;

    setUploadError("");

    try {
      const url = await uploadToCloudinary(file);
      if (!url) {
        throw new Error("No se recibió una URL válida al subir la imagen del post.");
      }

      updatePost(index, "image", url);
    } catch (error) {
      console.error("Error subiendo imagen del post:", error);
      const message = error?.message || "No se pudo subir la imagen del post.";
      setUploadError(message);
      alert(message);
    }
  }

  const enabledPosts = posts.filter((post) => post.enabled !== false);

  const badgeBackground = buildBadgeBackground(config);

  const galleryMode =
    typeof config.galleryMode === "string" && config.galleryMode.trim()
      ? config.galleryMode.trim().toLowerCase()
      : "flex-hover";

  const hoverTransitionMs = clampNumber(config.hoverTransitionMs ?? 380, 120, 1200);
  const baseCardWidthPx = clampNumber(config.baseCardWidthPx ?? 88, 40, 320);
  const hoveredCardWidthPx = clampNumber(config.hoveredCardWidthPx ?? 260, 80, 1400);

  const previewBorderColor = config.cardBorderColor || "#d4af379f";
  const previewBorderWidthPx = clampNumber(config.cardBorderWidthPx ?? 2, 0, 20);

  const previewGridStyle = {
    display: "grid",
    gridTemplateColumns: `repeat(${clampNumber(config.columns || 4, 1, 6)}, minmax(0, 1fr))`,
    gap: `${clampNumber(config.gapPx || 16, 0, 60)}px`,
  };

  const previewFlexStyle = {
    display: "flex",
    justifyContent: "flex-end",
    alignItems: "stretch",
    gap: `${clampNumber(config.gapPx || 16, 0, 60)}px`,
    width: "100%",
    height: `${clampNumber(config.imageHeightPx || 260, 120, 2000)}px`,
  };

  const previewCardStyle = {
    borderRadius: `${clampNumber(config.borderRadiusPx || 8, 0, 40)}px`,
    overflow: "hidden",
    position: "relative",
    height: `${clampNumber(config.imageHeightPx || 260, 120, 2000)}px`,
    background: "#f5f5f5",
    border: `${previewBorderWidthPx}px solid ${previewBorderColor}`,
  };

  const hoverLogoEnabled =
    typeof config.hoverLogoEnabled === "boolean" ? config.hoverLogoEnabled : true;

  const watermarkEnabled =
    typeof config.watermarkEnabled === "boolean" ? config.watermarkEnabled : false;

  const watermarkAnchor = getWatermarkAnchor(config.watermarkPosition);
  const watermarkXPercent = clampNumber(
    watermarkAnchor?.x ?? config.watermarkXPercent ?? 50,
    0,
    100
  );
  const watermarkYPercent = clampNumber(
    watermarkAnchor?.y ?? config.watermarkYPercent ?? 50,
    0,
    100
  );
  const watermarkOpacity = clampNumber(config.watermarkOpacity ?? 0.12, 0, 1);
  const watermarkWidthPx = clampNumber(config.watermarkWidthPx ?? 320, 40, 2400);
  const watermarkHeightPx = clampNumber(config.watermarkHeightPx ?? 320, 40, 2400);
  const watermarkRotateDeg = clampNumber(config.watermarkRotateDeg ?? 0, -360, 360);
  const watermarkSizeMode =
    (config.watermarkSizeMode || "contain").toLowerCase() === "cover"
      ? "cover"
      : "contain";

  const previewWatermarkStyle = {
    position: "absolute",
    left: `${watermarkXPercent}%`,
    top: `${watermarkYPercent}%`,
    width: `${watermarkWidthPx}px`,
    height: `${watermarkHeightPx}px`,
    transform: `translate(-50%, -50%) rotate(${watermarkRotateDeg}deg)`,
    opacity: watermarkOpacity,
    objectFit: watermarkSizeMode,
    pointerEvents: "none",
    userSelect: "none",
    zIndex: 0,
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="text-sm font-semibold text-neutral-900">Configuración de Instagram</div>
          <div className="text-xs text-neutral-500">
            Esta sección se guarda dentro de <code>theme.sections</code>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs text-neutral-600">Activa</span>
          <Toggle
            checked={!!section.enabled}
            onChange={(v) =>
              patchSection({
                enabled: !!v,
              })
            }
          />
        </div>
      </div>

      {uploadError ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {uploadError}
        </div>
      ) : null}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="space-y-6">
          <div className="rounded-2xl border border-neutral-200 bg-white p-4 space-y-4">
            <div className="text-sm font-semibold text-neutral-900">Perfil</div>

            <Field label="Link del perfil de Instagram">
              <Input
                value={config.profileLink || ""}
                placeholder="https://instagram.com/tuusuario"
                onChange={(e) => updateConfig("profileLink", e.target.value)}
              />
            </Field>

            <Field label="Usuario / texto del perfil">
              <Input
                value={config.profileUser || ""}
                placeholder="@tuusuario"
                onChange={(e) => updateConfig("profileUser", e.target.value)}
              />
            </Field>

            <Field label="Color del texto del usuario">
              <div className="space-y-3">
                <Input
                  value={config.userTextColor || "#111111"}
                  onChange={(e) => updateConfig("userTextColor", e.target.value)}
                  placeholder="#111111"
                />
                <ColorPresets
                  value={config.userTextColor || "#111111"}
                  onChange={(value) => updateConfig("userTextColor", value)}
                />
              </div>
            </Field>

            <Field label="Fuente del usuario">
              <select
                className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm"
                value={config.userFontFamily || ""}
                onChange={(e) => updateConfig("userFontFamily", e.target.value)}
              >
                {FONT_OPTIONS.map((opt) => (
                  <option key={opt.label} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </Field>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Tamaño del usuario (px)">
                <Input
                  type="number"
                  value={config.userFontSizePx ?? 14}
                  onChange={(e) =>
                    updateConfig("userFontSizePx", clampNumber(e.target.value, 10, 40))
                  }
                />
              </Field>

              <Field label="Peso del usuario">
                <Input
                  type="number"
                  value={config.userFontWeight ?? 700}
                  onChange={(e) =>
                    updateConfig("userFontWeight", clampNumber(e.target.value, 200, 900))
                  }
                />
              </Field>
            </div>
          </div>

          <div className="rounded-2xl border border-neutral-200 bg-white p-4 space-y-4">
            <div className="text-sm font-semibold text-neutral-900">Logo y badge del perfil</div>

            <Field label="Imagen del logo">
              <div className="space-y-3">
                <Input
                  value={config.instagramLogo || ""}
                  placeholder="/icons/instagram.svg"
                  onChange={(e) => updateConfig("instagramLogo", e.target.value)}
                />

                {config.instagramLogo && !logoPreviewError ? (
                  <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3">
                    <div className="text-[11px] text-neutral-500 mb-2">Vista previa del logo</div>
                    <div className="h-32 flex items-center justify-center">
                      <img
                        src={config.instagramLogo}
                        alt="Preview logo Instagram"
                        className="max-h-28 max-w-full object-contain"
                        onError={() => {
                          setLogoPreviewError(true);
                          setUploadError("La URL del logo no se pudo abrir. Usa PNG, JPG o WEBP.");
                        }}
                      />
                    </div>
                  </div>
                ) : null}

                {logoPreviewError ? (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                    El logo actual no se pudo mostrar. Reemplázalo con PNG, JPG o WEBP.
                  </div>
                ) : null}

                <label className="inline-flex items-center px-3 py-2 rounded-xl bg-neutral-900 text-white text-xs font-medium cursor-pointer hover:bg-neutral-800 transition">
                  {uploading ? "Subiendo..." : "Subir logo"}
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/jpg,image/webp"
                    className="hidden"
                    disabled={uploading}
                    onChange={(e) =>
                      handleUploadConfigImage("instagramLogo", e.target.files?.[0] || null)
                    }
                  />
                </label>

                <div className="text-[11px] text-neutral-500">
                  Formatos recomendados para el logo: PNG, JPG o WEBP.
                </div>
              </div>
            </Field>

            <Field label="Tamaño del logo (px)">
              <Input
                type="number"
                value={config.logoSizePx ?? 180}
                onChange={(e) => updateConfig("logoSizePx", clampNumber(e.target.value, 24, 300))}
              />
            </Field>

            <Field label="Color del texto del badge">
              <div className="space-y-3">
                <Input
                  value={config.profileBadgeTextColor || "#111111"}
                  onChange={(e) => updateConfig("profileBadgeTextColor", e.target.value)}
                  placeholder="#111111"
                />
                <ColorPresets
                  value={config.profileBadgeTextColor || "#111111"}
                  onChange={(value) => updateConfig("profileBadgeTextColor", value)}
                />
              </div>
            </Field>

            <Field label="Color base del badge">
              <div className="space-y-3">
                <Input
                  value={config.profileBadgeBgColor || "#ffffff"}
                  onChange={(e) => updateConfig("profileBadgeBgColor", e.target.value)}
                  placeholder="#ffffff"
                />
                <ColorPresets
                  value={config.profileBadgeBgColor || "#ffffff"}
                  onChange={(value) => updateConfig("profileBadgeBgColor", value)}
                />
              </div>
            </Field>

            <Field label="Degradado preestablecido del badge">
              <select
                className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm"
                value={config.profileBadgeGradient || "none"}
                onChange={(e) => updateConfig("profileBadgeGradient", e.target.value)}
              >
                {INSTAGRAM_BADGE_GRADIENT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </Field>

            <GradientPreview value={config.profileBadgeGradient || "none"} />
          </div>

          <div className="rounded-2xl border border-neutral-200 bg-white p-4 space-y-4">
            <div className="text-sm font-semibold text-neutral-900">Marca de agua de fondo</div>

            <Field label="Mostrar marca de agua">
              <Toggle
                checked={!!config.watermarkEnabled}
                onChange={(v) => updateConfig("watermarkEnabled", !!v)}
              />
            </Field>

            <Field label="Imagen de marca de agua">
              <div className="space-y-3">
                <Input
                  value={config.watermarkImage || ""}
                  placeholder="/icons/watermark.png"
                  onChange={(e) => updateConfig("watermarkImage", e.target.value)}
                />

                <label className="inline-flex items-center px-3 py-2 rounded-xl bg-neutral-900 text-white text-xs font-medium cursor-pointer hover:bg-neutral-800 transition">
                  {uploading ? "Subiendo..." : "Subir imagen de marca de agua"}
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/jpg,image/webp"
                    className="hidden"
                    disabled={uploading}
                    onChange={(e) =>
                      handleUploadConfigImage("watermarkImage", e.target.files?.[0] || null)
                    }
                  />
                </label>
              </div>
            </Field>

            <Field label="Opacidad de la marca de agua">
              <Input
                type="number"
                step="0.01"
                value={config.watermarkOpacity ?? 0.12}
                onChange={(e) =>
                  updateConfig("watermarkOpacity", clampNumber(e.target.value, 0, 1))
                }
              />
            </Field>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Ancho de la marca de agua (px)">
                <Input
                  type="number"
                  value={config.watermarkWidthPx ?? 320}
                  onChange={(e) =>
                    updateConfig("watermarkWidthPx", clampNumber(e.target.value, 40, 2400))
                  }
                />
              </Field>

              <Field label="Alto de la marca de agua (px)">
                <Input
                  type="number"
                  value={config.watermarkHeightPx ?? 320}
                  onChange={(e) =>
                    updateConfig("watermarkHeightPx", clampNumber(e.target.value, 40, 2400))
                  }
                />
              </Field>
            </div>

            <Field label="Modo de ajuste de la imagen">
              <select
                className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm"
                value={config.watermarkSizeMode || "contain"}
                onChange={(e) => updateConfig("watermarkSizeMode", e.target.value)}
              >
                <option value="contain">Contain</option>
                <option value="cover">Cover</option>
              </select>
            </Field>

            <Field label="Posición de la marca de agua">
              <select
                className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm"
                value={config.watermarkPosition || "custom"}
                onChange={(e) => updateConfig("watermarkPosition", e.target.value)}
              >
                {INSTAGRAM_WATERMARK_POSITION_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </Field>

            {(config.watermarkPosition || "custom") === "custom" ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Posición horizontal X (%)">
                  <Input
                    type="number"
                    value={config.watermarkXPercent ?? 50}
                    onChange={(e) =>
                      updateConfig("watermarkXPercent", clampNumber(e.target.value, 0, 100))
                    }
                  />
                </Field>

                <Field label="Posición vertical Y (%)">
                  <Input
                    type="number"
                    value={config.watermarkYPercent ?? 50}
                    onChange={(e) =>
                      updateConfig("watermarkYPercent", clampNumber(e.target.value, 0, 100))
                    }
                  />
                </Field>
              </div>
            ) : null}

            <Field label="Rotación de la marca de agua (grados)">
              <Input
                type="number"
                value={config.watermarkRotateDeg ?? 0}
                onChange={(e) =>
                  updateConfig("watermarkRotateDeg", clampNumber(e.target.value, -360, 360))
                }
              />
            </Field>

            <Field label="Repetir imagen en toda la sección">
              <Toggle
                checked={!!config.watermarkRepeat}
                onChange={(v) => updateConfig("watermarkRepeat", !!v)}
              />
            </Field>
          </div>

          <div className="rounded-2xl border border-neutral-200 bg-white p-4 space-y-4">
            <div className="text-sm font-semibold text-neutral-900">Grid y apariencia</div>

            <Field label="Modo de galería">
              <select
                className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm"
                value={config.galleryMode || "flex-hover"}
                onChange={(e) => updateConfig("galleryMode", e.target.value)}
              >
                {INSTAGRAM_GALLERY_MODE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Número de columnas">
              <Input
                type="number"
                value={config.columns ?? 4}
                onChange={(e) => updateConfig("columns", clampNumber(e.target.value, 1, 6))}
              />
            </Field>

            <Field label="Espacio entre posts (px)">
              <Input
                type="number"
                value={config.gapPx ?? 16}
                onChange={(e) => updateConfig("gapPx", clampNumber(e.target.value, 0, 60))}
              />
            </Field>

            <Field label="Alto de imagen (px)">
              <Input
                type="number"
                value={config.imageHeightPx ?? 260}
                onChange={(e) =>
                  updateConfig("imageHeightPx", clampNumber(e.target.value, 120, 2000))
                }
              />
            </Field>

            <Field label="Color del marco de las fotos">
              <div className="space-y-3">
                <Input
                  value={config.cardBorderColor || "#d4af379f"}
                  onChange={(e) => updateConfig("cardBorderColor", e.target.value)}
                  placeholder="#d4af379f"
                />
                <ColorPresets
                  value={config.cardBorderColor || "#d4af379f"}
                  onChange={(value) => updateConfig("cardBorderColor", value)}
                />
              </div>
            </Field>

            <Field label="Grosor del marco (px)">
              <Input
                type="number"
                value={config.cardBorderWidthPx ?? 2}
                onChange={(e) =>
                  updateConfig("cardBorderWidthPx", clampNumber(e.target.value, 0, 20))
                }
              />
            </Field>

            <Field label="Ancho base de la tarjeta (px)">
              <Input
                type="number"
                value={config.baseCardWidthPx ?? 88}
                onChange={(e) =>
                  updateConfig("baseCardWidthPx", clampNumber(e.target.value, 40, 320))
                }
              />
            </Field>

            <Field label="Ancho expandido al pasar mouse (px)">
              <Input
                type="number"
                value={config.hoveredCardWidthPx ?? 260}
                onChange={(e) =>
                  updateConfig("hoveredCardWidthPx", clampNumber(e.target.value, 80, 1400))
                }
              />
            </Field>

            <Field label="Radio de bordes (px)">
              <Input
                type="number"
                value={config.borderRadiusPx ?? 8}
                onChange={(e) =>
                  updateConfig("borderRadiusPx", clampNumber(e.target.value, 0, 40))
                }
              />
            </Field>

            <Field label="Duración de transición hover (ms)">
              <Input
                type="number"
                value={config.hoverTransitionMs ?? 380}
                onChange={(e) =>
                  updateConfig("hoverTransitionMs", clampNumber(e.target.value, 120, 1200))
                }
              />
            </Field>
          </div>

          <div className="rounded-2xl border border-neutral-200 bg-white p-4 space-y-4">
            <div className="text-sm font-semibold text-neutral-900">Logo hover marca de agua</div>

            <Field label="Mostrar logo al pasar mouse">
              <Toggle
                checked={!!config.hoverLogoEnabled}
                onChange={(v) => updateConfig("hoverLogoEnabled", !!v)}
              />
            </Field>

            <Field label="Estilo del logo hover">
              <select
                className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm"
                value={config.hoverLogoStyle || "glyph"}
                onChange={(e) => updateConfig("hoverLogoStyle", e.target.value)}
              >
                {INSTAGRAM_HOVER_LOGO_STYLE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Imagen personalizada del logo hover">
              <div className="space-y-3">
                <Input
                  value={config.hoverLogoImage || ""}
                  placeholder="/icons/instagram-hover.png"
                  onChange={(e) => updateConfig("hoverLogoImage", e.target.value)}
                />

                <label className="inline-flex items-center px-3 py-2 rounded-xl bg-neutral-900 text-white text-xs font-medium cursor-pointer hover:bg-neutral-800 transition">
                  {uploading ? "Subiendo..." : "Subir imagen hover"}
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/jpg,image/webp"
                    className="hidden"
                    disabled={uploading}
                    onChange={(e) =>
                      handleUploadConfigImage("hoverLogoImage", e.target.files?.[0] || null)
                    }
                  />
                </label>
              </div>
            </Field>

            <Field label="Color del logo hover">
              <div className="space-y-3">
                <Input
                  value={config.hoverLogoColor || "#ffffff"}
                  onChange={(e) => updateConfig("hoverLogoColor", e.target.value)}
                  placeholder="#ffffff"
                />
                <ColorPresets
                  value={config.hoverLogoColor || "#ffffff"}
                  onChange={(value) => updateConfig("hoverLogoColor", value)}
                />
              </div>
            </Field>

            <Field label="Opacidad del logo hover">
              <Input
                type="number"
                step="0.05"
                value={config.hoverLogoOpacity ?? 0.32}
                onChange={(e) =>
                  updateConfig("hoverLogoOpacity", clampNumber(e.target.value, 0.05, 1))
                }
              />
            </Field>

            <Field label="Tamaño del logo hover (px)">
              <Input
                type="number"
                value={config.hoverLogoSizePx ?? 74}
                onChange={(e) =>
                  updateConfig("hoverLogoSizePx", clampNumber(e.target.value, 20, 220))
                }
              />
            </Field>
          </div>

          <div className="rounded-2xl border border-neutral-200 bg-white p-4 space-y-4">
            <div className="text-sm font-semibold text-neutral-900">Overlay, hover y animación</div>

            <Field label="Activar overlay">
              <Toggle
                checked={!!config.overlayEnabled}
                onChange={(v) => updateConfig("overlayEnabled", !!v)}
              />
            </Field>

            <Field label="Color del overlay">
              <div className="space-y-3">
                <Input
                  value={config.overlayColor || "#000000"}
                  onChange={(e) => updateConfig("overlayColor", e.target.value)}
                  placeholder="#000000"
                />
                <ColorPresets
                  value={config.overlayColor || "#000000"}
                  onChange={(value) => updateConfig("overlayColor", value)}
                />
              </div>
            </Field>

            <Field label="Opacidad del overlay">
              <Input
                type="number"
                step="0.1"
                value={config.overlayOpacity ?? 0.3}
                onChange={(e) =>
                  updateConfig("overlayOpacity", clampNumber(e.target.value, 0, 1))
                }
              />
            </Field>

            <Field label="Efecto hover">
              <select
                className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm"
                value={config.hoverEffect || "zoom"}
                onChange={(e) => updateConfig("hoverEffect", e.target.value)}
              >
                <option value="zoom">Zoom</option>
                <option value="fade">Fade</option>
                <option value="lift">Lift</option>
              </select>
            </Field>

            <Field label="Intensidad hover (scale)">
              <Input
                type="number"
                step="0.01"
                value={config.hoverScale ?? 1.05}
                onChange={(e) => updateConfig("hoverScale", clampNumber(e.target.value, 1, 1.3))}
              />
            </Field>

            <Field label="Animación de entrada">
              <select
                className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm"
                value={config.animation || "fade"}
                onChange={(e) => updateConfig("animation", e.target.value)}
              >
                <option value="none">Ninguna</option>
                <option value="fade">Fade</option>
                <option value="slide">Slide</option>
                <option value="zoom">Zoom</option>
              </select>
            </Field>

            <Field label="Duración de animación (s)">
              <Input
                type="number"
                step="0.1"
                value={config.animationDuration ?? 0.6}
                onChange={(e) =>
                  updateConfig("animationDuration", clampNumber(e.target.value, 0.1, 3))
                }
              />
            </Field>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl border border-neutral-200 bg-white p-4 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-semibold text-neutral-900">Posts de Instagram</div>
              <button
                type="button"
                onClick={addPost}
                className="px-3 py-2 rounded-xl bg-neutral-900 text-white text-xs font-medium hover:bg-neutral-800 transition"
              >
                Agregar post
              </button>
            </div>

            <div className="space-y-4">
              {posts.map((post, index) => (
                <div
                  key={post.id}
                  className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4 space-y-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-xs font-semibold text-neutral-800">
                      Post {index + 1}
                    </div>

                    <button
                      type="button"
                      onClick={() => removePost(index)}
                      className="px-2 py-1 rounded-lg border border-red-200 text-red-600 text-xs hover:bg-red-50 transition"
                    >
                      Eliminar
                    </button>
                  </div>

                  <Field label="Imagen del post">
                    <div className="space-y-3">
                      <Input
                        value={post.image || ""}
                        placeholder="/SeccionInstagram/post.jpg"
                        onChange={(e) => updatePost(index, "image", e.target.value)}
                      />

                      <label className="inline-flex items-center px-3 py-2 rounded-xl bg-neutral-900 text-white text-xs font-medium cursor-pointer hover:bg-neutral-800 transition">
                        {uploading ? "Subiendo..." : "Subir imagen"}
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          disabled={uploading}
                          onChange={(e) =>
                            handleUploadPostImage(index, e.target.files?.[0] || null)
                          }
                        />
                      </label>
                    </div>
                  </Field>

                  <Field label="Link del post">
                    <Input
                      value={post.link || ""}
                      placeholder="https://instagram.com/p/xxxx"
                      onChange={(e) => updatePost(index, "link", e.target.value)}
                    />
                  </Field>

                  <Field label="Mostrar post">
                    <Toggle
                      checked={post.enabled !== false}
                      onChange={(v) => updatePost(index, "enabled", !!v)}
                    />
                  </Field>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-neutral-200 bg-white p-4 space-y-4">
            <div className="text-sm font-semibold text-neutral-900">Vista previa</div>

            <div
              className="relative rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 p-4 space-y-4 overflow-hidden"
              style={{ isolation: "isolate" }}
            >
              {watermarkEnabled && config.watermarkImage ? (
                <div className="absolute inset-0 pointer-events-none z-0">
                  {config.watermarkRepeat ? (
                    <div
                      className="absolute inset-0"
                      style={{
                        backgroundImage: `url(${config.watermarkImage})`,
                        backgroundRepeat: "repeat",
                        backgroundSize: `${watermarkWidthPx}px ${watermarkHeightPx}px`,
                        opacity: watermarkOpacity,
                      }}
                    />
                  ) : (
                    <img
                      src={config.watermarkImage}
                      alt=""
                      aria-hidden="true"
                      draggable={false}
                      style={previewWatermarkStyle}
                    />
                  )}
                </div>
              ) : null}

              <div className="relative z-10 space-y-4">
                <div className="flex justify-end">
                  <a
                    href={config.profileLink || "#"}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center justify-center rounded-full border border-neutral-300 px-6 py-5 shadow-sm"
                    style={{
                      background: badgeBackground,
                    }}
                  >
                    {config.instagramLogo && !logoPreviewError ? (
                      <img
                        src={config.instagramLogo}
                        alt="Instagram"
                        style={{
                          width: `${clampNumber(config.logoSizePx || 180, 24, 300)}px`,
                          height: `${clampNumber(config.logoSizePx || 180, 24, 300)}px`,
                          objectFit: "contain",
                        }}
                        onError={() => {
                          setLogoPreviewError(true);
                        }}
                      />
                    ) : null}
                  </a>
                </div>

                <div
                  style={galleryMode === "grid" ? previewGridStyle : previewFlexStyle}
                  className={galleryMode === "grid" ? "" : "overflow-hidden"}
                >
                  {enabledPosts.length ? (
                    enabledPosts.map((post) => {
                      const isHovered = previewHoveredId === post.id;

                      const dynamicCardStyle =
                        galleryMode === "grid"
                          ? {
                              ...previewCardStyle,
                            }
                          : {
                              ...previewCardStyle,
                              minWidth: `${baseCardWidthPx}px`,
                              width: `${isHovered ? hoveredCardWidthPx : baseCardWidthPx}px`,
                              flex: `0 0 ${isHovered ? hoveredCardWidthPx : baseCardWidthPx}px`,
                              transition: `width ${hoverTransitionMs}ms ease, flex-basis ${hoverTransitionMs}ms ease, box-shadow ${hoverTransitionMs}ms ease, transform ${hoverTransitionMs}ms ease`,
                              boxShadow: isHovered
                                ? "0 14px 34px rgba(0,0,0,0.14)"
                                : "0 4px 14px rgba(0,0,0,0.05)",
                            };

                      return (
                        <div
                          key={post.id}
                          style={dynamicCardStyle}
                          onMouseEnter={() => setPreviewHoveredId(post.id)}
                          onMouseLeave={() => setPreviewHoveredId(null)}
                        >
                          {post.image ? (
                            <img
                              src={post.image}
                              alt={post.id}
                              className="w-full h-full object-cover"
                              style={{
                                transition: `transform ${hoverTransitionMs}ms ease, opacity ${hoverTransitionMs}ms ease`,
                                transform:
                                  isHovered && config.hoverEffect === "zoom"
                                    ? `scale(${clampNumber(config.hoverScale ?? 1.05, 1, 1.3)})`
                                    : "scale(1)",
                                opacity:
                                  isHovered && config.hoverEffect === "fade"
                                    ? 0.78
                                    : 1,
                              }}
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-xs text-neutral-400 bg-white">
                              Sin imagen
                            </div>
                          )}

                          {config.overlayEnabled ? (
                            <div
                              className="absolute inset-0"
                              style={{
                                backgroundColor: config.overlayColor || "#000000",
                                opacity: isHovered
                                  ? clampNumber(config.overlayOpacity ?? 0.3, 0, 1)
                                  : 0,
                                transition: `opacity ${hoverTransitionMs}ms ease`,
                              }}
                            />
                          ) : null}

                          {hoverLogoEnabled ? (
                            <div
                              className="absolute inset-0 flex items-center justify-center pointer-events-none"
                              style={{
                                opacity: isHovered ? 1 : 0,
                                transition: `opacity ${hoverTransitionMs}ms ease`,
                              }}
                            >
                              {renderPreviewHoverLogo(config)}
                            </div>
                          ) : null}
                        </div>
                      );
                    })
                  ) : (
                    <div className="col-span-full rounded-xl border border-neutral-200 bg-white px-4 py-8 text-center text-xs text-neutral-500">
                      No hay posts activos para mostrar en la vista previa.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}