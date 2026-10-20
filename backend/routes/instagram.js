'use strict';
const express = require('express');
const rateLimit = require('express-rate-limit');
const requireAdmin = require('../middleware/requireAdmin');
const requirePermission = require('../middleware/requirePermission');
const service = require('../services/instagramService');
const admin = express.Router(), publicRouter = express.Router();
const noStore = (_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); };
const handle = fn => async (req, res) => {
  try { return await fn(req, res); }
  catch (error) {
    const conflict = error?.name === 'VersionError';
    return res.status(conflict ? 409 : error instanceof service.InstagramError ? error.status : 500).json({ ok: false,
      message: conflict ? 'La configuración cambió. Recarga antes de continuar.' : error instanceof service.InstagramError ? error.message : 'No se pudo completar la conexión de Instagram. Comprueba el cifrado del servidor y vuelve a intentar.' });
  }
};
admin.use(noStore, requireAdmin, requirePermission('settings:instagram'));
admin.get('/', handle(async (_req, res) => res.json(await service.getSettings())));
admin.put('/', handle(async (req, res) => res.json(await service.save(req.body || {}))));
const actionLimit = rateLimit({ windowMs: 60000, limit: 10, standardHeaders: true, legacyHeaders: false, message: { ok: false, message: 'Espera un minuto antes de volver a intentar.' } });
admin.use(actionLimit);
admin.post('/connect-token', handle(async (req, res) => res.json(await service.connectToken(req.body || {}))));
admin.post('/authorize', handle(async (req, res) => {
  return res.json({ ok: true, ...await service.authorize(req.body || {}) });
}));
admin.post('/disconnect', handle(async (req, res) => res.json(await service.disconnect(req.body || {}))));
admin.post('/sync', handle(async (_req, res) => { await service.feed('', true); return res.json(await service.getSettings()); }));
publicRouter.use(noStore);
publicRouter.get('/feed', rateLimit({ windowMs: 60000, limit: 60, standardHeaders: true, legacyHeaders: false,
  message: { ok: false, message: 'Espera un momento antes de cargar más publicaciones.' } }), handle(async (req, res) => res.json(await service.feed(req.query.cursor || ''))));
publicRouter.get('/start', handle(async (req, res) => {
  const state = req.query.state;
  const url = await service.start(state);
  res.set('Referrer-Policy', 'no-referrer');
  res.cookie('ig_oauth_state', state, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/api/instagram/callback', maxAge: 10 * 60000 });
  return res.redirect(url);
}));
publicRouter.get('/callback', async (req, res) => {
  const cookie = String(req.headers.cookie || '').split(';').map(v => v.trim()).find(v => v.startsWith('ig_oauth_state='))?.slice('ig_oauth_state='.length) || '';
  res.clearCookie('ig_oauth_state', { path: '/api/instagram/callback', httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' });
  let message, status = 200;
  try { await service.callback(req.query, cookie); message = 'Cuenta conectada. Cierra esta ventana y vuelve a Ajustes → Instagram para ver el estado.'; }
  catch (error) { status = 400; message = error instanceof service.InstagramError ? error.message : 'No se pudo conectar Instagram. Revisa la configuración del servidor y vuelve a intentar.'; }
  // Fixed text only: never interpolate provider query parameters or errors into HTML.
  const safe = message.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  res.status(status).type('html').send(`<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Conexión de Instagram</title><body><h1>Instagram</h1><p>${safe}</p></body></html>`);
});
module.exports = { admin, publicRouter };
