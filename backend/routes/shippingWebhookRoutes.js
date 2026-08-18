'use strict';

const express = require('express');
const rateLimit = require('express-rate-limit');

const ShippingWebhookEvent = require('../models/ShippingWebhookEvent');
const { verifyEnviaWebhook } = require('../services/enviaShippingProvider');
const {
  getRuntimeShippingConfiguration,
} = require('../services/shippingConfigurationService');

const router = express.Router();

router.use(
  rateLimit({
    windowMs: 60_000,
    max: 120,
    standardHeaders: true,
    legacyHeaders: false,
    message: { ok: false, message: 'Demasiados webhooks.' },
  })
);

router.post('/', async (req, res) => {
  try {
    const runtime = await getRuntimeShippingConfiguration();
    const verified = verifyEnviaWebhook({
      rawBody: req.body,
      headers: req.headers,
      secret: runtime.envia.webhookSecret,
    });
    let payload;
    try {
      payload = JSON.parse(verified.body || '{}');
    } catch {
      return res.status(400).json({
        ok: false,
        error: 'INVALID_SHIPPING_WEBHOOK_JSON',
        message: 'El cuerpo del webhook no contiene JSON válido.',
      });
    }

    try {
      await ShippingWebhookEvent.create({
        provider: 'envia',
        eventId: verified.eventId,
        eventType: verified.event,
        providerTimestamp: new Date(verified.timestamp),
        status: 'received',
        payload,
      });
    } catch (error) {
      if (error?.code === 11000) {
        return res.status(200).json({ ok: true, duplicate: true });
      }
      throw error;
    }

    return res.status(202).json({ ok: true, accepted: true });
  } catch (error) {
    return res.status(error?.statusCode || 500).json({
      ok: false,
      error: error?.code || 'SHIPPING_WEBHOOK_FAILED',
      message: error?.message || 'No fue posible recibir el webhook.',
    });
  }
});

module.exports = router;
