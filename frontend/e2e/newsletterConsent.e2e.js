import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import { chromium } from "playwright";

const root = fileURLToPath(new URL("../", import.meta.url));
const entry = new URL("../newsletter-consent-audit.jsx", import.meta.url);
const artifacts =
  process.env.NEWSLETTER_ARTIFACTS || "/tmp/newsletter-consent-e2e";
process.chdir(root);
await assert.rejects(fs.access(entry));
await fs.mkdir(artifacts, { recursive: true });
const policy = {
  ready: true,
  version: "fixture-v1",
  text: "Autorizo a Mi negocio a utilizar mi correo electrónico para enviarme novedades y ofertas. Puedo retirar esta autorización opcional sin afectar mis compras.",
  seller: {
    legalName: "Mi negocio",
    email: "ayuda@example.test",
    phone: "3001234567",
    notificationAddress: "Calle de ejemplo 1",
  },
};
await fs.writeFile(
  entry,
  `import React from 'react';import{createRoot}from'react-dom/client';import FooterSection from '/src/components/FooterSection.jsx';import{applyTheme}from'/src/theme/applyTheme.js';import '/src/index.css';const theme={colors:{background:'#efd0cd'},footer:{layout:new URLSearchParams(location.search).get('layout'),buttonText:'Suscribirme',editorial:{brandName:'Mi negocio',newsletterEnabled:true,material:'glass'}}};applyTheme(theme);createRoot(document.getElementById('root')).render(<FooterSection theme={theme} store={{name:'Mi negocio'}}/>);`,
);
const server = await createServer({
  root,
  server: { host: "127.0.0.1", port: 5292, strictPort: true, hmr: false },
  plugins: [
    {
      name: "newsletter-audit-html",
      configureServer(vite) {
        vite.middlewares.use(async (req, res, next) => {
          if (req.url?.includes(".") || req.url?.startsWith("/@"))
            return next();
          res.setHeader("Content-Type", "text/html");
          res.end(
            await vite.transformIndexHtml(
              req.url,
              '<!DOCTYPE html><html lang="es"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/newsletter-consent-audit.jsx"></script></body></html>',
            ),
          );
        });
      },
    },
  ],
});
let browser, page;
const results = [],
  errors = [],
  writes = [];
let status = "withdrawn",
  pending = "";
try {
  await server.listen();
  browser = await chromium.launch({
    executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH || undefined,
    headless: true,
    args: process.env.PLAYWRIGHT_EXECUTABLE_PATH
      ? ["--no-sandbox", "--disable-dev-shm-usage", "--single-process"]
      : [],
  });
  page = await browser.newPage();
  page.setDefaultTimeout(15000);
  page.setDefaultNavigationTimeout(20000);
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/api/**", async (route) => {
    const req = route.request(),
      path = new URL(req.url()).pathname;
    if (req.method() === "GET" && path === "/api/newsletter/policy")
      return route.fulfill({ json: { ok: true, policy } });
    assert.equal(req.method(), "POST");
    const body = req.postDataJSON();
    writes.push({ path, body });
    assert.equal(body.email, "prueba@example.test");
    if (path.endsWith("/subscribe")) {
      assert.equal(body.consent, true);
      assert.equal(body.version, policy.version);
      pending = "subscribe";
    } else if (path.endsWith("/request-withdrawal")) pending = "withdraw";
    else if (path.endsWith("/confirm")) {
      assert.equal(body.code, "123456");
      assert.equal(body.intent, pending);
      status = pending === "subscribe" ? "granted" : "withdrawn";
      pending = "";
    } else throw Error("Unexpected endpoint " + path);
    return route.fulfill({
      json: {
        ok: true,
        status,
        message: pending
          ? "Revisa tu correo para obtener el código."
          : status === "granted"
            ? "Suscripción confirmada."
            : "Retiro confirmado.",
      },
    });
  });
  const noOverflow = async () =>
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    );
  for (const layout of ["editorial", "classic"])
    for (const width of [1536, 768, 390, 320]) {
      await page.setViewportSize({ width, height: 1000 });
      status = "withdrawn";
      pending = "";
      await page.goto(`http://127.0.0.1:5292/?layout=${layout}`);
      assert.equal(
        await page.evaluate(() => document.compatMode),
        "CSS1Compat",
      );
      const checkbox = page.getByRole("checkbox");
      await checkbox.waitFor();
      assert.equal(await checkbox.isChecked(), false);
      await noOverflow();
      if (width === 1536 || width === 390)
        await page.screenshot({
          path: `${artifacts}/${layout}-${width}.png`,
          fullPage: true,
        });
      await page
        .getByRole("textbox", { name: "Correo electrónico", exact: true })
        .fill("prueba@example.test");
      await checkbox.check();
      await page
        .getByRole("button", { name: "Suscribirme", exact: true })
        .click();
      const code = page.getByLabel("Código de confirmación", { exact: true });
      await code.waitFor();
      assert.equal(status, "withdrawn");
      await code.fill("123456");
      await page
        .getByRole("button", { name: "Confirmar suscripción", exact: true })
        .click();
      await page
        .getByText("Suscripción confirmada.", { exact: true })
        .waitFor();
      assert.equal(status, "granted");
      await noOverflow();
      await page
        .getByRole("button", {
          name: "Dejar de recibir novedades",
          exact: true,
        })
        .click();
      await page
        .getByRole("button", { name: "Enviar código", exact: true })
        .click();
      await code.waitFor();
      assert.equal(status, "granted");
      await code.fill("123456");
      await page
        .getByRole("button", { name: "Confirmar retiro", exact: true })
        .click();
      await page.getByText("Retiro confirmado.", { exact: true }).waitFor();
      assert.equal(status, "withdrawn");
      await noOverflow();
      results.push(
        `${layout} ${width}px: autorización, confirmación y retiro sin desbordamiento`,
      );
      console.log("OK " + results.at(-1));
    }
  assert.deepEqual(errors, []);
  assert.equal(writes.length, 32);
  await fs.writeFile(
    `${artifacts}/results.json`,
    JSON.stringify({ results, errors, requests: writes.length }, null, 2),
  );
  console.log(
    `PASS ${results.length} recorridos Chromium. API controlada; sin correos ni registros reales.`,
  );
} catch (error) {
  if (page && !page.isClosed())
    await page
      .screenshot({ path: `${artifacts}/failure.png`, fullPage: true })
      .catch(() => {});
  throw error;
} finally {
  await browser?.close();
  await server.close();
  await fs.rm(entry, { force: true });
}
