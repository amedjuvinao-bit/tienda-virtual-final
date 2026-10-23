'use strict';
const SiteSettings = require('../models/SiteSettings');

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
        metallicMenuText: false,
        searchBgColor: "",
        searchTextColor: "",
        searchAccentColor: "",
        searchBorderColor: "",
        menuAnimation: "soft",
        iconColor: "",
        iconHoverColor: "",
        iconAnimation: "soft",
        iconSet: "gold",
        iconImages: { account: "", favorites: "", cart: "" },
        iconOverrides: {},
        iconSizePx: 34,
        fontPreset: "",
        fontFamily: "",
        fontSizePx: 16,
        logoLight: "",
        logoDark: "",
        logoMode: "auto",
        logoHeightPx: 80,
        surfaceShape: "attached",
        cornerRadiusPx: 16,
        liquidGlassEnabled: false,
        glassStrength: 75,
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
        sliderShowProgress: true,
        sliderShowCounter: false,
        sliderShowControls: true,
        sliderControlColor: "#ffffff",
        sliderControlTheme: "minimal",
        sliderControlPosition: "right",
        sliderControlSize: 100,
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
        tabletHeightMode: "fullscreen",
        tabletHeightPx: 1180,
        mobileHeightMode: "fullscreen",
        mobileHeightPx: 844,
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

    appearanceRevision: 0,

    admin: {
      theme: {},
      layout: "default",
      sidebar: "expanded",
      loader: { model: "halo" },
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

function missingFields(current, defaults, prefix, changes) {
  for (const [key, value] of Object.entries(defaults)) {
    const path = prefix + '.' + key;
    if (current?.[key] === undefined) changes[path] = value;
    else if (value && typeof value === 'object' && !Array.isArray(value)) {
      if (!current[key] || typeof current[key] !== 'object') changes[path] = value;
      else missingFields(current[key], value, path, changes);
    }
  }
}

// Normal reads perform one query. Legacy repairs run only when fields are absent.
async function loadSettingsDocument() {
  const doc = await SiteSettings.findOne().lean();
  if (!doc) {
    const created = await SiteSettings.create(buildDefaultSettings());
    return typeof created.toObject === 'function' ? created.toObject() : created;
  }
  const defaults = buildDefaultSettings();
  const changes = {};
  if (!Array.isArray(doc.theme?.sections)) changes['theme.sections'] = [];
  for (const key of ['admin', 'loginAdmin', 'store']) {
    if (!doc[key] || typeof doc[key] !== 'object') changes[key] = defaults[key];
  }
  if (!doc.billing || typeof doc.billing !== 'object') changes.billing = defaults.billing;
  else missingFields(doc.billing, defaults.billing, 'billing', changes);
  if (!Object.keys(changes).length) return doc;
  return SiteSettings.findByIdAndUpdate(doc._id, { $set: changes }, { new: true, strict: false }).lean();
}

module.exports = { buildDefaultSettings, loadSettingsDocument };
