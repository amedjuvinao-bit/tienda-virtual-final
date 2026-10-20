'use strict';
const crypto = require('crypto');
const Settings = require('../models/InstagramSettings');
const Pages = require('../models/InstagramFeedPage');
const { key, protect, reveal, digest, signCursor, readCursor } = require('../lib/instagram/credentials');
const HOUR = 3600000;
const busy = new Map();
class InstagramError extends Error {
  constructor(message, status = 422) { super(message); this.status = status; }
}
function safeAsset(value) {
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password && !url.searchParams.has('access_token') ? url.href : ''; } catch { return ''; }
}
function permalink(value) {
  const safe = safeAsset(value);
  try { return /^(www\.)?instagram\.com$/.test(new URL(safe).hostname) ? safe : ''; } catch { return ''; }
}
function normalizeMedia(media) {
  const children = Array.isArray(media.children?.data) ? media.children.data : [];
  const album = (children.length ? children : [media]).map(m => ({
    id: String(m.id || ''), image: safeAsset(m.media_type === 'VIDEO' ? m.thumbnail_url : m.media_url),
    videoUrl: m.media_type === 'VIDEO' ? safeAsset(m.media_url) : '',
  })).filter(m => m.image || m.videoUrl);
  const first = album[0];
  if (!first?.image || !permalink(media.permalink)) return null;
  return {
    id: `ig_${media.id}`, enabled: true, image: first.image, videoUrl: first.videoUrl,
    album, link: permalink(media.permalink), caption: String(media.caption || '').slice(0, 5000),
    alt: String(media.caption || 'Publicación de Instagram').slice(0, 160),
    kind: media.media_type === 'VIDEO' ? 'reel' : 'photo', timestamp: media.timestamp || '',
    likes: Number(media.like_count) || 0, comments: Number(media.comments_count) || 0,
  };
}
async function metaRequest(url, { token, body, fetchFn = fetch } = {}) {
  let response, data;
  try {
    response = await fetchFn(url, {
      method: body ? 'POST' : 'GET', redirect: 'error', signal: AbortSignal.timeout(12000),
      headers: body ? { 'Content-Type': 'application/x-www-form-urlencoded' } : token ? { Authorization: `Bearer ${token}` } : {},
      ...(body ? { body: new URLSearchParams(body) } : {}),
    });
    data = await response.json();
  } catch { throw new InstagramError('Instagram no respondió. Intenta actualizar más tarde.', 503); }
  if (!response.ok || data.error || data.error_type) {
    // Never return the provider's raw error, URL or access token.
    const expired = Number(data.error?.code) === 190;
    throw new InstagramError(expired ? 'El acceso a Instagram caducó o fue revocado. Vuelve a conectar la cuenta.' : 'Instagram rechazó la solicitud. Revisa el token, la cuenta profesional y el permiso instagram_business_basic.');
  }
  return data;
}
function graph(settings, path, params = {}) {
  const url = new URL(`https://graph.instagram.com/${settings.apiVersion}/${path}`);
  Object.entries(params).forEach(([k, v]) => { if (v !== '') url.searchParams.set(k, v); });
  return url;
}
async function profile(settings, token, fetchFn) {
  const identity = await metaRequest(graph(settings, 'me', { fields: 'user_id,username' }), { token, fetchFn });
  const id = String(identity.user_id || identity.id || '');
  if (!/^\d+$/.test(id) || !/^[\w.]+$/.test(identity.username || '')) throw new InstagramError('No se recibió una cuenta válida de Instagram.');
  const detail = await metaRequest(graph(settings, id, { fields: 'username,name,account_type,profile_picture_url,followers_count,media_count' }), { token, fetchFn });
  return { id, username: identity.username, name: String(detail.name || identity.username).slice(0, 120),
    avatar: safeAsset(detail.profile_picture_url), url: `https://www.instagram.com/${identity.username}/`,
    followers: Number(detail.followers_count) || 0, mediaCount: Number(detail.media_count) || 0 };
}
function safeSettings(s) {
  let encryptionReady = false; try { key(); encryptionReady = true; } catch { /* setup */ }
  return { ok: true, settings: {
    revision: s.revision, appId: s.appId, apiVersion: s.apiVersion, redirectUri: s.redirectUri,
    hasAppSecret: Boolean(s.appSecretEncrypted), connected: Boolean(s.tokenEncrypted && s.account),
    enabled: s.enabled, account: s.account, expiresAt: s.expiresAt || null, syncedAt: s.syncedAt || null,
    lastError: s.lastError, encryptionReady,
  } };
}
function assertRevision(s, input) {
  if (!Number.isInteger(input.revision) || input.revision !== s.revision) throw new InstagramError('Los ajustes cambiaron en otra sesión. Recarga antes de guardar.', 409);
}
function validateRedirect(value) {
  if (!value) return '';
  try {
    const url = new URL(value);
    const local = ['localhost', '127.0.0.1'].includes(url.hostname);
    if (url.username || url.password || url.search || url.hash || url.pathname !== '/api/instagram/callback' || (url.protocol !== 'https:' && !(url.protocol === 'http:' && local))) throw new Error();
    return url.href;
  } catch { throw new InstagramError('Usa la URL HTTPS del backend seguida de /api/instagram/callback (HTTP solo en localhost).'); }
}
function createInstagramService({ Model = Settings, PageModel = Pages, fetchFn = fetch } = {}) {
  async function getSettings() { return safeSettings(await Model.getSingleton()); }
  async function save(input) {
    const s = await Model.getSingleton(); assertRevision(s, input);
    const appId = String(input.appId || '').trim();
    if (appId && !/^\d{5,40}$/.test(appId)) throw new InstagramError('El ID de la app debe ser numérico.');
    const apiVersion = String(input.apiVersion || 'v24.0').trim();
    if (!/^v\d{2}\.0$/.test(apiVersion)) throw new InstagramError('Versión de API no válida. Ejemplo: v24.0.');
    const redirectUri = validateRedirect(String(input.redirectUri || '').trim());
    const changed = s.appId !== appId || s.redirectUri !== redirectUri || Boolean(input.appSecret?.trim());
    s.appId = appId; s.apiVersion = apiVersion; s.redirectUri = redirectUri;
    if (input.appSecret?.trim()) s.appSecretEncrypted = protect(String(input.appSecret).trim());
    s.enabled = input.enabled === true;
    if (changed) { s.oauthHash = ''; s.oauthExpiresAt = null; }
    s.revision += 1; await s.save(); return safeSettings(s);
  }
  async function install(s, token, expiresIn) {
    const account = await profile(s, token, fetchFn);
    // Validate the feed permission before replacing an existing connection.
    await metaRequest(graph(s, `${account.id}/media`, { fields: 'id', limit: '1' }), { token, fetchFn });
    s.account = account; s.tokenEncrypted = protect(token); s.connectionId = crypto.randomUUID();
    s.expiresAt = Number(expiresIn) > 0 ? new Date(Date.now() + Number(expiresIn) * 1000) : null;
    s.tokenUpdatedAt = new Date(); s.syncedAt = new Date(); s.retryAt = null; s.lastError = '';
    s.enabled = true; s.oauthHash = ''; s.oauthExpiresAt = null;
    s.revision += 1; await s.save(); return safeSettings(s);
  }
  async function connectToken(input) {
    const s = await Model.getSingleton(); assertRevision(s, input); key();
    const token = String(input.accessToken || '').trim();
    if (token.length < 20 || token.length > 4096 || /\s/.test(token)) throw new InstagramError('Pega un token válido generado por tu app de Meta.');
    return install(s, token, null);
  }
  function authorizationUrl(s, state) {
    const url = new URL('https://www.instagram.com/oauth/authorize');
    Object.entries({ client_id: s.appId, redirect_uri: s.redirectUri, response_type: 'code', scope: 'instagram_business_basic', state, enable_fb_login: '0', force_authentication: '1' }).forEach(([k,v]) => url.searchParams.set(k,v));
    return url.href;
  }
  async function authorize(input) {
    const s = await Model.getSingleton(); assertRevision(s, input); key();
    if (!s.appId || !s.appSecretEncrypted || !s.redirectUri) throw new InstagramError('Guarda el ID, el secreto de la app y la URL de retorno antes de conectar.');
    const state = crypto.randomBytes(32).toString('hex');
    s.oauthHash = digest(state); s.oauthExpiresAt = new Date(Date.now() + 10 * 60000);
    await s.save();
    const url = new URL('/api/instagram/start', s.redirectUri); url.searchParams.set('state', state);
    return { url: url.href };
  }
  async function start(state) {
    if (typeof state !== 'string' || !/^[a-f0-9]{64}$/.test(state)) throw new InstagramError('Autorización no válida.', 400);
    const s = await Model.getSingleton();
    if (s.oauthHash !== digest(state) || +new Date(s.oauthExpiresAt) <= Date.now()) throw new InstagramError('La autorización caducó. Vuelve a conectar.', 400);
    return authorizationUrl(s, state);
  }
  async function callback(query, cookieState) {
    const state = String(query.state || '');
    if (!state || state !== cookieState) throw new InstagramError('La autorización no pertenece a este navegador. Vuelve a conectar.', 400);
    const s = await Model.findOneAndUpdate({ key: 'main', oauthHash: digest(state), oauthExpiresAt: { $gt: new Date() } }, { $set: { oauthHash: '', oauthExpiresAt: null } }, { new: true }).select('+appSecretEncrypted +tokenEncrypted');
    if (!s) throw new InstagramError('La autorización caducó o ya fue utilizada. Vuelve a conectar.', 400);
    if (query.error || !query.code) throw new InstagramError('La autorización fue cancelada en Instagram.');
    const short = await metaRequest('https://api.instagram.com/oauth/access_token', { body: { client_id: s.appId, client_secret: reveal(s.appSecretEncrypted), grant_type: 'authorization_code', redirect_uri: s.redirectUri, code: String(query.code) }, fetchFn });
    const url = new URL('https://graph.instagram.com/access_token');
    Object.entries({ grant_type: 'ig_exchange_token', client_secret: reveal(s.appSecretEncrypted), access_token: short.access_token || short.data?.[0]?.access_token }).forEach(([k,v]) => url.searchParams.set(k,v));
    const long = await metaRequest(url, { fetchFn });
    if (!long.access_token || !long.expires_in) throw new InstagramError('No se recibió el acceso de larga duración. Vuelve a conectar.');
    return install(s, long.access_token, long.expires_in);
  }
  async function disconnect(input) {
    const s = await Model.getSingleton(); assertRevision(s, input);
    const connection = s.connectionId;
    s.tokenEncrypted = ''; s.account = null; s.enabled = false; s.connectionId = '';
    s.expiresAt = null; s.syncedAt = null; s.lastError = ''; s.retryAt = null; s.oauthHash = ''; s.oauthExpiresAt = null;
    s.revision += 1; await s.save();
    await PageModel.deleteMany({ connection }); return safeSettings(s);
  }
  async function refreshAccount(s) {
    let token = reveal(s.tokenEncrypted);
    if (s.expiresAt && new Date(s.expiresAt) <= new Date()) throw new InstagramError('El acceso a Instagram caducó. Vuelve a conectar la cuenta.');
    if (s.expiresAt && +new Date(s.expiresAt) - Date.now() < 7 * 24 * HOUR && Date.now() - +new Date(s.tokenUpdatedAt) >= 24 * HOUR) {
      const url = new URL('https://graph.instagram.com/refresh_access_token');
      url.searchParams.set('grant_type', 'ig_refresh_token'); url.searchParams.set('access_token', token);
      const renewed = await metaRequest(url, { fetchFn });
      if (!renewed.access_token || !renewed.expires_in) throw new InstagramError('No se pudo renovar el acceso. Vuelve a conectar la cuenta.');
      token = renewed.access_token; s.tokenEncrypted = protect(token);
      s.expiresAt = new Date(Date.now() + renewed.expires_in * 1000); s.tokenUpdatedAt = new Date();
    }
    s.account = await profile(s, token, fetchFn); s.syncedAt = new Date(); s.lastError = ''; s.retryAt = null;
    await s.save(); return token;
  }
  async function fetchPage(s, after, force) {
    const cursorHash = digest(after), connection = s.connectionId;
    const record = await PageModel.findOne({ connection, cursorHash }).lean();
    const cached = record && Date.now() - +new Date(record.fetchedAt) < 24 * HOUR ? record : null;
    if (!force && cached && Date.now() - +new Date(cached.fetchedAt) < HOUR) return cached;
    if (!force && s.retryAt && +new Date(s.retryAt) > Date.now()) {
      if (cached) return cached;
      throw new InstagramError(s.lastError || 'Instagram no está disponible temporalmente.', 503);
    }
    try {
      const token = force || !s.syncedAt || Date.now() - +new Date(s.syncedAt) > HOUR ? await refreshAccount(s) : reveal(s.tokenEncrypted);
      const data = await metaRequest(graph(s, `${s.account.id}/media`, {
        fields: 'id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count,children{id,media_type,media_url,thumbnail_url}',
        limit: '12', after,
      }), { token, fetchFn });
      if (!Array.isArray(data.data)) throw new InstagramError('Instagram no devolvió publicaciones válidas.');
      const page = { connection, cursorHash, posts: data.data.map(normalizeMedia).filter(Boolean),
        after: data.paging?.next ? String(data.paging?.cursors?.after || '') : '', fetchedAt: new Date(), expiresAt: new Date(Date.now() + 24 * HOUR) };
      // Use only our fixed Graph endpoint and the cursor, never the provider's next URL.
      if (page.after.length > 4096) page.after = '';
      await PageModel.updateOne({ connection, cursorHash }, { $set: page }, { upsert: true });
      return page;
    } catch (error) {
      s.lastError = error instanceof InstagramError ? error.message : 'No se pudo actualizar Instagram. Revisa la conexión en Ajustes.';
      s.retryAt = new Date(Date.now() + 5 * 60000);
      try { await s.save(); } catch { /* concurrent settings change wins */ }
      if (cached && !force) return cached;
      throw new InstagramError(s.lastError, error.status || 503);
    }
  }
  async function feed(cursor = '', force = false) {
    const s = await Model.getSingleton();
    if (!s.enabled || !s.account || !s.tokenEncrypted) return { ok: true, connected: false, posts: [], nextCursor: '' };
    let after; try { after = readCursor(cursor, s.connectionId); } catch (e) { throw new InstagramError(e.message, 400); }
    const pendingKey = `${s.connectionId}:${digest(after)}`;
    if (!busy.has(pendingKey)) busy.set(pendingKey, fetchPage(s, after, force).finally(() => busy.delete(pendingKey)));
    const page = await busy.get(pendingKey);
    // A disconnect during a provider request must never publish the old account.
    const current = await Model.getSingleton();
    if (!current.enabled || current.connectionId !== s.connectionId) return { ok: true, connected: false, posts: [], nextCursor: '' };
    return { ok: true, connected: true, account: current.account, posts: page.posts,
      nextCursor: signCursor(page.after, s.connectionId), fetchedAt: page.fetchedAt,
      stale: Date.now() - +new Date(page.fetchedAt) >= HOUR };
  }
  return { getSettings, save, connectToken, authorize, start, callback, disconnect, feed };
}
module.exports = { ...createInstagramService(), createInstagramService, InstagramError, normalizeMedia, safeAsset, validateRedirect, metaRequest, safeSettings };
