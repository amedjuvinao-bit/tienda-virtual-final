// backend/services/posCashSaleService.js

const mongoose = require('mongoose');

const CashSession = require('../models/CashSession');
const Order = require('../models/Order');
const { createPosSale, preparePosSalePreview, createPosError } = require('./adminPosService');
const { recalculateCashSession, getPendingCashClosingReview } = require('./cashSessionService');
const {
  processFulfillmentOnce,
} = require('./orderCreationPostCommitService');
const {
  beginPosSaleIdempotency,
  completePosSaleIdempotency,
} = require('./posSaleIdempotencyService');

function cleanText(value, max = 300) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, max);
}

function cleanUpper(value, max = 300) {
  return cleanText(value, max).toUpperCase();
}

function getRegisterCode(payload = {}) {
  return cleanUpper(
    payload.cashRegisterCode ||
      payload.registerCode ||
      payload.pos?.cashRegisterCode ||
      payload.pos?.registerCode ||
      'CAJA POS',
    40
  );
}

async function findOpenCashSession({ branch, registerCode, session = null } = {}) {
  if (!branch?._id) return null;

  return CashSession.findOne({
    branch: branch._id,
    cashRegisterCode: registerCode,
    status: 'open',
  })
    .session(session)
    .sort({ openedAt: -1 });
}

async function resolveCashSessionForSale(payload = {}, branch, { session = null } = {}) {
  const registerCode = getRegisterCode(payload);
  const cashSession = await findOpenCashSession({ branch, registerCode, session });
  const requiresCashSession = branch?.settings?.requireCashSessionForPos === true;

  if (requiresCashSession && !cashSession) {
    throw createPosError(
      `Debes abrir caja para vender en la sede ${branch.name || ''}.`,
      'POS_CASH_SESSION_REQUIRED',
      {
        branchId: String(branch._id || ''),
        branchName: branch.name || '',
        cashRegisterCode: registerCode,
      },
      409
    );
  }

  if (cashSession && getPendingCashClosingReview(cashSession)) {
    throw createPosError(
      'La caja está congelada mientras un supervisor revisa el arqueo de cierre.',
      'POS_CASH_CLOSING_REVIEW_PENDING',
      { cashSessionId: String(cashSession._id || ''), cashRegisterCode: registerCode },
      409
    );
  }

  return {
    cashSession,
    registerCode,
    required: requiresCashSession,
  };
}

async function attachOrderToCashSession(order, cashSession, registerCode, { session = null } = {}) {
  if (!order?._id || !cashSession?._id) return order;

  await Order.updateOne(
    { _id: order._id },
    {
      $set: {
        cashSession: cashSession._id,
        cashRegister: null,
        'pos.registerCode': cashSession.cashRegisterCode || registerCode,
      },
    },
    { session }
  );

  order.cashSession = cashSession._id;
  order.cashRegister = null;
  order.pos = {
    ...(order.pos?.toObject ? order.pos.toObject() : order.pos || {}),
    registerCode: cashSession.cashRegisterCode || registerCode,
  };

  return order;
}

async function createPosSaleWithCashSession(payload = {}, options = {}) {
  const externalSession = options.session || null;
  const admin = options.admin || {};
  const idempotency = options.idempotency || null;

  const run = async (session) => {
    const idempotencyRecord = idempotency
      ? await beginPosSaleIdempotency(idempotency, { session })
      : null;
    const preview = await preparePosSalePreview(payload, { session });
    const branch = preview.branch;
    const cashResolution = await resolveCashSessionForSale(payload, branch, { session });

    const result = await createPosSale(payload, {
      ...options,
      admin,
      session,
      paymentTransactionId: idempotency?.paymentTransactionId || '',
    });

    if (cashResolution.cashSession) {
      await attachOrderToCashSession(
        result.order,
        cashResolution.cashSession,
        cashResolution.registerCode,
        { session }
      );
      // Recargar por ID dentro de la transacción evita guardar una instancia
      // anterior al alta de la orden y conserva el control optimista de versión.
      result.cashSession = await recalculateCashSession(cashResolution.cashSession._id, { session });
    } else {
      result.cashSession = null;
    }

    result.cashRegisterCode = cashResolution.registerCode;
    result.cashSessionRequired = cashResolution.required;

    if (idempotencyRecord) {
      await completePosSaleIdempotency(
        idempotencyRecord,
        idempotency,
        result,
        { session }
      );
    }

    return result;
  };

  let result;

  if (externalSession) {
    result = await run(externalSession);
  } else {
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        result = await run(session);
      });
    } finally {
      await session.endSession();
    }
  }

  if (!externalSession && result?.cashSession?._id) {
    result.cashSession = await recalculateCashSession(result.cashSession._id);
  }

  if (!externalSession) {
    try {
      await processFulfillmentOnce({
        orderId: result.order._id,
        paymentProvider: 'pos',
        transaction: {
          id: result.order.payment?.transactionId,
          provider: 'pos',
          payment_method_type:
            result.order.payment?.methodType || 'pos',
          payment_method_name:
            result.order.payment?.methodLabel || 'Venta física',
          payment_method: result.order.payment?.method || 'pos',
          rawMethod: result.order.payment?.rawMethod || {},
        },
      });
    } catch (error) {
      console.error(
        '[posCashSaleService] Error registrando cumplimiento POS recuperable:',
        error.message
      );
    }
  }

  return result;
}

module.exports = {
  getRegisterCode,
  findOpenCashSession,
  resolveCashSessionForSale,
  attachOrderToCashSession,
  createPosSaleWithCashSession,
};
