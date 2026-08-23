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
  markShippingWebhookVerified,
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

async function persistVerifiedEvent(verified, payload) {
  try {
    const event = await ShippingWebhookEvent.create({
      provider: 'envia',
      eventId: verified.eventId,
      eventType: verified.event,
      providerTimestamp: new Date(verified.timestamp),
      status: 'received',
      payload,
    });
    console.info('[shipping-webhook] Solicitud aceptada:', {
      eventId: verified.eventId,
      eventType: verified.event,
      sandboxTest: verified.sandboxTest === true,
    });
    await markShippingWebhookVerified(verified);
    setImmediate(() => {
      processShippingWebhookEvent(event._id).catch((error) => {
        console.error('[shipping-webhook] No fue posible procesar el evento:', error?.message || error);
      });
    });
    return { duplicate: false };
  } catch (error) {
    if (error?.code === 11000) {
      console.info('[shipping-webhook] Solicitud duplicada aceptada:', {
        eventId: verified.eventId,
      });
      await markShippingWebhookVerified(verified);
      return { duplicate: true };
    }
    throw error;
  }
}

router.get('/', (_req, res) =>
  res.status(200).json({ received: true, ready: true })
);

router.post('/', async (req, res) => {
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

  if (!hasSignedHeaders && temporarySandboxTunnel) {
    const response = res.status(200).json({ received: true });
    setImmediate(async () => {
      try {
        const runtime = await getRuntimeShippingConfiguration();
        const verified = verifyEnviaSandboxTestWebhook({
          rawBody: req.body,
          headers: req.headers,
          mode: runtime.envia.mode,
          webhookToken: runtime.envia.sandboxWebhookToken,
          apiToken: runtime.envia.token,
          allowLegacySandboxProbe: runtime.envia.mode === 'sandbox',
        });
        const payload = JSON.parse(verified.body || '{}');
        await persistVerifiedEvent(verified, payload);
      } catch (error) {
        console.warn('[shipping-webhook] Prueba Sandbox confirmada pero descartada:', {
          code: error?.code || 'SHIPPING_WEBHOOK_FAILED',
          status: error?.statusCode || 500,
        });
      }
    });
    return response;
  }

  try {
    const runtime = await getRuntimeShippingConfiguration();
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

    if (verified.sandboxTest === true) {
      const response = res.status(200).json({ received: true });
      setImmediate(() => {
        persistVerifiedEvent(verified, payload).catch((error) => {
          console.error('[shipping-webhook] No fue posible guardar la prueba aceptada:', error?.message || error);
        });
      });
      return response;
    }

    const persisted = await persistVerifiedEvent(verified, payload);
    return res.status(200).json({
      received: true,
      ...(persisted.duplicate ? { duplicate: true } : {}),
    });
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
