// frontend/src/admin/pages/BlockConfigPanel.jsx
import React, { useState } from "react";
import LookSectionUI from "../appearance/sections/look/LookSectionUI";
import BannerPanel from "../appearance/banner/BannerPanel";
import CategoriasSectionUI from "../appearance/sections/categorias/CategoriasSectionUI";
import ComplementosSectionUI from "../appearance/sections/complementos/ComplementosSectionUI";
import InstagramSectionUI from "../appearance/sections/instagram/InstagramSectionUI";
import TiktokSectionUI from "../appearance/sections/tiktok/TiktokSectionUI";
import InfoSectionUI from "../appearance/sections/info/infoSectionUI";

import {
  LOOK_SECTION_DEFAULTS,
  normalizeLookSection,
} from "../appearance/sections/look/lookSectionHelpers";
import {
  CATEGORIAS_SECTION_DEFAULTS,
  normalizeCategoriasSection,
} from "../appearance/sections/categorias/categoriasSectionHelpers";
import {
  COMPLEMENTOS_SECTION_DEFAULTS,
  normalizeComplementosSection,
} from "../appearance/sections/complementos/complementosSectionHelpers";
import {
  INSTAGRAM_SECTION_ID,
  normalizeInstagramSection,
} from "../appearance/sections/instagram/instagramSectionHelpers";
import {
  TIKTOK_SECTION_ID,
  normalizeTiktokSection,
} from "../appearance/sections/tiktok/tiktokSectionHelpers";
import {
  INFO_SECTION_ID,
  normalizeInfoSection,
} from "../appearance/sections/info/infoSectionHelpers";
import { API_BASE_URL } from "../../config/apiBaseUrl";

const API_BASE = API_BASE_URL;

const Input = ({ label, ...rest }) => (
  <label className="block min-w-0">
    <span className="mb-1 block text-sm font-medium text-gray-700">{label}</span>
    <input
      className="w-full min-w-0 rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-800 outline-none transition focus:border-pink-300 focus:ring-2 focus:ring-pink-200"
      {...rest}
    />
  </label>
);

const Toggle = ({ label, checked, onChange }) => (
  <label className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3">
    <span className="text-sm text-gray-700">{label}</span>
    <input
      type="checkbox"
      checked={!!checked}
      onChange={(e) => onChange(e.target.checked)}
      className="h-4 w-4 shrink-0 accent-pink-600"
    />
  </label>
);

const SectionTitle = ({ children }) => (
  <h3 className="text-base font-semibold text-gray-900">{children}</h3>
);

function isLookSection(section) {
  const id = typeof section?.id === "string" ? section.id.trim().toLowerCase() : "";
  const type = typeof section?.type === "string" ? section.type.trim().toLowerCase() : "";
  return id === "look" || type === "look";
}

function isCategoriasSection(section) {
  const id = typeof section?.id === "string" ? section.id.trim().toLowerCase() : "";
  const type = typeof section?.type === "string" ? section.type.trim().toLowerCase() : "";
  return id === "categorias" || type === "categorias";
}

function isComplementosSection(section) {
  const id = typeof section?.id === "string" ? section.id.trim().toLowerCase() : "";
  const type = typeof section?.type === "string" ? section.type.trim().toLowerCase() : "";
  return id === "complementos" || type === "complementos";
}

function isInstagramSection(section) {
  const id = typeof section?.id === "string" ? section.id.trim().toLowerCase() : "";
  const type = typeof section?.type === "string" ? section.type.trim().toLowerCase() : "";
  return id === INSTAGRAM_SECTION_ID || type === INSTAGRAM_SECTION_ID;
}

function isTiktokSection(section) {
  const id = typeof section?.id === "string" ? section.id.trim().toLowerCase() : "";
  const type = typeof section?.type === "string" ? section.type.trim().toLowerCase() : "";
  return id === TIKTOK_SECTION_ID || type === TIKTOK_SECTION_ID;
}

function isInfoSectionBlock(section) {
  const id = typeof section?.id === "string" ? section.id.trim().toLowerCase() : "";
  const type = typeof section?.type === "string" ? section.type.trim().toLowerCase() : "";
  return (
    id === INFO_SECTION_ID ||
    type === INFO_SECTION_ID ||
    id === "informacion" ||
    type === "informacion"
  );
}

function buildLookSectionFromBlock(block) {
  const rawConfig =
    block?.config && typeof block.config === "object" ? block.config : {};

  const nestedConfig =
    rawConfig?.config && typeof rawConfig.config === "object" ? rawConfig.config : {};

  const nestedStyle =
    rawConfig?.style && typeof rawConfig.style === "object" ? rawConfig.style : {};

  const legacyConfig = {
    ...(typeof rawConfig.title === "string" && !nestedConfig.titleText
      ? { titleText: rawConfig.title }
      : {}),
    ...(typeof rawConfig.selectedProductId === "string" && !nestedConfig.selectedProductId
      ? { selectedProductId: rawConfig.selectedProductId }
      : {}),
  };

  return normalizeLookSection({
    ...LOOK_SECTION_DEFAULTS,
    id: "look",
    type: "look",
    enabled: block?.enabled !== false,
    config: {
      ...(LOOK_SECTION_DEFAULTS.config || {}),
      ...legacyConfig,
      ...nestedConfig,
    },
    style: {
      ...(LOOK_SECTION_DEFAULTS.style || {}),
      ...nestedStyle,
    },
  });
}

function buildCategoriasSectionFromBlock(block) {
  const rawConfig =
    block?.config && typeof block.config === "object" ? block.config : {};

  const nestedConfig =
    rawConfig?.config && typeof rawConfig.config === "object" ? rawConfig.config : {};

  const nestedStyle =
    rawConfig?.style && typeof rawConfig.style === "object" ? rawConfig.style : {};

  const legacyConfig = {
    ...(typeof rawConfig.title === "string" && !nestedConfig.titleText
      ? { titleText: rawConfig.title }
      : {}),
    ...(Array.isArray(rawConfig.items) && !Array.isArray(nestedConfig.slides)
      ? { slides: rawConfig.items }
      : {}),
  };

  return normalizeCategoriasSection({
    ...CATEGORIAS_SECTION_DEFAULTS,
    id: "categorias",
    type: "categorias",
    enabled: block?.enabled !== false,
    config: {
      ...(CATEGORIAS_SECTION_DEFAULTS.config || {}),
      ...legacyConfig,
      ...nestedConfig,
    },
    style: {
      ...(CATEGORIAS_SECTION_DEFAULTS.style || {}),
      ...nestedStyle,
    },
  });
}

function buildComplementosSectionFromBlock(block) {
  const rawConfig =
    block?.config && typeof block.config === "object" ? block.config : {};

  const nestedConfig =
    rawConfig?.config && typeof rawConfig.config === "object" ? rawConfig.config : {};

  const nestedStyle =
    rawConfig?.style && typeof rawConfig.style === "object" ? rawConfig.style : {};

  const legacyConfig = {
    ...(typeof rawConfig.imageSrc === "string" && !nestedConfig.imageSrc
      ? { imageSrc: rawConfig.imageSrc }
      : {}),
    ...(typeof rawConfig.buttonText === "string" && !nestedConfig.buttonText
      ? { buttonText: rawConfig.buttonText }
      : {}),
    ...(typeof rawConfig.linkHref === "string" && !nestedConfig.linkHref
      ? { linkHref: rawConfig.linkHref }
      : {}),
    ...(typeof rawConfig.imageAlt === "string" && !nestedConfig.imageAlt
      ? { imageAlt: rawConfig.imageAlt }
      : {}),
    ...(typeof rawConfig.recommendedImageNote === "string" && !nestedConfig.recommendedImageNote
      ? { recommendedImageNote: rawConfig.recommendedImageNote }
      : {}),
    ...(typeof rawConfig.buttonEnabled === "boolean" &&
    typeof nestedConfig.buttonEnabled !== "boolean"
      ? { buttonEnabled: rawConfig.buttonEnabled }
      : {}),
  };

  return normalizeComplementosSection({
    ...COMPLEMENTOS_SECTION_DEFAULTS,
    id: "complementos",
    type: "complementos",
    enabled: block?.enabled !== false,
    config: {
      ...(COMPLEMENTOS_SECTION_DEFAULTS.config || {}),
      ...legacyConfig,
      ...nestedConfig,
    },
    style: {
      ...(COMPLEMENTOS_SECTION_DEFAULTS.style || {}),
      ...nestedStyle,
    },
  });
}

function buildInstagramSectionFromBlock(block) {
  const rawConfig =
    block?.config && typeof block.config === "object" ? block.config : {};

  const nestedConfig =
    rawConfig?.config && typeof rawConfig.config === "object" ? rawConfig.config : {};

  const nestedStyle =
    rawConfig?.style && typeof rawConfig.style === "object" ? rawConfig.style : {};

  const flatPosts = Array.isArray(rawConfig.posts) ? rawConfig.posts : [];
  const nestedPosts = Array.isArray(nestedConfig.posts) ? nestedConfig.posts : [];

  const legacyPostsFromItems =
    Array.isArray(rawConfig.items) && nestedPosts.length === 0 && flatPosts.length === 0
      ? rawConfig.items.map((item, index) => ({
          id: item?.id || `post_${index + 1}`,
          image: item?.image || item?.thumb || "",
          link: item?.link || "",
          enabled: item?.enabled !== false,
        }))
      : [];

  const resolvedPosts =
    nestedPosts.length > 0
      ? nestedPosts
      : flatPosts.length > 0
      ? flatPosts
      : legacyPostsFromItems;

  const legacyConfig = {
    ...(typeof rawConfig.title === "string" && !nestedConfig.titleText
      ? { titleText: rawConfig.title }
      : {}),
    ...(typeof rawConfig.profileUser === "string" && !nestedConfig.profileUser
      ? { profileUser: rawConfig.profileUser }
      : {}),
    ...(typeof rawConfig.profileLink === "string" && !nestedConfig.profileLink
      ? { profileLink: rawConfig.profileLink }
      : {}),
    ...(typeof rawConfig.titleImage === "string" && !nestedConfig.titleImage
      ? { titleImage: rawConfig.titleImage }
      : {}),
    ...(typeof rawConfig.instagramLogo === "string" && !nestedConfig.instagramLogo
      ? { instagramLogo: rawConfig.instagramLogo }
      : {}),
    ...(resolvedPosts.length ? { posts: resolvedPosts } : {}),
  };

  return normalizeInstagramSection({
    ...(typeof block === "object" && block ? block : {}),
    id: INSTAGRAM_SECTION_ID,
    type: INSTAGRAM_SECTION_ID,
    enabled: block?.enabled !== false,
    config: {
      ...legacyConfig,
      ...nestedConfig,
      ...(nestedStyle && Object.keys(nestedStyle).length
        ? { style: nestedStyle }
        : {}),
    },
  });
}

function buildTiktokSectionFromBlock(block) {
  const rawConfig =
    block?.config && typeof block.config === "object" ? block.config : {};

  const nestedConfig =
    rawConfig?.config && typeof rawConfig.config === "object" ? rawConfig.config : {};

  const nestedStyle =
    rawConfig?.style && typeof rawConfig.style === "object" ? rawConfig.style : {};

  const legacyPosts =
    Array.isArray(rawConfig.items) && !Array.isArray(nestedConfig.posts)
      ? rawConfig.items.map((item, index) => ({
          id: item?.id || `post_${index + 1}`,
          image: item?.image || item?.thumb || "",
          thumb: item?.thumb || item?.image || "",
          link: item?.link || "",
          videoUrl: item?.videoUrl || "",
          enabled: item?.enabled !== false,
        }))
      : [];

  const legacyConfig = {
    ...(typeof rawConfig.title === "string" && !nestedConfig.titleText
      ? { titleText: rawConfig.title }
      : {}),
    ...(typeof rawConfig.profileUser === "string" && !nestedConfig.profileUser
      ? { profileUser: rawConfig.profileUser }
      : {}),
    ...(legacyPosts.length ? { posts: legacyPosts } : {}),
  };

  return normalizeTiktokSection({
    ...(typeof block === "object" && block ? block : {}),
    id: TIKTOK_SECTION_ID,
    type: TIKTOK_SECTION_ID,
    enabled: block?.enabled !== false,
    config: {
      ...legacyConfig,
      ...nestedConfig,
      ...(nestedStyle && Object.keys(nestedStyle).length
        ? { style: nestedStyle }
        : {}),
    },
  });
}

function buildInfoSectionFromBlock(block) {
  const rawConfig =
    block?.config && typeof block.config === "object" ? block.config : {};

  const nestedConfig =
    rawConfig?.config && typeof rawConfig.config === "object" ? rawConfig.config : {};

  const nestedStyle =
    rawConfig?.style && typeof rawConfig.style === "object" ? rawConfig.style : {};

  const legacyCards =
    Array.isArray(rawConfig.items) && !Array.isArray(nestedConfig.cards)
      ? rawConfig.items.map((item, index) => ({
          id: item?.id || `card_${index + 1}`,
          iconType: item?.iconType || "lucide",
          icon: item?.icon || "star",
          iconUrl: item?.iconUrl || "",
          iconSize: item?.iconSize || 32,
          iconColor: item?.iconColor || "#ffffff",
          iconBgColor: item?.iconBgColor || "#fbcfe8",
          text: item?.text || "",
          textColor: item?.textColor || "#111827",
          textFontSize: item?.textFontSize || 18,
          textFontFamily: item?.textFontFamily || "",
        }))
      : [];

  const legacyConfig = {
    ...(typeof rawConfig.title === "string" && !nestedConfig.titleText
      ? { titleText: rawConfig.title }
      : {}),
    ...(legacyCards.length ? { cards: legacyCards } : {}),
  };

  const safeSection = normalizeInfoSection({
    ...(typeof block === "object" && block ? block : {}),
    id: INFO_SECTION_ID,
    type: INFO_SECTION_ID,
    enabled: block?.enabled !== false,
    config: {
      ...legacyConfig,
      ...nestedConfig,
    },
  });

  if (nestedStyle && Object.keys(nestedStyle).length) {
    safeSection.style = {
      ...(safeSection.style || {}),
      ...nestedStyle,
    };
  }

  return safeSection;
}

function buildDefaultBannerButton() {
  return {
    enabled: true,
    kind: "image",
    imageUrl: "/ImgBotones/VerMas2.png",
    text: "",
    link: "",
    posX: 50,
    posY: 92,
    widthPx: 200,
    anim: "inherit",
    animDurationMs: 600,
    animDelayMs: 0,
  };
}

function normalizeBannerConfig(raw) {
  const source = raw && typeof raw === "object" ? raw : {};

  return {
    type: source.type || "slider",
    slides: Array.isArray(source.slides)
      ? source.slides.map((slide) => {
          const safeSlide = slide || {};
          return {
            image: "",
            link: "",
            posX: 50,
            posY: 50,
            fit: "cover",
            ...safeSlide,
            button: {
              ...buildDefaultBannerButton(),
              ...(safeSlide.button || {}),
            },
          };
        })
      : [],
    imageUrl: source.imageUrl || "",
    imageLink: source.imageLink || "",
    videoUrl: source.videoUrl || "",
    videoAutoplay: source.videoAutoplay !== false,
    videoMuted: source.videoMuted !== false,
    videoLoop: source.videoLoop !== false,
    heightMode: source.heightMode || "auto",
    heightPx: Number.isFinite(Number(source.heightPx)) ? Number(source.heightPx) : 520,
    imagePosX: Number.isFinite(Number(source.imagePosX)) ? Number(source.imagePosX) : 50,
    imagePosY: Number.isFinite(Number(source.imagePosY)) ? Number(source.imagePosY) : 50,
    imageFit: source.imageFit === "contain" ? "contain" : "cover",
    imageButton: {
      ...buildDefaultBannerButton(),
      ...(source.imageButton || {}),
    },
    videoButton: {
      ...buildDefaultBannerButton(),
      ...(source.videoButton || {}),
    },
    sliderIntervalMs: Number.isFinite(Number(source.sliderIntervalMs))
      ? Number(source.sliderIntervalMs)
      : 3500,
    sliderShowProgress: source.sliderShowProgress !== false,
  };
}

function uploadFactory() {
  return async (file, fieldName = "image") => {
    if (!file) return "";

    const formData = new FormData();
    formData.append(fieldName, file);

    const res = await fetch(`${API_BASE}/api/uploads`, {
      method: "POST",
      body: formData,
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(data?.message || "No se pudo subir el archivo");
    }

    return data?.url || "";
  };
}

function LookBlockEditor({ block, onChange }) {
  const lookSection = buildLookSectionFromBlock(block);
  const uploadToCloudinary = uploadFactory();

  const theme = {
    sections: [lookSection],
  };

  const setPath = (path, value) => {
    if (path !== "sections") return;

    const sections = Array.isArray(value) ? value : [];
    const nextLookSection =
      sections.find((section) => isLookSection(section)) || lookSection;

    const safeLook = normalizeLookSection(nextLookSection);

    onChange({
      ...block,
      enabled: safeLook.enabled !== false,
      config: {
        config: {
          ...(safeLook.config || {}),
        },
        style: {
          ...(safeLook.style || {}),
        },
      },
    });
  };

  return (
    <LookSectionUI
      theme={theme}
      setPath={setPath}
      uploadToCloudinary={uploadToCloudinary}
    />
  );
}

function CategoriasBlockEditor({ block, onChange }) {
  const categoriasSection = buildCategoriasSectionFromBlock(block);
  const uploadToCloudinary = uploadFactory();

  const theme = {
    sections: [categoriasSection],
  };

  const setPath = (path, value) => {
    if (path !== "sections") return;

    const sections = Array.isArray(value) ? value : [];
    const nextCategoriasSection =
      sections.find((section) => isCategoriasSection(section)) || categoriasSection;

    const safeCategorias = normalizeCategoriasSection(nextCategoriasSection);

    onChange({
      ...block,
      enabled: safeCategorias.enabled !== false,
      config: {
        config: {
          ...(safeCategorias.config || {}),
        },
        style: {
          ...(safeCategorias.style || {}),
        },
      },
    });
  };

  return (
    <CategoriasSectionUI
      theme={theme}
      setPath={setPath}
      uploadToCloudinary={uploadToCloudinary}
    />
  );
}

function ComplementosBlockEditor({ block, onChange }) {
  const complementosSection = buildComplementosSectionFromBlock(block);
  const uploadToCloudinary = uploadFactory();

  const theme = {
    sections: [complementosSection],
  };

  const setPath = (path, value) => {
    if (path !== "sections") return;

    const sections = Array.isArray(value) ? value : [];
    const nextComplementosSection =
      sections.find((section) => isComplementosSection(section)) || complementosSection;

    const safeComplementos = normalizeComplementosSection(nextComplementosSection);

    onChange({
      ...block,
      enabled: safeComplementos.enabled !== false,
      config: {
        config: {
          ...(safeComplementos.config || {}),
        },
        style: {
          ...(safeComplementos.style || {}),
        },
      },
    });
  };

  return (
    <ComplementosSectionUI
      theme={theme}
      setPath={setPath}
      uploadToCloudinary={uploadToCloudinary}
    />
  );
}

function InstagramBlockEditor({ block, onChange }) {
  const instagramSection = buildInstagramSectionFromBlock(block);
  const uploadToCloudinary = uploadFactory();

  const theme = {
    sections: [instagramSection],
  };

  const setPath = (path, value) => {
    if (path !== "sections") return;

    const sections = Array.isArray(value) ? value : [];
    const nextInstagramSection =
      sections.find((section) => isInstagramSection(section)) || instagramSection;

    const safeInstagram = normalizeInstagramSection(nextInstagramSection);

    onChange({
      ...block,
      enabled: safeInstagram.enabled !== false,
      config: {
        ...(safeInstagram.config || {}),
      },
    });
  };

  return (
    <InstagramSectionUI
      theme={theme}
      setPath={setPath}
      uploadToCloudinary={uploadToCloudinary}
      uploading={false}
    />
  );
}

function TiktokBlockEditor({ block, onChange }) {
  const tiktokSection = buildTiktokSectionFromBlock(block);
  const uploadToCloudinary = uploadFactory();

  const theme = {
    sections: [tiktokSection],
  };

  const setPath = (path, value) => {
    if (path !== "sections") return;

    const sections = Array.isArray(value) ? value : [];
    const nextTiktokSection =
      sections.find((section) => isTiktokSection(section)) || tiktokSection;

    const safeTiktok = normalizeTiktokSection(nextTiktokSection);

    onChange({
      ...block,
      enabled: safeTiktok.enabled !== false,
      config: {
        ...(safeTiktok.config || {}),
      },
    });
  };

  return (
    <TiktokSectionUI
      theme={theme}
      setPath={setPath}
      uploadToCloudinary={uploadToCloudinary}
      uploading={false}
    />
  );
}

function InfoBlockEditor({ block, onChange }) {
  const infoSection = buildInfoSectionFromBlock(block);
  const uploadToCloudinary = uploadFactory();

  const theme = {
    sections: [infoSection],
  };

  const setPath = (path, value) => {
    if (path !== "sections") return;

    const sections = Array.isArray(value) ? value : [];
    const nextInfoSection =
      sections.find((section) => isInfoSectionBlock(section)) || infoSection;

    const safeInfo = normalizeInfoSection(nextInfoSection);

    onChange({
      ...block,
      enabled: safeInfo.enabled !== false,
      config: {
        ...(safeInfo.config || {}),
        ...((safeInfo.style && Object.keys(safeInfo.style).length)
          ? { style: safeInfo.style }
          : {}),
      },
    });
  };

  return (
    <InfoSectionUI
      theme={theme}
      setPath={setPath}
      uploadToCloudinary={uploadToCloudinary}
      uploading={false}
    />
  );
}

function BannerBlockEditor({ block, onChange }) {
  const [uploading, setUploading] = useState(false);

  const safeBanner = normalizeBannerConfig(block?.config);

  const theme = {
    banner: safeBanner,
  };

  const setPath = (path, value) => {
    if (!path) return;

    if (path === "banner") {
      onChange({
        ...block,
        config: normalizeBannerConfig(value),
      });
      return;
    }

    if (!path.startsWith("banner.")) return;

    const keys = path.split(".").slice(1);
    const draft = structuredClone(safeBanner);
    let ref = draft;

    for (let i = 0; i < keys.length - 1; i += 1) {
      const key = keys[i];
      if (ref[key] == null || typeof ref[key] !== "object") {
        ref[key] = {};
      }
      ref = ref[key];
    }

    ref[keys[keys.length - 1]] = value;

    onChange({
      ...block,
      config: normalizeBannerConfig(draft),
    });
  };

  const uploadToCloudinaryViaBackend = uploadFactory();

  return (
    <BannerPanel
      theme={theme}
      setPath={setPath}
      uploading={uploading}
      setUploading={setUploading}
      uploadToCloudinaryViaBackend={uploadToCloudinaryViaBackend}
      onPreview={() => {}}
    />
  );
}

export default function BlockConfigPanel({ block, onChange }) {
  if (!block) return null;

  const type = String(block.type || "").trim().toLowerCase();

  if (type === "look") {
    return <LookBlockEditor block={block} onChange={onChange} />;
  }

  if (type === "banner") {
    return <BannerBlockEditor block={block} onChange={onChange} />;
  }

  if (type === "categorias") {
    return <CategoriasBlockEditor block={block} onChange={onChange} />;
  }

  if (type === "complementos") {
    return <ComplementosBlockEditor block={block} onChange={onChange} />;
  }

  if (type === "instagram") {
    return <InstagramBlockEditor block={block} onChange={onChange} />;
  }

  if (type === "tiktok") {
    return <TiktokBlockEditor block={block} onChange={onChange} />;
  }

  if (type === "informacion" || type === "info") {
    return <InfoBlockEditor block={block} onChange={onChange} />;
  }

  const config = block.config || {};

  const updateBlock = (patch) => {
    onChange({
      ...block,
      ...patch,
    });
  };

  const updateConfig = (patch) => {
    onChange({
      ...block,
      config: {
        ...config,
        ...patch,
      },
    });
  };

  return (
    <div className="rounded-2xl border border-pink-100 bg-pink-50/50 p-4 space-y-4">
      <SectionTitle>Configuración del bloque</SectionTitle>

      <div className="grid gap-4 md:grid-cols-2">
        <Toggle
          label="Bloque activo"
          checked={block.enabled}
          onChange={(value) => updateBlock({ enabled: value })}
        />

        <Input
          label="Orden"
          type="number"
          min={0}
          step={1}
          value={block.order ?? 0}
          onChange={(e) => updateBlock({ order: Number(e.target.value) })}
        />
      </div>

      {type === "tendencia" && (
        <div className="grid gap-4 md:grid-cols-2">
          <Input
            label="Título"
            value={config.title || ""}
            onChange={(e) => updateConfig({ title: e.target.value })}
            placeholder="En tendencia"
          />

          <Input
            label="Cantidad de items"
            type="number"
            min={0}
            step={1}
            value={Array.isArray(config.items) ? config.items.length : 0}
            onChange={(e) => {
              const total = Number(e.target.value) || 0;
              const nextItems = Array.from({ length: total }, (_, i) => config.items?.[i] || {});
              updateConfig({ items: nextItems });
            }}
          />
        </div>
      )}
    </div>
  );
}
