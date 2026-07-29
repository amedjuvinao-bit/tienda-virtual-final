// backend/models/SiteSettings.js
const mongoose = require("mongoose");
const { Schema } = mongoose;

/* ========== Button (movible) ========== */
const ButtonSchema = new Schema(
  {
    enabled: { type: Boolean, default: true },

    kind: { type: String, enum: ["image", "text"], default: "image" },

    imageUrl: { type: String, default: "" },
    text: { type: String, default: "" },

    link: { type: String, default: "" },

    posX: { type: Number, default: 50 },
    posY: { type: Number, default: 92 },

    widthPx: { type: Number, default: 200 },
    heightPx: { type: Number, default: 44 },

    style: {
      type: String,
      enum: ["delicate", "glass"],
      default: "delicate",
    },

    radius: {
      type: String,
      enum: ["pill", "soft", "square"],
      default: "pill",
    },

    anim: {
      type: String,
      enum: [
        "none",
        "fade",
        "fadeUp",
        "fadeDown",
        "slideLeft",
        "slideRight",
        "zoomIn",
        "softPop",
        "float",
        "shine",
      ],
      default: "none",
    },
    animDurationMs: { type: Number, default: 650 },
    animDelayMs: { type: Number, default: 0 },
  },
  { _id: false }
);

/* ========== Banner ========== */
const BannerSlideSchema = new Schema(
  {
    image: { type: String, default: "" },
    link: { type: String, default: "" },

    posX: { type: Number, default: 50 },
    posY: { type: Number, default: 50 },

    fit: { type: String, enum: ["cover", "contain"], default: "cover" },

    button: { type: ButtonSchema, default: () => ({}) },
    buttons: { type: [ButtonSchema], default: [] },
  },
  { _id: false }
);

const BannerSchema = new Schema(
  {
    type: {
      type: String,
      enum: ["slider", "image", "video"],
      default: "slider",
    },

    slides: { type: [BannerSlideSchema], default: [] },

    autoplayMs: { type: Number, default: 4500 },

    imageUrl: { type: String, default: "" },
    imageLink: { type: String, default: "" },

    imagePosX: { type: Number, default: 50 },
    imagePosY: { type: Number, default: 50 },
    imageFit: { type: String, enum: ["cover", "contain"], default: "cover" },

    imageButton: { type: ButtonSchema, default: () => ({}) },
    imageButtons: { type: [ButtonSchema], default: [] },

    videoUrl: { type: String, default: "" },
    videoAutoplay: { type: Boolean, default: true },
    videoMuted: { type: Boolean, default: true },
    videoLoop: { type: Boolean, default: true },

    videoButton: { type: ButtonSchema, default: () => ({}) },
    videoButtons: { type: [ButtonSchema], default: [] },

    heightMode: {
      type: String,
      enum: ["auto", "fullscreen"],
      default: "auto",
    },

    heightPx: { type: Number, default: 520 },
  },
  { _id: false }
);

/* ========== Store / Empresa ========== */
const StoreSchema = new Schema(
  {
    name: { type: String, default: "" },
    businessName: { type: String, default: "" },
    email: { type: String, default: "" },
    phone: { type: String, default: "" },
    address: { type: String, default: "" },
  },
  { _id: false, strict: false }
);

/* ========== ✅ SECTIONS ========== */
/**
 * ✅ CLAVE: strict:false
 * - Para que CUALQUIER variable nueva de style/config se guarde
 * - Ej: cardTitleColor, cardMetaColor, etc. sin volver a tocar backend
 */
const SectionStyleSchema = new Schema(
  {
    bgColor: { type: String, default: "#ffffff" },
    textColor: { type: String, default: "#111111" },
    accentColor: { type: String, default: "#d4af37" },

    titleSizePx: { type: Number, default: 42 },
    subtitleSizePx: { type: Number, default: 16 },

    cardRadiusPx: { type: Number, default: 18 },
    imageHeightPx: { type: Number, default: 260 },
    spacingPx: { type: Number, default: 16 },

    titleWeight: { type: Number, default: 800 },
    subtitleWeight: { type: Number, default: 400 },

    // ✅ Tipografía/estilo global del texto dentro de cards
    cardTextFontFamily: { type: String, default: "" },
    cardTextColor: { type: String, default: "" },
    cardTextSizePx: { type: Number, default: 0 },
    cardTextWeight: { type: Number, default: 0 },
    cardTextItalic: { type: Boolean, default: false },
    cardTextUnderline: { type: Boolean, default: false },

    /**
     * ✅ (Opcional pero útil) Campos “por parte” si tu panel los crea:
     * - Si existen, se guardan. Si no, no molestan.
     * - Igual strict:false permite más campos futuros.
     */
    cardTitleColor: { type: String, default: "" },
    cardPriceColor: { type: String, default: "" },
    cardMetaColor: { type: String, default: "" }, // tallas/colores
    cardDescColor: { type: String, default: "" },
  },
  { _id: false, strict: false }
);

const SectionItemSchema = new Schema(
  {
    image: { type: String, default: "" },
    title: { type: String, default: "" },
    subtitle: { type: String, default: "" },
    link: { type: String, default: "" },

    fit: { type: String, enum: ["cover", "contain"], default: "cover" },
    posX: { type: Number, default: 50 },
    posY: { type: Number, default: 50 },
  },
  { _id: false }
);

/**
 * ✅ CLAVE: strict:false
 * - Para permitir que el frontend mande campos extra (ej: type)
 * - y se guarden sin perderse.
 */
const SectionSchema = new Schema(
  {
    id: { type: String, required: true, trim: true },
    enabled: { type: Boolean, default: true },

    // ✅ IMPORTANTE: tu frontend usa "type" (tendencia/look/etc)
    type: { type: String, default: "" },

    name: { type: String, default: "" },
    title: { type: String, default: "" },
    subtitle: { type: String, default: "" },

    titleImage: { type: String, default: "" },

    href: { type: String, default: "" },

    style: { type: SectionStyleSchema, default: () => ({}) },
    items: { type: [SectionItemSchema], default: [] },

    // ✅ config flexible (tendencia: maxItems, products[], watermarkImage, etc.)
    config: { type: Schema.Types.Mixed, default: {} },
  },
  { _id: false, strict: false }
);

/* ========== Theme ========== */
const ThemeSchema = new Schema(
  {
    colors: {
      primary: String,
      secondary: String,
      text: String,
      background: String,
      accent: String,
    },
    fonts: {
      base: String,
      headings: String,
      fontSize: Number,
      lineHeight: Number,
    },
    radius: { sm: Number, md: Number, lg: Number },
    spacing: { base: Number },
    logo: { light: String, dark: String },
    favicon: String,

    header: {
      bgColor: String,
      bgOpacity: Number,
      textColor: String,
      linkColor: String,

      iconColor: String,
      iconHoverColor: String,

      menuAnimation: String,
      iconAnimation: String,

      fontPreset: String,
      fontFamily: String,
      fontSizePx: Number,

      logoLight: String,
      logoDark: String,

      logoHeightPx: Number,
    },

    home: {
      title: String,
      subtitle: String,
      bgImage: String,
      textColor: String,
    },

    footer: {
      bgColor: String,
      textColor: String,
    },

    banner: BannerSchema,

    sections: { type: [SectionSchema], default: [] },
  },
  { _id: false }
);

/* ========== Admin Appearance ========== */
const AdminAppearanceSchema = new Schema(
  {
    theme: {
      type: Schema.Types.Mixed,
      default: {},
    },

    layout: {
      type: String,
      default: "default",
    },

    sidebar: {
      type: String,
      default: "expanded",
    },
  },
  { _id: false, strict: false }
);

/* ========== Login Admin Appearance ========== */
const LoginAdminAppearanceSchema = new Schema(
  {
    theme: {
      type: String,
      default: "roseLuxuryLight",
    },

    layout: {
      type: String,
      default: "centeredCard",
    },

    background: {
      mode: {
        type: String,
        enum: ["theme", "color", "image"],
        default: "theme",
      },
      color: { type: String, default: "" },
      image: { type: String, default: "" },
      imageOpacity: { type: Number, default: 1 },
      overlay: { type: Number, default: 0 },
    },
  },
  { _id: false, strict: false }
);

/* ========== MenuItem ========== */
const MenuItemSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    type: { type: String, enum: ["page", "category", "url"], default: "url" },
    ref: { type: String, default: "" },
  },
  { _id: true }
);

MenuItemSchema.add({ children: [MenuItemSchema] });

/* ========== Billing / Facturación ========== */
const BillingSettingsSchema = new Schema(
  {
    fiscalInfo: {
      businessName: { type: String, default: "" },
      nit: { type: String, default: "" },
      dv: { type: String, default: "" },
      taxRegime: { type: String, default: "" },
      taxResponsibility: { type: String, default: "" },
      taxLevelCode: { type: String, default: "" },
      responsibilityCode: { type: String, default: "" },
      legalRepresentative: { type: String, default: "" },
      billingEmail: { type: String, default: "" },

      // ✅ Datos de ubicación fiscal para XML DIAN
      address: { type: String, default: "" },
      city: { type: String, default: "" },
      cityCode: { type: String, default: "" },
      municipalityCode: { type: String, default: "" },
      department: { type: String, default: "" },
      departmentCode: { type: String, default: "" },
      country: { type: String, default: "CO" },
    },

    dianResolution: {
      resolutionNumber: { type: String, default: "" },
      prefix: { type: String, default: "" },
      rangeFrom: { type: Number, default: 1 },
      rangeTo: { type: Number, default: 1 },
      currentNumber: { type: Number, default: 1 },
      resolutionDate: { type: String, default: "" },
      expirationDate: { type: String, default: "" },
      documentType: { type: String, default: "" },

      // ✅ Campos necesarios para preparar cálculo CUFE / ambiente DIAN
      technicalKey: { type: String, default: "" },
      environment: { type: String, enum: ["1", "2"], default: "2" },
      numberingRangeId: { type: Number, min: 0, default: 0 },
      creditNoteNumberingRangeId: { type: Number, min: 0, default: 0 },
    },

    // ✅ Configuración DIAN administrable por usuario
    dian: {
      enabled: { type: Boolean, default: false },

      mode: {
        type: String,
        enum: ["internal", "habilitacion", "production"],
        default: "internal",
      },

      environment: {
        type: String,
        enum: ["1", "2"],
        default: "2",
      },

      providerType: {
        type: String,
        enum: ["own", "provider", "free_dian", ""],
        default: "",
      },

      softwareId: { type: String, default: "" },
      softwarePin: { type: String, default: "" },
      softwareSecurityCode: { type: String, default: "" },

      testSetId: { type: String, default: "" },

      providerNit: { type: String, default: "" },
      providerDv: { type: String, default: "" },

      certificateFileName: { type: String, default: "" },
      certificatePath: { type: String, default: "" },
      certificatePassword: { type: String, default: "" },
      certificateUploadedAt: { type: Date, default: null },

      wsdlUrl: { type: String, default: "" },
      productionWsdlUrl: { type: String, default: "" },
      habilitationWsdlUrl: { type: String, default: "" },

      lastTestStatus: { type: String, default: "" },
      lastTestMessage: { type: String, default: "" },
      lastTestAt: { type: Date, default: null },

      lastSyncStatus: { type: String, default: "" },
      lastSyncMessage: { type: String, default: "" },
      lastSyncAt: { type: Date, default: null },
    },

    // ✅ NUEVO: proveedor electrónico configurable
    electronicProvider: {
      provider: {
        type: String,
        enum: ["mock", "factus", ""],
        default: "mock",
      },

      apiUrl: { type: String, default: "" },

      clientId: { type: String, default: "" },
      clientSecret: { type: String, default: "" },

      username: { type: String, default: "" },
      password: { type: String, default: "" },

      softwareId: { type: String, default: "" },
      softwarePin: { type: String, default: "" },
      technicalKey: { type: String, default: "" },

      lastConnectionStatus: { type: String, default: "" },
      lastConnectionMessage: { type: String, default: "" },
      lastConnectionAt: { type: Date, default: null },
      lastConnectionEnvironment: { type: String, default: "" },
      lastConnectionFingerprint: { type: String, default: "", select: false },
      lastConnectionCompany: { type: Schema.Types.Mixed, default: null },
      numberingRangeId: { type: Number, min: 0, default: 0 },
      creditNoteNumberingRangeId: { type: Number, min: 0, default: 0 },
      numberingRangesEnvironment: { type: String, default: "" },
      numberingRangesFingerprint: { type: String, default: "", select: false },
      numberingRangesSyncedAt: { type: Date, default: null },
    },

    legalTexts: {
      invoiceLegalText: { type: String, default: "" },
      internalReceiptNote: { type: String, default: "" },
    },

    taxes: {
      iva: {
        enabled: { type: Boolean, default: true },
        percent: { type: Number, default: 19 },
        code: { type: String, default: "01" },
        name: { type: String, default: "IVA" },
      },
    },
  },
  { _id: false, strict: false }
);

const BillingHistoryEntrySchema = new Schema(
  {
    revision: { type: Number, required: true, min: 0 },
    snapshot: { type: Schema.Types.Mixed, required: true },
    changedAt: { type: Date, required: true, default: Date.now },
    changedBy: { type: String, default: "admin" },
    reason: { type: String, default: "update" },
  },
  { _id: true }
);

/* ========== SiteSettings ========== */
const SiteSettingsSchema = new Schema(
  {
    // ✅ URL pública de la tienda para QR de factura
    publicUrl: { type: String, default: "" },

    store: {
      type: StoreSchema,
      default: () => ({}),
    },

    theme: ThemeSchema,

    admin: {
      type: AdminAppearanceSchema,
      default: () => ({}),
    },

    loginAdmin: {
      type: LoginAdminAppearanceSchema,
      default: () => ({}),
    },

    billing: {
      type: BillingSettingsSchema,
      default: () => ({}),
    },
    billingRevision: { type: Number, min: 0, default: 0 },
    billingHistory: {
      type: [BillingHistoryEntrySchema],
      default: [],
      select: false,
    },

    menus: {
      header: { type: [MenuItemSchema], default: [] },
      footer: { type: [MenuItemSchema], default: [] },
      social: { type: [MenuItemSchema], default: [] },
    },

    updatedBy: String,
  },
  { timestamps: true, collection: "site_settings" }
);

module.exports =
  mongoose.models.SiteSettings ||
  mongoose.model("SiteSettings", SiteSettingsSchema);
