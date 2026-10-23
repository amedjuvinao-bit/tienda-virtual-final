'use strict';
const express = require('express');
const rateLimit = require('express-rate-limit');
const requireAdmin = require('../middleware/requireAdmin');
const requirePermission = require('../middleware/requirePermission');
const service = require('../services/tiktokService');
const admin = express.Router(), publicRouter = express.Router();
const noStore = (_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); };
const handle = fn => async (req, res) => {
  try { return await fn(req, res); }
  catch (error) {
    const conflict = error?.name === 'VersionError';
    return res.status(conflict ? 409 : error instanceof service.TiktokError ? error.status : 500).json({ ok: false,
      message: conflict ? 'La configuración cambió. Recarga antes de continuar.' : error instanceof service.TiktokError ? error.message : 'No se pudo completar la conexión de TikTok. Comprueba el cifrado del servidor y vuelve a intentar.' });
  }
};
// Media belongs to the existing administrative connection mount, with Appearance access.
// Register before settings-only middleware so editors never need credential permissions.
const mediaRead = handle(async (req, res) => res.json(await service.feed(req.query.cursor || '', false, true)));
const mediaRefresh = handle(async (_req, res) => res.json(await service.feed('', true, true)));
const mediaLimit = rateLimit({ windowMs: 60000, limit: 60, standardHeaders: true, legacyHeaders: false });
admin.get('/feed', noStore, requireAdmin, requirePermission('appearance:view'), mediaLimit, mediaRead);
admin.post('/refresh-feed', noStore, requireAdmin, requirePermission('appearance:view'), mediaLimit, mediaRefresh);
admin.use(noStore, requireAdmin, requirePermission('settings:tiktok'));
admin.get('/', handle(async (_req, res) => res.json(await service.getSettings())));
admin.put('/', handle(async (req, res) => res.json(await service.save(req.body || {}))));
const qrOwner = req => String(req.adminSessionId || req.adminUserId || req.adminUsername || '');
const qrCheckLimit = rateLimit({ windowMs: 60000, limit: 30, standardHeaders: true, legacyHeaders: false,
  message: { ok: false, message: 'Espera unos segundos antes de comprobar el QR.' } });
// Polling has its own budget; never exhaust the ten settings actions per minute.
admin.post('/qr/check', qrCheckLimit, handle(async (req, res) => res.json(await service.checkQr(req.body || {}, qrOwner(req)))));
const actionLimit = rateLimit({ windowMs: 60000, limit: 10, standardHeaders: true, legacyHeaders: false, message: { ok: false, message: 'Espera un minuto antes de volver a intentar.' } });
admin.use(actionLimit);
admin.post('/qr', handle(async (req, res) => res.json(await service.createQr(req.body || {}, qrOwner(req)))));
admin.post('/qr/cancel', handle(async (req, res) => res.json(await service.cancelQr(req.body || {}, qrOwner(req)))));
admin.post('/authorize', handle(async (req, res) => {
  return res.json({ ok: true, ...await service.authorize(req.body || {}) });
}));
admin.post('/disconnect', handle(async (req, res) => res.json(await service.disconnect(req.body || {}))));
admin.post('/sync', handle(async (_req, res) => { await service.feed('', true, true); return res.json(await service.getSettings()); }));
publicRouter.use(noStore);
// Appearance editors may read media (including hidden posts), never connection credentials.
publicRouter.get('/admin/feed', requireAdmin, requirePermission('appearance:view'),
  mediaLimit, mediaRead);
publicRouter.post('/admin/refresh', requireAdmin, requirePermission('appearance:view'), actionLimit, mediaRefresh);
publicRouter.get('/feed', rateLimit({ windowMs: 60000, limit: 60, standardHeaders: true, legacyHeaders: false,
  message: { ok: false, message: 'Espera un momento antes de cargar más publicaciones.' } }), handle(async (req, res) => res.json(await service.feed(req.query.cursor || ''))));
publicRouter.get('/start', handle(async (req, res) => {
  const state = req.query.state;
  const url = await service.start(state);
  res.set('Referrer-Policy', 'no-referrer');
  res.cookie('tt_oauth_state', state, { httpOnly: true, secure: true, sameSite: 'lax', path: '/api/tiktok/callback', maxAge: 10 * 60000 });
  return res.redirect(url);
}));
publicRouter.get('/callback', async (req, res) => {
  const cookie = String(req.headers.cookie || '').split(';').map(v => v.trim()).find(v => v.startsWith('tt_oauth_state='))?.slice('tt_oauth_state='.length) || '';
  res.clearCookie('tt_oauth_state', { path: '/api/tiktok/callback', httpOnly: true, secure: true, sameSite: 'lax' });
  let message, status = 200;
  try { await service.callback(req.query, cookie); message = 'Cuenta conectada. Cierra esta ventana y vuelve a Ajustes → TikTok para ver el estado.'; }
  catch (error) { status = 400; message = error instanceof service.TiktokError ? error.message : 'No se pudo conectar TikTok. Revisa la configuración del servidor y vuelve a intentar.'; }
  // Fixed text only: never interpolate provider query parameters or errors into HTML.
  const safe = message.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  res.status(status).type('html').send(`<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Conexión de TikTok</title><body><h1>TikTok</h1><p>${safe}</p></body></html>`);
});
module.exports = { admin, publicRouter };
