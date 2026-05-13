// backend/lib/dian/providers/siigoProvider.js

async function sendInvoiceToSiigo(invoiceData) {
  return {
    success: false,
    provider: 'siigo',
    status: 'not_implemented',
    message: 'Proveedor Siigo creado en la arquitectura, pero aún no está implementado.',
    receivedData: {
      orderNumber: invoiceData?.order?.orderNumber || '',
      hasXml: !!invoiceData?.xmlContent,
    },
  };
}

module.exports = {
  sendInvoiceToSiigo,
};