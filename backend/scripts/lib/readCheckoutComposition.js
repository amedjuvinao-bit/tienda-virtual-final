'use strict';

const fs = require('node:fs');
const path = require('node:path');

const PROJECT_ROOT = path.resolve(__dirname, '..', '..', '..');
const CHECKOUT_ENTRY = 'frontend/src/pages/CheckoutPage.jsx';
const CHECKOUT_MODULE_ROOT = 'frontend/src/checkout/page';

function walkSourceFiles(relativeRoot) {
  const absoluteRoot = path.join(PROJECT_ROOT, relativeRoot);
  if (!fs.existsSync(absoluteRoot)) return [];

  return fs
    .readdirSync(absoluteRoot, { withFileTypes: true })
    .flatMap((entry) => {
      const relativePath = path.posix.join(relativeRoot, entry.name);
      if (entry.isDirectory()) return walkSourceFiles(relativePath);
      return /\.(?:js|jsx)$/.test(entry.name) && !/\.test\.(?:js|jsx)$/.test(entry.name)
        ? [relativePath]
        : [];
    })
    .sort();
}

function readSource(relativePath) {
  return fs.readFileSync(path.join(PROJECT_ROOT, relativePath), 'utf8');
}

function checkoutCompositionFiles() {
  return [CHECKOUT_ENTRY, ...walkSourceFiles(CHECKOUT_MODULE_ROOT)];
}

function readCheckoutComposition() {
  return checkoutCompositionFiles()
    .map((relativePath) => `// ${relativePath}\n${readSource(relativePath)}`)
    .join('\n');
}

module.exports = {
  checkoutCompositionFiles,
  readCheckoutComposition,
};
