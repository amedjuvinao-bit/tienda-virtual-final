'use strict';

const {
  buildStoreCreditAttemptSnapshot,
  cleanText,
  evaluateApprovedPaymentAttempt,
  idText,
  isOrderClosedForCheckout,
  normalizeAttemptState,
  normalizeCurrency,
  normalizeProvider,
  positiveInteger,
  resolveOrderPayableAmountInCents,
  sameAttemptComposition,
} = require('./policy');

function chainSession(query, session) {
  return session && typeof query?.session === 'function'
    ? query.session(session)
    : query;
}

async function resolveQuery(query) {
  return typeof query?.exec === 'function' ? query.exec() : query;
}

function createPaymentAttemptService({
  mongooseAdapter,
  OrderModel,
  PaymentAttemptModel,
  StoreCreditUsageModel,
  OrderEventModel,
  now = () => new Date(),
} = {}) {
  if (!mongooseAdapter || typeof mongooseAdapter.startSession !== 'function') {
    throw new TypeError('PAYMENT_ATTEMPT_MONGOOSE_ADAPTER_REQUIRED');
  }
  if (!OrderModel || !PaymentAttemptModel || !StoreCreditUsageModel) {
    throw new TypeError('PAYMENT_ATTEMPT_MODELS_REQUIRED');
  }

  async function findAttempt({ provider, reference, session } = {}) {
    const query = PaymentAttemptModel.findOne({
      provider: normalizeProvider(provider),
      reference: cleanText(reference, 220),
    });
    return resolveQuery(chainSession(query, session));
  }

  async function createAttemptDocument(values, session) {
    const [attempt] = await PaymentAttemptModel.create([values], { session });
    return attempt;
  }

  async function issueAttempt(
    {
      orderId,
      provider,
      reference,
      amountInCents,
      currency,
      merchantFingerprint = '',
    } = {},
    { session: externalSession } = {}
  ) {
    const safeProvider = normalizeProvider(provider);
    const safeReference = cleanText(reference, 220);
    const requestedAmountInCents = positiveInteger(amountInCents);
    const requestedCurrency = normalizeCurrency(currency);
    const safeMerchantFingerprint = cleanText(merchantFingerprint, 128);
    if (
      !orderId ||
      !safeProvider ||
      !safeReference ||
      !requestedAmountInCents ||
      !safeMerchantFingerprint
    ) {
      throw Object.assign(new Error('El intento de pago está incompleto.'), {
        code: 'PAYMENT_ATTEMPT_INVALID',
        statusCode: 422,
      });
    }

    async function work(session) {
      const orderQuery = OrderModel.findById(orderId);
      const order = await resolveQuery(chainSession(orderQuery, session));
      if (!order) {
        throw Object.assign(new Error('La orden no está disponible.'), {
          code: 'PAYMENT_ATTEMPT_ORDER_NOT_FOUND',
          statusCode: 404,
        });
      }
      if (isOrderClosedForCheckout(order)) {
        throw Object.assign(
          new Error('La orden ya no admite nuevos intentos de pago.'),
          { code: 'PAYMENT_ATTEMPT_ORDER_CLOSED', statusCode: 409 }
        );
      }

      const canonicalAmountInCents = resolveOrderPayableAmountInCents(order);
      const canonicalCurrency = normalizeCurrency(
        order?.payment?.currency || requestedCurrency
      );
      if (
        canonicalAmountInCents !== requestedAmountInCents ||
        canonicalCurrency !== requestedCurrency
      ) {
        throw Object.assign(
          new Error('La composición del pago cambió antes de emitir el intento.'),
          { code: 'PAYMENT_ATTEMPT_ORDER_CHANGED', statusCode: 409 }
        );
      }

      const expected = {
        amountInCents: canonicalAmountInCents,
        currency: canonicalCurrency,
        merchantFingerprint: safeMerchantFingerprint,
        storeCredit: buildStoreCreditAttemptSnapshot(order),
      };
      const activeQuery = PaymentAttemptModel.findOne({
        order: order._id,
        active: true,
        state: 'issued',
      });
      const activeAttempt = await resolveQuery(
        chainSession(activeQuery, session)
      );
      if (
        activeAttempt &&
        normalizeProvider(activeAttempt.provider) === safeProvider &&
        sameAttemptComposition(activeAttempt, expected)
      ) {
        return { attempt: activeAttempt, reused: true };
      }

      const issuedAt = now();
      await PaymentAttemptModel.updateMany(
        {
          order: order._id,
          active: true,
        },
        {
          $set: {
            active: false,
            state: 'superseded',
            supersededAt: issuedAt,
          },
        },
        { session }
      );

      const attempt = await createAttemptDocument(
        {
          provider: safeProvider,
          order: order._id,
          orderNumber: order.orderNumber,
          reference: safeReference,
          amountInCents: canonicalAmountInCents,
          currency: canonicalCurrency,
          merchantFingerprint: expected.merchantFingerprint,
          state: 'issued',
          active: true,
          issuedBySystem: true,
          issuedAt,
          storeCredit: expected.storeCredit,
        },
        session
      );
      return { attempt, reused: false };
    }

    if (externalSession) return work(externalSession);
    const session = await mongooseAdapter.startSession();
    try {
      let result;
      await session.withTransaction(async () => {
        result = await work(session);
      });
      return result;
    } catch (error) {
      if (Number(error?.code) !== 11000) throw error;
      const order = await resolveQuery(OrderModel.findById(orderId));
      const activeAttempt = await resolveQuery(
        PaymentAttemptModel.findOne({
          order: order?._id,
          active: true,
          state: 'issued',
        })
      );
      const expected = order
        ? {
            amountInCents: resolveOrderPayableAmountInCents(order),
            currency: normalizeCurrency(
              order?.payment?.currency || requestedCurrency
            ),
            merchantFingerprint: cleanText(merchantFingerprint, 128),
            storeCredit: buildStoreCreditAttemptSnapshot(order),
          }
        : null;
      if (
        activeAttempt &&
        normalizeProvider(activeAttempt.provider) === safeProvider &&
        expected &&
        sameAttemptComposition(activeAttempt, expected)
      ) {
        return { attempt: activeAttempt, reused: true, concurrent: true };
      }
      throw Object.assign(
        new Error('El intento cambió mientras se preparaba el checkout.'),
        { code: 'PAYMENT_ATTEMPT_CONCURRENT_CHANGE', statusCode: 409 }
      );
    } finally {
      await session.endSession();
    }
  }

  async function loadAttemptUsage(attempt, session) {
    if (attempt?.storeCredit?.applied !== true || !attempt.storeCredit.usage) {
      return null;
    }
    const query = StoreCreditUsageModel.findById(attempt.storeCredit.usage);
    return resolveQuery(chainSession(query, session));
  }

  async function recordReconciliation({
    order,
    attempt,
    provider,
    reference,
    transactionId,
    amountInCents,
    currency,
    merchantFingerprint,
    decision,
    session,
  }) {
    const detectedAt = now();
    let targetAttempt = attempt;
    const attemptBelongsToOrder = Boolean(
      !targetAttempt || idText(targetAttempt.order) === idText(order._id)
    );
    if (!targetAttempt) {
      targetAttempt = await createAttemptDocument(
        {
          provider: normalizeProvider(provider),
          order: order._id,
          orderNumber: order.orderNumber,
          reference: cleanText(reference, 220),
          amountInCents: positiveInteger(amountInCents),
          currency: normalizeCurrency(currency),
          merchantFingerprint: cleanText(merchantFingerprint, 128),
          state: 'reconciliation_required',
          active: false,
          issuedBySystem: false,
          transactionId: cleanText(transactionId, 160),
          providerStatus: 'APPROVED',
          issuedAt: detectedAt,
          finalizedAt: detectedAt,
          storeCredit: buildStoreCreditAttemptSnapshot(order),
        },
        session
      );
    }

    const alreadyRecorded = Boolean(
      (attemptBelongsToOrder &&
        targetAttempt?.reconciliation?.required === true &&
        cleanText(targetAttempt?.reconciliation?.code, 120) === decision.code &&
        cleanText(targetAttempt?.reconciliation?.transactionId, 160) ===
          cleanText(transactionId, 160)) ||
        (!attemptBelongsToOrder &&
          order?.payment?.reviewRequired === true &&
          cleanText(order?.payment?.reviewCode, 120) === decision.code &&
          cleanText(order?.payment?.reviewTransactionId, 160) ===
            cleanText(transactionId, 160))
    );
    if (attemptBelongsToOrder) {
      targetAttempt.state = 'reconciliation_required';
      targetAttempt.active = false;
      targetAttempt.providerStatus = 'APPROVED';
      targetAttempt.finalizedAt = targetAttempt.finalizedAt || detectedAt;
      if (!targetAttempt.transactionId) {
        targetAttempt.transactionId = cleanText(transactionId, 160);
      }
      targetAttempt.reconciliation = {
        required: true,
        code: decision.code,
        message: decision.message,
        detectedAt,
        transactionId: cleanText(transactionId, 160),
        amountInCents: positiveInteger(amountInCents),
        currency: normalizeCurrency(currency),
      };
      await targetAttempt.save({ session });
    }

    order.payment = order.payment || {};
    order.payment.reviewRequired = true;
    order.payment.reviewCode = decision.code;
    order.payment.reviewMessage = decision.message;
    order.payment.reviewDetectedAt = detectedAt;
    order.payment.reviewTransactionId = cleanText(transactionId, 160);
    order.timeline = Array.isArray(order.timeline) ? order.timeline : [];
    if (!alreadyRecorded) {
      order.timeline.push({
        type: 'system',
        message: `Pago ${normalizeProvider(provider)} enviado a conciliación: ${decision.code}.`,
        by: 'payment_attempt_ledger',
        at: detectedAt,
      });
      if (OrderEventModel && typeof OrderEventModel.create === 'function') {
        await OrderEventModel.create(
          [
            {
              orderId: order._id,
              type: 'payment_reconciliation_required',
              message: decision.message,
              meta: {
                provider: normalizeProvider(provider),
                reference: cleanText(reference, 220),
                transactionId: cleanText(transactionId, 160),
                amountInCents: positiveInteger(amountInCents),
                currency: normalizeCurrency(currency),
                code: decision.code,
              },
            },
          ],
          { session }
        );
      }
    }

    return { attempt: targetAttempt, alreadyRecorded };
  }

  async function claimApprovedAttempt(
    {
      order,
      provider,
      reference,
      transactionId,
      amountInCents,
      currency,
      merchantFingerprint = '',
    } = {},
    { session } = {}
  ) {
    if (!order?._id || !session) {
      throw new TypeError('PAYMENT_ATTEMPT_TRANSACTION_REQUIRED');
    }
    const attempt = await findAttempt({ provider, reference, session });
    const usage = await loadAttemptUsage(attempt, session);
    const decision = evaluateApprovedPaymentAttempt({
      order,
      attempt,
      usage,
      provider,
      reference,
      transactionId,
      amountInCents,
      currency,
      merchantFingerprint,
    });

    if (!decision.allowed) {
      const reconciliation = await recordReconciliation({
        order,
        attempt,
        provider,
        reference,
        transactionId,
        amountInCents,
        currency,
        merchantFingerprint,
        decision,
        session,
      });
      return {
        ...decision,
        attempt: reconciliation.attempt,
        alreadyRecorded: reconciliation.alreadyRecorded,
      };
    }

    if (!decision.duplicate) {
      attempt.state = 'approved';
      attempt.active = false;
      attempt.transactionId = cleanText(transactionId, 160);
      attempt.providerStatus = 'APPROVED';
      attempt.finalizedAt = now();
      await attempt.save({ session });
    }
    return { ...decision, attempt };
  }

  async function claimNonApprovedAttempt(
    {
      order,
      provider,
      reference,
      transactionId,
      amountInCents,
      currency,
      providerStatus,
      paymentStatus,
      merchantFingerprint = '',
    } = {},
    { session } = {}
  ) {
    if (!order?._id || !session) {
      throw new TypeError('PAYMENT_ATTEMPT_TRANSACTION_REQUIRED');
    }
    const attempt = await findAttempt({ provider, reference, session });
    const normalizedPaymentStatus = normalizeAttemptState(paymentStatus);
    const expectedState =
      normalizedPaymentStatus === 'cancelled'
        ? 'cancelled'
        : normalizedPaymentStatus === 'failed'
          ? 'declined'
          : 'issued';
    const matches = Boolean(
      attempt &&
        attempt.active === true &&
        normalizeAttemptState(attempt.state) === 'issued' &&
        attempt.issuedBySystem !== false &&
        normalizeProvider(attempt.provider) === normalizeProvider(provider) &&
        cleanText(attempt.reference, 220) === cleanText(reference, 220) &&
        idText(attempt.order) === idText(order._id) &&
        positiveInteger(attempt.amountInCents) ===
          positiveInteger(amountInCents) &&
        Boolean(cleanText(currency, 12)) &&
        normalizeCurrency(attempt.currency) === normalizeCurrency(currency) &&
        Boolean(cleanText(transactionId, 160)) &&
        Boolean(cleanText(merchantFingerprint, 128)) &&
        cleanText(attempt.merchantFingerprint, 128) ===
          cleanText(merchantFingerprint, 128) &&
        cleanText(order?.payment?.status, 40).toLowerCase() !== 'paid'
    );
    if (!matches) {
      return {
        allowed: false,
        ignored: true,
        reason: !attempt
          ? 'PAYMENT_ATTEMPT_UNKNOWN'
          : 'PAYMENT_ATTEMPT_NOT_ACTIVE',
        attempt,
      };
    }

    attempt.providerStatus = cleanText(providerStatus, 80);
    if (expectedState !== 'issued') {
      attempt.state = expectedState;
      attempt.active = false;
      attempt.transactionId = cleanText(transactionId, 160);
      attempt.finalizedAt = now();
    }
    await attempt.save({ session });
    return { allowed: true, ignored: false, attempt };
  }

  return Object.freeze({
    claimApprovedAttempt,
    claimNonApprovedAttempt,
    findAttempt,
    issueAttempt,
  });
}

module.exports = { createPaymentAttemptService };
