// backend/routes/geo.js
const express = require('express');
const Country = require('../models/Country');
const Region = require('../models/Region');
const City = require('../models/City');

const router = express.Router();

/**
 * GET /api/geo/countries
 * Lista de países (code, name)
 */
router.get('/countries', async (req, res) => {
  try {
    const countries = await Country.find({}, { _id: 0, code: 1, name: 1 })
      .sort({ name: 1 })
      .lean();

    res.json(countries);
  } catch (err) {
    console.error('GET /countries error:', err);
    res.status(500).json({ message: 'Error obteniendo países' });
  }
});

/**
 * GET /api/geo/regions?country=CO
 * Lista de departamentos/regiones por país (code, isoCode, name)
 */
router.get('/regions', async (req, res) => {
  try {
    const { country } = req.query;

    if (!country) {
      return res.status(400).json({
        message: 'Parámetro "country" es requerido (ej: CO)',
      });
    }

    const regions = await Region.find(
      { countryCode: String(country).toUpperCase() },
      {
        _id: 0,
        code: 1,
        isoCode: 1,
        name: 1,
      }
    )
      .sort({ name: 1 })
      .lean();

    res.json(regions);
  } catch (err) {
    console.error('GET /regions error:', err);
    res.status(500).json({ message: 'Error obteniendo regiones' });
  }
});

/**
 * GET /api/geo/cities?country=CO&region=ANT&q=me&limit=10000
 * Lista ciudades por país y (opcional) departamento.
 * Devuelve name y code para poder enviar municipality_id a Factus.
 */
router.get('/cities', async (req, res) => {
  try {
    const { country, region, q = '', limit } = req.query;

    if (!country) {
      return res.status(400).json({
        message: 'Parámetro "country" es requerido (ej: CO)',
      });
    }

    const filt = {
      countryCode: String(country).toUpperCase(),
    };

    if (region && String(region).trim()) {
      filt.regionCode = String(region).toUpperCase();
    }

    const safe = String(q || '')
      .trim()
      .replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    if (safe.length > 0) {
      filt.$or = [
        { name: new RegExp(`^${safe}`, 'i') },
        { name: new RegExp(`${safe}`, 'i') },
      ];
    }

    const requested = parseInt(limit, 10);

    const lim = Number.isFinite(requested)
      ? Math.min(Math.max(requested, 1), 10000)
      : safe.length > 0
        ? 500
        : 5000;

    const cities = await City.find(filt, {
      _id: 0,
      name: 1,
      code: 1,
      countryCode: 1,
      regionCode: 1,
      departmentCode: 1,
      department: 1,
    })
      .sort({ name: 1 })
      .limit(lim)
      .lean();

    res.json(cities);
  } catch (err) {
    console.error('GET /cities error:', err);
    res.status(500).json({ message: 'Error obteniendo ciudades' });
  }
});

module.exports = router;