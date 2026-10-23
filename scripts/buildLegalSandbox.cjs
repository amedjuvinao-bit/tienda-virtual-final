#!/usr/bin/env node
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const source = path.join(root, 'docs/legal-sandbox');
const args = process.argv.slice(2);
function option(name, fallback) { const i = args.indexOf(name); return i < 0 ? fallback : args[i + 1] || ''; }
const out = path.resolve(root, option('--out', 'frontend/public/legal'));
const site = JSON.parse(fs.readFileSync(path.join(source, 'site.json'), 'utf8'));
const content = JSON.parse(fs.readFileSync(path.join(source, 'content.json'), 'utf8'));
site.siteUrl = option('--site-url', site.siteUrl);
const escape = text => String(text).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function https(value) { const u = new URL(value); if (u.protocol !== 'https:' || u.username || u.password || u.search || u.hash) throw new Error('Use an absolute HTTPS URL without credentials, query or fragment.'); return u.href; }
site.siteUrl = https(site.siteUrl).replace(/\/?$/, '/');
site.contactUrl = https(site.contactUrl); site.repositoryUrl = https(site.repositoryUrl);
if (!site.name || !site.operator || !site.contactLabel || !site.contactDisplay || !/^\d{4}-\d{2}-\d{2}$/.test(site.updatedAt) || !Number.isFinite(Date.parse(site.updatedAt))) throw new Error('Missing legal site identity, contact or revision date.');
for (const key of ['terms', 'privacy']) {
  const page = content[key];
  if (page?.file !== (key === 'terms' ? 'terminos.html' : 'privacidad.html') || !page.title || !page.summary || !Array.isArray(page.sections) || !page.sections.length) throw new Error('Invalid legal document.');
  for (const section of page.sections) if (!section.title || ![...(section.paragraphs || []), ...(section.items || [])].every(value => typeof value === 'string' && value.trim())) throw new Error('Invalid document section.');
}
const date = new Intl.DateTimeFormat('es-CO', { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(`${site.updatedAt}T00:00:00Z`));
const pages = [content.terms, content.privacy];
const contact = `<aside class="contact" id="contacto" aria-labelledby="contact-title"><h2 id="contact-title">Contacto y administración</h2><p>${escape(site.operator)}</p><a class="contact-link" href="${escape(site.contactUrl)}" rel="noopener noreferrer">${escape(site.contactLabel)} · ${escape(site.contactDisplay)}</a><p>Canal de contacto publicado por la tienda. No envíes contraseñas, tokens ni códigos de acceso.</p></aside>`;
function layout({ file, title, summary, body }) {
  const nav = [['index.html', 'Proyecto'], ['terminos.html', 'Términos'], ['privacidad.html', 'Privacidad']].map(([href, label]) => `<a href="${href}"${href === file ? ' aria-current="page"' : ''}>${label}</a>`).join('');
  return `<!doctype html>\n<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="description" content="${escape(summary)}"><meta name="robots" content="noindex,follow"><meta name="referrer" content="strict-origin-when-cross-origin"><title>${escape(title)} · ${escape(site.name)}</title><link rel="canonical" href="${escape(new URL(file === 'index.html' ? './' : file, site.siteUrl).href)}"><link rel="stylesheet" href="styles.css"></head><body><a class="skip" href="#contenido">Saltar al contenido</a><div class="shell"><header class="top"><a class="brand" href="index.html">${escape(site.name)}</a><nav aria-label="Documentación legal">${nav}</nav></header><main id="contenido"><header class="hero"><p class="eyebrow">Documentación del proyecto</p><h1>${escape(title)}</h1><p class="lead">${escape(summary)}</p><div class="meta"><span class="badge">Entorno de desarrollo</span><span>Actualizado el <time datetime="${site.updatedAt}">${escape(date)}</time></span></div></header>${body}${contact}</main><footer class="footer"><p>${escape(site.name)} · Documentación para pruebas de integración.</p><a href="${escape(site.repositoryUrl)}" rel="noopener noreferrer">Repositorio del proyecto ↗</a></footer></div></body></html>\n`;
}
const files = {};
files['index.html'] = layout({ file: 'index.html', title: 'Una conexión clara. Tus datos, bajo control.', summary: site.description,
  body: `<p class="notice"><strong>Información para el desarrollo de la tienda.</strong> Esta documentación explica las condiciones de prueba y el tratamiento de datos al autorizar TikTok. Estas páginas no reciben pagos ni permiten realizar compras.</p><div class="grid">${pages.map((page, i) => `<a class="card" href="${page.file}"><span class="num">0${i + 1}</span><h2>${escape(page.title)}</h2><p>${escape(page.summary)}</p><span class="open">Leer documento →</span></a>`).join('')}</div>` });
for (const page of pages) {
  const links = page.sections.map((section, i) => `<a href="#seccion-${i + 1}">${escape(section.title)}</a>`).join('');
  const toc = `<h2>En este documento</h2>${links}`;
  const sections = page.sections.map((section, i) => `<section id="seccion-${i + 1}" aria-labelledby="titulo-${i + 1}"><h2 id="titulo-${i + 1}">${escape(section.title)}</h2>${(section.paragraphs || []).map(p => `<p>${escape(p)}</p>`).join('')}${section.items?.length ? `<ul>${section.items.map(item => `<li>${escape(item)}</li>`).join('')}</ul>` : ''}</section>`).join('');
  files[page.file] = layout({ ...page, body: `<p class="notice">Versión para el <strong>entorno de desarrollo</strong>. Puedes consultar también ${page.file === 'terminos.html' ? '<a href="privacidad.html">la política de privacidad</a>' : '<a href="terminos.html">los términos del servicio</a>'}.</p><details class="mobile-toc"><summary>Ver contenido del documento</summary><nav class="toc" aria-label="Índice del documento">${toc}</nav></details><div class="layout"><nav class="toc" aria-label="Índice del documento">${toc}</nav><article class="paper">${sections}</article></div>` });
}
files['styles.css'] = fs.readFileSync(path.join(source, 'styles.css'), 'utf8');
files['.nojekyll'] = '';
fs.mkdirSync(out, { recursive: true });
for (const [file, value] of Object.entries(files)) fs.writeFileSync(path.join(out, file), value);
console.log(`Generated ${Object.keys(files).length} static legal files in ${path.relative(root, out) || '.'}`);
