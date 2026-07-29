'use strict';

const {
  clearFactusTokenCache,
  getFactusAccessToken,
  getFactusCredentials,
} = require('./factus/factusAuth');
const {
  postFactusCreditNoteValidate,
  sendCreditNoteToFactus,
} = require('./factus/factusCreditNoteService');
const {
  decodeFactusBase64Document,
  downloadCreditNoteDocumentFromFactus,
  downloadInvoiceDocumentFromFactus,
  extractFactusDownloadPayload,
  getCreditNoteFromFactus,
  getInvoiceFromFactus,
} = require('./factus/factusDocuments');
const {
  deleteFactusBillByReference,
  sendInvoiceToFactus,
} = require('./factus/factusInvoiceService');
const {
  buildFactusCreditNotePayload,
  buildFactusCustomer,
  buildFactusInvoicePayload,
} = require('./factus/factusPayloads');

module.exports = {
  sendInvoiceToFactus,
  sendCreditNoteToFactus,
  getInvoiceFromFactus,
  getCreditNoteFromFactus,
  deleteFactusBillByReference,
  getFactusCredentials,
  getFactusAccessToken,
  clearFactusTokenCache,
  downloadInvoiceDocumentFromFactus,
  downloadCreditNoteDocumentFromFactus,
  extractFactusDownloadPayload,
  decodeFactusBase64Document,
  postFactusCreditNoteValidate,
  buildFactusCustomer,
  buildFactusInvoicePayload,
  buildFactusCreditNotePayload,
};
