'use strict';

const assert = require('assert');
const { resolveSiteSettingsWritePermissions } = require('../security/siteSettingsWritePermissions');
const { findAdminRoutePermission } = require('../security/adminRoutePermissionMap');
const siteSettingsRouter = require('../routes/siteSettings');
const {
  appearanceVersionFilter,
  isAppearanceWrite,
  updateAppearanceWithRevision,
} = require('../services/appearanceSettingsRevisionService');

assert.deepStrictEqual(resolveSiteSettingsWritePermissions({ theme: { sections: [] } }), ['appearance:sections']);
assert.deepStrictEqual(resolveSiteSettingsWritePermissions({ menus: { header: [] } }), ['appearance:menus']);
assert.deepStrictEqual(
  resolveSiteSettingsWritePermissions({ theme: { header: {}, sections: [] }, menus: {} }).sort(),
  ['appearance:update', 'appearance:sections', 'appearance:menus'].sort()
);
assert(isAppearanceWrite(['appearance:sections']));
assert(!isAppearanceWrite(['settings:panel']));
assert.strictEqual(findAdminRoutePermission('GET', '/api/site-settings/appearance')?.permission, 'appearance:view');
assert.deepStrictEqual(appearanceVersionFilter('site-1', 0), {
  _id: 'site-1',
  $or: [{ appearanceRevision: 0 }, { appearanceRevision: { $exists: false } }],
});

async function run() {
  // Appearance previews need the store identity, without expanding access to
  // contact, billing or other store configuration fields.
  const SiteSettings = require('../models/SiteSettings');
  const { buildPublicSiteSettings } = require('../lib/siteSettingsSecurity');
  for(const preset of ['stack','cinema','depth','cascade']) {
    const sectionMotion={enabled:true,preset,intensity:85,pace:'leisurely',mobileMode:'off'};
    const persisted=new SiteSettings({theme:{global:{sectionMotion}}}).toObject();
    assert.deepStrictEqual(persisted.theme.global.sectionMotion,sectionMotion);
    assert.deepStrictEqual(buildPublicSiteSettings(persisted).theme.global.sectionMotion,sectionMotion);
    assert.deepStrictEqual(resolveSiteSettingsWritePermissions({theme:{global:{sectionMotion}}}),['appearance:update']);
  }
  const originalFindOne = SiteSettings.findOne, originalUpdate = SiteSettings.findByIdAndUpdate;
  const identityFixture = new SiteSettings({store:{name:'Negocio de prueba',businessName:'Razón social',email:'privado@example.com'}}).toObject();
  try {
    SiteSettings.findOne = () => ({select(){return this;},async lean(){return identityFixture;}});
    SiteSettings.findByIdAndUpdate = async () => identityFixture;
    const getAppearance = siteSettingsRouter.stack.find(layer => layer.route?.path === '/appearance' && layer.route.methods.get).route.stack.at(-1).handle;
    let response;
    await getAppearance({}, {set(){return this;},json(value){response=value;}}, error => {throw error;});
    assert.deepStrictEqual(response.store,{name:'Negocio de prueba',businessName:'Razón social'});
    assert(!Object.hasOwn(response.store,'email'));
  } finally {
    SiteSettings.findOne = originalFindOne;
    SiteSettings.findByIdAndUpdate = originalUpdate;
  }
  const putHandler = siteSettingsRouter.stack.find((layer) => layer.route?.path === '/' && layer.route.methods.put).route.stack.at(-1).handle;
  async function responseFor(body) {
    const result = { status: 200, body: null };
    const res = {
      status(code) { result.status = code; return this; },
      json(value) { result.body = value; return this; },
    };
    await putHandler({ body }, res, (error) => { throw error; });
    return result;
  }
  assert.deepStrictEqual(
    await responseFor({ theme: { sections: [] } }),
    {
      status: 409,
      body: { ok: false, error: 'APPEARANCE_REVISION_REQUIRED', message: 'Recarga Apariencia antes de guardar.' },
    }
  );
  assert.strictEqual(
    (await responseFor({ admin: {}, appearanceRevision: 0 })).body.error,
    'UNEXPECTED_APPEARANCE_REVISION'
  );
  assert.strictEqual(
    (await responseFor({ theme: { sections: {} }, appearanceRevision: 0 })).body.error,
    'INVALID_APPEARANCE_SECTIONS'
  );
  assert.strictEqual(
    (await responseFor({ menus: { header: {} }, appearanceRevision: 0 })).body.error,
    'INVALID_APPEARANCE_MENUS'
  );

  const state = {
    _id: 'site-1',
    theme: { header: { bgColor: '#fff' }, sections: [] },
    menus: { header: [{ title: 'Inicio' }] },
    admin: { theme: { name: 'intact' } },
  };
  const model = {
    findOneAndUpdate(filter, update) {
      return {
        async lean() {
          assert.deepStrictEqual(Object.keys(update), ['$set', '$inc']);
          const current = state.appearanceRevision;
          const matches = filter.appearanceRevision === current ||
            (filter.$or && current === undefined && filter.$or[1].appearanceRevision.$exists === false);
          if (!matches) return null;
          for (const [key, value] of Object.entries(update.$set)) {
            const path = key.split('.');
            let target = state;
            for (const part of path.slice(0, -1)) target = target[part];
            target[path.at(-1)] = value;
          }
          state.appearanceRevision = (current || 0) + update.$inc.appearanceRevision;
          return structuredClone(state);
        },
      };
    },
  };

  const first = await updateAppearanceWithRevision({
    id: 'site-1', revision: 0, changes: { 'theme.sections': [{ id: 'look' }] }, model,
  });
  assert.strictEqual(first.appearanceRevision, 1);
  assert.strictEqual(state.theme.header.bgColor, '#fff');
  assert.deepStrictEqual(state.menus.header, [{ title: 'Inicio' }]);
  assert.deepStrictEqual(state.admin.theme, { name: 'intact' });

  const stale = await updateAppearanceWithRevision({
    id: 'site-1', revision: 0, changes: { 'theme.header.bgColor': '#000' }, model,
  });
  assert.strictEqual(stale, null);
  assert.strictEqual(state.theme.header.bgColor, '#fff');

  const next = await updateAppearanceWithRevision({
    id: 'site-1', revision: 1, changes: { 'menus.header': [{ title: 'Nuevo' }] }, model,
  });
  assert.strictEqual(next.appearanceRevision, 2);
  assert.deepStrictEqual(state.theme.sections, [{ id: 'look' }]);

  const simultaneous = await Promise.all([
    updateAppearanceWithRevision({ id: 'site-1', revision: 2, changes: { 'theme.header.bgColor': '#111' }, model }),
    updateAppearanceWithRevision({ id: 'site-1', revision: 2, changes: { 'theme.header.bgColor': '#222' }, model }),
  ]);
  assert.strictEqual(simultaneous.filter(Boolean).length, 1);
  assert.strictEqual(state.appearanceRevision, 3);
  console.log('Apariencia Etapa 1 (permisos y concurrencia): OK');
}

run().catch((error) => { console.error(error); process.exitCode = 1; });
