import { fileURLToPath } from "node:url";
import fs from "node:fs/promises";
import { createServer } from "vite";
import { chromium } from "playwright";
const root = fileURLToPath(new URL("../", import.meta.url));
process.chdir(root);
const artifactDirectory =
  process.env.PAGES_E2E_ARTIFACTS || "/tmp/pages-workspace-e2e";
await fs.mkdir(artifactDirectory, { recursive: true });
const settings = {
  admin: {
    theme: { preset: "roseLuxuryLight" },
    background: { enabled: false },
  },
  theme: { header: {}, sections: [] },
  store: { name: "Mi negocio" },
};
const pages = [
  { _id: "cart", name: "Carrito", slug: "carrito", pageType: "cart-page" },
  {
    _id: "checkout",
    name: "Finalizar compra",
    slug: "checkout",
    pageType: "checkout-page",
  },
  {
    _id: "thanks",
    name: "Confirmación de compra",
    slug: "gracias",
    pageType: "thanks-page",
  },
  {
    _id: "favorites",
    name: "Favoritos",
    slug: "favoritos",
    pageType: "favorites-page",
  },
  {
    _id: "error",
    name: "Página no encontrada",
    slug: "not-found",
    pageType: "notfound-page",
  },
  {
    _id: "catalog",
    name: "Productos destacados",
    slug: "destacados",
    pageType: "catalog",
    catalogConfig: {},
  },
  {
    _id: "detail",
    name: "Ficha del producto",
    slug: "ficha-producto",
    pageType: "product-detail",
    productDetailConfig: {},
  },
  {
    _id: "custom",
    name: "Nuestra historia",
    slug: "nuestra-historia",
    pageType: "custom",
    blocks: [
      { id: "bloque-1", type: "banner", enabled: true, order: 0, config: {} },
      {
        id: "bloque-2",
        type: "informacion",
        enabled: true,
        order: 1,
        config: {},
      },
    ],
  },
].map((p) => ({
  enabled: true,
  useHeader: true,
  useFooter: true,
  blocks: [],
  createdAt: "2026-10-01T12:00:00Z",
  ...p,
}));
const products = Array.from({ length: 8 }, (_, i) => ({
  _id: "p" + i,
  name: "Producto " + (i + 1),
  title: "Producto " + (i + 1),
  slug: "producto-" + (i + 1),
  price: 80000,
  image: "/categorias/collection-older.webp",
  images: ["/categorias/collection-older.webp", "/categorias/collection-atlas.webp"],
  categories: ["Destacados"],
  stock: i === 1 ? 0 : 10,
  inventoryTracked: true,
  availableStock: i === 1 ? 0 : 10,
  colors: ["rojo"],
  variants: [
    {
      variantKey: "unica",
      availableStock: i === 1 ? 0 : 10,
      price: 80000,
      active: true,
    },
  ],
}));
const fixture = `import React from'react';import{createRoot}from'react-dom/client';import{BrowserRouter,Routes,Route}from'react-router-dom';import AdminLayout from'/src/admin/AdminLayout.jsx';import PagesAdmin from'/src/admin/pages/PagesAdmin.jsx';import Catalog from'/src/admin/pages/CatalogPageEditor.jsx';import Detail from'/src/admin/pages/ProductDetailPageEditor.jsx';import Page from'/src/admin/pages/PageEditor.jsx';import PublicCatalog from'/src/components/catalog/CatalogPageView.jsx';import{CartContext}from'/src/context/CartContext.jsx';import{FavoritesContext}from'/src/context/FavoritesContext.jsx';function PublicAudit({editorial=false}){return <CartContext.Provider value={{cart:[],totalItems:0,subtotal:0,addToCart:p=>window.__catalogCart=p}}><FavoritesContext.Provider value={{favorites:[],isFavorite:()=>false,toggleFavorite:p=>window.__catalogFavorite=p}}><PublicCatalog catalogConfig={{limit:editorial?8:2,sourceMode:'categories',allowedCategoriesText:'Destacados',title:editorial?'Últimas tendencias':'',titleMode:editorial?'image':'text',titleImage:editorial?'/legacy-heading.png':'',heroBadge:'Selección destacada',showHeroBadge:editorial,initialMaxPrice:300000,presentation:{styleVersion:1,showPhotoCount:true},cardUiConfig:{titleColor:'#0066ff',priceColor:'#ff00ff',cardPaddingPx:12,cardBorderWidthPx:6,cardRadiusPx:40},filterUiConfig:{panelBorderColor:'#0066ff',sectionHeaderBg:'#d6ffe6'}}}/></FavoritesContext.Provider></CartContext.Provider>}import'/src/index.css';import{installPageDraftNavigationGuard}from'/src/admin/pages/workspace/pageDraftNavigationGuard.js';installPageDraftNavigationGuard();createRoot(document.getElementById('root')).render(<BrowserRouter><Routes><Route path='/catalog-audit' element={<PublicAudit/>}/><Route path='/catalog-editorial-audit' element={<PublicAudit editorial/>}/><Route path='/admin' element={<AdminLayout initialSettings={${JSON.stringify(settings)}}/>}><Route path='paginas' element={<PagesAdmin/>}/><Route path='catalogo/:id' element={<Catalog/>}/><Route path='product-detail/:id' element={<Detail/>}/><Route path='paginas/:id' element={<Page/>}/></Route></Routes></BrowserRouter>);`;
const server = await createServer({
  root,
  cacheDir: "/tmp/pages-ui-vite-cache",
  // Same site, separate origin: match the frontend/API ports used in development.
  define: {
    "import.meta.env.VITE_API_BASE_URL": JSON.stringify(
      "http://127.0.0.1:5206",
    ),
  },
  plugins: [
    {
      name: "pages-ui-audit",
      enforce: "pre",
      resolveId(id) {
        if (id === "/__pages-audit.jsx") return id;
      },
      load(id) {
        if (id === "/__pages-audit.jsx") return fixture;
        if (id.endsWith("/context/AuthContext.jsx"))
          return `export const useAuth=()=>({adminUser:{role:'owner',username:'amed',displayName:'Amed Juvinao'},logout:()=>{}});export const AuthProvider=({children})=>children;`;
      },
      configureServer(s) {
        s.middlewares.use(async (req, res, next) => {
          if (
            !req.url.split("?")[0].startsWith("/admin/") &&
            !req.url.startsWith("/catalog-")
          )
            return next();
          res.setHeader("Content-Type", "text/html");
          res.end(
            await s.transformIndexHtml(
              req.url,
              '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/__pages-audit.jsx"></script></body></html>',
            ),
          );
        });
      },
    },
  ],
  server: { host: "127.0.0.1", port: 5205, strictPort: true, hmr: false },
});
let browser, page;
const results = [],
  writes = [];
try {
  await server.listen();
  browser = await chromium.launch({
    executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH || undefined,
    args: process.env.PLAYWRIGHT_EXECUTABLE_PATH
      ? ["--no-sandbox", "--disable-dev-shm-usage", "--single-process"]
      : [],
    headless: true,
  });
  page = await browser.newPage();
  await page.context().addCookies([
    {
      name: "admin_access",
      value: "pages-session-fixture",
      url: "http://127.0.0.1:5206",
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
  const errors = [];
  page.on("pageerror", (e) => {
    errors.push(e.message);
    console.log("PAGEERROR", e.message);
  });
  await page.route("https://fonts.googleapis.com/**", (route) => route.abort());
  await page.route("https://fonts.gstatic.com/**", (route) => route.abort());
  await page.route("**/api/**", async (route) => {
    const u = new URL(route.request().url());
    if (!u.pathname.startsWith("/api/")) return route.continue();
    if (!["GET", "OPTIONS"].includes(route.request().method())) {
      const method = route.request().method();
      if (
        u.pathname.startsWith("/api/pages") &&
        ["POST", "PUT"].includes(method)
      ) {
        if (
          !(await route.request().allHeaders()).cookie?.includes(
            "admin_access=pages-session-fixture",
          )
        ) {
          return route.fulfill({
            status: 401,
            contentType: "application/json",
            headers: {
              "access-control-allow-origin": "http://127.0.0.1:5205",
              "access-control-allow-credentials": "true",
            },
            body: JSON.stringify({
              message: "Token de administrador ausente.",
            }),
          });
        }
        writes.push({
          method,
          url: u.pathname,
          payload: route.request().postDataJSON(),
        });
        let row =
          method === "POST"
            ? { _id: "new-page", ...route.request().postDataJSON() }
            : pages.find((p) => p._id === u.pathname.split("/").at(-1));
        if (method === "POST") pages.push(row);
        else Object.assign(row, route.request().postDataJSON());
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(row),
          headers: {
            "access-control-allow-origin": "http://127.0.0.1:5205",
            "access-control-allow-credentials": "true",
          },
        });
      }
      throw Error("Unexpected preview write " + method + " " + u.pathname);
    }
    const headers = {
      "access-control-allow-origin": "http://127.0.0.1:5205",
      "access-control-allow-credentials": "true",
      "access-control-allow-headers": "content-type,x-session-id",
      "access-control-allow-methods": "GET,PUT,POST,OPTIONS",
    };
    if (route.request().method() === "OPTIONS")
      return route.fulfill({ status: 204, headers });
    let data;
    if (u.pathname === "/api/pages") data = pages;
    else if (u.pathname.startsWith("/api/pages/"))
      data = pages.find((p) => p._id === u.pathname.split("/").at(-1)) || {};
    else if (u.pathname.startsWith("/api/site-settings")) data = settings;
    else if (u.pathname === "/api/products/meta")
      data = {
        categories: ["Destacados"],
        colors: ["rojo"],
        minPrice: 10000,
        maxPrice: 150000,
      };
    else if (u.pathname === "/api/products/admin/reviews")
      data = { reviews: [] };
    else if (/^\/api\/products\/p\d+$/.test(u.pathname))
      data = products.find((p) => p._id === u.pathname.split("/").at(-1));
    else if (u.pathname.startsWith("/api/products")) {
      const q = (u.searchParams.get("q") || "").toLowerCase();
      let rows = products.filter(
        (p) => !q || p.title.toLowerCase().includes(q),
      );
      const keys = u.searchParams.getAll("productKeys");
      if (keys.length)
        rows = rows.filter(
          (p) => keys.includes(p._id) || keys.includes(p.slug),
        );
      if (u.searchParams.get("sort") === "-title") rows = [...rows].reverse();
      const pageNumber = Number(u.searchParams.get("page") || 1),
        limit = Number(u.searchParams.get("limit") || 24);
      const total = rows.length,
        totalPages = Math.ceil(total / limit);
      data = {
        products: rows.slice((pageNumber - 1) * limit, pageNumber * limit),
        pagination: {
          page: pageNumber,
          limit,
          totalProducts: total,
          totalPages,
          hasPreviousPage: pageNumber > 1,
          hasNextPage: pageNumber < totalPages,
          from: total ? (pageNumber - 1) * limit + 1 : 0,
          to: Math.min(total, pageNumber * limit),
        },
      };
    } else data = { items: [], posts: [] };
    return route.fulfill({
      status: 200,
      headers,
      contentType: "application/json",
      body: JSON.stringify(data),
    });
  });

  for (const device of [
    { id: "desktop", width: 1440, height: 1000 },
    { id: "mobile", width: 390, height: 844 },
  ]) {
    await page.setViewportSize({ width: device.width, height: device.height });
    await page.goto("http://127.0.0.1:5205/admin/paginas");
    await page
      .getByRole("heading", { name: "Páginas de tu tienda", exact: true })
      .waitFor();
    await page
      .getByRole("button", { name: "Editar Carrito", exact: true })
      .waitFor();
    const firstEditTop = await page
      .getByRole("button", { name: "Editar Carrito", exact: true })
      .evaluate((el) => el.getBoundingClientRect().top);
    if (firstEditTop > device.height)
      throw Error(
        "First edit is below the fold " + device.id + " " + firstEditTop,
      );
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth + 1,
    );
    if (overflow) throw Error("List overflow " + device.id);
    await page.screenshot({
      path: artifactDirectory + "/list-" + device.id + ".png",
      fullPage: true,
    });
    await page
      .getByRole("textbox", { name: "Buscar páginas" })
      .fill("destacados");
    await page
      .getByRole("button", { name: /^Editar / })
      .first()
      .click();
    await page
      .getByRole("heading", {
        name: pages.find((p) => p._id === "catalog").name,
        exact: true,
      })
      .waitFor();
    for (const kind of ["catalog", "detail"]) {
      const publicTitle =
        (kind === "catalog" ? "Novedades en vivo " : "Ficha en vivo ") +
        device.id;
      if (kind === "detail") {
        await page.goto("http://127.0.0.1:5205/admin/product-detail/detail");
        await page
          .getByRole("heading", {
            name: pages.find((p) => p._id === "detail").name,
            exact: true,
          })
          .waitFor();
      }
      const frame = page.frameLocator('iframe[title="Página en edición"]');
      if (device.id === "mobile")
        await page
          .getByRole("button", { name: "Vista previa", exact: true })
          .last()
          .click();
      if (kind === "catalog")
        await frame.locator(".cpv-page").waitFor({ timeout: 20000 });
      else
        await frame
          .getByText("Producto para la vista previa", { exact: false })
          .first()
          .waitFor({ timeout: 20000 });
      if (device.id === "mobile")
        await page.getByRole("button", { name: "Editar", exact: true }).click();
      await page.getByRole("button", { name: "Ajustes", exact: true }).click();
      const field = page.getByLabel("Nombre de la página", { exact: true });
      await field.fill(
        (kind === "catalog" ? "Catálogo editado " : "Ficha editada ") +
          device.id,
      );
      await page
        .getByRole("button", { name: "Guardar cambios", exact: true })
        .waitFor({ state: "visible" });
      if (
        !(await page
          .getByRole("button", { name: "Guardar cambios", exact: true })
          .isEnabled())
      )
        throw Error("Draft is not dirty");
      if (device.id === "desktop" && kind === "catalog") {
        for (let attempt = 0; attempt < 2; attempt++) {
          const prompt = page
            .waitForEvent("dialog")
            .then((dialog) => dialog.dismiss());
          await page.evaluate(() => history.back());
          await prompt;
          await page.waitForURL("**/admin/catalogo/catalog");
          if (
            (await page
              .getByLabel("Nombre de la página", { exact: true })
              .inputValue()) !== "Catálogo editado desktop"
          )
            throw Error("Browser back discarded a draft");
        }
      }
      await page
        .getByRole("button", { name: "Contenido", exact: true })
        .click();
      if (kind === "catalog") {
        await page
          .getByRole("button", { name: "Título y presentación", exact: true })
          .click();
        await page
          .getByLabel("Título del catálogo", { exact: true })
          .fill(publicTitle);
      } else {
        await page
          .getByRole("button", { name: "Ajustes", exact: true })
          .click();
        await page
          .getByRole("button", { name: "Encabezado del detalle", exact: true })
          .click();
        await page
          .getByLabel("Título alternativo", { exact: true })
          .fill(publicTitle);
      }
      if (device.id === "mobile")
        await page
          .getByRole("group", { name: "Modo del editor" })
          .getByRole("button", { name: "Vista previa", exact: true })
          .click();
      await frame
        .getByText(publicTitle, { exact: true })
        .first()
        .waitFor({ timeout: 12000 });
      if (kind === "catalog" && device.id === "desktop") {
        await page.getByRole('button', { name: 'Diseño', exact: true }).click();
        await page.getByRole('button', { name: 'Estructura visual', exact: true, expanded: true }).waitFor();
        await page.getByRole('tab', {name:'Productos', exact:true}).click();
        await page.getByLabel('Borde de las tarjetas', { exact: true }).selectOption('fine');
        await frame.locator('.catalog-ecard[data-rim="fine"]').first().waitFor();
        await page.getByLabel('Borde de las tarjetas', { exact: true }).selectOption('optical');
        await page.getByRole('tab', {name:'Encabezado', exact:true}).click();
        await page.getByRole('tab', {name:'Texto', exact:true}).click();
        await page.getByLabel('Tamaño del título de catálogo (px)', { exact: true }).fill('40');
        await page.getByRole('tab', {name:'Fondo', exact:true}).click();
        await page.getByLabel('Opacidad del cristal (0 a 1)', { exact: true }).fill('0.45');
        await page.getByLabel('Dirección de la imagen de fondo', { exact: true }).fill('/information/satin.webp');
        await page.getByRole('tab', {name:'Encabezado', exact:true}).click();
        await page.getByRole('tab', {name:'Cristal', exact:true}).click();
        await page.getByLabel('Color del cristal del encabezado', { exact:true }).fill('#d4eee1');
        await page.getByRole('tab', {name:'Bordes y luz', exact:true}).click();
        await page.getByLabel('Color del borde del encabezado', { exact:true }).fill('#24785a');
        await page.getByLabel('Intensidad de los reflejos (0 a 1)', { exact:true }).fill('0.3');
        await page.getByRole('tab', {name:'Bolsas', exact:true}).click();
        await page.getByLabel('Adorno del encabezado', { exact:true }).selectOption('none');
        await frame.locator('.cpv-glass-bags').waitFor({state:'detached'});
        await page.waitForFunction(() => {
          const node=document.querySelector('iframe')?.contentDocument?.querySelector('.cpv-page');
          return node?.style.getPropertyValue('--ch-tint') === '#d4eee1' && node?.style.getPropertyValue('--ch-edge') === '#24785a';
        });

        await page.waitForFunction(() => {
          const node = document.querySelector('iframe')?.contentDocument?.querySelector('.cpv-page');
          return node?.style.getPropertyValue('--catalog-title-size') === '40px' && node?.style.getPropertyValue('--catalog-glass-fill') === '45%' && node?.style.getPropertyValue('--catalog-backdrop').includes('/information/satin.webp');
        });
      }
      if (kind === "detail") {
        const count = writes.length;
        await frame
          .getByRole("button", { name: "Favorito", exact: true })
          .click();
        await frame.getByRole("button", { name: /añadir al carrito/i }).click();
        if (writes.length !== count)
          throw Error("Preview modified commerce data");
      }
      await page.screenshot({
        path: artifactDirectory + "/editor-" + kind + "-" + device.id + ".png",
        fullPage: true,
      });
      if (
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth + 1,
        )
      )
        throw Error("Editor overflow " + kind + " " + device.id);
      await page
        .getByRole("button", { name: "Guardar cambios", exact: true })
        .click();
      await page
        .getByText(
          "Cambios guardados. La página pública ya usa esta configuración.",
          { exact: true },
        )
        .waitFor();
      const payload = writes.at(-1).payload;
      if (
        (kind === "catalog"
          ? payload.catalogConfig.title
          : payload.productDetailConfig.titleOverride) !== publicTitle
      )
        throw Error("Draft omitted from save");
      if (kind === 'catalog' && device.id === 'desktop') {
        if (payload.catalogConfig.presentation.titleSize !== 40 || payload.catalogConfig.presentation.glassOpacity !== .45) throw Error('Editorial controls omitted from save');
        if (payload.catalogConfig.presentation.headerTint !== '#d4eee1' || payload.catalogConfig.presentation.headerEdgeColor !== '#24785a' || payload.catalogConfig.presentation.headerIcon !== 'none' || payload.catalogConfig.presentation.headerReflection !== .3) throw Error('Header customization omitted from save');
        await page.reload();
        await frame.getByText(publicTitle, { exact: true }).first().waitFor();
        if (!(await frame.locator('.cpv-page').getAttribute('style')).includes('--catalog-glass-fill: 45%')) throw Error('Editorial style did not persist after reload');
        if (!(await frame.locator('.cpv-page').getAttribute('style')).includes('--ch-tint: #d4eee1') || await frame.locator('.cpv-glass-bags').count()) throw Error('Header customization did not persist after reload');
      }
      console.log(
        JSON.stringify({
          device: device.id,
          editor: kind,
          livePreview: true,
          saved: true,
          overflow: false,
        }),
      );
    }
    console.log(
      JSON.stringify({
        device: device.id,
        firstEditTop,
        visibleFirstEdit: true,
      }),
    );
  }
  await page.goto("http://127.0.0.1:5205/admin/paginas");
  await page.getByRole("button", { name: "Nueva página", exact: true }).click();
  await page.getByRole("radio", { name: /Catálogo/ }).click();
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await page
    .getByLabel("Nombre de la página", { exact: true })
    .pressSequentially("Nueva promoción");
  const address = await page
    .getByLabel("Dirección de la página", { exact: false })
    .inputValue();
  if (address !== "nueva-promocion") throw Error("Slug regression " + address);
  await page
    .getByRole("button", { name: "Crear y editar", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "Nueva promoción", exact: true })
    .waitFor();
  if (writes.filter((w) => w.method === "POST").length !== 1)
    throw Error("Unexpected writes " + JSON.stringify(writes));
  for (const viewport of [
    { width: 1440, height: 1000 },
    { width: 880, height: 1000 },
    { width: 390, height: 844 },
    { width: 320, height: 740 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto("http://127.0.0.1:5205/catalog-audit?utm_source=qa");
    await page
      .getByRole("heading", { name: "Producto 1", exact: true })
      .waitFor();
    if ((await page.locator(".cpv-product-item").count()) !== 2)
      throw Error("Public catalog did not paginate");
    if (
      !(await page
        .getByRole("button", { name: "Agotado", exact: true })
        .isDisabled())
    )
      throw Error("Unavailable product can be purchased");
    await page
      .getByRole("button", { name: "Favorito", exact: true })
      .first()
      .click();
    await page
      .getByRole("button", { name: "Agregar al carrito", exact: true })
      .click();
    const intent = await page.evaluate(() => ({
      cart: window.__catalogCart,
      favorite: window.__catalogFavorite,
    }));
    if (intent.cart?.variantKey !== "unica" || intent.favorite?._id !== "p0")
      throw Error("Commercial catalog actions disconnected");
    await page.getByRole("button", { name: "Siguiente", exact: true }).click();
    await page.getByText("Página 2 de 4", { exact: true }).waitFor();
    await page
      .getByRole("textbox", { name: "Buscar productos" })
      .fill("Producto 8");
    await page
      .getByRole("textbox", { name: "Buscar productos" })
      .press("Enter");
    await page
      .getByRole("heading", { name: "Producto 8", exact: true })
      .waitFor();
    if (new URL(page.url()).searchParams.has("page"))
      throw Error("Search did not reset page");
    await page.goBack();
    await page.getByText("Página 2 de 4", { exact: true }).waitFor();
    await page.reload();
    await page.getByText("Página 2 de 4", { exact: true }).waitFor();
    if (new URL(page.url()).searchParams.get("utm_source") !== "qa")
      throw Error("Catalog removed attribution");
    await page.getByLabel("Ordenar productos").selectOption("price");
    await page.getByText("Página 1 de 4", { exact: true }).waitFor();
    if (viewport.width < 768) {
      await page
        .getByRole("button", { name: "Mostrar/ocultar filtros" })
        .click();
      await page
        .getByRole("dialog", { name: "Filtros", exact: true })
        .waitFor();
      await page.getByRole("button", { name: "rojo", exact: true }).click();
      await page.keyboard.press("Escape");
      if (
        await page.getByRole("dialog", { name: "Filtros", exact: true }).count()
      )
        throw Error("Filter drawer did not close");
    } else
      await page.getByRole("button", { name: "rojo", exact: true }).click();
    await page
      .getByRole("heading", { name: "Producto 1", exact: true })
      .waitFor();
    if (new URL(page.url()).searchParams.get("colors") !== "rojo")
      throw Error("Filter changed the color identity");
    if (
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth + 1,
      )
    )
      throw Error("Public catalog overflows");
    await page
      .locator(".cpv-product-item img")
      .evaluateAll((images) =>
        Promise.all(images.map((image) => image.decode().catch(() => {}))),
      );
    await page.screenshot({
      path: artifactDirectory + "/catalog-plus-" + viewport.width + ".png",
      fullPage: true,
      animations: "disabled",
    });
    console.log(
      JSON.stringify({
        publicCatalog: true,
        width: viewport.width,
        pagination: true,
        history: true,
        inventory: true,
        variantCart: true,
        favorites: true,
        colors: true,
      }),
    );
  }
  for (const width of [1440, 1280, 1024]) {
    await page.setViewportSize({width,height:900});
    await page.goto('http://127.0.0.1:5205/admin/catalogo/catalog');
    await page.locator('.pages-workspace__form').waitFor();
    await page.getByRole('button', {name:'Diseño',exact:true}).click();
    await page.getByRole('tab', {name:'Encabezado',exact:true}).click();
    await page.locator('.pages-workspace__form').evaluate(node => { node.style.minHeight='1800px'; });
    for (const offset of [500,1000]) {
      await page.evaluate(offset => window.scrollTo(0,document.querySelector('.pages-workspace__grid').getBoundingClientRect().top + scrollY + offset),offset);
      await page.waitForFunction(() => {
        const node=document.querySelector('.pages-workspace__preview');
        return Math.abs(node.getBoundingClientRect().top - parseFloat(getComputedStyle(node).top)) < 3;
      });
      const bounds=await page.locator('.pages-workspace__preview').boundingBox();
      if (bounds.y < 0 || bounds.y+bounds.height > 902) throw Error('Preview leaves viewport at '+width);
    }
    await page.screenshot({path:artifactDirectory+'/sticky-preview-'+width+'.png'});
    console.log(JSON.stringify({stickyPreview:true,width,scrollOffsets:[500,1000]}));
    await page.locator('.pages-workspace__form').evaluate(node => { node.style.minHeight=''; });
    await page.evaluate(() => scrollTo(0,0));
  }
  for (const width of [1440, 1100, 1024, 880, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('http://127.0.0.1:5205/catalog-editorial-audit');
    await page.getByRole('heading', { name: 'Producto 1', exact: true }).waitFor();
    if (await page.locator('.cpv-product-item').count() !== 8) throw Error('Editorial dropped products');
    await page.getByRole('heading', { name:'Últimas tendencias', exact:true }).waitFor();
    if (await page.locator('.cpv-title-image').count()) throw Error('Legacy title artwork bypasses the approved typography');
    const headingCollision = await page.locator('.cpv-hero-glass').evaluate(node => {
      const text = node.querySelector('.cpv-hero-top').getBoundingClientRect();
      const icon = node.querySelector('.cpv-glass-bags').getBoundingClientRect();
      return text.right > icon.left + 1 || icon.right > node.getBoundingClientRect().right;
    });
    if (headingCollision) throw Error('Glass heading collides with shopping bags at ' + width);
    const featuredCount = await page.locator('.cpv-product-item--featured').count();
    if (featuredCount !== 0) throw Error('Conventional grid contains a featured frame');
    if (await page.locator('.look-glass-rim').count() !== 8) throw Error('Homepage optical rims are missing');
    await page.waitForFunction(() => document.querySelectorAll('.look-glass-rim svg').length === 8);
    if (!(await page.locator('.cpv-title').evaluate(node => getComputedStyle(node).fontFamily)).includes('Georgia')) throw Error('Editorial typography not applied');
    const refined = await page.locator('.catalog-ecard').first().evaluate(node => ({ border:getComputedStyle(node).borderTopWidth, padding:getComputedStyle(node).paddingTop, title:node.style.getPropertyValue('--ecard-title') }));
    if (refined.border !== '1px' || refined.padding !== '0px' || refined.title !== '#562633') throw Error('Legacy styles still contaminate the editorial design');
    const collision = await page.locator('.catalog-ecard__footer').evaluateAll(nodes => nodes.some(node => {
      const info=node.querySelector('.catalog-ecard__info').getBoundingClientRect(), actions=node.querySelector('.catalog-ecard__actions').getBoundingClientRect();
      return Math.min(info.right,actions.right)-Math.max(info.left,actions.left)>1 && Math.min(info.bottom,actions.bottom)-Math.max(info.top,actions.top)>1;
    }));
    if (collision) throw Error('Editorial controls collide with product details');
    const geometry = await page.locator('.cpv-product-item').evaluateAll(nodes => nodes.map(node => node.getBoundingClientRect().toJSON()));
    if (geometry.some(box => Math.abs(box.width - geometry[0].width) > 1)) throw Error('Catalog columns are not uniform');
    for (let i = 0; i < geometry.length; i++) for (let j = i + 1; j < geometry.length; j++) {
      const a = geometry[i], b = geometry[j];
      if (Math.min(a.right,b.right)-Math.max(a.left,b.left)>1 && Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>1) throw Error('Editorial product overlap at ' + width);
    }
    if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)) throw Error('Editorial overflow at ' + width);
    await page.locator('.cpv-product-item img').evaluateAll(images => Promise.all(images.map(image => image.decode().catch(() => {}))));
    await page.screenshot({ path: artifactDirectory + '/catalog-editorial-' + width + '.png', fullPage: true, animations: 'disabled' });
    await page.getByLabel('Ordenar productos').selectOption('-title');
    await page.waitForFunction(() => document.querySelector('.cpv-product-item h3')?.textContent === 'Producto 8');
    await page.getByRole('textbox', { name: 'Buscar productos' }).fill('Producto 6');
    await page.getByRole('textbox', { name: 'Buscar productos' }).press('Enter');
    await page.waitForFunction(() => document.querySelectorAll('.cpv-product-item').length === 1 && document.querySelector('.cpv-product-item h3')?.textContent === 'Producto 6');
    if (await page.locator('.cpv-product-item').count() !== 1 || await page.locator('.cpv-product-item--featured').count()) throw Error('Editorial injected a featured product into search');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    if (await page.locator('.cpv-product-item').evaluate(node => getComputedStyle(node).animationName) !== 'none') throw Error('Reduced motion ignored');
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    console.log(JSON.stringify({ editorialCatalog:true, width, products:8, overlaps:false, sort:true, search:true, reducedMotion:true }));
  }
  if (errors.length) throw Error("Browser errors " + JSON.stringify(errors));
  console.log(
    JSON.stringify({
      creationAndEditor: true,
      slugFixed: true,
      previewWrites: 0,
      errors,
    }),
  );
  await fs.writeFile(
    artifactDirectory + "/results.json",
    JSON.stringify({ writes, errors }, null, 2),
  );
} catch (error) {
  console.error("E2E_ERROR", error);
  console.log(
    "FAILURE_STATE",
    await page?.evaluate(() => ({
      scrollY,
      bar: [
        ...document.querySelectorAll(
          ".pages-workspace__bar,.pages-workspace__switch,.pages-workspace__nav",
        ),
      ].map((e) => ({
        cls: e.className,
        rect: e.getBoundingClientRect().toJSON(),
        style: getComputedStyle(e).position,
      })),
    })),
  );
  await page?.screenshot({ path: artifactDirectory + "/failure.png" });
  throw error;
} finally {
  await browser?.close();
  await server.close();
}
