// backend/routes/siteSettings.js
const express = require("express");
const router = express.Router();

const SiteSettings = require("../models/SiteSettings");
const requireAdmin = require("../middleware/requireAdmin");
const requirePermission = require("../middleware/requirePermission");
const {
  buildAdminSiteSettings,
  buildPublicSiteSettings,
  stripProtectedWriteFields,
} = require("../lib/siteSettingsSecurity");
const {
  getUnsupportedSiteSettingsKeys,
  resolveSiteSettingsWritePermissions,
} = require("../security/siteSettingsWritePermissions");

/**
 * 🔎 Ping de diagnóstico
 * GET /api/site-settings/ping
 */
router.get("/ping", (_req, res) => {
  res.json({ ok: true, where: "siteSettings router" });
});

// Defaults (incluye header.logoHeightPx y menus.social)
function buildDefaultSettings() {
  return {
    store: {
      name: "",
      businessName: "",
      email: "",
      phone: "",
      whatsapp: "",
      supportEmail: "",
      website: "",
      address: "",
      city: "",
      cityCode: "",
      department: "",
      departmentCode: "",
      country: "CO",
      timezone: "America/Bogota",
      locale: "es-CO",
      customerServiceHours: "",
      weeklySchedule: null,
    },

    theme: {
      colors: {
        primary: "#111827",
        secondary: "#4b5563",
        text: "#111827",
        background: "#ffffff",
        accent: "#ef4444",
      },
      fonts: { base: "Inter", headings: "Poppins", fontSize: 16, lineHeight: 1.6 },
      radius: { sm: 6, md: 10, lg: 14 },
      spacing: { base: 8 },
      logo: { light: "", dark: "" },
      favicon: "",
      header: {
        bgColor: "",
        bgOpacity: 1,
        textColor: "",
        linkColor: "",
        menuAnimation: "soft",
        iconColor: "",
        iconHoverColor: "",
        iconAnimation: "soft",
        fontPreset: "",
        fontFamily: "",
        fontSizePx: 16,
        logoLight: "",
        logoDark: "",
        logoHeightPx: 80,
      },

      home: {
        title: "",
        subtitle: "",
        bgImage: "",
        textColor: "",
      },

      footer: {
        bgColor: "",
        textColor: "",
      },

      banner: {
        type: "slider",
        slides: [],
        imageUrl: "",
        imageLink: "",
        imagePosX: 50,
        imagePosY: 50,
        imageFit: "cover",
        videoUrl: "",
        videoAutoplay: true,
        videoMuted: true,
        videoLoop: true,
        heightMode: "auto",
        heightPx: 520,
        imageButton: {
          enabled: true,
          kind: "image",
          imageUrl: "",
          text: "",
          link: "",
          posX: 50,
          posY: 85,
          widthPx: 180,
        },
        videoButton: {
          enabled: true,
          kind: "image",
          imageUrl: "",
          text: "",
          link: "",
          posX: 50,
          posY: 85,
          widthPx: 180,
        },
      },

      sections: [],
    },

    admin: {
      theme: {},
      layout: "default",
      sidebar: "expanded",
      background: {
        enabled: false,
        image: "",
      },
    },

    loginAdmin: {
      theme: "liquidGlass",
      layout: "centeredCard",
      background: {
        mode: "theme",
        color: "#16324a",
        image: "",
        imageOpacity: 0.35,
        overlay: 0.35,
        glassTransparency: 0.35,
      },
      backgrounds: {},
    },

    billing: {
      fiscalInfo: {
        businessName: "",
        nit: "",
        dv: "",
        taxRegime: "",
        taxResponsibility: "",
        taxLevelCode: "",
        responsibilityCode: "",
        legalRepresentative: "",
        billingEmail: "",
        address: "",
        city: "",
        cityCode: "",
        municipalityCode: "",
        department: "",
        departmentCode: "",
        country: "CO",
      },
      dianResolution: {
        resolutionNumber: "",
        prefix: "",
        rangeFrom: 1,
        rangeTo: 1,
        currentNumber: 1,
        resolutionDate: "",
        expirationDate: "",
        documentType: "",
        technicalKey: "",
        environment: "2",
      },
      dian: {
        enabled: false,
        mode: "internal",
        environment: "2",
        providerType: "",
        softwareId: "",
        softwarePin: "",
        softwareSecurityCode: "",
        testSetId: "",
        providerNit: "",
        providerDv: "",
        certificateFileName: "",
        certificatePath: "",
        certificatePassword: "",
        certificateUploadedAt: null,
        wsdlUrl: "",
        productionWsdlUrl: "",
        habilitationWsdlUrl: "",
        lastTestStatus: "",
        lastTestMessage: "",
        lastTestAt: null,
        lastSyncStatus: "",
        lastSyncMessage: "",
        lastSyncAt: null,
      },
      legalTexts: {
        invoiceLegalText: "",
        internalReceiptNote: "",
      },
      taxes: {
        iva: {
          enabled: true,
          percent: 19,
          code: "01",
          name: "IVA",
        },
      },
    },

    menus: { header: [], footer: [], social: [] },
    updatedBy: "system",
  };
}

// Helper: asegura que exista un documento singleton (y devuelve {_id})
async function ensureSingletonId() {
  const existing = await SiteSettings.findOne().select("_id").lean();
  if (existing?._id) return existing._id;

  const created = await SiteSettings.create(buildDefaultSettings());
  return created._id;
}

/**
 * Convierte un objeto en un mapa plano para $set:
 * { a: { b: 1 } } -> { "a.b": 1 }
 * Ignora undefined. Permite null (para limpiar campos si quieres).
 */
function flattenForSet(obj, prefix = "", out = {}) {
  if (!obj || typeof obj !== "object") return out;

  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;

    if (value === undefined) continue;

    const isPlainObject =
      value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      !(value instanceof Date);

    if (isPlainObject) {
      flattenForSet(value, path, out);
    } else {
      out[path] = value;
    }
  }
  return out;
}

function isInvalidSettingsSection(value) {
  return (
    value !== undefined &&
    (!value || typeof value !== "object" || Array.isArray(value))
  );
}

function validateAdminBackground(admin) {
  if (
    !admin ||
    !Object.prototype.hasOwnProperty.call(admin, "background")
  ) {
    return null;
  }

  const background = admin.background;
  if (!background || typeof background !== "object" || Array.isArray(background)) {
    return "admin.background debe ser un objeto";
  }

  if (
    Object.prototype.hasOwnProperty.call(background, "enabled") &&
    typeof background.enabled !== "boolean"
  ) {
    return "admin.background.enabled debe ser verdadero o falso";
  }

  if (
    Object.prototype.hasOwnProperty.call(background, "image") &&
    typeof background.image !== "string"
  ) {
    return "admin.background.image debe ser una URL";
  }

  const image = String(background.image || "").trim();
  if (background.enabled && !image) {
    return "Debes cargar una imagen antes de activar el fondo del panel";
  }

  if (!image) return null;

  try {
    const url = new URL(image);
    if (
      url.protocol !== "https:" ||
      url.hostname !== "res.cloudinary.com" ||
      !url.pathname.includes("/image/upload/")
    ) {
      return "El fondo del panel debe ser una imagen segura de Cloudinary";
    }
  } catch {
    return "La URL del fondo del panel no es válida";
  }

  return null;
}

/**
 * ✅ autocorrige documentos viejos para que tengan theme.sections
 */
async function ensureThemeSectionsExists() {
  const doc = await SiteSettings.findOne().select("_id theme.sections").lean();
  if (!doc?._id) return;

  const hasSections = Array.isArray(doc?.theme?.sections);
  if (hasSections) return;

  await SiteSettings.findByIdAndUpdate(
    doc._id,
    { $set: { "theme.sections": [] } },
    { strict: false }
  );
}

/**
 * ✅ autocorrige documentos viejos para que tengan admin y loginAdmin
 */
async function ensureAdminAppearanceExists() {
  const doc = await SiteSettings.findOne().select("_id admin loginAdmin").lean();
  if (!doc?._id) return;

  const $set = {};

  if (!doc.admin) {
    $set.admin = {
      theme: {},
      layout: "default",
      sidebar: "expanded",
      background: {
        enabled: false,
        image: "",
      },
    };
  }

  if (!doc.loginAdmin) {
    $set.loginAdmin = {
      theme: "liquidGlass",
      layout: "centeredCard",
      background: {
        mode: "theme",
        color: "#16324a",
        image: "",
        imageOpacity: 0.35,
        overlay: 0.35,
        glassTransparency: 0.35,
      },
      backgrounds: {},
    };
  }

  if (Object.keys($set).length === 0) return;

  await SiteSettings.findByIdAndUpdate(doc._id, { $set }, { strict: false });
}

/**
 * ✅ autocorrige documentos viejos para que tengan billing completo
 */
async function ensureBillingExists() {
  const doc = await SiteSettings.findOne().select("_id billing").lean();
  if (!doc?._id) return;

  const defaults = buildDefaultSettings().billing;
  const $set = {};

  if (!doc.billing || typeof doc.billing !== "object") {
    $set.billing = defaults;
  } else {
    if (!doc.billing.fiscalInfo || typeof doc.billing.fiscalInfo !== "object") {
      $set["billing.fiscalInfo"] = defaults.fiscalInfo;
    } else {
      for (const [key, value] of Object.entries(defaults.fiscalInfo)) {
        if (typeof doc.billing.fiscalInfo[key] === "undefined") {
          $set[`billing.fiscalInfo.${key}`] = value;
        }
      }
    }

    if (!doc.billing.dianResolution || typeof doc.billing.dianResolution !== "object") {
      $set["billing.dianResolution"] = defaults.dianResolution;
    } else {
      for (const [key, value] of Object.entries(defaults.dianResolution)) {
        if (typeof doc.billing.dianResolution[key] === "undefined") {
          $set[`billing.dianResolution.${key}`] = value;
        }
      }
    }

    if (!doc.billing.dian || typeof doc.billing.dian !== "object") {
      $set["billing.dian"] = defaults.dian;
    } else {
      for (const [key, value] of Object.entries(defaults.dian)) {
        if (typeof doc.billing.dian[key] === "undefined") {
          $set[`billing.dian.${key}`] = value;
        }
      }
    }

    if (!doc.billing.legalTexts || typeof doc.billing.legalTexts !== "object") {
      $set["billing.legalTexts"] = defaults.legalTexts;
    }

    if (!doc.billing.taxes || typeof doc.billing.taxes !== "object") {
      $set["billing.taxes"] = defaults.taxes;
    } else if (!doc.billing.taxes.iva || typeof doc.billing.taxes.iva !== "object") {
      $set["billing.taxes.iva"] = defaults.taxes.iva;
    } else {
      for (const [key, value] of Object.entries(defaults.taxes.iva)) {
        if (typeof doc.billing.taxes.iva[key] === "undefined") {
          $set[`billing.taxes.iva.${key}`] = value;
        }
      }
    }
  }

  if (Object.keys($set).length === 0) return;

  await SiteSettings.findByIdAndUpdate(doc._id, { $set }, { strict: false });
}

/**
 * ✅ autocorrige documentos viejos para que tengan store
 */
async function ensureStoreExists() {
  const doc = await SiteSettings.findOne().select("_id store").lean();
  if (!doc?._id) return;

  if (doc.store && typeof doc.store === "object") return;

  await SiteSettings.findByIdAndUpdate(
    doc._id,
    { $set: { store: buildDefaultSettings().store } },
    { strict: false }
  );
}

/**
 * GET /api/site-settings
 * Devuelve el documento (crea uno por defecto si no existe)
 * ✅ Autocorrige theme.sections si el documento es viejo
 */
async function loadSettingsDocument() {
  await ensureSingletonId();
  await ensureThemeSectionsExists();
  await ensureAdminAppearanceExists();
  await ensureBillingExists();
  await ensureStoreExists();

  return SiteSettings.findOne().lean();
}

function requireSensitiveSettingsPermissions(req, res, next) {
  const requiredPermissions = resolveSiteSettingsWritePermissions(req.body);

  if (!requiredPermissions.length) return next();

  return requirePermission(requiredPermissions)(req, res, next);
}

router.get(
  "/admin",
  requireAdmin,
  requirePermission("settings:view"),
  async (_req, res, next) => {
    try {
      const doc = await loadSettingsDocument();
      res.json(buildAdminSiteSettings(doc));
    } catch (err) {
      next(err);
    }
  }
);

router.get("/", async (_req, res, next) => {
  try {
    const doc = await loadSettingsDocument();
    res.set("Cache-Control", "no-store, no-cache, must-revalidate");
    res.json(buildPublicSiteSettings(doc));
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/site-settings
 * Guarda cambios globales de theme, menus, admin y/o billing.
 * Tienda se actualiza exclusivamente mediante /api/admin/store-settings.
 * Login administrativo se actualiza exclusivamente mediante
 * /api/admin/login-settings para conservar su revisión.
 * body: { theme?, menus?, admin?, billing? }
 */
router.put("/", requireAdmin, requireSensitiveSettingsPermissions, async (req, res, next) => {
  try {
    const { theme, menus, admin, billing } = req.body || {};
    const unsupportedKeys = getUnsupportedSiteSettingsKeys(req.body);

    if (unsupportedKeys.length) {
      return res.status(400).json({
        ok: false,
        error: "UNSUPPORTED_SETTINGS_FIELDS",
        message: "La solicitud contiene secciones de configuración no admitidas.",
        fields: unsupportedKeys,
      });
    }

    if (!resolveSiteSettingsWritePermissions(req.body).length) {
      return res.status(400).json({
        ok: false,
        error: "EMPTY_SETTINGS_UPDATE",
        message: "Debes enviar al menos una sección de configuración válida.",
      });
    }

    if (Object.prototype.hasOwnProperty.call(req.body || {}, "store")) {
      return res.status(409).json({
        ok: false,
        error: "STORE_DEDICATED_ENDPOINT_REQUIRED",
        message: "Los datos de Tienda deben guardarse desde su módulo protegido.",
      });
    }

    if (Object.prototype.hasOwnProperty.call(req.body || {}, "loginAdmin")) {
      return res.status(409).json({
        ok: false,
        error: "LOGIN_SETTINGS_DEDICATED_ENDPOINT_REQUIRED",
        message: "El diseño del Login administrativo debe guardarse desde su módulo protegido.",
      });
    }

    if (
      req.body?.theme?.global &&
      Object.prototype.hasOwnProperty.call(req.body.theme.global, "payments")
    ) {
      return res.status(409).json({
        ok: false,
        error: "PAYMENTS_DEDICATED_ENDPOINT_REQUIRED",
        message: "La configuración de Pagos debe guardarse desde su módulo protegido.",
      });
    }

    if (
      req.body?.theme?.global &&
      Object.prototype.hasOwnProperty.call(req.body.theme.global, "envios")
    ) {
      return res.status(409).json({
        ok: false,
        error: "SHIPPING_RATES_DEDICATED_ENDPOINT_REQUIRED",
        message: "Las tarifas de Envíos deben guardarse desde su módulo protegido.",
      });
    }

    if (isInvalidSettingsSection(theme)) {
      return res.status(400).json({ error: "theme debe ser un objeto" });
    }
    if (isInvalidSettingsSection(menus)) {
      return res.status(400).json({ error: "menus debe ser un objeto" });
    }
    if (isInvalidSettingsSection(admin)) {
      return res.status(400).json({ error: "admin debe ser un objeto" });
    }
    const adminBackgroundError = validateAdminBackground(admin);
    if (adminBackgroundError) {
      return res.status(400).json({
        ok: false,
        error: "INVALID_ADMIN_BACKGROUND",
        message: adminBackgroundError,
      });
    }
    if (isInvalidSettingsSection(billing)) {
      return res.status(400).json({ error: "billing debe ser un objeto" });
    }
    const updatedBy =
      req.adminUsername ||
      req.adminUserId ||
      "admin";

    const id = await ensureSingletonId();

    await ensureThemeSectionsExists();
    await ensureAdminAppearanceExists();
    await ensureBillingExists();
    await ensureStoreExists();

    const $set = { updatedBy };

    if (theme) {
      const flatTheme = flattenForSet(theme, "theme");
      Object.assign($set, flatTheme);
    }

    if (admin) {
      const flatAdmin = flattenForSet(admin, "admin");
      Object.assign($set, flatAdmin);
    }

    if (menus) {
      const flatMenus = flattenForSet(menus, "menus");
      Object.assign($set, flatMenus);
    }

    if (billing) {
      const flatBilling = flattenForSet(billing, "billing");
      Object.assign($set, stripProtectedWriteFields(flatBilling));
    }

    const protectedSet = stripProtectedWriteFields($set);

    const updated = await SiteSettings.findByIdAndUpdate(
      id,
      { $set: protectedSet },
      {
        new: true,
        strict: false,
        runValidators: false,
      }
    ).lean();

    res.json(buildAdminSiteSettings(updated));
  } catch (err) {
    next(err);
  }
});

module.exports = router;
