'use strict';

function requireFunction(value, name) {
  if (typeof value !== 'function') {
    throw new TypeError(`PAYMENT_FISCAL_DEPENDENCY_REQUIRED:${name}`);
  }
  return value;
}

function createPaymentFiscalAdminController({
  OrderModel,
  OrderEventModel,
  ElectronicInvoiceModel,
  authorizeOrderAdminScope,
  getSiteSettingsDoc,
  deleteFactusBillByReference,
  getFactusCredentials,
  getFactusAccessToken,
  createOfficialCreditNote,
  linkRefundCreditNote,
  issueElectronicInvoiceForOrder,
  trimSafe,
  logger = console,
} = {}) {
  if (!OrderModel || !OrderEventModel || !ElectronicInvoiceModel) {
    throw new TypeError('PAYMENT_FISCAL_MODELS_REQUIRED');
  }

  const authorizeScope = requireFunction(
    authorizeOrderAdminScope,
    'authorizeOrderAdminScope'
  );
  const loadSettings = requireFunction(getSiteSettingsDoc, 'getSiteSettingsDoc');
  const deleteFactusBill = requireFunction(
    deleteFactusBillByReference,
    'deleteFactusBillByReference'
  );
  const resolveFactusCredentials = requireFunction(
    getFactusCredentials,
    'getFactusCredentials'
  );
  const requestFactusToken = requireFunction(
    getFactusAccessToken,
    'getFactusAccessToken'
  );
  const createCreditNote = requireFunction(
    createOfficialCreditNote,
    'createOfficialCreditNote'
  );
  const linkCreditNote = requireFunction(
    linkRefundCreditNote,
    'linkRefundCreditNote'
  );
  const issueInvoice = requireFunction(
    issueElectronicInvoiceForOrder,
    'issueElectronicInvoiceForOrder'
  );
  const clean = requireFunction(trimSafe, 'trimSafe');
  const fiscalOrderAccess = Object.freeze({
    requiredCapability: 'canInvoice',
    requireWholeOrder: true,
  });

  async function requireAuthorizedOrderScope(req, res, orderId) {
    const access = await authorizeScope(
      req,
      orderId,
      OrderModel,
      fiscalOrderAccess
    );

    if (access.ok) return true;

    res.status(access.status || 403).json({
      success: false,
      error: access.error || 'ORDER_BRANCH_ACCESS_DENIED',
      message:
        access.message || 'No tienes permiso para operar órdenes de esta sede.',
    });
    return false;
  }

  async function deleteFactusInvoice(req, res) {
    try {
      const orderId = clean(req.params.orderId, 100);

      if (!orderId) {
        return res.status(400).json({
          success: false,
          error: 'ORDER_ID_REQUIRED',
          message: 'No se recibió el ID de la orden.',
        });
      }

      if (!(await requireAuthorizedOrderScope(req, res, orderId))) return;

      const invoice = await ElectronicInvoiceModel.findOne({ orderId }).lean();

      if (!invoice) {
        return res.status(404).json({
          success: false,
          error: 'INVOICE_NOT_FOUND',
          message: 'No se encontró factura electrónica para esta orden.',
        });
      }

      if (
        invoice.status === 'accepted' ||
        invoice?.provider?.isValidated === true ||
        invoice?.provider?.raw?.is_validated === true
      ) {
        return res.status(409).json({
          success: false,
          error: 'INVOICE_ALREADY_VALIDATED',
          message: 'La factura ya está validada y no se puede eliminar en Factus.',
        });
      }

      const settingsDoc = await loadSettings();
      const electronicProvider = settingsDoc?.billing?.electronicProvider || {};

      const referenceCode =
        invoice?.provider?.referenceCode ||
        invoice?.provider?.raw?.reference_code ||
        invoice?.orderNumber ||
        '';

      const credentials = resolveFactusCredentials({
        providerConfig: electronicProvider,
      });

      const tokenResult = await requestFactusToken(credentials);

      if (!tokenResult.success) {
        return res.status(500).json({
          success: false,
          error: 'FACTUS_AUTH_ERROR',
          message: 'No se pudo autenticar con Factus.',
          detail: tokenResult.error || tokenResult.raw || null,
        });
      }

      const deleteResult = await deleteFactusBill({
        credentials,
        tokenResult,
        referenceCode,
      });

      logger.log(
        '🧹 DELETE FACTUS RESULT:',
        JSON.stringify(deleteResult, null, 2)
      );

      const deleteMessage = String(
        deleteResult?.error || deleteResult?.data?.message || ''
      ).toLowerCase();

      const factusDocumentNotFound =
        Number(deleteResult?.status) === 404 ||
        deleteMessage.includes('no se encontró') ||
        deleteMessage.includes('no se encontro') ||
        deleteMessage.includes('documento con código de referencia') ||
        deleteMessage.includes('codigo de referencia') ||
        deleteMessage.includes('not found');

      const deleteSucceeded = deleteResult.success || factusDocumentNotFound;

      await ElectronicInvoiceModel.findOneAndUpdate(
        { orderId },
        {
          $set: {
            status: deleteResult.success ? 'pending' : 'failed',
            errorMessage: deleteResult.success
              ? ''
              : String(deleteResult.error || 'No se pudo eliminar en Factus.'),
            'dianResponse.stage': 'manual_delete_from_admin',
            'dianResponse.message': deleteResult.success
              ? 'Factura no validada eliminada en Factus.'
              : String(
                  deleteResult.error || 'Error eliminando factura en Factus.'
                ),
            'dianResponse.raw': deleteResult,
          },
        },
        { new: true }
      );

      await OrderEventModel.create({
        orderId,
        type: 'electronic_invoice_deleted',
        message: deleteResult.success
          ? 'Factura no validada eliminada en Factus desde el panel admin.'
          : 'Intento fallido de eliminación de factura en Factus.',
        meta: {
          provider: 'factus',
          referenceCode,
          success: deleteSucceeded,
          status: deleteResult.status,
          by: req.adminUsername || req.adminUserId || 'admin',
        },
      });

      return res.json({
        success: deleteSucceeded,
        referenceCode,
        deleteResult,
      });
    } catch (error) {
      logger.error('❌ DELETE FACTUS INVOICE ERROR:', error);

      return res.status(500).json({
        success: false,
        error: 'DELETE_FACTUS_INVOICE_ERROR',
        message: error.message || 'No se pudo eliminar la factura en Factus.',
      });
    }
  }

  async function createCreditNoteForOrder(req, res) {
    try {
      if (!(await requireAuthorizedOrderScope(req, res, req.params.orderId))) {
        return;
      }

      const invoice = await ElectronicInvoiceModel.findOne({
        orderId: req.params.orderId,
      });
      if (!invoice) {
        return res.status(404).json({
          success: false,
          error: 'BILLING_INVOICE_NOT_FOUND',
          message: 'Factura electrónica no encontrada.',
        });
      }

      const result = await createCreditNote(invoice._id, req.body || {}, {
        adminUser: req.adminUsername || req.adminUserId || 'admin',
      });

      let refundReconciliation = null;
      let reconciliationWarning = null;
      if (req.body?.refundId) {
        try {
          refundReconciliation = await linkCreditNote({
            orderId: req.params.orderId,
            refundId: req.body.refundId,
            invoice: result.invoice,
            creditNote: result.creditNote,
            adminLabel: req.adminUsername || req.adminUserId || 'admin',
          });
        } catch (reconciliationError) {
          reconciliationWarning = {
            error:
              reconciliationError?.code ||
              'REFUND_CREDIT_NOTE_RECONCILIATION_PENDING',
            message:
              reconciliationError?.message ||
              'La nota fue procesada, pero falta vincularla al reembolso.',
          };
        }
      }

      return res
        .status(reconciliationWarning ? 202 : result.created ? 201 : 200)
        .json({
          success: true,
          created: result.created,
          reused: result.reused,
          message: result.message,
          invoice: result.invoice,
          refundReconciliation,
          reconciliationWarning,
        });
    } catch (error) {
      return res.status(Number(error?.status || 500)).json({
        success: false,
        error: error?.code || 'BILLING_CREDIT_NOTE_ERROR',
        message: error?.message || 'Error interno creando nota crédito.',
      });
    }
  }

  async function retryElectronicInvoice(req, res) {
    try {
      const orderId = clean(req.params.orderId, 100);

      if (!orderId) {
        return res.status(400).json({
          success: false,
          error: 'ORDER_ID_REQUIRED',
        });
      }

      if (!(await requireAuthorizedOrderScope(req, res, orderId))) return;

      const result = await issueInvoice({
        orderId,
        source: 'admin-retry',
        initiatedBy: req.adminUsername || req.adminUserId || 'admin',
        skipWhenElectronicBillingIsInactive: true,
        allowRetry: true,
      });

      if (!result.retried) {
        return res.status(409).json({
          success: false,
          error: result.inProgress
            ? 'BILLING_EMISSION_IN_PROGRESS'
            : 'BILLING_RETRY_NOT_ALLOWED',
          message: result.message,
          invoice: result.invoice || null,
        });
      }

      const updatedInvoice = result.invoice;
      const nextStatus = updatedInvoice?.status || 'sent';
      const providerInvoiceNumber =
        updatedInvoice?.provider?.number || updatedInvoice?.invoiceNumber || '';
      const providerCufe =
        updatedInvoice?.provider?.cufe || updatedInvoice?.cufe || '';

      await OrderEventModel.create({
        orderId,
        type: 'electronic_invoice_retry',
        message: 'Factura electrónica reenviada al proveedor desde el panel admin.',
        meta: {
          provider: updatedInvoice?.provider?.name || '',
          status: nextStatus,
          providerSuccess: true,
          invoiceNumber: providerInvoiceNumber,
          cufe: providerCufe,
          by: req.adminUsername || req.adminUserId || 'admin',
        },
      });

      return res.json({
        success: true,
        status: nextStatus,
        invoice: updatedInvoice,
        message: result.message,
      });
    } catch (error) {
      logger.error('❌ RETRY ELECTRONIC INVOICE ERROR:', error);

      return res.status(Number(error.status || 500)).json({
        success: false,
        error: error.message,
        code: error.code || 'BILLING_RETRY_ERROR',
        invoice: error.invoice || null,
      });
    }
  }

  return Object.freeze({
    createCreditNoteForOrder,
    deleteFactusInvoice,
    retryElectronicInvoice,
  });
}

module.exports = {
  createPaymentFiscalAdminController,
};
