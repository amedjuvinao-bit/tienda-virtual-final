import {
  INSTAGRAM_SECTION_DEFAULTS,
} from "../appearance/sections/instagram/instagramSectionHelpers";
import {
  TIKTOK_SECTION_DEFAULTS,
} from "../appearance/sections/tiktok/tiktokSectionHelpers";
import {
  INFO_SECTION_DEFAULTS,
} from "../appearance/sections/info/infoSectionHelpers";

export function getDefaultBlockConfig(type) {
  switch (String(type || "").trim().toLowerCase()) {
    case "banner":
      return {
        height: 500,
        autoplay: true,
        delay: 4000,
        slides: [],
      };

    case "tendencia":
      return {
        title: "En tendencia",
        items: [],
      };

    case "look":
      return {
        title: "Completa tu look",
        selectedProductId: "",
      };

    case "complementos":
      return {
        imageSrc: "",
        buttonText: "Ver más",
        buttonEnabled: true,
      };

    case "categorias":
      return {
        title: "Categorías",
        items: [],
      };

    case "instagram":
      return {
        ...INSTAGRAM_SECTION_DEFAULTS.config,
      };

    case "tiktok":
      return {
        ...(TIKTOK_SECTION_DEFAULTS?.config || {
          titleText: "Síguenos en TikTok",
          profileUser: "",
          posts: [],
        }),
      };

    case "informacion":
      return {
        ...(INFO_SECTION_DEFAULTS?.config || {
          titleText: "Información",
          cards: [],
        }),
      };

    default:
      return {};
  }
}

export function createBlock(type, order = 0) {
  return {
    id: `block_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    type,
    enabled: true,
    order,
    config: getDefaultBlockConfig(type),
  };
}