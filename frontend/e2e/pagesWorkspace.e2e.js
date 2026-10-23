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
  categories: ["Destacados"],
  stock: 10,
}));
const fixture = `import React from'react';import{createRoot}from'react-dom/client';import{BrowserRouter,Routes,Route}from'react-router-dom';import AdminLayout from'/src/admin/AdminLayout.jsx';import PagesAdmin from'/src/admin/pages/PagesAdmin.jsx';import Catalog from'/src/admin/pages/CatalogPageEditor.jsx';import Detail from'/src/admin/pages/ProductDetailPageEditor.jsx';import Page from'/src/admin/pages/PageEditor.jsx';import'/src/index.css';import{installPageDraftNavigationGuard}from'/src/admin/pages/workspace/pageDraftNavigationGuard.js';installPageDraftNavigationGuard();createRoot(document.getElementById('root')).render(<BrowserRouter><Routes><Route path='/admin' element={<AdminLayout initialSettings={${JSON.stringify(settings)}}/>}><Route path='paginas' element={<PagesAdmin/>}/><Route path='catalogo/:id' element={<Catalog/>}/><Route path='product-detail/:id' element={<Detail/>}/><Route path='paginas/:id' element={<Page/>}/></Route></Routes></BrowserRouter>);`;
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
          if (!req.url.split("?")[0].startsWith("/admin/")) return next();
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
      data = { categories: ["Destacados"], minPrice: 10000, maxPrice: 150000 };
    else if (u.pathname === "/api/products/admin/reviews")
      data = { reviews: [] };
    else if (/^\/api\/products\/p\d+$/.test(u.pathname))
      data = products.find((p) => p._id === u.pathname.split("/").at(-1));
    else if (u.pathname.startsWith("/api/products"))
      data = {
        products,
        pagination: { page: 1, totalPages: 1, total: products.length },
      };
    else data = { items: [], posts: [] };
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
