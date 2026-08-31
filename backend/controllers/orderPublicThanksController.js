const Order = require('../models/Order');
const {
  SAFE_PAYMENT_ACCESS_ERROR,
  buildPublicThanksResponse,
  resolveAuthorizedPublicPaymentOrder,
} = require('../services/publicPaymentAccessService');
const {
  getOrderReturnAccessSecret,
  issueOrderReturnAccess,
} = require('../services/orderReturnAccessService');
const {
  getOrderReturnPolicy,
} = require('../services/orderReturnPolicyService');

async function getPublicOrderThanks(req, res) {
  try {
    const access = await resolveAuthorizedPublicPaymentOrder({
      req,
      OrderModel: Order,
      orderId: req.params.id,
    });
    if (!access.allowed) {
      return res.status(404).json(SAFE_PAYMENT_ACCESS_ERROR);
    }

    const policy = await getOrderReturnPolicy();
    const returnAccess = policy.enabled && policy.customerPortalEnabled
      ? issueOrderReturnAccess({
          order: access.order,
          secret: getOrderReturnAccessSecret(),
          ttlMs:
            Math.min(400, Math.max(35, policy.windowDays + 35)) *
            24 * 60 * 60 * 1000,
        })
      : null;

    return res.json({
      ...buildPublicThanksResponse({ order: access.order }),
      returnAccess: returnAccess
        ? { enabled: true, ...returnAccess }
        : { enabled: false },
    });
  } catch (error) {
    console.error('GET /orders/:id/thanks', error);
    if (error?.code === 'PAYMENT_ACCESS_SECRET_MISCONFIGURED') {
      return res.status(500).json({
        ok: false,
        error: 'PAYMENT_ACCESS_UNAVAILABLE',
        message: 'No fue posible validar el acceso a la orden.',
      });
    }
    return res.status(404).json(SAFE_PAYMENT_ACCESS_ERROR);
  }
}

module.exports = {
  getPublicOrderThanks,
};
