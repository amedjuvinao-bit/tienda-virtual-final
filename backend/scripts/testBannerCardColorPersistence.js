'use strict';

const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const SiteSettings = require('../models/SiteSettings');
const siteSettingsRouter = require('../routes/siteSettings');

async function main() {
  const uri = process.env.MONGODB_URI || '';
  if (process.env.NODE_ENV !== 'test' || !/^mongodb:\/\/127\.0\.0\.1:27017\//.test(uri)) {
    throw new Error('Esta prueba solo se ejecuta contra MongoDB local de CI.');
  }

  await mongoose.connect(uri);
  try {
    await SiteSettings.deleteMany({});
    const doc = await SiteSettings.create({
      theme: { banner: { templateConfigs: {
        editorial: { cards: [{ text: 'Vestidos', label: 'Elegante' }] },
      } } },
    });
    const putHandler = siteSettingsRouter.stack.find(
      (layer) => layer.route?.path === '/' && layer.route.methods.put
    ).route.stack.at(-1).handle;
    const result = { status: 200, body: null };
    const res = {
      status(code) { result.status = code; return this; },
      json(value) { result.body = value; return this; },
    };
    await putHandler({ body: { appearanceRevision: doc.appearanceRevision, theme: {
      banner: { templateConfigs: { editorial: { cards: [{
        text: 'Vestidos', label: 'Elegante', labelColor: '#ed246b', titleColor: '#ffffff',
      }] } } },
    } } }, res, (error) => { throw error; });

    assert.equal(result.status, 200, JSON.stringify(result.body));
    assert.equal(result.body.theme.banner.templateConfigs.editorial.cards[0].labelColor, '#ed246b');
    assert.equal(result.body.theme.banner.templateConfigs.editorial.cards[0].titleColor, '#ffffff');
    const raw = await SiteSettings.collection.findOne({ _id: doc._id });
    assert.equal(raw.theme.banner.templateConfigs.editorial.cards[0].labelColor, '#ed246b');
    assert.equal(raw.theme.banner.templateConfigs.editorial.cards[0].titleColor, '#ffffff');
    assert.equal(raw.appearanceRevision, doc.appearanceRevision + 1);
    const getHandler = siteSettingsRouter.stack.find(
      (layer) => layer.route?.path === '/' && layer.route.methods.get
    ).route.stack.at(-1).handle;
    const publicResult = { body: null };
    await getHandler({}, {
      set() { return this; },
      json(value) { publicResult.body = value; return this; },
    }, (error) => { throw error; });
    assert.equal(publicResult.body.theme.banner.templateConfigs.editorial.cards[0].labelColor, '#ed246b');
    assert.equal(publicResult.body.theme.banner.templateConfigs.editorial.cards[0].titleColor, '#ffffff');
    console.log('Guardado y lectura pública de colores de tarjetas: OK');
  } finally {
    await SiteSettings.deleteMany({});
    await mongoose.disconnect();
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
