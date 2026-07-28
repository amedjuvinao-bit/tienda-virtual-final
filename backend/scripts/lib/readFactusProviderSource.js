'use strict';

const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.join(__dirname, '..', '..', '..');

const FACTUS_PROVIDER_FILES = [
  'backend/lib/dian/providers/factusProvider.js',
  'backend/lib/dian/providers/factus/factusProviderShared.js',
  'backend/lib/dian/providers/factus/factusAuth.js',
  'backend/lib/dian/providers/factus/factusPayloads.js',
  'backend/lib/dian/providers/factus/factusInvoiceService.js',
  'backend/lib/dian/providers/factus/factusCreditNoteService.js',
  'backend/lib/dian/providers/factus/factusDocuments.js',
];

function readFactusProviderSource() {
  return FACTUS_PROVIDER_FILES
    .map((relativePath) => {
      const fullPath = path.join(PROJECT_ROOT, relativePath);
      if (!fs.existsSync(fullPath)) {
        throw new Error(`No existe ${relativePath}`);
      }
      return fs.readFileSync(fullPath, 'utf8');
    })
    .join('\n');
}

module.exports = {
  FACTUS_PROVIDER_FILES,
  readFactusProviderSource,
};
