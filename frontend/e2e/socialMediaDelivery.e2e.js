import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import { Readable } from 'node:stream';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { chromium } from 'playwright';

const root = fileURLToPath(new URL('../', import.meta.url));
const entry = new URL('../social-delivery-audit.jsx', import.meta.url);
const artifacts = process.env.PRIVACY_ARTIFACTS || '/tmp/social-media-delivery-e2e';
const origin = 'http://127.0.0.1:5296';
process.env.VITE_API_BASE_URL = origin;
const require = createRequire(new URL('../../backend/package.json', import.meta.url));
const express = require('express');
const { createMediaRelay } = require('./lib/socialMediaRelay');
const photo = await fs.readFile(new URL('../public/categorias/collection-atlas.webp', import.meta.url));
const source = 'https://scontent.cdninstagram.com/selected.webp?signature=approved';
const cover = 'https://p16-sign-sg.tiktokcdn.com/selected.webp?x-signature=approved';
const deliveries = [];
const app = express();
app.get('/api/storefront-media', createMediaRelay({
  authorize: async value => [source, cover].includes(value),
  transport: async (value, options) => {
    deliveries.push({ source: value, kind: options.kind });
    const response = Readable.from([photo]);
    response.statusCode = 200;
    response.headers = { 'content-type': 'image/webp', 'content-length': String(photo.length), 'set-cookie': 'optional-tracker=must-not-leak' };
    return response;
  },
}));
await assert.rejects(fs.access(entry));
await fs.mkdir(artifacts, { recursive: true });
await fs.writeFile(entry, `
import React from 'react';import{createRoot}from'react-dom/client';
import SocialContentPrivacy from '/src/components/privacy/SocialContentPrivacy.jsx';
import InstagramSection from '/src/components/InstagramSection.jsx';
import TiktokSection from '/src/components/TiktokSection.jsx';
import {savePrivacyPreference}from'/src/lib/privacyPreferences.js';
import '/src/index.css';
const baseline=new URLSearchParams(location.search).has('baseline');
const image=baseline?'/audit-photo.webp':${JSON.stringify(source)};
const cover=baseline?'/audit-photo.webp':${JSON.stringify(cover)};
const ig=layout=>({sections:[{id:'instagram',enabled:true,config:{instagramLayout:layout,journalTitle:'Nuestra colección',journalSource:'manual',journalMotionEnabled:false,journalHighlights:[],posts:[{id:'chosen',image,alt:'Publicación elegida'},{id:'second',image,alt:'Otra publicación'}]}}]});
const tk=layout=>({sections:[{id:'tiktok',enabled:true,config:{titleImage:'',tiktokLogo:'',hoverLogoStyle:'glyph',stageLayout:layout,stageSource:'manual',stageMotionEnabled:false,posts:[{id:'chosen',title:'Video elegido',image:cover,tiktokId:'1234567890123456789',link:'https://www.tiktok.com/@store/video/1234567890123456789'}]}}]});
const sections=[['journal',<InstagramSection theme={ig('journal')}/>],['editorial',<InstagramSection theme={ig('editorial')}/>],['stage',<TiktokSection theme={tk('stage')}/>],['legacy',<TiktokSection theme={tk('legacy')}/>]];
function Fixture(){return <><nav><button onClick={()=>savePrivacyPreference({social:false,maps:true})}>Retirar redes</button></nav><main>{sections.map(([id,content])=><div data-design={id} key={id}>{baseline?content:<SocialContentPrivacy>{content}</SocialContentPrivacy>}</div>)}</main></>}
createRoot(document.getElementById('root')).render(<Fixture/>);
`);
const server = await createServer({ root, server: { host: '127.0.0.1', port: 5296, strictPort: true, hmr: false }, plugins: [{
  name: 'social-delivery-audit', configureServer(vite) {
    vite.middlewares.use((req, res, next) => {
      if (req.url?.startsWith('/api/storefront-media')) return app(req, res, next);
      if (req.url === '/audit-photo.webp') { res.setHeader('Content-Type', 'image/webp'); return res.end(photo); }
      return next();
    });
    vite.middlewares.use(async (req, res, next) => {
      if (req.url?.includes('.') || req.url?.startsWith('/@') || req.url?.startsWith('/src/')) return next();
      res.setHeader('Content-Type', 'text/html');
      res.end(await vite.transformIndexHtml(req.url, '<!doctype html><html lang="es"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/fonts/storefront-fonts.css"><style>body{margin:0;background:#f5e6e2}nav{padding:12px}main{max-width:1100px;margin:auto}*{animation:none!important;transition:none!important}</style><div id="root"></div><script type="module" src="/social-delivery-audit.jsx"></script></html>'));
    });
  },
}] });
let browser;
const results = [];
async function comparePixels(page, actual, expected) {
  return page.evaluate(async ([left, right]) => {
    const decode = async value => {
      const bitmap = await createImageBitmap(new Blob([Uint8Array.from(atob(value), character => character.charCodeAt(0))], { type: 'image/png' }));
      const canvas = new OffscreenCanvas(bitmap.width, bitmap.height), context = canvas.getContext('2d');
      context.drawImage(bitmap, 0, 0); bitmap.close();
      return { width: canvas.width, height: canvas.height, data: context.getImageData(0, 0, canvas.width, canvas.height).data };
    };
    const [a, b] = await Promise.all([decode(left), decode(right)]);
    if (a.width !== b.width || a.height !== b.height) return { sameSize: false };
    let maximum = 0;
    for (let index = 0; index < a.data.length; index += 1) maximum = Math.max(maximum, Math.abs(a.data[index] - b.data[index]));
    return { sameSize: true, maximum };
  }, [actual.toString('base64'), expected.toString('base64')]);
}
try {
  await server.listen();
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH || undefined, headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  for (const width of [1440, 768, 390, 320]) {
    const context = await browser.newContext({ viewport: { width, height: 1600 } });
    const page = await context.newPage();
    page.setDefaultTimeout(10000);
    const external = [], errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await context.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.origin === origin) return route.continue();
      external.push(url.href);
      assert.equal(url.hostname, 'www.tiktok.com', 'Only the explicitly permitted player may connect directly');
      return route.fulfill({ contentType: 'text/html', body: '<html><body>Reproductor controlado</body></html>' });
    });
    await page.goto(origin, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    await page.locator('main').scrollIntoViewIfNeeded();
    await page.locator('img').evaluateAll(async images => { await Promise.all(images.map(async image => {
      try { await image.decode(); } catch { throw new Error(`No se pudo verificar la imagen: ${image.currentSrc || image.src}`); }
    })); });
    assert.equal(external.length, 0);
    assert.equal(await page.locator('[data-privacy-placeholder]').count(), 0);
    assert.equal(await page.locator('.privacy-social-note,.privacy-video-surface').count(), 0);
    assert.equal(await page.locator('iframe').count(), 0);
    assert((await context.cookies()).every(cookie => cookie.name !== 'optional-tracker'));
    const actual = {};
    for (const layout of ['journal', 'editorial', 'stage', 'legacy']) {
      const section = page.locator(`[data-design="${layout}"]`);
      await page.mouse.move(-20, -20);
      actual[layout] = await section.screenshot({ path: `${artifacts}/${layout}-${width}.png`, animations: 'disabled' });
    }
    await page.getByRole('button', { name: 'Retirar redes' }).click();
    assert.equal(await page.locator('[data-privacy-placeholder],iframe').count(), 0);
    const stage = page.locator('[data-design="stage"]');
    await stage.getByRole('button', { name: 'Reproducir: Video elegido', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await dialog.waitFor();
    assert.equal(external.length, 0, 'Requesting playback alone does not authorize tracking');
    await dialog.getByRole('button', { name: 'Ahora no' }).click();
    assert.equal(await page.locator('iframe').count(), 0);
    assert(await stage.getByRole('button', { name: 'Pantalla completa' }).isVisible());
    await stage.getByRole('button', { name: 'Reproducir: Video elegido', exact: true }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Permitir redes' }).click();
    await stage.locator('iframe').waitFor();
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('rb_privacy_preferences_v1')).choices.maps), true);
    await page.getByRole('button', { name: 'Retirar redes' }).click();
    assert.equal(await page.locator('iframe').count(), 0);
    assert.equal(await stage.locator('.tk-player__dock').count(), 1);
    await page.goto(`${origin}?baseline=1`, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    await page.locator('img').evaluateAll(async images => { await Promise.all(images.map(image => image.decode())); });
    for (const layout of ['journal', 'editorial', 'stage', 'legacy']) {
      await page.mouse.move(-20, -20);
      const baseline = await page.locator(`[data-design="${layout}"]`).screenshot({ path: `${artifacts}/baseline-${layout}-${width}.png`, animations: 'disabled' });
      const pixels = await comparePixels(page, actual[layout], baseline);
      // GPU rounding can vary by one RGB level along blurred glass edges.
      assert(pixels.sameSize && pixels.maximum <= 2, `The ${layout} design changed at ${width}px: ${JSON.stringify(pixels)}`);
    }
    assert.deepEqual(errors, []);
    results.push({ width, identicalDesigns: 4, directRequestsBeforeConsent: 0, relayCookieStripped: true, explicitPlayerChoice: true, withdrawalPreservesControls: true });
    await context.close();
  }
  assert(deliveries.length > 0);
  console.log('PASS', JSON.stringify(results));
} finally {
  try { await browser?.close(); } finally { try { await server.close(); } finally { await fs.unlink(entry); } }
}
