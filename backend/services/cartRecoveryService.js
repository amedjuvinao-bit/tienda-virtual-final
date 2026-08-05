'use strict';

const crypto = require('crypto');
const Cart = require('../models/Cart');
const MailSettings = require('../models/MailSettings');
const { sendMail } = require('../lib/mail/mailer');
const {
  getCartAccessSecret,
  issueCartRecoveryAccess,
  rotateCartAccess,
  verifyCartRecoveryAccess,
} = require('./cartAccessService');
const {
  classifyCartLifecycle,
  isValidEmail,
} = require('./cartAdminOperationsService');

const DEFAULT_EXPIRATION_MINUTES = 48 * 60;
const MIN_EXPIRATION_MINUTES = 15;
const MAX_EXPIRATION_MINUTES = 7 * 24 * 60;
const EMAIL_COOLDOWN_MS = 15 * 60 * 1000;

function clean(value, max = 1000) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, max);
}

function safeAdmin(req = {}) {
  return {
    id: clean(req.adminUserId, 80),
    name: clean(req.adminDisplayName || req.adminUsername || req.adminUser || 'admin', 160),
  };
}

function safeFrontendBase(env = process.env) {
  const raw = clean(env.FRONTEND_URL, 1000).replace(/\/+$/, '');
  let url;
  try {
    url = new URL(raw);
  } catch {
    const error = new Error('La URL publica de la tienda no esta configurada.');
    error.code = 'CART_RECOVERY_URL_UNAVAILABLE';
    throw error;
  }
  if (!['http:', 'https:'].includes(url.protocol)) {
    const error = new Error('La URL publica de la tienda no es valida.');
    error.code = 'CART_RECOVERY_URL_UNAVAILABLE';
    throw error;
  }
  return raw;
}

function normalizeExpiration(value) {
  const number = Number(value || DEFAULT_EXPIRATION_MINUTES);
  if (!Number.isInteger(number) || number < MIN_EXPIRATION_MINUTES || number > MAX_EXPIRATION_MINUTES) {
    const error = new TypeError('La expiracion debe estar entre 15 minutos y 7 dias.');
    error.code = 'CART_RECOVERY_EXPIRATION_INVALID';
    throw error;
  }
  return number;
}

function hashIdempotencyKey(value) {
  const key = clean(value, 200);
  return key ? crypto.createHash('sha256').update(key).digest('hex') : '';
}

function escapeHtml(value) {
  return clean(value, 2000)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

async function getMailAvailability({ MailSettingsModel = MailSettings } = {}) {
  const settings = await MailSettingsModel.findOne({ key: 'main' })
    .select('enabled fromEmail smtpHost smtpPort smtpUser hasSmtpPassword')
    .lean();
  const available = Boolean(
    settings?.enabled &&
    settings?.fromEmail &&
    settings?.smtpHost &&
    settings?.smtpPort &&
    settings?.smtpUser &&
    settings?.hasSmtpPassword
  );
  return {
    available,
    reason: available
      ? ''
      : 'El correo no esta configurado; puedes copiar el enlace de recuperacion.',
  };
}

function createCartRecoveryService({
  CartModel = Cart,
  MailSettingsModel = MailSettings,
  mailSender = sendMail,
  getSecret = getCartAccessSecret,
  env = process.env,
  now = () => new Date(),
} = {}) {
  async function issueLink(sessionId, req = {}, options = {}) {
    const cart = await CartModel.findOne({ sessionId: clean(sessionId, 120) })
      .select('+recoveryAccess.tokenHash')
      .exec();
    if (!cart) return null;
    const issuedAt = now();
    if (classifyCartLifecycle(cart, issuedAt) !== 'recoverable') {
      const error = new Error(
        cart.convertedOrderId
          ? 'El carrito ya fue convertido.'
          : !isValidEmail(cart.userEmail)
            ? 'El carrito no tiene un correo valido.'
            : 'El carrito aun no cumple las condiciones de recuperacion.'
      );
      error.code = cart.convertedOrderId
        ? 'CART_ALREADY_CONVERTED'
        : !isValidEmail(cart.userEmail)
          ? 'CART_RECOVERY_EMAIL_REQUIRED'
          : 'CART_NOT_RECOVERABLE';
      throw error;
    }
    const expirationMinutes = normalizeExpiration(options.expirationMinutes);
    const expiresAt = new Date(issuedAt.getTime() + expirationMinutes * 60 * 1000);
    const access = issueCartRecoveryAccess({
      cartId: cart._id,
      sessionId: cart.sessionId,
      expiresAt,
      secret: getSecret(),
    });
    const administrator = safeAdmin(req);
    const update = {
      $set: {
        'recoveryAccess.tokenHash': access.tokenHash,
        'recoveryAccess.issuedAt': issuedAt,
        'recoveryAccess.expiresAt': expiresAt,
        'recoveryAccess.usedAt': null,
        lastCustomerActivityAt: cart.lastCustomerActivityAt || cart.updatedAt,
        lastAdminActivityAt: issuedAt,
      },
    };
    if (options.recordAttempt !== false) {
      update.$set.lastRecoveryAttemptAt = issuedAt;
      update.$push = {
        recoveryAttempts: {
          channel: 'link',
          result: 'generated',
          administratorId: administrator.id,
          administratorName: administrator.name,
          createdAt: issuedAt,
        },
      };
    }
    await CartModel.updateOne({ _id: cart._id }, update);
    const base = safeFrontendBase(env);
    const fragment = new URLSearchParams({
      cart: cart.sessionId,
      recovery: access.credential,
    }).toString();
    return {
      link: `${base}/carrito#${fragment}`,
      expiresAt,
      recipient: clean(cart.userEmail, 180).toLowerCase(),
      subject: 'Completa tu compra',
    };
  }

  async function sendRecoveryEmail(sessionId, req = {}, options = {}) {
    const idempotencyKeyHash = hashIdempotencyKey(options.idempotencyKey);
    if (!idempotencyKeyHash) {
      const error = new Error('Se requiere una clave de idempotencia.');
      error.code = 'CART_RECOVERY_IDEMPOTENCY_REQUIRED';
      throw error;
    }
    const cart = await CartModel.findOne({ sessionId: clean(sessionId, 120) })
      .select('+recoveryAttempts.idempotencyKeyHash')
      .exec();
    if (!cart) return null;
    const previous = (cart.recoveryAttempts || []).find(
      (attempt) => attempt.idempotencyKeyHash === idempotencyKeyHash
    );
    if (previous) {
      return {
        idempotent: true,
        result: previous.result,
        attemptedAt: previous.createdAt,
      };
    }
    const currentTime = now();
    if (classifyCartLifecycle(cart, currentTime) !== 'recoverable') {
      const error = new Error('El carrito no es recuperable por correo.');
      error.code = 'CART_NOT_RECOVERABLE';
      throw error;
    }
    if (
      cart.lastRecoveryEmailAt &&
      currentTime.getTime() - new Date(cart.lastRecoveryEmailAt).getTime() < EMAIL_COOLDOWN_MS
    ) {
      const error = new Error('Ya se envio una recuperacion recientemente.');
      error.code = 'CART_RECOVERY_COOLDOWN';
      throw error;
    }
    const availability = await getMailAvailability({ MailSettingsModel });
    if (!availability.available) {
      const error = new Error(availability.reason);
      error.code = 'CART_RECOVERY_MAIL_UNAVAILABLE';
      throw error;
    }
    const lockUntil = new Date(currentTime.getTime() + 2 * 60 * 1000);
    const cooldownBoundary = new Date(currentTime.getTime() - EMAIL_COOLDOWN_MS);
    const locked = await CartModel.findOneAndUpdate(
      {
        _id: cart._id,
        $and: [
          {
            $or: [
              { lastRecoveryEmailAt: null },
              { lastRecoveryEmailAt: { $exists: false } },
              { lastRecoveryEmailAt: { $lte: cooldownBoundary } },
            ],
          },
          {
            $or: [
              { recoveryEmailLockUntil: null },
              { recoveryEmailLockUntil: { $exists: false } },
              { recoveryEmailLockUntil: { $lte: currentTime } },
            ],
          },
        ],
      },
      {
        $set: {
          recoveryEmailLockUntil: lockUntil,
          recoveryEmailLockKeyHash: idempotencyKeyHash,
        },
      },
      { new: true }
    );
    if (!locked) {
      const error = new Error('Ya existe una recuperacion reciente o en proceso.');
      error.code = 'CART_RECOVERY_COOLDOWN';
      throw error;
    }
    let linkData;
    try {
      linkData = await issueLink(sessionId, req, {
        expirationMinutes: options.expirationMinutes,
        recordAttempt: false,
      });
    } catch (error) {
      await CartModel.updateOne(
        { _id: cart._id, recoveryEmailLockKeyHash: idempotencyKeyHash },
        { $set: { recoveryEmailLockUntil: null, recoveryEmailLockKeyHash: '' } }
      );
      throw error;
    }
    const subject = clean(options.subject || linkData.subject, 220);
    const clientName = clean(cart.userName || 'cliente', 160);
    const safeLink = escapeHtml(linkData.link);
    const text = `Hola ${clientName}. Tu carrito sigue disponible. Recuperalo aqui: ${linkData.link}`;
    const html = `<p>Hola ${escapeHtml(clientName)}.</p><p>Tu carrito sigue disponible.</p><p><a href="${safeLink}">Recuperar mi carrito</a></p><p>Este enlace expira el ${escapeHtml(linkData.expiresAt.toISOString())}.</p>`;
    const administrator = safeAdmin(req);
    try {
      await mailSender({
        to: linkData.recipient,
        subject,
        text,
        html,
      });
      await CartModel.updateOne(
        { _id: cart._id },
        {
          $set: {
            lastRecoveryAttemptAt: currentTime,
            lastRecoveryEmailAt: currentTime,
            lastAdminActivityAt: currentTime,
            recoveryEmailLockUntil: null,
            recoveryEmailLockKeyHash: '',
          },
          $push: {
            recoveryAttempts: {
              channel: 'email',
              result: 'sent',
              subject,
              administratorId: administrator.id,
              administratorName: administrator.name,
              idempotencyKeyHash,
              createdAt: currentTime,
            },
          },
        }
      );
      return { result: 'sent', attemptedAt: currentTime };
    } catch {
      await CartModel.updateOne(
        { _id: cart._id },
        {
          $set: {
            lastRecoveryAttemptAt: currentTime,
            lastAdminActivityAt: currentTime,
            recoveryEmailLockUntil: null,
            recoveryEmailLockKeyHash: '',
          },
          $push: {
            recoveryAttempts: {
              channel: 'email',
              result: 'failed',
              subject,
              detail: 'No fue posible entregar el correo.',
              administratorId: administrator.id,
              administratorName: administrator.name,
              idempotencyKeyHash,
              createdAt: currentTime,
            },
          },
        }
      );
      const error = new Error('No fue posible enviar el correo de recuperacion.');
      error.code = 'CART_RECOVERY_EMAIL_FAILED';
      throw error;
    }
  }

  async function claim({ sessionId, credential } = {}) {
    const safeSessionId = clean(sessionId, 120);
    const cart = await CartModel.findOne({ sessionId: safeSessionId })
      .select('+accessTokenHash +accessVersion +accessIssuedAt +recoveryAccess.tokenHash')
      .exec();
    const currentTime = now();
    if (!verifyCartRecoveryAccess({
      cart,
      sessionId: safeSessionId,
      credential,
      secret: getSecret(),
      now: currentTime,
    })) {
      return null;
    }
    const rotated = rotateCartAccess({
      cartId: cart._id,
      sessionId: safeSessionId,
      secret: getSecret(),
    });
    const updated = await CartModel.findOneAndUpdate(
      {
        _id: cart._id,
        sessionId: safeSessionId,
        'recoveryAccess.tokenHash': cart.recoveryAccess.tokenHash,
        'recoveryAccess.usedAt': null,
        'recoveryAccess.expiresAt': { $gt: currentTime },
      },
      {
        $set: {
          accessTokenHash: rotated.tokenHash,
          accessVersion: rotated.version,
          accessIssuedAt: currentTime,
          'recoveryAccess.usedAt': currentTime,
          lastCustomerActivityAt: currentTime,
        },
        $currentDate: { updatedAt: true },
      },
      { new: true, timestamps: false }
    )
      .select('+accessTokenHash +accessVersion +accessIssuedAt')
      .exec();
    return updated
      ? { cart: updated, sessionId: safeSessionId, token: rotated.token }
      : null;
  }

  return {
    claim,
    getMailAvailability: () => getMailAvailability({ MailSettingsModel }),
    issueLink,
    sendRecoveryEmail,
  };
}

module.exports = {
  DEFAULT_EXPIRATION_MINUTES,
  EMAIL_COOLDOWN_MS,
  createCartRecoveryService,
  getMailAvailability,
  hashIdempotencyKey,
  normalizeExpiration,
  safeFrontendBase,
};
