'use strict';

const Subscriber = require('../models/Subscriber');

function cleanText(value, maximum = 200) {
  return String(value || '').trim().slice(0, maximum);
}

function normalizeNewsletterIntent(customer = {}, sessionId = '') {
  if (customer?.wantsNewsletter !== true) return null;

  const rawEmail = cleanText(customer.emailOrPhone, 254).toLowerCase();
  const email = rawEmail.includes('@') ? rawEmail : '';
  const phone = cleanText(customer.phone || (!email ? rawEmail : ''), 40);
  if (!email && !phone) return null;

  return {
    email,
    phone,
    sessionId: cleanText(sessionId, 200),
    origen: 'checkout',
  };
}

function isDuplicateKeyError(error) {
  return Number(error?.code) === 11000;
}

function buildSubscriberFilter(intent) {
  const candidates = [];
  if (intent.email) candidates.push({ email: intent.email });
  if (intent.phone) candidates.push({ phone: intent.phone });
  return candidates.length === 1 ? candidates[0] : { $or: candidates };
}

async function upsertSubscriber(intent, SubscriberModel) {
  const filter = buildSubscriberFilter(intent);
  const contactFields = {
    ...(intent.email ? { email: intent.email } : {}),
    ...(intent.phone ? { phone: intent.phone } : {}),
  };

  return SubscriberModel.findOneAndUpdate(
    filter,
    {
      $set: {
        sessionId: intent.sessionId,
      },
      $setOnInsert: {
        ...contactFields,
        origen: intent.origen,
        fecha: new Date(),
      },
    },
    {
      new: true,
      upsert: true,
      setDefaultsOnInsert: true,
    }
  );
}

async function persistNewsletterSubscription(
  intent,
  { SubscriberModel = Subscriber, logger = console } = {}
) {
  if (!intent?.email && !intent?.phone) {
    return { attempted: false, persisted: false, reason: 'not_requested' };
  }

  try {
    const subscriber = await upsertSubscriber(intent, SubscriberModel);
    return {
      attempted: true,
      persisted: Boolean(subscriber),
      subscriberId: subscriber?._id || null,
    };
  } catch (error) {
    // Una carrera entre dos checkouts puede ganar el mismo índice único. Se
    // vuelve a buscar/actualizar fuera de la transacción de la orden para que
    // esa condición secundaria nunca aborte la compra principal.
    if (isDuplicateKeyError(error)) {
      try {
        const subscriber = await upsertSubscriber(intent, SubscriberModel);
        return {
          attempted: true,
          persisted: Boolean(subscriber),
          reused: true,
          subscriberId: subscriber?._id || null,
        };
      } catch (retryError) {
        logger.warn('No se pudo actualizar la suscripción existente.', {
          code: retryError?.code || '',
        });
        return {
          attempted: true,
          persisted: false,
          retryable: true,
          errorCode: String(retryError?.code || 'SUBSCRIBER_UPSERT_FAILED'),
        };
      }
    }

    logger.warn('No se pudo guardar la suscripción solicitada en Checkout.', {
      code: error?.code || '',
    });
    return {
      attempted: true,
      persisted: false,
      retryable: true,
      errorCode: String(error?.code || 'SUBSCRIBER_UPSERT_FAILED'),
    };
  }
}

module.exports = {
  buildSubscriberFilter,
  isDuplicateKeyError,
  normalizeNewsletterIntent,
  persistNewsletterSubscription,
};
