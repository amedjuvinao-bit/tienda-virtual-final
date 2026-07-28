'use strict';

const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.join(__dirname, '..', '..', '..');

const BILLING_CONFIGURATION_FRONTEND_FILES = [
  'frontend/src/admin/configuracion/sections/FacturacionSection.jsx',
  'frontend/src/admin/configuracion/sections/facturacion/billingConfiguration.js',
  'frontend/src/admin/configuracion/sections/facturacion/billingConfigurationValidation.js',
  'frontend/src/admin/configuracion/sections/facturacion/useBillingConfiguration.js',
  'frontend/src/admin/configuracion/sections/facturacion/useBillingDraftHandlers.js',
  'frontend/src/admin/configuracion/sections/facturacion/useBillingWizardNavigation.js',
  'frontend/src/admin/configuracion/sections/facturacion/components/BillingConfigurationFeedback.jsx',
  'frontend/src/admin/configuracion/sections/facturacion/components/BillingWizardProgress.jsx',
  'frontend/src/admin/configuracion/sections/facturacion/components/BillingWizardStep.jsx',
  'frontend/src/admin/configuracion/sections/facturacion/components/BillingSummaryStep.jsx',
  'frontend/src/admin/configuracion/sections/facturacion/components/BillingWizardNavigation.jsx',
];

function readBillingConfigurationFrontendSource() {
  return BILLING_CONFIGURATION_FRONTEND_FILES
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
  BILLING_CONFIGURATION_FRONTEND_FILES,
  readBillingConfigurationFrontendSource,
};
