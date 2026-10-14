'use strict';

const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const SiteSettings = require('../models/SiteSettings');

async function main() {
  const uri = process.env.MONGODB_URI || '';
  if (process.env.NODE_ENV !== 'test' || !/^mongodb:\/\/127\.0\.0\.1:27017\//.test(uri)) {
    throw new Error('Esta prueba solo se ejecuta contra MongoDB local de CI.');
  }

  await mongoose.connect(uri);
  try {
    const doc = await SiteSettings.create({
      theme: { banner: { templateConfigs: {
        editorial: { cards: [{ text: 'Vestidos', label: 'Elegante', labelColor: '#f472b6' }] },
      } } },
    });

    const requestedCardColors = {
      'theme.banner.templateConfigs.editorial.cards.0.labelColor': '#ed246b',
      'theme.banner.templateConfigs.editorial.cards.0.titleColor': '#ffffff',
    };
    const updated = await SiteSettings.findOneAndUpdate(
      { _id: doc._id, appearanceRevision: doc.appearanceRevision },
      { $set: { 'theme.banner.templateConfigs.editorial.cards': [{
        text: 'Vestidos', label: 'Elegante', labelColor: '#ed246b', titleColor: '#ffffff',
      }] }, $inc: { appearanceRevision: 1 } },
      { new: true, strict: false, runValidators: false }
    ).lean();
    assert.ok(updated);

    const result = await SiteSettings.collection.updateOne(
      { _id: doc._id, appearanceRevision: updated.appearanceRevision },
      { $set: requestedCardColors }
    );
    assert.equal(result.matchedCount, 1);
    const raw = await SiteSettings.collection.findOne({ _id: doc._id });
    assert.equal(raw.theme.banner.templateConfigs.editorial.cards[0].labelColor, '#ed246b');
    assert.equal(raw.theme.banner.templateConfigs.editorial.cards[0].titleColor, '#ffffff');
    assert.equal(raw.appearanceRevision, updated.appearanceRevision);

    await SiteSettings.deleteOne({ _id: doc._id });
    console.log('Colores de tarjetas guardados y leídos en MongoDB: OK');
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
