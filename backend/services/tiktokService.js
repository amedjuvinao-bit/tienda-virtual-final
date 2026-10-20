'use strict';
const crypto = require('crypto');
const Settings = require('../models/TiktokSettings');
const Pages = require('../models/TiktokFeedPage');
const SiteSettings = require('../models/SiteSettings');
const { visiblePosts, selectionFor } = require('../../shared/tiktokSelection.cjs');
const { key, protect, reveal, digest, signCursor, readCursor } = require('../lib/tiktok/credentials');
const HOUR = 3600000, SCOPES = 'user.info.basic,video.list';
const VIDEO_FIELDS = 'id,title,video_description,cover_image_url,share_url,duration,create_time';
class TiktokError extends Error {
  constructor(message, status = 422) { super(message); this.status = status; }
}
function safeAsset(value) {
  try { const u = new URL(value); return u.protocol === 'https:' && !u.username && !u.password && !u.searchParams.has('access_token') ? u.href : ''; } catch { return ''; }
}
function tiktokLink(value) {
  try { const u = new URL(safeAsset(value)); return /^(www\.)?tiktok\.com$/.test(u.hostname) ? u.href : ''; } catch { return ''; }
}
function normalizeVideo(video) {
  const id = String(video?.id || ''), image = safeAsset(video?.cover_image_url), link = tiktokLink(video?.share_url);
  if (!/^\d{10,30}$/.test(id) || !link) return null;
  return { id: `tt_${id}`, tiktokId: id, image, thumb: image, link, enabled: true,
    title: String(video.title || video.video_description || '').slice(0, 150),
    caption: String(video.video_description || '').slice(0, 5000),
    duration: Math.max(0, Number(video.duration) || 0),
    timestamp: Number(video.create_time) > 0 ? new Date(Number(video.create_time) * 1000).toISOString() : '' };
}
async function request(path, { token, form, body, fields, fetchFn = fetch } = {}) {
  const url = new URL(`https://open.tiktokapis.com/v2/${path}/`);
  if (fields) url.searchParams.set('fields', fields);
  let response, data;
  try {
    response = await fetchFn(url, { method: form || body ? 'POST' : 'GET', redirect: 'error', signal: AbortSignal.timeout(12000),
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(form || body ? { 'Content-Type': form ? 'application/x-www-form-urlencoded' : 'application/json' } : {}) },
      ...(form ? { body: new URLSearchParams(form).toString() } : body ? { body: JSON.stringify(body) } : {}) });
    data = await response.json();
  } catch { throw new TiktokError('TikTok no respondió. Vuelve a intentar más tarde.', 503); }
  const code = typeof data.error === 'string' ? data.error : data.error?.code;
  if (!response.ok || code && code !== 'ok') {
    const expired = ['access_token_invalid', 'invalid_grant', 'invalid_token'].includes(code);
    throw new TiktokError(expired ? 'El acceso a TikTok caducó o fue revocado. Vuelve a conectar la cuenta.' : 'TikTok rechazó la solicitud. Comprueba Login Kit, Display API y los permisos user.info.basic y video.list.');
  }
  return data;
}
function validateRedirect(value) {
  if (!value) return '';
  try {
    const u = new URL(value);
    if (u.protocol !== 'https:' || u.username || u.password || u.search || u.hash || u.pathname !== '/api/tiktok/callback') throw new Error();
    return u.href;
  } catch { throw new TiktokError('Usa la URL HTTPS permanente del backend seguida de /api/tiktok/callback y regístrala en Login Kit.'); }
}
function safeSettings(s) {
  let encryptionReady = false; try { key(); encryptionReady = true; } catch { /* setup */ }
  return { ok: true, settings: { revision: s.revision, clientKey: s.clientKey, redirectUri: s.redirectUri,
    hasClientSecret: Boolean(s.clientSecretEncrypted), encryptionReady,
    connected: Boolean(s.tokenEncrypted && s.account), enabled: s.enabled, account: s.account,
    expiresAt: s.expiresAt || null, refreshExpiresAt: s.refreshExpiresAt || null, syncedAt: s.syncedAt || null,
    lastError: s.lastError || '', scopes: s.scopes || '' } };
}
function assertRevision(s, input) {
  if (!Number.isInteger(input.revision) || input.revision !== s.revision) throw new TiktokError('Los ajustes cambiaron en otra sesión. Recarga antes de continuar.', 409);
}
async function readPublishedConfig() {
  const site = await SiteSettings.findOne().select('theme.sections').lean();
  const section = site?.theme?.sections?.find(s => s.id === 'tiktok' || s.type === 'tiktok');
  return { ...section?.config, sectionEnabled: section?.enabled !== false };
}
function createTiktokService({ Model = Settings, PageModel = Pages, fetchFn = fetch, readConfig = readPublishedConfig } = {}) {
  const busy = new Map(), renewals = new Map();
  const call = (path, options) => request(path, { ...options, fetchFn });
  const getSettings = async () => safeSettings(await Model.getSingleton());
  async function save(input) {
    const s = await Model.getSingleton(); assertRevision(s, input);
    const clientKey = String(input.clientKey || '').trim(), redirectUri = validateRedirect(String(input.redirectUri || '').trim());
    if (clientKey && !/^[\w-]{4,128}$/.test(clientKey)) throw new TiktokError('Client Key no válido. Copia el dato de tu app de TikTok.');
    const changed = s.clientKey !== clientKey || s.redirectUri !== redirectUri || Boolean(input.clientSecret?.trim());
    if (s.tokenEncrypted && s.clientKey !== clientKey) throw new TiktokError('Desconecta la cuenta antes de cambiar de app de TikTok.');
    if (input.clientSecret?.trim()) s.clientSecretEncrypted = protect(String(input.clientSecret).trim());
    s.clientKey = clientKey; s.redirectUri = redirectUri; s.enabled = input.enabled === true;
    if (changed) { s.oauthHash = ''; s.oauthExpiresAt = null; }
    s.revision += 1; await s.save(); return safeSettings(s);
  }
  async function profile(token, scopes = '') {
    const detail = scopes.split(',').includes('user.info.profile');
    const result = await call('user/info', { token, fields: `open_id,display_name,avatar_url${detail ? ',username,profile_deep_link' : ''}` });
    const u = result.data?.user;
    if (!u?.open_id || String(u.open_id).length > 200) throw new TiktokError('TikTok no devolvió una cuenta válida.');
    return { id: String(u.open_id), name: String(u.display_name || '').slice(0, 120), avatar: safeAsset(u.avatar_url),
      username: detail ? String(u.username || '').slice(0, 100) : '', url: detail ? tiktokLink(u.profile_deep_link) : '' };
  }
  async function install(s, tokens) {
    if (!tokens.access_token || !tokens.refresh_token || !Number(tokens.expires_in) || !SCOPES.split(',').every(scope => String(tokens.scope || '').split(',').includes(scope))) throw new TiktokError('Autoriza los permisos de perfil y videos públicos para conectar la cuenta.');
    const account = await profile(tokens.access_token, tokens.scope);
    if (tokens.open_id && account.id !== tokens.open_id) throw new TiktokError('La cuenta recibida no coincide con la autorización.');
    await call('video/list', { token: tokens.access_token, fields: 'id', body: { max_count: 1 } });
    const oldConnection = s.connectionId;
    s.account = account; s.tokenEncrypted = protect(tokens.access_token); s.refreshTokenEncrypted = protect(tokens.refresh_token);
    s.connectionId = crypto.randomUUID(); s.scopes = tokens.scope;
    s.expiresAt = new Date(Date.now() + Number(tokens.expires_in) * 1000);
    s.refreshExpiresAt = new Date(Date.now() + Number(tokens.refresh_expires_in || 31536000) * 1000);
    s.tokenUpdatedAt = new Date(); s.syncedAt = new Date(); s.lastError = ''; s.retryAt = null;
    s.enabled = true; s.oauthHash = ''; s.oauthExpiresAt = null; s.revision += 1;
    await s.save(); if (oldConnection) await PageModel.deleteMany({ connection: oldConnection });
    return safeSettings(s);
  }
  async function authorize(input) {
    const s = await Model.getSingleton(); assertRevision(s, input); key();
    if (!s.clientKey || !s.clientSecretEncrypted || !s.redirectUri) throw new TiktokError('Guarda Client Key, Client Secret y URL de retorno antes de conectar.');
    const state = crypto.randomBytes(32).toString('hex');
    s.oauthHash = digest(state); s.oauthExpiresAt = new Date(Date.now() + 10 * 60000); await s.save();
    const url = new URL('/api/tiktok/start', s.redirectUri); url.searchParams.set('state', state);
    return { url: url.href };
  }
  async function start(state) {
    if (typeof state !== 'string' || !/^[a-f0-9]{64}$/.test(state)) throw new TiktokError('Autorización no válida.', 400);
    const s = await Model.getSingleton();
    if (s.oauthHash !== digest(state) || +new Date(s.oauthExpiresAt) <= Date.now()) throw new TiktokError('La autorización caducó. Vuelve a conectar.', 400);
    const u = new URL('https://www.tiktok.com/v2/auth/authorize/');
    Object.entries({ client_key: s.clientKey, redirect_uri: s.redirectUri, response_type: 'code', scope: SCOPES, state }).forEach(([k,v]) => u.searchParams.set(k,v));
    return u.href;
  }
  async function callback(query, cookieState) {
    const state = typeof query.state === 'string' ? query.state : '';
    if (!/^[a-f0-9]{64}$/.test(state) || state !== cookieState) throw new TiktokError('La autorización no pertenece a este navegador. Vuelve a conectar.', 400);
    const s = await Model.findOneAndUpdate({ key: 'main', oauthHash: digest(state), oauthExpiresAt: { $gt: new Date() } }, { $set: { oauthHash: '', oauthExpiresAt: null } }, { new: true }).select('+clientSecretEncrypted +tokenEncrypted +refreshTokenEncrypted');
    if (!s) throw new TiktokError('La autorización caducó o ya fue utilizada. Vuelve a conectar.', 400);
    if (query.error || typeof query.code !== 'string' || !query.code || query.code.length > 4096) throw new TiktokError('La autorización fue cancelada o no se recibió un código válido.');
    const tokens = await call('oauth/token', { form: { client_key: s.clientKey, client_secret: reveal(s.clientSecretEncrypted), grant_type: 'authorization_code', redirect_uri: s.redirectUri, code: query.code } });
    return install(s, tokens);
  }
  async function disconnect(input) {
    const s = await Model.getSingleton(); assertRevision(s, input);
    const connection = s.connectionId, token = s.tokenEncrypted;
    s.tokenEncrypted = ''; s.refreshTokenEncrypted = ''; s.account = null; s.enabled = false; s.connectionId = '';
    s.expiresAt = null; s.refreshExpiresAt = null; s.syncedAt = null; s.lastError = ''; s.retryAt = null;
    s.oauthHash = ''; s.oauthExpiresAt = null; s.scopes = ''; s.revision += 1; await s.save();
    await PageModel.deleteMany({ connection });
    if (token && s.clientSecretEncrypted) {
      try { await call('oauth/revoke', { form: { client_key: s.clientKey, client_secret: reveal(s.clientSecretEncrypted), token: reveal(token) } }); } catch { /* local disconnect always completes */ }
    }
    return safeSettings(s);
  }
  async function access(s) {
    if (s.expiresAt && +new Date(s.expiresAt) - Date.now() > 5 * 60000) return reveal(s.tokenEncrypted);
    if (!renewals.has(s.connectionId)) renewals.set(s.connectionId, (async () => {
      const fresh = await Model.getSingleton();
      if (fresh.connectionId !== s.connectionId) throw new TiktokError('La conexión cambió. Vuelve a cargar los videos.', 409);
      if (+new Date(fresh.expiresAt) - Date.now() > 5 * 60000) return reveal(fresh.tokenEncrypted);
      if (!fresh.refreshTokenEncrypted || +new Date(fresh.refreshExpiresAt) <= Date.now()) throw new TiktokError('Vuelve a conectar TikTok para renovar el permiso de la cuenta.');
      const renewed = await call('oauth/token', { form: { client_key: fresh.clientKey, client_secret: reveal(fresh.clientSecretEncrypted), grant_type: 'refresh_token', refresh_token: reveal(fresh.refreshTokenEncrypted) } });
      if (!renewed.access_token || !renewed.refresh_token || !Number(renewed.expires_in) || renewed.open_id && renewed.open_id !== fresh.account.id) throw new TiktokError('No se pudo renovar el acceso a TikTok. Vuelve a conectar la cuenta.');
      fresh.tokenEncrypted = protect(renewed.access_token); fresh.refreshTokenEncrypted = protect(renewed.refresh_token);
      fresh.expiresAt = new Date(Date.now() + Number(renewed.expires_in) * 1000);
      fresh.refreshExpiresAt = new Date(Date.now() + Number(renewed.refresh_expires_in || 31536000) * 1000);
      fresh.tokenUpdatedAt = new Date(); await fresh.save();
      return renewed.access_token;
    })().finally(() => renewals.delete(s.connectionId)));
    return renewals.get(s.connectionId);
  }
  async function fetchPage(s, after, force) {
    const cursorHash = digest(after), connection = s.connectionId;
    const record = await PageModel.findOne({ connection, cursorHash }).lean();
    // TikTok cover URLs expire after six hours; never serve a day-old thumbnail.
    const cached = record && Date.now() - +new Date(record.fetchedAt) < 5 * HOUR ? record : null;
    if (!force && cached && Date.now() - +new Date(cached.fetchedAt) < HOUR) return cached;
    if (!force && s.retryAt && +new Date(s.retryAt) > Date.now()) {
      if (cached) return cached;
      throw new TiktokError(s.lastError || 'TikTok no está disponible temporalmente.', 503);
    }
    try {
      const token = await access(s);
      const data = await call('video/list', { token, fields: VIDEO_FIELDS, body: { max_count: 20, ...(after ? { cursor: Number(after) } : {}) } });
      if (!Array.isArray(data.data?.videos)) throw new TiktokError('TikTok no devolvió una lista válida de videos.');
      const next = data.data.has_more && Number.isSafeInteger(data.data.cursor) && data.data.cursor > 0 ? String(data.data.cursor) : '';
      const page = { connection, cursorHash, posts: data.data.videos.map(normalizeVideo).filter(Boolean), after: next !== after ? next : '', fetchedAt: new Date(), expiresAt: new Date(Date.now() + 5 * HOUR) };
      await PageModel.updateOne({ connection, cursorHash }, { $set: page }, { upsert: true });
      const current = await Model.getSingleton();
      if (current.connectionId === connection) {
        if (force || !current.syncedAt || Date.now() - +new Date(current.syncedAt) > HOUR) current.account = await profile(token, current.scopes);
        // Basic profile permission has no username. A public video share URL can
        // supply the author's profile link without requesting additional scopes.
        const username = page.posts.map(p => new URL(p.link).pathname.match(/^\/@([\w.]+)\/video\//)?.[1]).find(Boolean);
        if (username && !current.account.url) current.account = { ...current.account, username, url: `https://www.tiktok.com/@${username}` };
        current.syncedAt = new Date(); current.lastError = ''; current.retryAt = null;
        try { await current.save(); } catch { /* a concurrent settings update wins */ }
      }
      return page;
    } catch (error) {
      const current = await Model.getSingleton();
      const message = error instanceof TiktokError ? error.message : 'No se pudo actualizar TikTok. Revisa la conexión en Configuración.';
      if (current.connectionId === connection) { current.lastError = message; current.retryAt = new Date(Date.now() + 5 * 60000); try { await current.save(); } catch { /* concurrent update wins */ } }
      if (cached && !force) return cached;
      throw new TiktokError(message, error.status || 503);
    }
  }
  async function feedPage(cursor, force, adminPreview) {
    const s = await Model.getSingleton();
    const empty = { ok: true, connected: false, posts: [], nextCursor: '' };
    if ((!adminPreview && !s.enabled) || !s.account || !s.tokenEncrypted) return empty;
    let after; try { after = readCursor(cursor, s.connectionId); } catch { throw new TiktokError('Paginación inválida o caducada. Actualiza los videos.', 400); }
    if (after && !/^\d{1,16}$/.test(after)) throw new TiktokError('Paginación no válida.', 400);
    const pending = `${s.connectionId}:${digest(after)}:${force}`;
    if (!busy.has(pending)) busy.set(pending, fetchPage(s, after, force).finally(() => busy.delete(pending)));
    const page = await busy.get(pending), current = await Model.getSingleton();
    if ((!adminPreview && !current.enabled) || current.connectionId !== s.connectionId) return empty;
    const config = adminPreview ? null : await readConfig(), selection = selectionFor(config || {}, current.account.id);
    const noSelection = !adminPreview && (config?.sectionEnabled === false || selection.mode === 'selected' && !selection.included.size);
    return { ok: true, connected: true, account: current.account,
      posts: adminPreview ? page.posts : noSelection ? [] : visiblePosts(page.posts, config, current.account.id),
      nextCursor: noSelection ? '' : signCursor(page.after, s.connectionId), fetchedAt: page.fetchedAt,
      stale: Date.now() - +new Date(page.fetchedAt) >= HOUR };
  }
  async function feed(cursor = '', force = false, adminPreview = false) {
    const seen = new Set(), started = Date.now(); let result;
    for (let page = 0; page < 8; page += 1) {
      result = await feedPage(cursor, force, adminPreview);
      if (adminPreview || !result.connected || result.posts.length || !result.nextCursor || seen.has(result.nextCursor) || Date.now() - started > 8000) break;
      seen.add(result.nextCursor); cursor = result.nextCursor; force = false;
    }
    return result;
  }
  return { getSettings, save, authorize, start, callback, disconnect, feed };
}
module.exports = { ...createTiktokService(), createTiktokService, TiktokError, safeSettings, validateRedirect, normalizeVideo, request };
