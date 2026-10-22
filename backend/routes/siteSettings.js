// backend/routes/siteSettings.js
const express = require("express");
const router = express.Router();

const SiteSettings = require("../models/SiteSettings");
const { validateAppearanceInput } = require("../services/appearanceValidation");
const { loadSettingsDocument } = require("../services/siteSettingsDocumentService");
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
const {
  isAppearanceWrite,
  appearanceVersionFilter,
  updateAppearanceWithRevision,
} = require('../services/appearanceSettingsRevisionService');

/**
 * 🔎 Ping de diagnóstico
 * GET /api/site-settings/ping
 */
router.get("/ping", (_req, res) => {
  res.json({ ok: true, where: "siteSettings router" });
});

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

function validateAdminLoader(admin) {
  if (!admin || !Object.prototype.hasOwnProperty.call(admin, 'loader')) return null;
  const loader = admin.loader;
  if (!loader || typeof loader !== 'object' || Array.isArray(loader) ||
    !['halo', 'pulse', 'orbit', 'wave', 'linear'].includes(loader.model)) {
    return 'Selecciona uno de los cinco modelos de carga disponibles';
  }
  return null;
}

function requireSensitiveSettingsPermissions(req, res, next) {
  const permissions = resolveSiteSettingsWritePermissions(req.body);
  if (!permissions.length) return next();
  return requirePermission(permissions)(req, res, next);
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

router.get('/appearance', requireAdmin, requirePermission('appearance:view'), async (_req, res, next) => {
  try {
    const doc = await loadSettingsDocument();
    const safe = buildAdminSiteSettings(doc);
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.json({
      theme: safe.theme,
      menus: safe.menus,
      store: { name: safe.store?.name || "", businessName: safe.store?.businessName || "" },
      appearanceRevision: Number(safe.appearanceRevision || 0),
    });
  } catch (error) {
    next(error);
  }
});

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
    const { theme, menus, admin, billing, appearanceRevision } = req.body || {};
    const unsupportedKeys = getUnsupportedSiteSettingsKeys(req.body);

    if (unsupportedKeys.length) {
      return res.status(400).json({
        ok: false,
        error: "UNSUPPORTED_SETTINGS_FIELDS",
        message: "La solicitud contiene secciones de configuración no admitidas.",
        fields: unsupportedKeys,
      });
    }

    const requiredPermissions = resolveSiteSettingsWritePermissions(req.body);
    if (!requiredPermissions.length) {
      return res.status(400).json({
        ok: false,
        error: "EMPTY_SETTINGS_UPDATE",
        message: "Debes enviar al menos una sección de configuración válida.",
      });
    }

    const appearanceWrite = isAppearanceWrite(requiredPermissions);
    if (!appearanceWrite && appearanceRevision !== undefined) {
      return res.status(400).json({ ok: false, error: 'UNEXPECTED_APPEARANCE_REVISION', message: 'Esta revisión solo corresponde a Apariencia.' });
    }
    if (appearanceWrite && (!Number.isSafeInteger(appearanceRevision) || appearanceRevision < 0)) {
      return res.status(409).json({ ok: false, error: 'APPEARANCE_REVISION_REQUIRED', message: 'Recarga Apariencia antes de guardar.' });
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
    if (theme && Object.prototype.hasOwnProperty.call(theme, 'sections') && !Array.isArray(theme.sections)) {
      return res.status(400).json({ ok: false, error: 'INVALID_APPEARANCE_SECTIONS', message: 'Las secciones deben ser una lista.' });
    }
    if (theme?.header?.iconSet === 'custom') {
      const iconImages = theme.header.iconImages;
      const validCloudinaryImage = (url) => typeof url === 'string' && /^https:\/\/res\.cloudinary\.com\/[a-z0-9_-]+\/image\/upload\//i.test(url);
      if (!['account', 'favorites', 'cart'].every((kind) => validCloudinaryImage(iconImages?.[kind]))) {
        return res.status(400).json({ ok: false, error: 'INVALID_HEADER_ICON_IMAGES', message: 'Carga los tres iconos en Cloudinary antes de guardar.' });
      }
    }
    if (theme?.header && ['searchBgColor', 'searchTextColor', 'searchAccentColor', 'searchBorderColor'].some((key) => {
      const value = theme.header[key];
      return value !== undefined && value !== '' && (typeof value !== 'string' || !/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(value));
    })) {
      return res.status(400).json({ ok: false, error: 'INVALID_HEADER_SEARCH_COLORS', message: 'Los colores del buscador deben ser hexadecimales válidos.' });
    }
    if (theme?.header?.iconOverrides !== undefined) {
      const overrides = theme.header.iconOverrides;
      const validCloudinaryImage = (url) => typeof url === 'string' && /^https:\/\/res\.cloudinary\.com\/[a-z0-9_-]+\/image\/upload\//i.test(url);
      const validKinds = ['account', 'search', 'favorites', 'cart'];
      const validSets = ['gold', 'wine', 'satin', 'porcelain'];
      const valid = overrides && typeof overrides === 'object' && !Array.isArray(overrides)
        && Object.entries(overrides).every(([set, images]) => validSets.includes(set)
          && images && typeof images === 'object' && !Array.isArray(images)
          && Object.entries(images).every(([kind, url]) => validKinds.includes(kind) && (url === '' || validCloudinaryImage(url))));
      if (!valid) return res.status(400).json({ ok: false, error: 'INVALID_HEADER_ICON_OVERRIDES', message: 'Los iconos personalizados deben ser imágenes de Cloudinary.' });
    }
    if (theme?.header?.mobileMenuFeatureImage !== undefined &&
      theme.header.mobileMenuFeatureImage !== '' &&
      (typeof theme.header.mobileMenuFeatureImage !== 'string' ||
        !/^https:\/\/res\.cloudinary\.com\/[a-z0-9_-]+\/image\/upload\//i.test(theme.header.mobileMenuFeatureImage))) {
      return res.status(400).json({ ok: false, error: 'INVALID_MOBILE_MENU_FEATURE_IMAGE', message: 'La imagen destacada del menú móvil debe estar en Cloudinary.' });
    }
    if (theme?.header?.iconSizePx !== undefined && (!Number.isInteger(theme.header.iconSizePx) || theme.header.iconSizePx < 28 || theme.header.iconSizePx > 40)) {
      return res.status(400).json({ ok: false, error: 'INVALID_HEADER_ICON_SIZE', message: 'El tamaño de los iconos debe estar entre 28 y 40 px.' });
    }
    if (isInvalidSettingsSection(menus)) {
      return res.status(400).json({ error: "menus debe ser un objeto" });
    }
    if (menus && ['header', 'footer', 'social'].some((key) =>
      Object.prototype.hasOwnProperty.call(menus, key) && !Array.isArray(menus[key])
    )) {
      return res.status(400).json({ ok: false, error: 'INVALID_APPEARANCE_MENUS', message: 'Los menús deben ser listas.' });
    }
    if (menus?.header?.some((item) => item?.iconColor !== undefined && item.iconColor !== '' &&
      (typeof item.iconColor !== 'string' || !/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(item.iconColor)))) {
      return res.status(400).json({ ok: false, error: 'INVALID_MOBILE_MENU_ICON_COLOR', message: 'El color de cada ícono debe ser hexadecimal.' });
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
    const adminLoaderError = validateAdminLoader(admin);
    if (adminLoaderError) {
      return res.status(400).json({ ok: false, error: 'INVALID_ADMIN_LOADER', message: adminLoaderError });
    }
    if (isInvalidSettingsSection(billing)) {
      return res.status(400).json({ error: "billing debe ser un objeto" });
    }
    if (appearanceWrite) {
      const error = validateAppearanceInput({ theme, menus });
      if (error) return res.status(400).json({ ok: false, error: 'INVALID_APPEARANCE_SETTINGS', message: error });
    }

    const updatedBy =
      req.adminUsername ||
      req.adminUserId ||
      "admin";

    const { _id: id } = await loadSettingsDocument();

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

    // Store card text overrides with the same atomic revision update as the rest of
    // Appearance. Mongoose can cast an entire cards array using an older
    // compiled nested schema and silently omit recently added card fields.
    const hasCardTextOverrides = Object.values(theme?.banner?.templateConfigs || {}).some(
      (template) => (template?.cardTextStyle && Object.keys(template.cardTextStyle).length > 0)
        || (Array.isArray(template?.cards) && template.cards.some((card) =>
          card && ['titleColor', 'labelColor', 'titleSizePx', 'labelSizePx'].some((key) => Object.hasOwn(card, key))))
    );
    if (hasCardTextOverrides) {
      for (const template of Object.values(theme.banner.templateConfigs)) {
        for (const card of [template?.cardTextStyle, ...(template?.cards || [])]) {
          for (const key of ['titleColor', 'labelColor']) {
            if (card?.[key] !== undefined && card[key] !== '' && !/^#[0-9a-f]{6}$/i.test(card[key])) {
              return res.status(400).json({ ok: false, error: 'INVALID_BANNER_CARD_COLOR', message: 'El color de texto de una tarjeta no es válido.' });
            }
          }
          for (const [key, min, max] of [['titleSizePx', 10, 24], ['labelSizePx', 8, 18]]) {
            const value = card?.[key];
            if (value !== undefined && value !== null && (!Number.isInteger(value) || value < min || value > max)) {
              return res.status(400).json({ ok: false, error: 'INVALID_BANNER_CARD_TEXT_SIZE', message: 'El tamaño de texto de una tarjeta no es válido.' });
            }
          }
        }
        if (template?.cardTextStyle?.metallicTitle !== undefined && typeof template.cardTextStyle.metallicTitle !== 'boolean') {
          return res.status(400).json({ ok: false, error: 'INVALID_BANNER_CARD_METALLIC_TITLE', message: 'El efecto metalizado debe estar activado o desactivado.' });
        }
      }
    }

    const updated = appearanceWrite
      ? hasCardTextOverrides
        ? await SiteSettings.collection.findOneAndUpdate(
          appearanceVersionFilter(id, appearanceRevision),
          { $set: protectedSet, $inc: { appearanceRevision: 1 } },
          { returnDocument: 'after' }
        )
        : await updateAppearanceWithRevision({ id, revision: appearanceRevision, changes: protectedSet })
      : await SiteSettings.findByIdAndUpdate(
        id,
        { $set: protectedSet },
        { new: true, strict: false, runValidators: false }
      ).lean();

    if (!updated) {
      return res.status(409).json({
        ok: false,
        error: 'APPEARANCE_REVISION_CONFLICT',
        message: 'La Apariencia guardada cambió. Recarga los datos y revisa tus cambios antes de guardar.',
      });
    }

    const safe = buildAdminSiteSettings(updated);
    res.json(appearanceWrite && !admin && !billing
      ? { theme: safe.theme, menus: safe.menus, appearanceRevision: safe.appearanceRevision }
      : safe);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
