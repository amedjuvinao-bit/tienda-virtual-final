import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const entry = new URL('../privacy-preferences-audit.jsx', import.meta.url);
const artifacts = process.env.PRIVACY_ARTIFACTS || '/tmp/privacy-preferences-e2e';
await assert.rejects(fs.access(entry));
await fs.mkdir(artifacts, { recursive: true });
await fs.writeFile(entry, `
import React from 'react'; import {createRoot} from 'react-dom/client'; import {BrowserRouter} from 'react-router-dom';
import PrivacyPreferences from '/src/components/privacy/PrivacyPreferences.jsx';
import ExternalContentGate from '/src/components/privacy/ExternalContentGate.jsx';
import ContactMap from '/src/components/information-page/ContactMap.jsx';
import {buildContactConfig} from '/src/components/information-page/contactPageConfig.js';
import TiktokPlayer from '/src/components/tiktok/TiktokPlayer.jsx';
import useCheckoutState from '/src/checkout/page/useCheckoutState.js';
import useCheckoutConfiguration from '/src/checkout/page/useCheckoutConfiguration.js';
import {loadWompiWidgetScript} from '/src/checkout/page/checkoutWompi.js';
import {openPrivacyPreferences} from '/src/lib/privacyPreferences.js';
import '/src/components/tiktok/tiktokStage.css';
const post={id:'post-1',tiktokId:'1234567890123456789',image:'https://www.tiktok.com/privacy-test.jpg',title:'Video de prueba',positionX:50,positionY:50};
const settings={stageMuted:true,stageLoop:false,stageFit:'cover',stageShowControls:true,stageShowDuration:false};
function Fixture(){const state=useCheckoutState();useCheckoutConfiguration(state);const config={style:{cardRadiusPx:22,buttonRadiusPx:20},presentation:{borderWidth:0},contact:buildContactConfig({})};return <main>
<h1>Privacidad de la tienda</h1><button onClick={openPrivacyPreferences}>Cookies y preferencias</button>
<ExternalContentGate category="social" title="Redes de la tienda"><div style={{height:280,position:'relative'}}><TiktokPlayer post={post} settings={settings}/><img src="https://www.instagram.com/privacy-test.jpg" alt="Publicación de Instagram" /></div></ExternalContentGate>
<ContactMap config={config} data={{address:'Calle de prueba 1',coordinates:{lat:11.0,lon:-74.0},map:'https://maps.google.com',directions:'https://maps.google.com'}}/>
<button onClick={()=>loadWompiWidgetScript().then(()=>window.paymentReady=true)}>Iniciar pago de prueba</button>
<PrivacyPreferences/></main>}
createRoot(document.getElementById('root')).render(<BrowserRouter><Fixture/></BrowserRouter>);
`);
process.chdir(root);
const server = await createServer({ root, server: { host: '127.0.0.1', port: 5295, strictPort: true, hmr: false }, plugins: [{
  name: 'privacy-preferences-audit', configureServer(vite) {
    vite.middlewares.use(async (req, res, next) => {
      if (req.url?.includes('.') || req.url?.startsWith('/@') || req.url?.startsWith('/src/')) return next();
      res.setHeader('Content-Type', 'text/html');
      res.end(await vite.transformIndexHtml(req.url, '<!doctype html><html lang="es"><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/fonts/storefront-fonts.css"><style>body{margin:0;background:#f7ddda;color:#521e32;font-family:Manrope,system-ui}main{max-width:1100px;margin:auto;padding:20px;box-sizing:border-box}h1{font-family:"Cormorant Garamond",serif}button{min-height:44px}.contact-map{height:330px;position:relative}.contact-map svg{max-width:100%;max-height:100%}.contact-map iframe{width:100%;height:100%;border:0}</style></head><body><div id="root"></div><script type="module" src="/privacy-preferences-audit.jsx"></script></body></html>'));
    });
  },
}] });
let browser, currentPage;
const results = [];
try {
  await server.listen();
  for (const width of [1440, 768, 390, 320]) {
    browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH || undefined,
      headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage', '--single-process', '--no-zygote'] });
    const context = await browser.newContext({ viewport: { width, height: 1000 } });
    const page = await context.newPage();
    currentPage = page;
    page.setDefaultTimeout(10000);
    const requests = [], errors = [];
    page.on('pageerror', error => { errors.push(error.message); console.error('PAGE_ERROR', error.message); });
    await context.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.pathname.startsWith('/api/')) return route.fulfill({ json: { ok: true, theme: { global: { payments: { provider: 'wompi', active: true } } } } });
      if (url.hostname === '127.0.0.1') return route.continue();
      requests.push(url.href);
      if (url.hostname.includes('wompi')) return route.fulfill({ contentType: 'application/javascript', body: 'window.WidgetCheckout=function(){};' });
      if (url.pathname.endsWith('.jpg')) return route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="pink"/></svg>' });
      return route.fulfill({ contentType: 'text/html', body: '<html><body>Contenido externo controlado<script>parent.postMessage({"x-tiktok-player":true,type:"onPlayerReady"},"*")</script></body></html>' });
    });
    const origin = 'http://127.0.0.1:5295';
    await page.goto(origin, { waitUntil: 'networkidle' });
    await page.getByRole('region', { name: 'Cookies y contenidos externos' }).waitFor();
    assert.equal(requests.length, 0, 'No optional provider, font or payment requests before choosing');
    assert.equal(await page.locator('iframe').count(), 0);
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Horizontal overflow at ' + width);
    await page.screenshot({ path: `${artifacts}/banner-${width}.png`, fullPage: true });
    await page.getByRole('button', { name: 'Elegir preferencias' }).click();
    const dialog = page.getByRole('dialog');
    assert.equal(await dialog.locator('input:checked').count(), 0);
    await dialog.getByRole('checkbox', { name: /Mapa interactivo/ }).check();
    await page.screenshot({ path: `${artifacts}/preferences-${width}.png`, fullPage: true });
    await dialog.getByRole('button', { name: 'Guardar mi elección' }).click();
    await page.getByRole('button', { name: 'Explorar mapa' }).click();
    await page.locator('iframe[src*="openstreetmap"]').waitFor();
    assert(!requests.some(url => /tiktok|instagram|fonts\.(googleapis|gstatic)|wompi/.test(url)));
    await page.getByRole('button', { name: 'Cookies y preferencias', exact: true }).click();
    await page.getByRole('dialog').getByRole('checkbox', { name: /Contenidos sociales/ }).check();
    await page.getByRole('dialog').getByRole('button', { name: 'Guardar mi elección' }).click();
    await page.getByAltText('Publicación de Instagram').waitFor();
    await page.getByRole('button', { name: 'Reproducir: Video de prueba', exact: true }).click();
    await page.locator('iframe[src*="tiktok.com/player"]').waitFor();
    await page.getByRole('button', { name: 'Cookies y preferencias', exact: true }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Rechazar opcionales' }).click();
    assert.equal(await page.locator('iframe').count(), 0, 'Revoking unmounts opened providers');
    await page.reload({ waitUntil: 'networkidle' });
    assert.equal(await page.getByRole('region', { name: 'Cookies y contenidos externos' }).count(), 0, 'Rejection persists');
    assert.equal(await page.locator('iframe').count(), 0);
    const beforePayment = requests.length;
    assert(!requests.some(url => /wompi/.test(url)), 'Entering configured checkout does not preload Wompi');
    await page.getByRole('button', { name: 'Iniciar pago de prueba' }).click();
    await page.waitForFunction(() => window.paymentReady === true);
    assert.equal(requests.slice(beforePayment).filter(url => /wompi/.test(url)).length, 1);
    assert(!requests.some(url => /fonts\.(googleapis|gstatic)/.test(url)));
    await page.evaluate(async () => {
      await Promise.all(['600 18px Manrope', '600 24px "Cormorant Garamond"', '600 18px "Dancing Script"'].map(font => document.fonts.load(font, 'Ñandú, tamaño, promoción')));
      if (!document.fonts.check('600 18px Manrope')) throw new Error('Local font unavailable');
    });
    if (width === 1440) {
      const other = await context.newPage();
      await other.goto(origin, { waitUntil: 'networkidle' });
      await page.getByRole('button', { name: 'Cookies y preferencias', exact: true }).click();
      await page.getByRole('dialog').getByRole('button', { name: 'Aceptar opcionales' }).click();
      await other.getByAltText('Publicación de Instagram').waitFor();
      await page.getByRole('button', { name: 'Cookies y preferencias', exact: true }).click();
      await page.getByRole('dialog').getByRole('button', { name: 'Rechazar opcionales' }).click();
      await other.getByAltText('Publicación de Instagram').waitFor({ state: 'detached' });
      await other.close();
    }
    assert.deepEqual(errors, []);
    results.push({ width, initialExternalRequests: 0, selectiveMap: true, socialPlayback: true, withdrawal: true, paymentOnAction: true, localFonts: true });
    await context.close();
    await browser.close();
  }
  await fs.writeFile(`${artifacts}/results.json`, JSON.stringify(results, null, 2));
  console.log('PASS', JSON.stringify(results));
} catch (error) {
  if (currentPage && !currentPage.isClosed()) {
    await fs.writeFile(`${artifacts}/failure.html`, await currentPage.content());
    await currentPage.screenshot({ path: `${artifacts}/failure.png`, fullPage: true });
  }
  throw error;
} finally {
  await browser?.close();
  await server.close();
  await fs.unlink(entry);
}
