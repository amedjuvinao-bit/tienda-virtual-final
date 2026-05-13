// backend/lib/dian/providers/carvajalProvider.js

async function sendInvoiceToCarvajal(invoiceData) {
  return {
    success: false,
    provider: 'carvajal',
    status: 'not_implemented',
    message: 'Proveedor Carvajal creado en la arquitectura, pero aún no está implementado.',
    receivedData: {
      orderNumber: invoiceData?.order?.orderNumber || '',
      hasXml: !!invoiceData?.xmlContent,
    },
  };
}

module.exports = {
  sendInvoiceToCarvajal,
};