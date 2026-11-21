import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const fonts = path.join(root, 'public/fonts');
const manifest = JSON.parse(fs.readFileSync(path.join(fonts, 'local/manifest.json')));
const css = fs.readFileSync(path.join(fonts, 'storefront-fonts.css'), 'utf8');
const hash = content => createHash('sha256').update(content).digest('hex');
const files = new Set();
assert.equal(manifest.length, 21);
assert(!/https?:\/\//.test(css), 'The font stylesheet must not contact external servers');
for (const family of manifest) {
  const license = fs.readFileSync(path.join(fonts, 'local', family.license));
  assert(license.includes('SIL OPEN FONT LICENSE'));
  assert.equal(hash(license), family.licenseSha256);
  assert(css.includes(`font-family: '${family.family}'`));
  for (const face of family.faces) {
    const bytes = fs.readFileSync(path.join(fonts, 'local', face.file));
    assert.equal(bytes.subarray(0, 4).toString(), 'wOF2');
    assert.equal(hash(bytes), face.sha256);
    assert(css.includes(`/fonts/local/${face.file}`));
    files.add(face.file);
  }
}
for (const filename of ['index.html', 'page-preview.html', 'src/Index.html', 'src/components/catalog/catalogPage.css', 'src/components/product-detail/productDetail.css', 'src/admin/appearance/sections/sectionEditorModel.js']) {
  const source = fs.readFileSync(path.join(root, filename), 'utf8');
  assert(!/fonts\.(googleapis|gstatic)\.com/.test(source), filename);
  assert(source.includes('/fonts/storefront-fonts.css'), filename);
}
console.log(`PASS: ${manifest.length} families, ${files.size} WOFF2 files, licenses, hashes and local entry points.`);
