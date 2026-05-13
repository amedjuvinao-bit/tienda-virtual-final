// backend/lib/dian/factusDownloads.js

function extractFactusLinks(invoice = {}) {
  return {
    pdfUrl:
      invoice?.provider?.links?.public_url ||
      '',

    qrUrl:
      invoice?.provider?.links?.qr ||
      '',

    cufe:
      invoice?.provider?.cufe ||
      invoice?.cufe ||
      '',

    invoiceNumber:
      invoice?.invoiceNumber ||
      invoice?.provider?.number ||
      '',
  };
}

module.exports = {
  extractFactusLinks,
};