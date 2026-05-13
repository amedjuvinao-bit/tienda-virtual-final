// backend/lib/dian/providers/alegraProvider.js

async function sendInvoiceToAlegra(invoiceData) {
  return {
    success: false,
    provider: 'alegra',
    status: 'not_implemented',
    message: 'Proveedor Alegra creado en la arquitectura, pero aún no está implementado.',
    receivedData: {
      orderNumber: invoiceData?.order?.orderNumber || '',
      hasXml: !!invoiceData?.xmlContent,
    },
  };
}

module.exports = {
  sendInvoiceToAlegra,
};