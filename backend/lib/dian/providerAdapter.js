// backend/lib/dian/providerAdapter.js

const {
  sendInvoiceToFactus,
} = require('./providers/factusRangeAwareProvider');
const {
  BillingConfigurationError,
  buildRuntimeFactusConfig,
  hasLegacyPlaintextBillingSecrets,
  SUPPORTED_EXTERNAL_PROVIDER,
} = require('../billing/billingConfigurationSecurity');

async function sendElectronicInvoiceToProvider({ provider, invoiceData }) {
  const selectedProvider = String(provider || '').trim().toLowerCase();

  if (selectedProvider !== SUPPORTED_EXTERNAL_PROVIDER) {
    return {
      success: false,
      provider: selectedProvider || 'vacío',
      status: 422,
      stage: 'provider_selection',
      error: `Proveedor de facturación no habilitado: ${selectedProvider || 'vacío'}.`,
    };
  }

  try {
    const billing = invoiceData?.settings?.billing || {};

    if (hasLegacyPlaintextBillingSecrets(billing)) {
      throw new BillingConfigurationError(
        'Las credenciales de facturación deben migrarse al almacenamiento cifrado antes de emitir.',
        'BILLING_CREDENTIALS_MIGRATION_REQUIRED',
        503
      );
    }

    const runtimeProviderConfig = buildRuntimeFactusConfig(billing);

    return sendInvoiceToFactus({
      ...(invoiceData || {}),
      provider: SUPPORTED_EXTERNAL_PROVIDER,
      providerConfig: runtimeProviderConfig,
    });
  } catch (error) {
    return {
      success: false,
      provider: SUPPORTED_EXTERNAL_PROVIDER,
      status: Number(error?.status || 422),
      stage: 'secure_configuration',
      error:
        error instanceof BillingConfigurationError
          ? error.message
          : 'La configuración segura de Factus no está disponible.',
    };
  }
}

module.exports = {
  sendElectronicInvoiceToProvider,
};
