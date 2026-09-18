'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const SiteSettings = require('../models/SiteSettings');
const { findAdminRoutePermission } = require('../security/adminRoutePermissionMap');
const {
  DEFAULT_LOGIN_SETTINGS,
  LoginSettingsError,
  buildResponse,
  getLoginSettings,
  normalizeLoginSettings,
  safeImageUrl,
  updateLoginSettings,
  validateLoginSettings,
} = require('../services/loginSettingsService');

function document(overrides = {}) {
  return {
    _id: 'settings-main',
    loginAdminRevision: 4,
    loginAdmin: DEFAULT_LOGIN_SETTINGS,
    store: { name: 'Rosa Boutique' },
    theme: { header: { logoLight: 'https://cdn.example.com/logo.png' } },
    updatedAt: new Date('2026-09-17T10:00:00.000Z'),
    updatedBy: 'owner',
    ...overrides,
  };
}

function modelFor(current, options = {}) {
  return {
    findOne: async () => current,
    create: async () => current,
    findOneAndUpdate: async (query, update) => {
      options.capture?.(query, update);
      if (options.conflict) return null;
      return {
        ...current,
        ...update.$set,
        loginAdminRevision: Number(current.loginAdminRevision || 0) + 1,
      };
    },
  };
}

async function run() {
  const normalized = normalizeLoginSettings({
    theme: 'liquidGlass',
    layout: 'splitPanel',
    customizations: {
      liquidGlass: {
        ...DEFAULT_LOGIN_SETTINGS.customizations.liquidGlass,
        accent: '#12abef',
        headline: 'Control total',
      },
    },
    background: {
      mode: 'image',
      image: 'https://cdn.example.com/login.webp',
      imageOpacity: 5,
      overlay: -1,
      color: '#ABCDEF',
    },
  });
  assert.equal(normalized.theme, 'liquidGlass');
  assert.equal(normalized.customizations.liquidGlass.accent, '#12abef');
  assert.equal(normalized.customizations.liquidGlass.headline, 'Control total');
  assert.equal(normalized.layout, 'splitPanel');
  assert.equal(normalized.background.imageOpacity, 1);
  assert.equal(normalized.background.overlay, 0);
  assert.equal(normalized.background.color, '#abcdef');
  assert.equal(normalized.backgrounds.liquidGlass.image, 'https://cdn.example.com/login.webp');
  assert.equal(normalized.backgrounds.smokeGlass.image, '');

  const independentBackgrounds = normalizeLoginSettings({
    ...DEFAULT_LOGIN_SETTINGS,
    theme: 'smokeGlass',
    backgrounds: {
      liquidGlass: { mode: 'color', color: '#abcdef' },
      immersiveGallery: { mode: 'image', image: 'https://cdn.example.com/gallery.webp' },
      smokeGlass: {
        mode: 'image',
        image: 'https://cdn.example.com/perla.webp',
        glassTransparency: 2,
      },
    },
  });
  assert.equal(independentBackgrounds.backgrounds.liquidGlass.color, '#abcdef');
  assert.equal(independentBackgrounds.backgrounds.immersiveGallery.image, 'https://cdn.example.com/gallery.webp');
  assert.equal(independentBackgrounds.backgrounds.smokeGlass.image, 'https://cdn.example.com/perla.webp');
  assert.equal(independentBackgrounds.backgrounds.smokeGlass.glassTransparency, 1);
  assert.deepEqual(independentBackgrounds.background, independentBackgrounds.backgrounds.smokeGlass);

  const galleryTone = normalizeLoginSettings({
    ...DEFAULT_LOGIN_SETTINGS,
    customizations: {
      immersiveGallery: {
        ...DEFAULT_LOGIN_SETTINGS.customizations.immersiveGallery,
        imageTone: 'lightBlue',
      },
    },
  });
  assert.equal(galleryTone.customizations.immersiveGallery.imageTone, 'lightBlue');

  assert.equal(safeImageUrl('javascript:alert(1)'), '');
  assert.equal(safeImageUrl('data:image/png;base64,abc'), '');
  assert.equal(safeImageUrl('//malicioso.example/fondo.png'), '');
  assert.equal(safeImageUrl('https://cdn.example.com/bg.webp'), 'https://cdn.example.com/bg.webp');

  const invalid = validateLoginSettings({
    theme: 'inventado',
    layout: 'inventado',
    background: { mode: 'image', image: 'javascript:alert(1)' },
  });
  assert.deepEqual(invalid.map((item) => item.field), [
    'theme',
    'layout',
    'background.image',
  ]);

  const invalidCustomization = validateLoginSettings({
    ...DEFAULT_LOGIN_SETTINGS,
    customizations: {
      liquidGlass: {
        ...DEFAULT_LOGIN_SETTINGS.customizations.liquidGlass,
        accent: 'azul',
      },
    },
  });
  assert.equal(invalidCustomization[0]?.field, 'customizations.liquidGlass.accent');

  const invalidGalleryTone = validateLoginSettings({
    ...DEFAULT_LOGIN_SETTINGS,
    customizations: {
      immersiveGallery: {
        ...DEFAULT_LOGIN_SETTINGS.customizations.immersiveGallery,
        imageTone: 'inventado',
      },
    },
  });
  assert.equal(invalidGalleryTone[0]?.field, 'customizations.immersiveGallery.imageTone');

  const current = document();
  const response = await getLoginSettings({ SiteSettingsModel: modelFor(current) });
  assert.equal(response.store.name, 'Rosa Boutique');
  assert.equal(response.store.logo, 'https://cdn.example.com/logo.png');
  assert.equal(response.revision, 4);

  await assert.rejects(
    () => updateLoginSettings({ revision: 3, settings: DEFAULT_LOGIN_SETTINGS }, {
      SiteSettingsModel: modelFor(current),
    }),
    (error) => error instanceof LoginSettingsError && error.code === 'LOGIN_SETTINGS_CONFLICT'
  );

  let captured = null;
  const updated = await updateLoginSettings({
    revision: 4,
    settings: {
      theme: 'smokeGlass',
      layout: 'centeredCard',
      customizations: DEFAULT_LOGIN_SETTINGS.customizations,
      background: { mode: 'color', color: '#ffffff', image: '', imageOpacity: 0.5, overlay: 0.2 },
    },
  }, {
    SiteSettingsModel: modelFor(current, {
      capture: (query, update) => { captured = { query, update }; },
    }),
    actor: 'owner',
  });
  assert.equal(captured.query.loginAdminRevision, 4);
  assert.equal(captured.update.$inc.loginAdminRevision, 1);
  assert.equal(captured.update.$set.updatedBy, 'owner');
  assert.equal(updated.settings.theme, 'smokeGlass');
  assert.equal(updated.revision, 5);

  await assert.rejects(
    () => updateLoginSettings({ revision: 4, settings: DEFAULT_LOGIN_SETTINGS }, {
      SiteSettingsModel: modelFor(current, { conflict: true }),
    }),
    (error) => error instanceof LoginSettingsError && error.code === 'LOGIN_SETTINGS_CONFLICT'
  );

  assert(SiteSettings.schema.path('loginAdminRevision'));
  assert.equal(findAdminRoutePermission('GET', '/api/admin/login-settings')?.permission, 'settings:login');
  assert.equal(findAdminRoutePermission('PUT', '/api/admin/login-settings')?.permission, 'settings:login');
  assert.equal(findAdminRoutePermission('PUT', '/api/admin/login-settings')?.audit, true);

  const routeSource = fs.readFileSync(path.join(__dirname, '..', 'routes', 'adminLoginSettings.js'), 'utf8');
  const indexSource = fs.readFileSync(path.join(__dirname, '..', 'index.js'), 'utf8');
  const loginSource = fs.readFileSync(path.join(__dirname, '..', '..', 'frontend', 'src', 'admin', 'Login.jsx'), 'utf8');
  const panelSource = fs.readFileSync(path.join(__dirname, '..', '..', 'frontend', 'src', 'admin', 'configuracion', 'sections', 'LoginAdminSection.jsx'), 'utf8');
  const legacyRouteSource = fs.readFileSync(path.join(__dirname, '..', 'routes', 'siteSettings.js'), 'utf8');

  assert(routeSource.includes("requirePermission('settings:login')"));
  assert(indexSource.includes("app.use('/api/admin/login-settings'"));
  assert(loginSource.includes('fetchSiteSettings'));
  assert(loginSource.includes('response?.loginAdmin'));
  assert(!loginSource.includes('admin_login_theme_id'));
  assert(panelSource.includes('getAdminLoginSettings'));
  assert(panelSource.includes('Guardar diseño'));
  assert(panelSource.includes('Subir imagen'));
  assert(legacyRouteSource.includes('LOGIN_SETTINGS_DEDICATED_ENDPOINT_REQUIRED'));

  const safeResponse = buildResponse(current);
  assert.equal(JSON.stringify(safeResponse).includes('password'), false);

  console.log('Configuración Nivel Plus Etapa 5 - Login administrativo (backend): OK');
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
