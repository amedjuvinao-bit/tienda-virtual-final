import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import { chromium } from "playwright";

const root = fileURLToPath(new URL("../", import.meta.url));
const require = createRequire(import.meta.url);
const { CATALOG_PAGES, complementsConfig, buildCategoryCatalogConfig } = require("../../backend/services/pages/catalogPages.js");
const artifactDirectory = process.env.CATEGORY_NAVIGATION_ARTIFACTS || "/tmp/category-navigation-e2e";
const entry = new URL("../category-navigation-audit.jsx", import.meta.url);
process.chdir(root);
await fs.mkdir(artifactDirectory, { recursive: true });
await assert.rejects(fs.access(entry));
const settings = {
  store: { name: "Mi negocio" },
  menus: { header: [{ title: "Inicio", ref: "/" }, { title: "Novedades", ref: "/lo-nuevo" }] },
  theme: {
    colors: { background: "#f3d0cd" },
    global: { sectionMotion: { enabled: true, experience: "journey", journey: { backgroundImage: "/looks-editorial-background.webp" } } },
    footer: { editorial: { newsletterEnabled: false } },
  },
};
const pages = CATALOG_PAGES.map(definition => ({
  _id: definition.slug, name: definition.name, slug: definition.slug,
  pageType: "catalog", enabled: true, useHeader: true, useFooter: true, blocks: [],
  catalogConfig: definition.slug === "complementos" ? complementsConfig : buildCategoryCatalogConfig(definition),
}));
const products = CATALOG_PAGES.filter(item => item.category).map((definition, index) => ({
  _id: (index + 1).toString(16).padStart(24, "0"), slug: `prueba-${definition.slug}`,
  title: `${definition.name} de prueba`, categories: [definition.category], price: 24000,
  image: "/categorias/collection-atlas.webp", active: true, inventoryTracked: false,
  variants: [{ variantId: "v1", active: true, price: 24000 }],
}));
await fs.writeFile(entry, `import React from 'react';
import {createRoot} from 'react-dom/client';
import {BrowserRouter,Routes,Route} from 'react-router-dom';
import Header from '/src/components/Header.jsx';
import FooterSection from '/src/components/FooterSection.jsx';
import ConsumerLinks from '/src/components/consumer/ConsumerLinks.jsx';
import CategoriasSection from '/src/components/CategoriasSection.jsx';
import DynamicPage from '/src/pages/DynamicPage.jsx';
import StorefrontScrollRestoration from '/src/components/StorefrontScrollRestoration.jsx';
import StorefrontStory from '/src/components/StorefrontStory.jsx';
import {applyTheme} from '/src/theme/applyTheme.js';
import {CATEGORIAS_SECTION_DEFAULTS} from '/src/admin/appearance/sections/categorias/categoriasSectionHelpers.js';
import {StorefrontSettingsContext} from '/src/context/StorefrontSettingsContext.js';
import CATALOG_PAGES from '/@fs/${fileURLToPath(new URL('../../shared/catalogPages.json', import.meta.url))}';
import '/src/index.css';
const settings=${JSON.stringify(settings)};
settings.theme.sections=[CATEGORIAS_SECTION_DEFAULTS];
applyTheme(settings.theme);
function Home(){return <><Header/><StorefrontStory config={settings.theme.global.sectionMotion}><section id="banner" style={{height:520,paddingTop:150}}><h1>Mi negocio</h1></section><section id="categorias" className="storefront-section-shell w-full"><CategoriasSection theme={settings.theme}/></section><section id="footer"><FooterSection theme={settings.theme} store={settings.store}/></section></StorefrontStory></>;}
createRoot(document.getElementById('root')).render(<BrowserRouter><StorefrontSettingsContext.Provider value={settings}><StorefrontScrollRestoration/><Routes><Route path="/" element={<Home/>}/>{CATALOG_PAGES.map(({slug,publicPath})=><Route key={slug} path={publicPath} element={<DynamicPage fixedSlug={slug} theme={settings.theme}/>}/>)}<Route path="/producto/:id" element={<h1>Detalle de prueba</h1>}/><Route path="*" element={<h1>Ruta de prueba sin resolver</h1>}/></Routes><ConsumerLinks/></StorefrontSettingsContext.Provider></BrowserRouter>);`);

let browser, page;
const results = [], queries = [], errors = [], mutations = [];
const server = await createServer({
  root,
  server: { host: "127.0.0.1", port: 5291, strictPort: true, hmr: false },
  plugins: [
    {
      name: "category-navigation-contexts", enforce: "pre",
      resolveId(id) {
        if (/context\/CartContext(?:\.jsx?)?$/.test(id)) return "\0navigation-cart";
        if (/context\/FavoritesContext(?:\.jsx?)?$/.test(id)) return "\0navigation-favorites";
      },
      load(id) {
        if (id === "\0navigation-cart") return "import{createContext,useContext}from'react';export const CartContext=createContext({cart:[],addToCart(){}});export const useCart=()=>useContext(CartContext);export const CartProvider=({children})=>children;";
        if (id === "\0navigation-favorites") return "import{createContext,useContext}from'react';export const FavoritesContext=createContext({favorites:[],isFavorite:()=>false,toggleFavorite(){}});export const useFavorites=()=>useContext(FavoritesContext);export const FavoritesProvider=({children})=>children;";
      },
    },
    {
      name: "category-navigation-html",
      configureServer(vite) {
        vite.middlewares.use(async (req, res, next) => {
          if (req.url?.includes(".") || req.url?.startsWith("/@")) return next();
          res.setHeader("Content-Type", "text/html");
          res.end(await vite.transformIndexHtml(req.url, '<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><div id="root"></div><script type="module" src="/category-navigation-audit.jsx"></script></body></html>'));
        });
      },
    },
  ],
});
try {
  await server.listen();
  browser = await chromium.launch({
    executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH || undefined,
    args: process.env.PLAYWRIGHT_EXECUTABLE_PATH ? ["--no-sandbox", "--disable-dev-shm-usage", "--single-process"] : [],
    headless: true,
  });
  const context = await browser.newContext();
  await context.route("**/api/**", async route => {
    const request = route.request(), url = new URL(request.url()), path = url.pathname;
    if (!path.startsWith("/api/")) return route.continue();
    if (request.method() !== "GET") { mutations.push(path); return route.abort(); }
    let json = settings, status = 200;
    if (path.startsWith("/api/pages/")) {
      json = pages.find(page => page.slug === decodeURIComponent(path.split("/").at(-1)));
      if (!json) { status = 404; json = { message: "Página no encontrada" }; }
    } else if (path === "/api/products" || path === "/api/products/meta") {
      const scope = url.searchParams.getAll("categoryScope");
      const selected = scope.length ? products.filter(item => item.categories.some(category => scope.includes(category))) : products;
      if (path.endsWith("/meta")) json = { categories: selected.flatMap(item => item.categories), colors: [] };
      else {
        queries.push(url.searchParams.toString());
        json = { products: selected, pagination: { page: 1, limit: 12, totalPages: 1, totalProducts: selected.length, hasPreviousPage: false, hasNextPage: false } };
      }
    }
    await route.fulfill({ status, json });
  });
  page = await context.newPage();
  page.setDefaultTimeout(15000);
  page.setDefaultNavigationTimeout(20000);
  page.on("pageerror", error => errors.push(error.message));
  const base = "http://127.0.0.1:5291";
  const noOverflow = async label => assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), label);
  for (const width of [1536, 1024, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(base);
    await page.getByRole("link", { name: "Explorar Calzado", exact: true }).waitFor();
    await page.evaluate(() => document.fonts.ready);
    assert.equal(await page.evaluate(() => document.compatMode), 'CSS1Compat');
    await noOverflow(`Inicio ${width}px`);
    results.push(`Inicio sin desbordamiento a ${width}px`);
  }
  for (const width of [1536, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const definition of CATALOG_PAGES.filter(item => item.category)) {
      await page.goto(base);
      const link = page.getByRole("link", { name: `Explorar ${definition.name}`, exact: true });
      await link.scrollIntoViewIfNeeded();
      await page.evaluate(() => document.addEventListener('click', () => sessionStorage.setItem('audit-category-click-y', String(scrollY)), { once: true, capture: true }));
      await link.click();
      await page.waitForURL(base + definition.publicPath);
      await page.getByRole("heading", { name: definition.name, exact: true }).waitFor();
      await page.locator(".catalog-ecard").first().waitFor();
      assert.equal(await page.locator(".catalog-ecard").count(), 1);
      await noOverflow(`${definition.name} ${width}px`);
      if (width === 390) {
        await page.getByRole("button", { name: "Mostrar/ocultar filtros", exact: true }).click();
        await page.getByRole("dialog").waitFor();
        await page.keyboard.press("Escape");
        assert.equal(await page.getByRole("dialog").count(), 0);
      }
      const before = await page.evaluate(() => Number(sessionStorage.getItem('audit-category-click-y')));
      await page.goBack();
      await link.waitFor();
      await page.waitForFunction(previous => document.documentElement.dataset.storefrontRestoring !== 'true' && Math.abs(scrollY - previous) < 100, before);
      console.log(`OK ${definition.name} ${width}px`);
      results.push(`${definition.name}: destino, productos y regreso a ${width}px`);
    }
    await page.goto(base);
    if (width === 390) await page.getByRole("button", { name: "Abrir menú", exact: true }).click();
    await page.getByRole(width === 390 ? "button" : "link", { name: "Novedades", exact: true }).filter({ visible: true }).click();
    await page.waitForURL(base + "/lo-nuevo");
    await page.getByRole("heading", { name: "Novedades", exact: true }).waitFor();
    await page.locator(".catalog-ecard").first().waitFor();
    assert.equal(await page.locator(".catalog-ecard").count(), products.length);
    await noOverflow(`Novedades ${width}px`);
    results.push(`Menú y Novedades a ${width}px`);
    const footer = page.getByRole('contentinfo', { name: 'Pie de página' });
    for (const [name, href] of [['Nuestra historia','/nuestra-historia'], ['Catálogo','/#categorias'], ['Envíos','/envios'], ['Cambios y devoluciones','/cambios-y-devoluciones'], ['Centro de ayuda','/preguntas-frecuentes'], ['Contacto','/contacto'], ['Privacidad','/privacidad'], ['Términos y condiciones','/terminos']]) {
      const link = footer.getByRole('link', { name, exact: true, includeHidden: true });
      if (width === 390) {
        const toggle = link.locator('xpath=ancestor::section[contains(@class,"footer-ed__column")]').getByRole('button');
        if (await toggle.getAttribute('aria-expanded') === 'false') await toggle.click();
      }
      await link.waitFor({state:'visible'});
      assert(await link.isVisible(), `Footer ${name} ${width}px`);
      assert.equal(await link.getAttribute('href'), href);
    }
    assert.equal(await footer.locator('a[href="/pqr"]').count(), 1);
    results.push(`Enlaces y grupos del footer a ${width}px`);
    await page.evaluate(() => scrollTo({top:0, behavior:'instant'}));
    await page.screenshot({ path: `${artifactDirectory}/novedades-${width}.png`, fullPage: true });
  }
  for (const definition of CATALOG_PAGES.filter(item => item.category)) {
    assert(queries.some(value => new URLSearchParams(value).getAll("categoryScope").includes(definition.category)), definition.slug);
  }
  assert(queries.some(value => { const query = new URLSearchParams(value); return !query.has("categoryScope") && query.get("sort") === "-createdAt"; }));
  assert.deepEqual(errors, []);
  assert.deepEqual(mutations, []);
  await fs.writeFile(`${artifactDirectory}/results.json`, JSON.stringify({ results, queries, errors, mutations }, null, 2));
  console.log(`PASS ${results.length} controles Chromium de navegación y tamaños. Datos controlados; sin cambios en inventario ni pedidos reales.`);
} catch (error) {
  if (page && !page.isClosed()) {
    await page.screenshot({ path: `${artifactDirectory}/failure.png`, fullPage: true }).catch(() => {});
    console.error(JSON.stringify({ completed: results, url: page.url(), ui: await page.evaluate(() => ({ width: innerWidth, scrollY, clickY: sessionStorage.getItem('audit-category-click-y'), positions: JSON.parse(sessionStorage.getItem('rb_storefront_scroll_v1') || '[]').slice(-3), restoring: document.documentElement.dataset.storefrontRestoring, links: [...document.querySelectorAll('header a')].map(a => ({ text: a.textContent, href: a.getAttribute('href'), visible: !!a.getClientRects().length })), buttons: [...document.querySelectorAll('button')].map(b => b.getAttribute('aria-label') || b.textContent) })).catch(() => null) }));
  }
  throw error;
} finally {
  await browser?.close();
  await server.close();
  await fs.rm(entry, { force: true });
}
