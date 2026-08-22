'use strict';

const express = require('express');
const rateLimit = require('express-rate-limit');

const ShippingWebhookEvent = require('../models/ShippingWebhookEvent');
const {
  verifyEnviaWebhook,
  verifyEnviaSandboxTestWebhook,
} = require('../services/enviaShippingProvider');
const {
  getRuntimeShippingConfiguration,
} = require('../services/shippingConfigurationService');
const {
  processShippingWebhookEvent,
} = require('../services/shippingWebhookProcessingService');

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
    const signedHeaderNames = [
      'x-webhook-event',
      'x-webhook-id',
      'x-webhook-timestamp',
      'x-webhook-signature',
    ];
    const hasSignedHeaders = signedHeaderNames.some((name) => Boolean(req.headers[name]));
    const temporarySandboxTunnel = String(req.hostname || '')
      .toLowerCase()
      .endsWith('.trycloudflare.com');
    const verified = hasSignedHeaders
      ? verifyEnviaWebhook({
          rawBody: req.body,
          headers: req.headers,
          secret: runtime.envia.webhookSecret,
        })
      : verifyEnviaSandboxTestWebhook({
          rawBody: req.body,
          headers: req.headers,
          mode: runtime.envia.mode,
          webhookToken: runtime.envia.sandboxWebhookToken,
          apiToken: runtime.envia.token,
          allowLegacySandboxProbe:
            runtime.envia.mode === 'sandbox' && temporarySandboxTunnel,
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
      const event = await ShippingWebhookEvent.create({
        provider: 'envia',
        eventId: verified.eventId,
        eventType: verified.event,
        providerTimestamp: new Date(verified.timestamp),
        status: 'received',
        payload,
      });
      setImmediate(() => {
        processShippingWebhookEvent(event._id).catch((error) => {
          console.error('[shipping-webhook] No fue posible procesar el evento:', error?.message || error);
        });
      });
    } catch (error) {
      if (error?.code === 11000) {
        return res.status(200).json({ ok: true, duplicate: true });
      }
      throw error;
    }

    return res.status(200).json({ ok: true, accepted: true });
  } catch (error) {
    console.warn('[shipping-webhook] Solicitud rechazada:', {
      code: error?.code || 'SHIPPING_WEBHOOK_FAILED',
      status: error?.statusCode || 500,
    });
    return res.status(error?.statusCode || 500).json({
      ok: false,
      error: error?.code || 'SHIPPING_WEBHOOK_FAILED',
      message: error?.message || 'No fue posible recibir el webhook.',
    });
  }
});

module.exports = router;
