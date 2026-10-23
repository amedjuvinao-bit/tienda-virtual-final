'use strict';
const crypto = require('crypto');
const QRCode = require('qrcode');
const { key, protect, reveal, digest } = require('../lib/tiktok/credentials');
const QR_FIELDS = '+clientSecretEncrypted +tokenEncrypted +refreshTokenEncrypted +qrSessionEncrypted +qrHash';
const clearQr = s => { s.qrHash = ''; s.qrSessionEncrypted = ''; s.qrExpiresAt = null; };

// TikTok returns the authorization code inside redirect_uri (or code). We only
// parse it; no request is ever made to this provider-supplied URL.
function qrGrant(result, fallback, ErrorType, expectedState) {
  const value = result.redirect_uri || result.code;
  if (typeof value !== 'string' || !value || value.length > 8192) throw new ErrorType('TikTok no devolvió un código de autorización válido. Genera otro QR.');
  if (!value.includes('://')) {
    if (result.redirect_uri || value.length > 4096 || /[:\\\s\x00-\x1f]/.test(value)) throw new ErrorType('TikTok no devolvió un código de autorización válido. Genera otro QR.');
    return { code: value, ...(fallback ? { redirect_uri: fallback } : {}) };
  }
  try {
    const url = new URL(value), codes = url.searchParams.getAll('code');
    if (url.protocol !== 'https:' || url.username || url.password || codes.length !== 1 || !codes[0] || url.searchParams.has('error')) throw new Error();
    if (url.searchParams.has('state') && (url.searchParams.getAll('state').length !== 1 || url.searchParams.get('state') !== expectedState)) throw new Error();
    if (result.redirect_uri && result.code && result.code !== value && result.code !== codes[0]) throw new Error();
    const code = codes[0]; url.search = ''; url.hash = '';
    return { code, redirect_uri: url.href };
  } catch { throw new ErrorType('TikTok no devolvió un código de autorización válido. Genera otro QR.'); }
}

function createQrService({ Model, call, install, assertRevision, ErrorType }) {
  const pending = new Map();
  async function createQr(input, owner) {
    const s = await Model.getSingleton(); assertRevision(s, input); key();
    if (!owner) throw new ErrorType('Inicia sesión de nuevo antes de conectar TikTok.', 401);
    if (!s.clientKey || !s.clientSecretEncrypted) throw new ErrorType('Guarda Client Key y Client Secret antes de generar el QR.');
    const state = crypto.randomBytes(32).toString('hex'), ticket = crypto.randomBytes(32).toString('hex');
    const response = await call('oauth/get_qrcode', { form: { client_key: s.clientKey, scope: 'user.info.basic,video.list', state } });
    let url;
    try {
      url = new URL(response.scan_qrcode_url);
      if (url.protocol !== 'aweme:' || url.hostname !== 'authorize' || url.username || url.password || url.href.length > 4096 || typeof response.token !== 'string' || !response.token || response.token.length > 4096) throw new Error();
      url.searchParams.set('client_ticket', ticket);
    } catch { throw new ErrorType('TikTok no devolvió un QR válido. Revisa Login Kit y vuelve a intentar.'); }
    const qrToken = crypto.randomBytes(32).toString('hex');
    const qrImage = await QRCode.toDataURL(url.href, { width: 320, margin: 4, errorCorrectionLevel: 'M' });
    s.qrHash = digest(qrToken); s.qrExpiresAt = new Date(Date.now() + 10 * 60000);
    s.qrSessionEncrypted = protect(JSON.stringify({ token: response.token, ticket, state, owner }));
    s.oauthHash = ''; s.oauthExpiresAt = null;
    await s.save();
    return { ok: true, qrToken, qrImage, expiresAt: s.qrExpiresAt, status: 'new', pollAfterMs: 3000 };
  }
  async function session(input, owner) {
    if (!owner || typeof input.qrToken !== 'string' || !/^[a-f0-9]{64}$/.test(input.qrToken)) throw new ErrorType('La conexión QR no es válida. Genera otro código.', 400);
    const s = await Model.getSingleton();
    if (s.qrHash !== digest(input.qrToken) || !s.qrSessionEncrypted) throw new ErrorType('El QR fue cancelado, sustituido o utilizado. Genera otro código.', 409);
    const auth = JSON.parse(reveal(s.qrSessionEncrypted));
    if (auth.owner !== owner) throw new ErrorType('Este QR pertenece a otra sesión de administración.', 403);
    return { s, auth };
  }
  async function cancelQr(input, owner) {
    const { s } = await session(input, owner); clearQr(s); await s.save();
    return { ok: true, status: 'cancelled' };
  }
  async function poll(input, owner) {
    const { s, auth } = await session(input, owner);
    if (+new Date(s.qrExpiresAt) <= Date.now()) { clearQr(s); await s.save(); return { ok: true, status: 'expired' }; }
    const result = await call('oauth/check_qrcode', { form: { client_key: s.clientKey, client_secret: reveal(s.clientSecretEncrypted), token: auth.token } });
    const status = result.status;
    if (!['new', 'scanned', 'confirmed', 'expired', 'utilised'].includes(status)) throw new ErrorType('No se pudo comprobar el QR. Genera otro código.');
    const sameTicket = result.client_ticket === auth.ticket;
    if ((status === 'scanned' || status === 'confirmed' || result.client_ticket) && !sameTicket || result.state && result.state !== auth.state) throw new ErrorType('La respuesta no corresponde a este QR. Cancela y genera otro código.');
    if (status === 'expired' || status === 'utilised') { clearQr(s); await s.save(); return { ok: true, status: 'expired' }; }
    if (status !== 'confirmed') return { ok: true, status, pollAfterMs: 3000 };
    const grant = qrGrant(result, s.redirectUri, ErrorType, auth.state);
    // Consume once before exchanging the code. Revision + __v protect against
    // cancellation, replacement, disconnect and another server's polling call.
    const claimed = await Model.findOneAndUpdate({ key: 'main', __v: s.__v, qrHash: s.qrHash, qrExpiresAt: { $gt: new Date() } },
      { $set: { qrHash: '', qrSessionEncrypted: '', qrExpiresAt: null, oauthHash: '', oauthExpiresAt: null }, $inc: { __v: 1 } }, { new: true }).select(QR_FIELDS);
    if (!claimed) throw new ErrorType('La conexión cambió o el QR caducó. Genera otro código.', 409);
    const tokens = await call('oauth/token', { form: { client_key: claimed.clientKey, client_secret: reveal(claimed.clientSecretEncrypted), grant_type: 'authorization_code', ...grant } });
    return { ...await install(claimed, tokens), status: 'confirmed' };
  }
  function checkQr(input, owner) {
    const id = `${owner}:${digest(input.qrToken || '')}`;
    if (!pending.has(id)) pending.set(id, poll(input, owner).finally(() => pending.delete(id)));
    return pending.get(id);
  }
  return { createQr, checkQr, cancelQr };
}
module.exports = { createQrService, clearQr, qrGrant };
