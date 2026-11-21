'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { Readable } = require('node:stream');
const { EventEmitter } = require('node:events');
const { createMediaRelay, createMediaTransport, mediaProvider, publicAddress } = require('../lib/socialMediaRelay');
const { createPublishedMediaAccess } = require('../services/publishedSocialMedia');
const ig = 'https://scontent.cdninstagram.com/photo.jpg?signature=public';
const tt = 'https://p16-sign-sg.tiktokcdn.com/photo.jpg?x-signature=public';
function asset(body = 'image', type = 'image/jpeg', statusCode = 200, extra = {}) {
  const stream = Readable.from([Buffer.from(body)]);
  stream.statusCode = statusCode; stream.headers = { 'content-type': type, ...extra };
  return stream;
}
async function withServer(relay, run) {
  const app = express(); app.get('/media', relay);
  const server = await new Promise(resolve => { const listener = app.listen(0, '127.0.0.1', () => resolve(listener)); });
  try { await run((source = ig, options = {}) => fetch(`http://127.0.0.1:${server.address().port}/media?url=${encodeURIComponent(source)}${options.kind ? `&kind=${options.kind}` : ''}`, { headers: options.headers || {} })); }
  finally { await new Promise(resolve => server.close(resolve)); }
}
test('only fixed social media CDNs are eligible; pages, players and lookalikes are not', () => {
  assert.equal(mediaProvider(ig), 'instagram'); assert.equal(mediaProvider(tt), 'tiktok');
  for (const source of ['https://www.instagram.com/p/1', 'https://www.tiktok.com/player/v1/1', 'https://cdninstagram.com.evil.test/a', 'https://cdninstagram.com@evil.test/a', 'https://scontent.cdninstagram.com:444/a', 'http://scontent.cdninstagram.com/a', `${ig}#fragment`, `${ig}&access_token=secret`, ['https://scontent.cdninstagram.com/a']]) assert.equal(mediaProvider(source), '');
});
test('rejects loopback, private, reserved, mapped and local network addresses', () => {
  for (const address of ['127.0.0.1', '10.1.2.3', '169.254.169.254', '172.16.1.2', '192.168.1.1', '100.64.1.1', '0.0.0.0', '198.18.1.1', '224.0.0.1', '::1', '::ffff:127.0.0.1', 'fc00::1', 'fe80::1', '2001:db8::1', '2002:7f00:1::']) assert.equal(publicAddress(address), false, address);
  for (const address of ['1.1.1.1', '8.8.8.8', '2606:4700:4700::1111']) assert.equal(publicAddress(address), true, address);
});
test('streams image bytes and strips upstream cookies and tracking headers', async () => {
  await withServer(createMediaRelay({ authorize: async () => true, transport: async () => asset('original-photo', 'image/jpeg', 200, { 'set-cookie': 'tracker=yes', etag: 'identifier', location: 'https://evil.test' }) }), async get => {
    const response = await get(ig, { headers: { Cookie: 'admin=private', Authorization: 'Bearer private', 'X-Forwarded-For': '1.2.3.4' } });
    assert.equal(response.status, 200); assert.equal(await response.text(), 'original-photo');
    for (const header of ['set-cookie', 'etag', 'location']) assert.equal(response.headers.get(header), null);
    assert.equal(response.headers.get('cache-control'), 'no-store'); assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  });
});
test('unpublished URLs never trigger an upstream connection', async () => {
  let calls = 0;
  await withServer(createMediaRelay({ authorize: async () => false, transport: async () => { calls += 1; return asset(); } }), async get => {
    assert.equal((await get()).status, 404); assert.equal((await get('https://evil.test/asset')).status, 400); assert.equal(calls, 0);
  });
});
test('does not relay HTML, SVG, redirects, provider failures or oversized files', async () => {
  for (const [type, status, extra, expected] of [['text/html', 200, {}, 502], ['image/svg+xml', 200, {}, 502], ['image/jpeg', 403, {}, 502], ['image/jpeg', 200, { 'content-length': String(13 * 1024 * 1024) }, 413]]) {
    await withServer(createMediaRelay({ authorize: async () => true, transport: async () => asset('body', type, status, extra) }), async get => assert.equal((await get()).status, expected));
  }
});
test('preserves video range delivery and rejects malformed or multiple ranges', async () => {
  let received;
  await withServer(createMediaRelay({ authorize: async () => true, transport: async (_source, options) => { received = options; return asset('1234', 'video/mp4', 206, { 'content-range': 'bytes 0-3/100', 'content-length': '4' }); } }), async get => {
    const response = await get(ig, { kind: 'video', headers: { Range: 'bytes=0-3' } });
    assert.equal(response.status, 206); assert.equal(await response.text(), '1234'); assert.equal(received.range, 'bytes=0-3'); assert.equal(response.headers.get('content-range'), 'bytes 0-3/100');
    assert.equal((await get(ig, { kind: 'video', headers: { Range: 'bytes=0-3,8-9' } })).status, 416);
    assert.equal((await get(ig, { headers: { Range: 'bytes=0-' } })).status, 416);
  });
});
test('transport pins public DNS and sends only media headers, without visitor identifiers', async () => {
  let options;
  const transport = createMediaTransport({ lookup: async () => [{ address: '1.1.1.1', family: 4 }], request: (_url, input, callback) => {
    options = input; const request = new EventEmitter(); request.end = () => callback(asset()); return request;
  } });
  const response = await transport(ig, { kind: 'image', signal: new AbortController().signal }); response.destroy();
  assert.deepEqual(Object.keys(options.headers), ['Accept']); assert.equal(options.agent, false);
  options.lookup('anything', {}, (_error, address, family) => { assert.equal(address, '1.1.1.1'); assert.equal(family, 4); });
  const blocked = createMediaTransport({ lookup: async () => [{ address: '127.0.0.1', family: 4 }], request: () => { throw new Error('must not connect'); } });
  await assert.rejects(blocked(ig, { kind: 'image', signal: new AbortController().signal }), error => error.status === 400);
});
test('preserves a provider range error without forwarding its body or cookies', async () => {
  await withServer(createMediaRelay({ authorize: async () => true, transport: async () => asset('provider details', 'text/html', 416, { 'content-range': 'bytes */100', 'set-cookie': 'tracker=yes' }) }), async get => {
    const response = await get(ig, { kind: 'video', headers: { Range: 'bytes=200-' } });
    assert.equal(response.status, 416); assert.equal(response.headers.get('content-range'), 'bytes */100');
    assert.equal(response.headers.get('set-cookie'), null); assert.equal(await response.text(), '');
  });
});
test('redirects revalidate the destination and never follow a platform page or private address', async () => {
  let calls = 0;
  const transport = createMediaTransport({ lookup: async () => [{ address: '1.1.1.1', family: 4 }], request: (_url, _options, callback) => {
    calls += 1; const request = new EventEmitter(); request.end = () => callback(asset('', 'text/html', 302, { location: 'https://www.instagram.com/login/' })); return request;
  } });
  await assert.rejects(transport(ig, { kind: 'image', signal: new AbortController().signal }), error => error.status === 502); assert.equal(calls, 1);
});
const query = value => ({ select() { return this; }, limit() { return this; }, async lean() { return value; } });
test('authorizes only enabled published media, current account, visible posts and nonexpired pages', async () => {
  let sourceQuery;
  const config = { journalSource: 'connected', journalConnectedSelection: { accountId: 'account', mode: 'all', excluded: ['ig_hidden'] }, posts: [{ image: 'unused-manual' }] };
  const theme = { sections: [{ id: 'instagram', enabled: true, config }, { id: 'tiktok', enabled: false, config: { image: tt } }] };
  const sources = { instagram: { Settings: { findOne: () => query({ enabled: true, account: { id: 'account', avatar: 'avatar' }, connectionId: 'current' }) }, Pages: { find: filter => { sourceQuery = filter; return query([{ posts: [{ id: 'ig_visible', image: ig }, { id: 'ig_hidden', image: 'hidden' }] }]); } }, selection: require('../../shared/instagramSelection.cjs') } };
  const authorize = createPublishedMediaAccess({ SiteModel: { findOne: () => query({ theme }) }, sources });
  assert.equal(await authorize(ig, 'instagram'), true); assert.equal(sourceQuery.connection, 'current'); assert(sourceQuery.expiresAt.$gt instanceof Date);
  assert.equal(await authorize('hidden', 'instagram'), false); assert.equal(await authorize('unused-manual', 'instagram'), false); assert.equal(await authorize(tt, 'tiktok'), false);
  config.journalSource = 'manual'; config.posts = [{ image: ig }, { image: 'disabled-post', enabled: false }];
  assert.equal(await authorize(ig, 'instagram'), true); assert.equal(await authorize('disabled-post', 'instagram'), false);
});
