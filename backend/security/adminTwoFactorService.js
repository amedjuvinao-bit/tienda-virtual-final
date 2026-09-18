'use strict';

const crypto = require('crypto');

const AdminTwoFactorChallenge = require('../models/AdminTwoFactorChallenge');
const AdminUser = require('../models/AdminUser');
const {
  clearTwoFactorChallengeCookie,
  getTwoFactorChallengeToken,
  setTwoFactorChallengeCookie,
} = require('./adminSessionService');
const {
  decryptTwoFactorSecret,
  hashRecoveryCode,
  verifyTotp,
} = require('./adminTwoFactorCrypto');

const CHALLENGE_MINUTES = 5;
const CHALLENGE_MAX_ATTEMPTS = 5;

function hashToken(value) {
  return crypto.createHash('sha256').update(String(value || '')).digest('hex');
}

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(String(left || ''));
  const rightBuffer = Buffer.from(String(right || ''));
  return (
    leftBuffer.length === rightBuffer.length &&
    crypto.timingSafeEqual(leftBuffer, rightBuffer)
  );
}

function getClientIp(req) {
  const forwarded = req?.headers?.['x-forwarded-for'];
  if (forwarded) return String(forwarded).split(',')[0].trim().slice(0, 160);
  return String(req?.ip || req?.socket?.remoteAddress || 'unknown').slice(0, 160);
}

function getUserAgent(req) {
  return String(req?.headers?.['user-agent'] || '').slice(0, 500);
}

function parseChallengeToken(rawToken) {
  const [challengeId, secret, extra] = String(rawToken || '').split('.');
  if (extra || !challengeId || !secret) return null;
  if (!/^[A-Za-z0-9_-]{20,100}$/.test(challengeId)) return null;
  if (!/^[A-Za-z0-9_-]{30,200}$/.test(secret)) return null;
  return { challengeId, rawToken: `${challengeId}.${secret}` };
}

async function createLoginChallenge(req, res, adminUser) {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + CHALLENGE_MINUTES * 60 * 1000);
  const challengeId = crypto.randomBytes(24).toString('base64url');
  const secret = crypto.randomBytes(48).toString('base64url');
  const rawToken = `${challengeId}.${secret}`;

  await AdminTwoFactorChallenge.updateMany(
    { adminUser: adminUser._id, consumedAt: null },
    { $set: { consumedAt: now, consumeReason: 'superseded' } }
  );

  await AdminTwoFactorChallenge.create({
    challengeId,
    tokenHash: hashToken(rawToken),
    adminUser: adminUser._id,
    attempts: 0,
    maxAttempts: CHALLENGE_MAX_ATTEMPTS,
    ip: getClientIp(req),
    userAgent: getUserAgent(req),
    expiresAt,
  });

  setTwoFactorChallengeCookie(
    res,
    rawToken,
    CHALLENGE_MINUTES * 60 * 1000
  );

  return { expiresAt, maxAttempts: CHALLENGE_MAX_ATTEMPTS };
}

async function loadChallenge(req) {
  const parsed = parseChallengeToken(getTwoFactorChallengeToken(req));
  if (!parsed) return { ok: false, reason: 'missing_challenge' };

  const challenge = await AdminTwoFactorChallenge.findOne({
    challengeId: parsed.challengeId,
  }).select('+challengeId +tokenHash');

  if (!challenge || !safeEqual(challenge.tokenHash, hashToken(parsed.rawToken))) {
    return { ok: false, reason: 'invalid_challenge' };
  }
  if (challenge.consumedAt) {
    return { ok: false, reason: challenge.consumeReason || 'challenge_consumed' };
  }
  if (new Date(challenge.expiresAt).getTime() <= Date.now()) {
    await AdminTwoFactorChallenge.updateOne(
      { _id: challenge._id, consumedAt: null },
      { $set: { consumedAt: new Date(), consumeReason: 'expired' } }
    );
    return { ok: false, reason: 'challenge_expired' };
  }
  if (Number(challenge.attempts || 0) >= Number(challenge.maxAttempts || 0)) {
    return { ok: false, reason: 'attempts_exhausted' };
  }

  return { ok: true, challenge };
}

async function registerFailedAttempt(challenge, res) {
  const updated = await AdminTwoFactorChallenge.findOneAndUpdate(
    { _id: challenge._id, consumedAt: null },
    { $inc: { attempts: 1 } },
    { new: true }
  );

  const attempts = Number(updated?.attempts || challenge.attempts || 0);
  const maxAttempts = Number(updated?.maxAttempts || challenge.maxAttempts || 0);
  const remainingAttempts = Math.max(0, maxAttempts - attempts);

  if (updated && remainingAttempts === 0) {
    await AdminTwoFactorChallenge.updateOne(
      { _id: updated._id, consumedAt: null },
      { $set: { consumedAt: new Date(), consumeReason: 'attempts_exhausted' } }
    );
    clearTwoFactorChallengeCookie(res);
  }

  return remainingAttempts;
}

async function consumeChallenge(challenge, reason) {
  return AdminTwoFactorChallenge.findOneAndUpdate(
    { _id: challenge._id, consumedAt: null },
    { $set: { consumedAt: new Date(), consumeReason: reason } },
    { new: true }
  );
}

async function verifyLoginChallenge(req, res, code) {
  const loaded = await loadChallenge(req);
  if (!loaded.ok) {
    clearTwoFactorChallengeCookie(res);
    return { ok: false, reason: loaded.reason, remainingAttempts: 0 };
  }

  const { challenge } = loaded;
  const adminUser = await AdminUser.findOne({
    _id: challenge.adminUser,
    deletedAt: null,
  })
    .select(
      '+passwordHash +twoFactorSecret +twoFactorRecoveryCodeHashes +tokenVersion +failedLoginAttempts +lockedUntil'
    )
    .populate('roleRef', 'name code level scope permissions');

  if (
    !adminUser ||
    adminUser.active !== true ||
    adminUser.status !== 'active' ||
    adminUser.twoFactorEnabled !== true ||
    !adminUser.twoFactorSecret
  ) {
    await consumeChallenge(challenge, 'user_invalid');
    clearTwoFactorChallengeCookie(res);
    return { ok: false, reason: 'user_invalid', remainingAttempts: 0 };
  }

  let secret;
  try {
    secret = decryptTwoFactorSecret(adminUser.twoFactorSecret);
  } catch {
    await consumeChallenge(challenge, 'secret_invalid');
    clearTwoFactorChallengeCookie(res);
    return { ok: false, reason: 'secret_invalid', remainingAttempts: 0 };
  }

  const cleanCode = String(code || '').trim();
  const totpValid = verifyTotp(secret, cleanCode);
  const recoveryHash = totpValid ? '' : hashRecoveryCode(cleanCode);
  const recoveryValid = Boolean(
    recoveryHash &&
      (adminUser.twoFactorRecoveryCodeHashes || []).some((value) =>
        safeEqual(value, recoveryHash)
      )
  );

  if (!totpValid && !recoveryValid) {
    const remainingAttempts = await registerFailedAttempt(challenge, res);
    return {
      ok: false,
      reason: 'invalid_code',
      remainingAttempts,
      username: adminUser.username,
    };
  }

  const consumed = await consumeChallenge(
    challenge,
    recoveryValid ? 'verified_recovery_code' : 'verified_totp'
  );
  if (!consumed) {
    clearTwoFactorChallengeCookie(res);
    return {
      ok: false,
      reason: 'challenge_consumed',
      remainingAttempts: 0,
      username: adminUser.username,
    };
  }

  const now = new Date();
  if (recoveryValid) {
    const update = await AdminUser.updateOne(
      {
        _id: adminUser._id,
        twoFactorRecoveryCodeHashes: recoveryHash,
      },
      {
        $pull: { twoFactorRecoveryCodeHashes: recoveryHash },
        $set: { twoFactorLastUsedAt: now },
      }
    );
    if (!update.modifiedCount) {
      clearTwoFactorChallengeCookie(res);
      return {
        ok: false,
        reason: 'recovery_code_used',
        remainingAttempts: 0,
        username: adminUser.username,
      };
    }
    adminUser.twoFactorRecoveryCodeHashes = (
      adminUser.twoFactorRecoveryCodeHashes || []
    ).filter((value) => value !== recoveryHash);
  } else {
    adminUser.twoFactorLastUsedAt = now;
    await adminUser.save({ validateBeforeSave: false });
  }

  clearTwoFactorChallengeCookie(res);
  return { ok: true, adminUser, recoveryCodeUsed: recoveryValid };
}

async function cancelLoginChallenge(req, res) {
  const loaded = await loadChallenge(req);
  if (loaded.ok) await consumeChallenge(loaded.challenge, 'cancelled');
  clearTwoFactorChallengeCookie(res);
}

module.exports = {
  cancelLoginChallenge,
  createLoginChallenge,
  verifyLoginChallenge,
};
