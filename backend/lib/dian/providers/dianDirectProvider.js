// backend/lib/dian/providers/dianDirectProvider.js

async function sendInvoiceDirectToDIAN(invoiceData) {
  return {
    success: false,
    provider: 'dian',
    status: 'not_implemented',
    message:
      'Integración directa con DIAN preparada en arquitectura, pero aún no implementada.',
    receivedData: {
      orderNumber: invoiceData?.order?.orderNumber || '',
      hasXml: !!invoiceData?.xmlContent,
    },
  };
}

module.exports = {
  sendInvoiceDirectToDIAN,
};