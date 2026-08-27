'use strict';

const {
  extractAcceptanceInfo,
} = require('../services/wompiPublicGatewayService');

function requireDependency(value, name) {
  if (typeof value !== 'function') {
    throw new TypeError(`PAYMENT_PUBLIC_DEPENDENCY_REQUIRED:${name}`);
  }
  return value;
}

function createPaymentPublicController({
  OrderModel,
  getActivePaymentsConfig,
  trimSafe,
  resolveWompiBaseUrl,
  buildWompiReference,
  amountToCents,
  buildRedirectUrl,
  buildIntegritySignature,
  fingerprintPaymentMerchant,
  parseWompiTransactionStatus,
  publicPaymentAccessService,
  paymentAttemptService,
  wompiGatewayService,
  logger = console,
} = {}) {
  if (!OrderModel) {
    throw new TypeError('PAYMENT_PUBLIC_DEPENDENCY_REQUIRED:OrderModel');
  }

  const loadPayments = requireDependency(
    getActivePaymentsConfig,
    'getActivePaymentsConfig'
  );
  const sanitize = requireDependency(trimSafe, 'trimSafe');
  const wompiBaseUrl = requireDependency(
    resolveWompiBaseUrl,
    'resolveWompiBaseUrl'
  );
  const wompiReference = requireDependency(
    buildWompiReference,
    'buildWompiReference'
  );
  const toCents = requireDependency(amountToCents, 'amountToCents');
  const redirectUrlFor = requireDependency(buildRedirectUrl, 'buildRedirectUrl');
  const integritySignature = requireDependency(
    buildIntegritySignature,
    'buildIntegritySignature'
  );
  const merchantFingerprintFor = requireDependency(
    fingerprintPaymentMerchant,
    'fingerprintPaymentMerchant'
  );
  const mapTransactionStatus = requireDependency(
    parseWompiTransactionStatus,
    'parseWompiTransactionStatus'
  );

  const {
    SAFE_PAYMENT_ACCESS_ERROR,
    buildPublicCheckoutResponse,
    buildPublicTransactionResponse,
    isValidObjectIdText,
    isValidTransactionId,
    isWompiTransactionOwnedByOrder,
    resolveAuthorizedPublicPaymentOrder,
  } = publicPaymentAccessService || {};

  [
    ['buildPublicCheckoutResponse', buildPublicCheckoutResponse],
    ['buildPublicTransactionResponse', buildPublicTransactionResponse],
    ['isValidObjectIdText', isValidObjectIdText],
    ['isValidTransactionId', isValidTransactionId],
    ['isWompiTransactionOwnedByOrder', isWompiTransactionOwnedByOrder],
    [
      'resolveAuthorizedPublicPaymentOrder',
      resolveAuthorizedPublicPaymentOrder,
    ],
  ].forEach(([name, dependency]) => requireDependency(dependency, name));

  const fetchMerchantData = requireDependency(
    wompiGatewayService?.fetchMerchantData,
    'wompiGatewayService.fetchMerchantData'
  );
  const fetchTransactionById = requireDependency(
    wompiGatewayService?.fetchTransactionById,
    'wompiGatewayService.fetchTransactionById'
  );
  const issuePaymentAttempt = requireDependency(
    paymentAttemptService?.issueAttempt,
    'paymentAttemptService.issueAttempt'
  );
  const findPaymentAttempt = requireDependency(
    paymentAttemptService?.findAttempt,
    'paymentAttemptService.findAttempt'
  );

  async function getPublicConfig(_req, res) {
    try {
      const payments = await loadPayments();

      return res.json({
        active: payments.active,
        provider: payments.provider,
        mode: payments.mode,
        currency: payments.currency,
        checkoutLabel: payments.checkoutLabel,
        successMessage: payments.successMessage,
        enableWebhook: payments.enableWebhook,
      });
    } catch (error) {
      logger.error('GET /payments/public-config', error);
      return res
        .status(500)
        .json({ error: 'No se pudo cargar la configuración pública de pagos' });
    }
  }

  async function createWompiCheckoutData(req, res) {
    try {
      const orderId = sanitize(req.body?.orderId, 100);
      if (!isValidObjectIdText(orderId)) {
        return res.status(404).json(SAFE_PAYMENT_ACCESS_ERROR);
      }
      const access = await resolveAuthorizedPublicPaymentOrder({
        req,
        OrderModel,
        orderId,
      });
      if (!access.allowed) {
        return res.status(404).json(SAFE_PAYMENT_ACCESS_ERROR);
      }
      const order = access.order;

      const payments = await loadPayments();

      if (payments.active === false) {
        return res.status(409).json({
          error: 'PAYMENTS_DISABLED',
          message: 'Los pagos están desactivados en la tienda.',
        });
      }

      if (payments.provider !== 'wompi') {
        return res.status(409).json({
          error: 'PAYMENT_PROVIDER_MISMATCH',
          message: 'La pasarela activa no es Wompi.',
          provider: payments.provider || null,
        });
      }

      const wompi = payments.credentials.wompi || {};
      if (!wompi.publicKey || !wompi.integrityKey) {
        return res.status(422).json({
          error: 'WOMPI_CONFIG_INCOMPLETE',
          message:
            'Falta la configuración esencial de Wompi (publicKey o integrityKey).',
        });
      }

      const payableAmount =
        order.storeCredit?.applied === true &&
        Number.isFinite(Number(order.payment?.amount))
          ? Number(order.payment.amount)
          : Number(order.total || 0);
      const amountInCents = toCents(payableAmount);
      if (amountInCents <= 0) {
        return res.status(422).json({
          error: 'INVALID_ORDER_TOTAL',
          message: 'La orden no tiene un total válido para iniciar el pago.',
        });
      }

      const currency = payments.currency || 'COP';
      const redirectUrl = redirectUrlFor(req, order);
      const baseUrl = wompiBaseUrl(payments.mode);
      const merchantData = await fetchMerchantData({
        baseUrl,
        publicKey: wompi.publicKey,
      });

      const acceptance = extractAcceptanceInfo(merchantData);

      if (!acceptance.acceptanceToken) {
        return res.status(422).json({
          error: 'WOMPI_ACCEPTANCE_TOKEN_MISSING',
          message:
            'Wompi no devolvió el acceptance token. Revisa la public key configurada.',
        });
      }

      const issuedAttempt = await issuePaymentAttempt({
        orderId: order._id,
        provider: 'wompi',
        reference: wompiReference(order),
        amountInCents,
        currency,
        merchantFingerprint: merchantFingerprintFor('wompi', wompi.publicKey),
      });
      const reference = sanitize(issuedAttempt?.attempt?.reference, 220);
      const canonicalAmountInCents = Number(
        issuedAttempt?.attempt?.amountInCents || 0
      );
      const canonicalCurrency = sanitize(
        issuedAttempt?.attempt?.currency || currency,
        12
      ).toUpperCase();
      if (!reference || canonicalAmountInCents <= 0) {
        throw Object.assign(
          new Error('No fue posible registrar el intento de pago.'),
          { code: 'PAYMENT_ATTEMPT_NOT_RECORDED' }
        );
      }
      const signature = integritySignature({
        reference,
        amountInCents: canonicalAmountInCents,
        currency: canonicalCurrency,
        integrityKey: wompi.integrityKey,
      });

      return res.json(
        buildPublicCheckoutResponse({
          payments,
          wompi,
          order,
          amountInCents: canonicalAmountInCents,
          currency: canonicalCurrency,
          reference,
          redirectUrl,
          signature,
          acceptance,
        })
      );
    } catch (error) {
      logger.error('POST /payments/wompi/checkout-data', error);
      if (error?.code === 'PAYMENT_ACCESS_SECRET_MISCONFIGURED') {
        return res.status(500).json({
          ok: false,
          error: 'PAYMENT_ACCESS_UNAVAILABLE',
          message: 'No fue posible validar el acceso al pago.',
        });
      }
      if (error?.code === 'PAYMENT_ATTEMPT_ORDER_CLOSED') {
        return res.status(409).json({
          ok: false,
          error: 'PAYMENT_ORDER_NOT_PAYABLE',
          message: 'Esta orden ya no admite nuevos intentos de pago.',
        });
      }
      if (
        error?.code === 'PAYMENT_ATTEMPT_ORDER_CHANGED' ||
        error?.code === 'PAYMENT_ATTEMPT_CONCURRENT_CHANGE'
      ) {
        return res.status(409).json({
          ok: false,
          error: 'PAYMENT_ORDER_CHANGED',
          message: 'El valor de la orden cambió. Actualiza el checkout.',
        });
      }
      return res.status(500).json({
        error: 'WOMPI_CHECKOUT_DATA_ERROR',
        message: 'No se pudo preparar el checkout de Wompi.',
      });
    }
  }

  async function getWompiTransaction(req, res) {
    try {
      const transactionId = sanitize(req.params?.transactionId, 120);
      if (!isValidTransactionId(transactionId)) {
        return res.status(404).json(SAFE_PAYMENT_ACCESS_ERROR);
      }
      const access = await resolveAuthorizedPublicPaymentOrder({
        req,
        OrderModel,
      });
      if (!access.allowed) {
        return res.status(404).json(SAFE_PAYMENT_ACCESS_ERROR);
      }
      const order = access.order;

      const payments = await loadPayments();

      if (payments.provider !== 'wompi') {
        return res.status(409).json({
          ok: false,
          error: 'PAYMENT_PROVIDER_MISMATCH',
          message: 'La pasarela activa no es Wompi.',
          provider: payments.provider || null,
        });
      }

      const wompi = payments.credentials?.wompi || {};
      const baseUrl = wompiBaseUrl(payments.mode);

      const transaction = await fetchTransactionById({
        baseUrl,
        transactionId,
        privateKey: wompi.privateKey,
        publicKey: wompi.publicKey,
      });
      const attempt = await findPaymentAttempt({
        provider: 'wompi',
        reference: sanitize(transaction?.reference, 220),
      });

      if (
        !isWompiTransactionOwnedByOrder({
          order,
          attempt,
          transaction,
          requestedTransactionId: transactionId,
        })
      ) {
        return res.status(404).json(SAFE_PAYMENT_ACCESS_ERROR);
      }

      const mapped = mapTransactionStatus(transaction?.status);

      return res.json(
        buildPublicTransactionResponse({
          order,
          transaction,
          mapped,
          payments,
        })
      );
    } catch (error) {
      logger.error('GET /payments/wompi/transaction/:transactionId', error);
      if (error?.code === 'PAYMENT_ACCESS_SECRET_MISCONFIGURED') {
        return res.status(500).json({
          ok: false,
          error: 'PAYMENT_ACCESS_UNAVAILABLE',
          message: 'No fue posible validar el acceso al pago.',
        });
      }
      return res.status(500).json({
        ok: false,
        error: 'WOMPI_TRANSACTION_LOOKUP_ERROR',
        message: 'No se pudo consultar la transacción de Wompi.',
      });
    }
  }

  async function testWompiMerchant(req, res) {
    try {
      const payments = await loadPayments();
      const wompiCfg = payments.credentials.wompi || {};

      const requestedMode = sanitize(req.body?.mode, 20).toLowerCase();
      const mode =
        requestedMode === 'production'
          ? 'production'
          : requestedMode === 'sandbox'
            ? 'sandbox'
            : payments.mode;

      const publicKey =
        sanitize(req.body?.publicKey, 200) || wompiCfg.publicKey;

      if (!publicKey) {
        return res.status(400).json({
          error: 'PUBLIC_KEY_REQUIRED',
          message:
            'Debes enviar una publicKey o tenerla guardada en configuración.',
        });
      }

      const baseUrl = wompiBaseUrl(mode);
      const merchantData = await fetchMerchantData({ baseUrl, publicKey });
      const acceptance = extractAcceptanceInfo(merchantData);

      return res.json({
        ok: true,
        mode,
        baseUrl,
        merchant: {
          name: merchantData?.name || '',
          email: merchantData?.email || '',
          contactName: merchantData?.contact_name || '',
          phoneNumber: merchantData?.phone_number || '',
        },
        acceptanceToken: acceptance.acceptanceToken,
        acceptancePermalink: acceptance.acceptancePermalink,
        personalDataAcceptanceToken: acceptance.personalDataAcceptanceToken,
        personalDataPermalink: acceptance.personalDataPermalink,
        acceptance,
      });
    } catch (error) {
      logger.error('POST /payments/admin/wompi/test-merchant', error);
      return res.status(500).json({
        error: 'WOMPI_TEST_FAILED',
        message:
          error.message || 'No se pudo validar la configuración de Wompi.',
      });
    }
  }

  return Object.freeze({
    createWompiCheckoutData,
    getPublicConfig,
    getWompiTransaction,
    testWompiMerchant,
  });
}

module.exports = {
  createPaymentPublicController,
};
