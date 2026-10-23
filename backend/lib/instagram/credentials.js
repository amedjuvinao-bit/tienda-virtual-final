'use strict';
const crypto = require('crypto');
function key() {
  const secret = process.env.INSTAGRAM_ENCRYPTION_KEY || process.env.MAIL_ENCRYPTION_KEY;
  if (!secret || secret.length < 32) throw new Error('Configura INSTAGRAM_ENCRYPTION_KEY con al menos 32 caracteres en el servidor.');
  return crypto.createHash('sha256').update(secret).digest();
}
function protect(value) {
  if (!value) return '';
  const iv = crypto.randomBytes(12), cipher = crypto.createCipheriv('aes-256-gcm', key(), iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return ['v1', iv.toString('base64'), cipher.getAuthTag().toString('base64'), encrypted.toString('base64')].join(':');
}
function reveal(value) {
  const [version, iv, tag, data] = String(value || '').split(':');
  if (version !== 'v1' || !iv || !tag || !data) throw new Error('Credencial de Instagram no válida.');
  const cipher = crypto.createDecipheriv('aes-256-gcm', key(), Buffer.from(iv, 'base64'));
  cipher.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([cipher.update(Buffer.from(data, 'base64')), cipher.final()]).toString('utf8');
}
const digest = value => crypto.createHash('sha256').update(String(value)).digest('hex');
function signCursor(after, account) {
  if (!after) return '';
  const payload = Buffer.from(JSON.stringify({ after, account, exp: Date.now() + 24 * 60 * 60 * 1000 })).toString('base64url');
  return `${payload}.${crypto.createHmac('sha256', key()).update(payload).digest('base64url')}`;
}
function readCursor(value, account) {
  if (!value) return '';
  if (typeof value !== 'string' || value.length > 8192) throw new Error('Paginación no válida.');
  const [payload, signature, extra] = value.split('.');
  const expected = crypto.createHmac('sha256', key()).update(payload || '').digest('base64url');
  if (extra || !signature || signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) throw new Error('Paginación no válida.');
  const data = JSON.parse(Buffer.from(payload, 'base64url').toString());
  if (data.account !== account || data.exp < Date.now() || typeof data.after !== 'string' || data.after.length > 4096) throw new Error('Paginación caducada. Recarga la sección.');
  return data.after;
}
module.exports = { key, protect, reveal, digest, signCursor, readCursor };
