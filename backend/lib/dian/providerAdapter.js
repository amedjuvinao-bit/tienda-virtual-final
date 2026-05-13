// backend/lib/dian/providerAdapter.js

const { sendInvoiceToFactus } = require('./providers/factusProvider');
const { sendInvoiceDirectToDIAN } = require('./providers/dianDirectProvider');
const { sendInvoiceToCarvajal } = require('./providers/carvajalProvider');
const { sendInvoiceToSiigo } = require('./providers/siigoProvider');
const { sendInvoiceToAlegra } = require('./providers/alegraProvider');

async function sendElectronicInvoiceToProvider({ provider, invoiceData }) {
  const selectedProvider = String(provider || '').trim().toLowerCase();

  if (selectedProvider === 'factus') {
    return sendInvoiceToFactus(invoiceData);
  }

  if (selectedProvider === 'dian') {
    return sendInvoiceDirectToDIAN(invoiceData);
  }

  if (selectedProvider === 'carvajal') {
    return sendInvoiceToCarvajal(invoiceData);
  }

  if (selectedProvider === 'siigo') {
    return sendInvoiceToSiigo(invoiceData);
  }

  if (selectedProvider === 'alegra') {
    return sendInvoiceToAlegra(invoiceData);
  }

  return {
    success: false,
    provider: selectedProvider || 'vacío',
    status: 'unsupported_provider',
    error: `Proveedor DIAN no soportado: ${selectedProvider || 'vacío'}`,
  };
}

module.exports = {
  sendElectronicInvoiceToProvider,
};