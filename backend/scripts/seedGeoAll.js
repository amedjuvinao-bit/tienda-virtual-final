// backend/scripts/seedGeoAll.js
require('dotenv').config({
  path: require('path').join(__dirname, '..', '.env'),
  quiet: true,
});

const path = require('path');
const mongoose = require('mongoose');

mongoose.set('autoIndex', false);

const CountriesISO = require('i18n-iso-countries');
const esLocale = require('i18n-iso-countries/langs/es.json');
const { Country: CSCCountry } = require('country-state-city');

const Country = require('../models/Country');
const Region = require('../models/Region');
const City = require('../models/City');

const factusMunicipalities = require(path.join(
  __dirname,
  'data',
  'factusMunicipalities.json'
));

CountriesISO.registerLocale(esLocale);

const MONGODB_URI =
  process.env.MONGODB_URI || 'mongodb://localhost:27017/tienda_virtual';

const T = (s) => String(s || '').trim();
const U = (s) => T(s).toUpperCase();

async function resetCityIndexes() {
  const indexes = await City.collection.indexes();

  for (const index of indexes) {
    if (index.name !== '_id_') {
      try {
        await City.collection.dropIndex(index.name);
        console.log(`🧹 Índice cities eliminado: ${index.name}`);
      } catch (e) {
        console.log(`⚠️ No se pudo eliminar índice cities ${index.name}: ${e.message}`);
      }
    }
  }

  await City.collection.createIndex(
    { countryCode: 1, regionCode: 1, code: 1 },
    { name: 'idx_city_country_region_code' }
  );

  await City.collection.createIndex(
    { countryCode: 1, regionCode: 1, name: 1 },
    { name: 'idx_city_country_region_name' }
  );
}

async function resetRegionIndexes() {
  const indexes = await Region.collection.indexes();

  for (const index of indexes) {
    if (index.name !== '_id_') {
      try {
        await Region.collection.dropIndex(index.name);
        console.log(`🧹 Índice regions eliminado: ${index.name}`);
      } catch (e) {
        console.log(`⚠️ No se pudo eliminar índice regions ${index.name}: ${e.message}`);
      }
    }
  }

  await Region.collection.createIndex(
    { countryCode: 1, code: 1 },
    { unique: true, name: 'uniq_region_country_code' }
  );
}

async function upsertCountriesAll() {
  const namesEs = CountriesISO.getNames('es', { select: 'official' }) || {};
  const all = CSCCountry.getAllCountries() || [];
  let count = 0;

  for (const c of all) {
    const code = U(c.isoCode);
    const name = namesEs[code] || c.name || code;

    await Country.updateOne(
      { code },
      { $set: { code, name } },
      { upsert: true }
    );

    count++;
  }

  console.log(`✅ Países upsert: ${count}`);
}

function buildUniqueMunicipalities(municipalities) {
  const map = new Map();

  for (const municipality of municipalities) {
    const code = T(municipality?.code);
    const name = T(municipality?.name);
    const departmentCode = T(municipality?.department?.code);
    const departmentName = T(municipality?.department?.name);

    if (!code || !name || !departmentCode || !departmentName) continue;

    const key = ['CO', departmentCode, code].join('|');

    if (!map.has(key)) {
      map.set(key, {
        countryCode: 'CO',
        regionCode: departmentCode,
        code,
        name,
        departmentCode,
        department: departmentName,
      });
    }
  }

  return Array.from(map.values());
}

async function upsertColombiaRegionsAndCities() {
  const COUNTRY = 'CO';

  const municipalities = Array.isArray(factusMunicipalities?.municipalities)
    ? factusMunicipalities.municipalities
    : [];

  if (!municipalities.length) {
    throw new Error(
      'El archivo backend/scripts/data/factusMunicipalities.json no tiene municipalities.'
    );
  }

  await resetCityIndexes();
  await resetRegionIndexes();

  const delR = await Region.deleteMany({ countryCode: COUNTRY });
  const delC = await City.deleteMany({ countryCode: COUNTRY });

  console.log(
    `🧹 Limpieza CO → regions: ${delR.deletedCount}, cities: ${delC.deletedCount}`
  );

  const regionsMap = new Map();

  for (const municipality of municipalities) {
    const departmentCode = T(municipality?.department?.code);
    const departmentName = T(municipality?.department?.name);

    if (!departmentCode || !departmentName) continue;

    if (!regionsMap.has(departmentCode)) {
      regionsMap.set(departmentCode, {
        countryCode: COUNTRY,
        code: departmentCode,
        isoCode: departmentCode,
        name: departmentName,
      });
    }
  }

  const regionsDocs = Array.from(regionsMap.values());

  if (regionsDocs.length) {
    await Region.insertMany(regionsDocs, { ordered: false });
  }

  console.log(`✅ Departamentos Factus insertados: ${regionsDocs.length}`);

  const uniqueCities = buildUniqueMunicipalities(municipalities);

  if (uniqueCities.length) {
    await City.insertMany(uniqueCities, { ordered: false });
  }

  console.log(`✅ Municipios Factus únicos insertados: ${uniqueCities.length}`);

  const santaMarta = await City.findOne(
    { countryCode: COUNTRY, code: '47001' },
    { _id: 0, name: 1, code: 1, regionCode: 1, department: 1 }
  ).lean();

  console.log('🔎 Verificación → Santa Marta:', santaMarta);
}

async function run() {
  try {
    console.log('⏳ Conectando a MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Conectado a MongoDB');

    await upsertCountriesAll();
    await upsertColombiaRegionsAndCities();

    console.log('🎉 seedGeoAll COMPLETADO');
  } catch (e) {
    console.error('❌ Error en seedGeoAll:', e?.message || e);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

run();