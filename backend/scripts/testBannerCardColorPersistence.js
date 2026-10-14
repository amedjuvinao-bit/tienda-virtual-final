'use strict';

const assert = require('node:assert/strict');
const express = require('express');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const SiteSettings = require('../models/SiteSettings');
const siteSettingsRouter = require('../routes/siteSettings');

async function main() {
  const uri = process.env.MONGODB_URI || '';
  if (process.env.NODE_ENV !== 'test' || !/^mongodb:\/\/127\.0\.0\.1:27017\//.test(uri)) {
    throw new Error('Esta prueba solo se ejecuta contra MongoDB local de CI.');
  }

  await mongoose.connect(uri);
  const previousSecret = process.env.JWT_SECRET;
  const previousLegacyAuth = process.env.ALLOW_LEGACY_ADMIN_AUTH;
  process.env.JWT_SECRET = 'local-test-secret-for-appearance-card-colors';
  process.env.ALLOW_LEGACY_ADMIN_AUTH = 'true';
  const app = express();
  app.use(express.json());
  app.use('/api/site-settings', siteSettingsRouter);
  app.use((error, _req, res, _next) => res.status(500).json({ message: error.message }));
  const server = await new Promise((resolve) => {
    const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
  });
  try {
    await SiteSettings.deleteMany({});
    const doc = await SiteSettings.create({
      theme: { banner: { templateConfigs: {
        editorial: { cards: [{ text: 'Vestidos', label: 'Elegante' }] },
      } } },
    });
    const base = `http://127.0.0.1:${server.address().port}/api/site-settings`;
    const token = jwt.sign({ role: 'admin', adminRole: 'owner', username: 'ci-owner' }, process.env.JWT_SECRET);
    const response = await fetch(base, {
      method: 'PUT',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ appearanceRevision: doc.appearanceRevision, theme: {
      banner: { templateConfigs: { editorial: { cards: [{
        text: 'Vestidos', label: 'Elegante', labelColor: '#ed246b', titleColor: '#ffffff',
      }] } } },
      } }),
    });
    const result = await response.json();

    assert.equal(response.status, 200, JSON.stringify(result));
    assert.equal(result.theme.banner.templateConfigs.editorial.cards[0].labelColor, '#ed246b');
    assert.equal(result.theme.banner.templateConfigs.editorial.cards[0].titleColor, '#ffffff');
    const raw = await SiteSettings.collection.findOne({ _id: doc._id });
    assert.equal(raw.theme.banner.templateConfigs.editorial.cards[0].labelColor, '#ed246b');
    assert.equal(raw.theme.banner.templateConfigs.editorial.cards[0].titleColor, '#ffffff');
    assert.equal(raw.appearanceRevision, doc.appearanceRevision + 1);
    const publicResponse = await fetch(base);
    assert.equal(publicResponse.status, 200);
    const publicSettings = await publicResponse.json();
    assert.equal(publicSettings.theme.banner.templateConfigs.editorial.cards[0].labelColor, '#ed246b');
    assert.equal(publicSettings.theme.banner.templateConfigs.editorial.cards[0].titleColor, '#ffffff');
    console.log('PUT HTTP, MongoDB y GET HTTP público de colores de tarjetas: OK');
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    await SiteSettings.deleteMany({});
    await mongoose.disconnect();
    if (previousSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousSecret;
    if (previousLegacyAuth === undefined) delete process.env.ALLOW_LEGACY_ADMIN_AUTH;
    else process.env.ALLOW_LEGACY_ADMIN_AUTH = previousLegacyAuth;
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
