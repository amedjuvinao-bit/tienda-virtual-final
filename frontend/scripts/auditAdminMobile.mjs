import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline/promises';
import { chromium } from 'playwright';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const baseUrl = process.env.ADMIN_AUDIT_URL || 'http://localhost:5173';
const output = resolve(root, 'responsive-audit');
const widths = [320, 340, 375, 430];
const source = await readFile(resolve(root, 'src/App.jsx'), 'utf8');
const routeNames = [...source.matchAll(/<Route path="([^"]+)" element=\{protectAdminContent\(/g)]
  .map((match) => match[1]);
const concreteRoutes = routeNames.filter((name) => !name.includes(':'));
const dynamicRoutes = routeNames.filter((name) => name.includes(':'));
const billingTabs = ['resumen', 'documentos', 'notas-credito', 'ordenes', 'reportes', 'configuracion'];
const routes = [...new Set([
  ...concreteRoutes.filter((name) => name !== 'facturacion/:tab'),
  ...billingTabs.map((tab) => `facturacion/${tab}`),
])];

const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[character]);
const slug = (value) => value.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '');

await mkdir(output, { recursive: true });

let browser;
let launchError;
for (const options of [{ channel: 'chrome' }, { channel: 'msedge' }, {}]) {
  try {
    browser = await chromium.launch({ headless: false, ...options });
    break;
  } catch (error) {
    launchError = error;
  }
}
if (!browser) {
  console.error('No se pudo abrir Chrome, Edge ni Chromium. Ejecuta una vez: node node_modules/playwright/cli.js install chromium');
  console.error(launchError?.message);
  process.exit(1);
}

const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await context.newPage();
const results = [];
const discovered = new Set();

try {
  await page.goto(`${baseUrl}/admin/login`, { waitUntil: 'domcontentloaded', timeout: 15000 });
  console.log('Inicia sesión en la ventana que se abrió. Mantén frontend y backend encendidos.');
  const prompt = createInterface({ input: process.stdin, output: process.stdout });
  await prompt.question('Cuando veas el panel, presiona Enter aquí para revisar todos los módulos: ');
  prompt.close();

  if (/\/admin\/(login|forgot-password|reset-password)/.test(new URL(page.url()).pathname)) {
    throw new Error('La sesión aún no está abierta. Inicia sesión antes de presionar Enter.');
  }

  for (let index = 0; index < routes.length; index += 1) {
    const name = routes[index];
    for (const width of widths) {
      await page.setViewportSize({ width, height: 800 });
      let failure = '';
      try {
        await page.goto(`${baseUrl}/admin/${name}`, { waitUntil: 'domcontentloaded', timeout: 15000 });
        await page.waitForTimeout(850);
      } catch (error) {
        failure = error.message;
      }

      const pathname = new URL(page.url()).pathname;
      if (/\/admin\/(login|forgot-password|reset-password)/.test(pathname)) {
        failure = 'Sesión cerrada o acceso no autorizado';
      } else if (!pathname.startsWith(`/admin/${name}`)) {
        failure = `Redirigido a ${pathname}`;
      }

      let measure = { pageWidth: width, elements: [] };
      if (!failure) {
        measure = await page.evaluate(() => {
          const pageWidth = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth);
          const elements = [...document.querySelectorAll('body *')]
            .filter((element) => {
              const box = element.getBoundingClientRect();
              const style = getComputedStyle(element);
              return box.width > 0 && box.height > 0 && style.visibility !== 'hidden'
                && style.position !== 'fixed' && style.position !== 'absolute'
                && (box.right > innerWidth + 2 || box.left < -2);
            })
            .slice(0, 12)
            .map((element) => ({
              tag: element.tagName.toLowerCase(),
              className: typeof element.className === 'string' ? element.className.slice(0, 90) : '',
              text: (element.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 75),
              right: Math.round(element.getBoundingClientRect().right),
            }));
          return { pageWidth, elements };
        });

        if (width === widths[0]) {
          const links = await page.locator('a[href^="/admin/"]').evaluateAll((anchors) => anchors.map((anchor) => anchor.getAttribute('href')));
          for (const link of links) {
            if (dynamicRoutes.some((pattern) => new RegExp(`^/admin/${pattern.replace(/:[^/]+/g, '[^/]+')}$`).test(link))) {
              discovered.add(link.slice('/admin/'.length));
            }
          }
        }
      }

      const image = `${slug(name)}-${width}.png`;
      try {
        await page.screenshot({ path: resolve(output, image), fullPage: true, timeout: 15000 });
      } catch {
        await page.screenshot({ path: resolve(output, image), timeout: 15000 }).catch(() => {});
      }
      results.push({ route: name, width, pathname, ...measure, image, failure });
      console.log(`${results.length}: ${name} · ${width}px · ${failure || (measure.pageWidth > width + 2 ? `DESBORDA ${measure.pageWidth}px` : 'sin desbordamiento de página')}`);
    }
    if (index === concreteRoutes.length - 1 && discovered.size) routes.push(...discovered);
  }

  const report = {
    baseUrl, date: new Date().toISOString(), widths, routesChecked: routes,
    dynamicRoutesWithoutLink: dynamicRoutes.filter((pattern) => ![...discovered].some((route) =>
      new RegExp(`^${pattern.replace(/:[^/]+/g, '[^/]+')}$`).test(route))),
    note: 'Revisión de páginas y desplazamiento horizontal. No abre modales ni realiza operaciones de escritura.',
    results,
  };
  await writeFile(resolve(output, 'report.json'), JSON.stringify(report, null, 2));
  const rows = results.map((item) => `<tr><td>${escapeHtml(item.route)}</td><td>${item.width}</td><td>${escapeHtml(item.failure || (item.pageWidth > item.width + 2 ? `Desborda hasta ${item.pageWidth}px` : 'Sin desbordamiento de página'))}</td><td>${escapeHtml(item.elements.map((element) => `${element.tag}.${element.className} (${element.right}px)`).join(' · '))}</td><td><a href="${escapeHtml(item.image)}">Captura</a></td></tr>`).join('\n');
  await writeFile(resolve(output, 'index.html'), `<!doctype html><html lang="es"><meta charset="utf-8"><title>Auditoría móvil del panel</title><style>body{font:14px system-ui;padding:24px}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ddd;padding:8px;text-align:left;vertical-align:top}tr:nth-child(even){background:#f5f5f5}td:nth-child(4){max-width:420px;overflow-wrap:anywhere}</style><h1>Auditoría móvil del panel</h1><p>${escapeHtml(report.date)} · ${results.length} vistas · anchos ${widths.join(', ')} px</p><p>Las rutas con identificador sin enlace detectable: ${escapeHtml(report.dynamicRoutesWithoutLink.join(', ') || 'ninguna')}. Los modales requieren revisión manual.</p><table><thead><tr><th>Ruta</th><th>Ancho</th><th>Estado</th><th>Elementos fuera de pantalla</th><th>Imagen</th></tr></thead><tbody>${rows}</tbody></table></html>`);
  if (process.platform === 'win32') {
    try {
      execFileSync('powershell.exe', ['-NoProfile', '-Command', `Compress-Archive -Path '${output.replaceAll("'", "''")}\\*' -DestinationPath '${output.replaceAll("'", "''")}.zip' -Force`]);
      console.log(`ZIP para compartir: ${output}.zip`);
    } catch { console.log(`Informe y capturas: ${output}`); }
  } else {
    console.log(`Informe y capturas: ${output}`);
  }
} finally {
  await browser.close();
}
