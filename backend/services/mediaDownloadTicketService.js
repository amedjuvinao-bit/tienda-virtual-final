'use strict';

const crypto = require('node:crypto');

const TICKET_LIFETIME_MS = 90_000;
const MAX_TICKETS = 50;
const tickets = new Map();

function cookieSettings() {
  const configured = String(process.env.ADMIN_COOKIE_SAME_SITE || '').toLowerCase();
  const sameSite = ['strict', 'lax', 'none'].includes(configured)
    ? configured : process.env.NODE_ENV === 'production' ? 'none' : 'lax';
  const secure = process.env.NODE_ENV === 'production' || sameSite === 'none' ||
    String(process.env.ADMIN_COOKIE_SECURE || '').toLowerCase() === 'true';
  return { name: secure ? '__Host-rb_media_download' : 'rb_media_download',
    options: { httpOnly: true, secure, sameSite, path: '/' } };
}

function prune(now = Date.now()) {
  for (const [hash, ticket] of tickets) {
    if (ticket.expiresAt <= now) tickets.delete(hash);
  }
}

function issue(res, { id, userId, sessionId }) {
  if (!id || !userId || !sessionId) throw new Error('Se requiere una sesión vigente del propietario.');
  prune();
  if (tickets.size >= MAX_TICKETS) throw new Error('Demasiadas descargas pendientes. Inténtalo de nuevo en un momento.');
  const secret = crypto.randomBytes(32).toString('base64url');
  tickets.set(crypto.createHash('sha256').update(secret).digest('hex'), {
    id, userId: String(userId), sessionId: String(sessionId), expiresAt: Date.now() + TICKET_LIFETIME_MS,
  });
  const { name, options } = cookieSettings();
  res.cookie(name, secret, { ...options, maxAge: TICKET_LIFETIME_MS });
}

function consume(req, res, { id, userId, sessionId }) {
  const { name, options } = cookieSettings();
  const cookies = String(req.headers?.cookie || '').split(';');
  const part = cookies.find((entry) => entry.trim().startsWith(`${name}=`));
  const secret = part ? part.trim().slice(name.length + 1) : '';
  res.clearCookie(name, options);
  if (!/^[A-Za-z0-9_-]{40,60}$/.test(secret)) return false;
  const hash = crypto.createHash('sha256').update(secret).digest('hex');
  const ticket = tickets.get(hash);
  tickets.delete(hash); // Single use, even when the request does not match.
  return Boolean(ticket && ticket.expiresAt > Date.now() && ticket.id === id &&
    ticket.userId === String(userId) && ticket.sessionId === String(sessionId));
}

module.exports = { issue, consume };
