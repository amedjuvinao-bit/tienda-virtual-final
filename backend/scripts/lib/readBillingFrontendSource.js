'use strict';

const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.join(__dirname, '..', '..', '..');

const BILLING_FRONTEND_FILES = [
  'frontend/src/admin/billing/AdminBillingPage.jsx',
  'frontend/src/admin/billing/billingConstants.js',
  'frontend/src/admin/billing/billingFormatters.js',
  'frontend/src/admin/billing/buildInvoiceModalData.js',
  'frontend/src/admin/billing/components/BillingUi.jsx',
  'frontend/src/admin/billing/panels/BillingSummaryPanel.jsx',
  'frontend/src/admin/billing/panels/BillingDocumentsPanel.jsx',
  'frontend/src/admin/billing/panels/BillingCreditNotesPanel.jsx',
  'frontend/src/admin/billing/panels/BillingPendingOrdersPanel.jsx',
  'frontend/src/admin/billing/panels/BillingReportsPanel.jsx',
];

function readBillingFrontendSource() {
  return BILLING_FRONTEND_FILES
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
  BILLING_FRONTEND_FILES,
  readBillingFrontendSource,
};
