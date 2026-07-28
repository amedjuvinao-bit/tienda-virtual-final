'use strict';

const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.join(__dirname, '..', '..', '..');

const ELECTRONIC_INVOICE_MODAL_FRONTEND_FILES = [
  'frontend/src/admin/orders/electronicInvoice/ElectronicInvoiceModal.jsx',
  'frontend/src/admin/orders/electronicInvoice/modal/electronicInvoiceModalUtils.js',
  'frontend/src/admin/orders/electronicInvoice/modal/useElectronicInvoiceModal.js',
  'frontend/src/admin/orders/electronicInvoice/modal/ElectronicInvoiceModalHeader.jsx',
  'frontend/src/admin/orders/electronicInvoice/modal/ElectronicInvoiceModalFeedback.jsx',
  'frontend/src/admin/orders/electronicInvoice/modal/CreditNoteForm.jsx',
  'frontend/src/admin/orders/electronicInvoice/modal/ElectronicInvoiceModalTabs.jsx',
  'frontend/src/admin/orders/electronicInvoice/modal/ElectronicInvoiceModalContent.jsx',
  'frontend/src/admin/orders/electronicInvoice/modal/InvoiceCreditNotesTab.jsx',
];

function readElectronicInvoiceModalFrontendSource() {
  return ELECTRONIC_INVOICE_MODAL_FRONTEND_FILES.map((relativePath) => {
    const fullPath = path.join(PROJECT_ROOT, relativePath);
    if (!fs.existsSync(fullPath)) {
      throw new Error(`No existe ${relativePath}`);
    }
    return fs.readFileSync(fullPath, 'utf8');
  }).join('\n');
}

module.exports = {
  ELECTRONIC_INVOICE_MODAL_FRONTEND_FILES,
  readElectronicInvoiceModalFrontendSource,
};
