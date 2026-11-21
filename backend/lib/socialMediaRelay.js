'use strict';
const https = require('node:https');
const dns = require('node:dns').promises;
const net = require('node:net');
const { Transform } = require('node:stream');
const { pipeline } = require('node:stream/promises');
const hosts = require('../../shared/socialMediaDelivery.json');
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']);
const VIDEO_TYPES = new Set(['video/mp4', 'video/webm', 'video/quicktime']);
const failure = status => Object.assign(new Error('No se pudo cargar este archivo de la tienda.'), { status });

function mediaProvider(value) {
  if (typeof value !== 'string' || value.length > 8192 || /[\s\u0000-\u001f]/.test(value)) return '';
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.port || url.username || url.password || url.hash || url.searchParams.has('access_token')) return '';
    return Object.keys(hosts).find(provider => hosts[provider].some(host => url.hostname === host || url.hostname.endsWith(`.${host}`))) || '';
  } catch { return ''; }
}
function publicAddress(address) {
  if (net.isIP(address) === 4) {
    const [a, b, c] = address.split('.').map(Number);
    return !(a === 0 || a === 10 || a === 127 || a >= 224 || a === 169 && b === 254 || a === 172 && b >= 16 && b <= 31
      || a === 192 && (b === 168 || b === 0 || b === 2) || a === 100 && b >= 64 && b <= 127
      || a === 198 && (b === 18 || b === 19 || b === 51 && c === 100) || a === 203 && b === 0 && c === 113);
  }
  // Global unicast only; excludes loopback, mapped IPv4, link-local and ULA.
  return net.isIP(address) === 6 && /^[23]/i.test(address) && !/^2001:(?:0*:|0*db8:)/i.test(address) && !/^2002:/i.test(address);
}

function createMediaTransport({ lookup = dns.lookup, request = https.request } = {}) {
  return async function open(source, { kind, range, signal }, redirects = 0) {
    const provider = mediaProvider(source);
    if (!provider) throw failure(400);
    const url = new URL(source);
    const addresses = await lookup(url.hostname, { all: true, verbatim: true });
    if (!addresses.length || addresses.some(item => !publicAddress(item.address))) throw failure(400);
    signal.throwIfAborted();
    const address = addresses[0];
    const upstream = await new Promise((resolve, reject) => {
      const outgoing = request(url, {
        method: 'GET', agent: false, signal, timeout: 15000,
        // Pin the validated DNS result for this TLS connection.
        lookup: (_host, options, callback) => options?.all ? callback(null, [address]) : callback(null, address.address, address.family),
        // Deliberately no visitor cookies, IP headers, referer, or credentials.
        headers: { Accept: kind === 'video' ? 'video/mp4,video/webm,video/quicktime' : 'image/avif,image/webp,image/png,image/jpeg,image/gif', ...(range ? { Range: range } : {}) },
      }, resolve);
      outgoing.once('error', reject);
      outgoing.once('timeout', () => outgoing.destroy(failure(504)));
      outgoing.end();
    });
    if ([301, 302, 303, 307, 308].includes(upstream.statusCode)) {
      upstream.destroy();
      const next = new URL(upstream.headers.location || '', url).href;
      if (redirects >= 2 || mediaProvider(next) !== provider) throw failure(502);
      return open(next, { kind, range, signal }, redirects + 1);
    }
    return upstream;
  };
}

function createMediaRelay({ authorize, transport = createMediaTransport() } = {}) {
  let active = 0;
  return async (req, res) => {
    const source = req.query.url, kind = req.query.kind || 'image', provider = mediaProvider(source);
    res.set({ 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'; sandbox" });
    if (!provider || !['image', 'video'].includes(kind)) return res.status(400).end();
    const range = req.headers.range;
    if (range && (kind !== 'video' || !/^bytes=(?:\d{1,12}-\d{0,12}|-\d{1,12})$/.test(range))) return res.status(416).end();
    if (active >= 64) return res.status(503).set('Retry-After', '2').end();
    active += 1;
    const controller = new AbortController();
    const stop = () => controller.abort();
    const timer = setTimeout(stop, kind === 'video' ? 120000 : 30000);
    res.once('close', stop);
    let upstream;
    try {
      if (!await authorize(source, provider)) return res.status(404).end();
      controller.signal.throwIfAborted();
      upstream = await transport(source, { kind, range, signal: controller.signal });
      if (upstream.statusCode === 416 && kind === 'video' && range) {
        const contentRange = upstream.headers['content-range'];
        upstream.destroy();
        if (/^bytes \*\/\d+$/.test(contentRange || '')) res.set('Content-Range', contentRange);
        return res.status(416).end();
      }
      const type = String(upstream.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
      if (![200, 206].includes(upstream.statusCode) || !(kind === 'video' ? VIDEO_TYPES : IMAGE_TYPES).has(type)) throw failure(502);
      const max = kind === 'video' ? 128 * 1024 * 1024 : 12 * 1024 * 1024;
      const length = Number(upstream.headers['content-length']);
      if (Number.isFinite(length) && length > max) throw failure(413);
      if (upstream.statusCode === 206 && (!range || !/^bytes \d+-\d+\/\d+$/.test(upstream.headers['content-range'] || ''))) throw failure(502);
      // Only explicitly safe media headers are copied. Never Set-Cookie or Location.
      res.status(upstream.statusCode).type(type);
      if (Number.isSafeInteger(length) && length >= 0) res.set('Content-Length', String(length));
      if (kind === 'video') res.set('Accept-Ranges', 'bytes');
      if (upstream.statusCode === 206) res.set('Content-Range', upstream.headers['content-range']);
      let bytes = 0;
      const bound = new Transform({ transform(chunk, _encoding, callback) {
        bytes += chunk.length;
        callback(bytes > max ? failure(413) : null, chunk);
      } });
      await pipeline(upstream, bound, res, { signal: controller.signal });
    } catch (error) {
      upstream?.destroy();
      if (!res.headersSent && !res.destroyed) {
        res.removeHeader('Content-Length'); res.removeHeader('Content-Range');
        res.status(error.status || 502).end();
      } else if (!res.destroyed) res.destroy();
    } finally {
      clearTimeout(timer); res.removeListener('close', stop); active -= 1;
    }
  };
}
module.exports = { mediaProvider, publicAddress, createMediaTransport, createMediaRelay };
