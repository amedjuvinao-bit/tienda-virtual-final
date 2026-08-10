'use strict';

const Cart = require('../models/Cart');
const IdempotencyKey = require('../models/IdempotencyKey');
const {
  SAFE_CART_ACCESS_ERROR,
  getCartAccessFromRequest,
  getCartAccessSecret,
  isValidCartAccessToken,
  isValidCartSessionId,
  verifyCartAccess,
} = require('./cartAccessService');
const {
  defaultCartCanonicalValidationService,
  toStoredCartItem,
} = require('./cartCanonicalValidationService');
const {
  resolveOrderPaymentSelection,
} = require('./paymentConfigurationAuthorityService');

const DEFAULT_ORDER_CART_ACCESS_TTL_MS = 24 * 60 * 60 * 1000;
const ORDER_ENDPOINT = 'POST /orders';

function toPlain(value) {
  if (!value) return value;
  return typeof value.toObject === 'function'
    ? value.toObject({ virtuals: true })
    : { ...value };
}

function buildAuthoritativeCartItems(cart) {
  const plainCart = toPlain(cart) || {};
  return (Array.isArray(plainCart.items) ? plainCart.items : []).map((item) => {
    const plainItem = toPlain(item) || {};
    const productId = plainItem._id || plainItem.productId || plainItem.product;
    const quantity = Number(plainItem.quantity ?? plainItem.qty ?? 0);

    return {
      productId,
      quantity,
      qty: quantity,
      title: plainItem.title,
      image: plainItem.image,
      price: plainItem.price,
      color: plainItem.color,
      size: plainItem.size,
      variantId: plainItem.variantId,
      variantKey: plainItem.variantKey,
      variantLabel: plainItem.variantLabel,
      variantAttributes: plainItem.variantAttributes,
    };
  });
}

function buildAuthorizedOrderBody(body, cart, sessionId, paymentSnapshot) {
  const source = body && typeof body === 'object' ? body : {};
  const requestedProvider = String(source?.payment?.provider || '')
    .trim()
    .toLowerCase();
  const safePaymentSnapshot =
    paymentSnapshot && typeof paymentSnapshot === 'object'
      ? paymentSnapshot
      : {
          provider: requestedProvider,
          status:
            requestedProvider === 'manual'
              ? 'pending_manual'
              : 'pending_gateway',
        };

  // Lista positiva: el comprador controla sus datos de contacto, entrega,
  // facturación, cupón y únicamente la selección del proveedor. Todo dato
  // comercial o configuración operativa se reemplaza con autoridades del servidor.
  return {
    sessionId,
    cart: buildAuthoritativeCartItems(cart),
    customer: source.customer,
    billing: source.billing,
    payment: { ...safePaymentSnapshot },
    couponCode: source.couponCode,
    branch: source.branch,
    branchId: source.branchId,
    defaultBranch: source.defaultBranch,
  };
}

function sendCartAccessNotFound(res) {
  return res.status(404).json(SAFE_CART_ACCESS_ERROR);
}

function isFreshOrderCartAccess(
  cart,
  { now = new Date(), ttlMs = DEFAULT_ORDER_CART_ACCESS_TTL_MS } = {}
) {
  const issuedAt = new Date(cart?.accessIssuedAt || 0);
  const current = new Date(now);
  const ageMs = current.getTime() - issuedAt.getTime();
  return (
    !Number.isNaN(issuedAt.getTime()) &&
    !Number.isNaN(current.getTime()) &&
    ageMs >= -60_000 &&
    ageMs <= Number(ttlMs)
  );
}

async function findAuthorizedIdempotentReplay({
  cart,
  req,
  IdempotencyKeyModel = IdempotencyKey,
} = {}) {
  const orderId = String(cart?.convertedOrderId || '').trim();
  const key = String(req?.headers?.['idempotency-key'] || '').trim();
  if (!orderId || !key) return null;

  let query = IdempotencyKeyModel.findOne({
    key,
    endpoint: ORDER_ENDPOINT,
    status: 'completed',
    orderId,
  });
  if (typeof query?.lean === 'function') query = query.lean();
  const record = typeof query?.exec === 'function' ? await query.exec() : await query;
  if (!record?.orderId) return null;
  return { orderId: String(record.orderId), idempotencyKey: key };
}

function createRequireAuthorizedOrderCart({
  CartModel = Cart,
  getSecret = getCartAccessSecret,
  canonicalValidationService = defaultCartCanonicalValidationService,
  resolvePaymentSelection = resolveOrderPaymentSelection,
  IdempotencyKeyModel = IdempotencyKey,
  now = () => new Date(),
  accessTtlMs = DEFAULT_ORDER_CART_ACCESS_TTL_MS,
} = {}) {
  return async function requireAuthorizedOrderCart(req, res, next) {
    try {
      const credentials = getCartAccessFromRequest(req);
      if (
        !credentials.sessionId ||
        !credentials.token ||
        !isValidCartSessionId(credentials.sessionId) ||
        !isValidCartAccessToken(credentials.token)
      ) {
        return sendCartAccessNotFound(res);
      }

      const cart = await CartModel.findOne({ sessionId: credentials.sessionId })
        .select('+accessTokenHash +accessVersion +accessIssuedAt')
        .exec();

      if (
        !cart ||
        cart.active === false ||
        ['inactive', 'closed', 'deleted'].includes(
          String(cart.status || '').trim().toLowerCase()
        ) ||
        !Array.isArray(cart.items) ||
        !verifyCartAccess({
          cart,
          sessionId: credentials.sessionId,
          token: credentials.token,
          secret: getSecret(),
        }) ||
        !isFreshOrderCartAccess(cart, {
          now: now(),
          ttlMs: accessTtlMs,
        })
      ) {
        return sendCartAccessNotFound(res);
      }

      if (cart.convertedOrderId) {
        const replay = await findAuthorizedIdempotentReplay({
          cart,
          req,
          IdempotencyKeyModel,
        });
        if (!replay) return sendCartAccessNotFound(res);
        req.authorizedCart = toPlain(cart) || {};
        req.authorizedCartSessionId = credentials.sessionId;
        req.authorizedOrderReplay = replay;
        return next();
      }

      if (cart.items.length === 0) return sendCartAccessNotFound(res);

      const validation = await canonicalValidationService.validateItems(cart.items, {
        mode: 'strict',
      });
      if (!validation.ok) {
        return res.status(409).json({
          ok: false,
          error: 'CART_ITEMS_INVALID',
          message: 'El carrito contiene productos que no pueden comprarse.',
          items: validation.invalidItems,
        });
      }

      const plainCart = toPlain(cart) || {};
      const { toObject: _discardStaleSerializer, ...cartSnapshot } = plainCart;
      const authoritativeCart = {
        ...cartSnapshot,
        items: validation.items.map(toStoredCartItem),
      };
      const requestedProvider = String(req.body?.payment?.provider || '')
        .trim()
        .toLowerCase();
      const paymentSelection = await resolvePaymentSelection(requestedProvider);
      req.authorizedCart = authoritativeCart;
      req.authorizedCartSessionId = credentials.sessionId;
      req.authorizedPaymentConfig = paymentSelection.config;
      req.authorizedPaymentSnapshot = paymentSelection.snapshot;
      req.body = buildAuthorizedOrderBody(
        req.body,
        authoritativeCart,
        credentials.sessionId,
        paymentSelection.snapshot
      );

      return next();
    } catch (error) {
      if (error?.code === 'CART_ACCESS_SECRET_MISCONFIGURED') {
        console.error('No fue posible validar el acceso del carrito para crear la orden.');
        return res.status(500).json({
          ok: false,
          error: 'ORDER_ACCESS_UNAVAILABLE',
          message: 'No fue posible iniciar la compra de forma segura.',
        });
      }

      if (
        String(error?.code || '').startsWith('PAYMENT_') ||
        error?.code === 'PAYMENTS_DISABLED'
      ) {
        return res.status(Number(error.statusCode || 409)).json({
          ok: false,
          error: error.code,
          message:
            error.publicMessage ||
            'El método de pago seleccionado no está disponible.',
        });
      }

      console.error('Error validando el carrito para crear la orden:', error?.code || 'unknown');
      return res.status(500).json({
        ok: false,
        error: 'ORDER_CREATION_UNAVAILABLE',
        message: 'No fue posible iniciar la compra.',
      });
    }
  };
}

module.exports = {
  DEFAULT_ORDER_CART_ACCESS_TTL_MS,
  buildAuthoritativeCartItems,
  buildAuthorizedOrderBody,
  createRequireAuthorizedOrderCart,
  findAuthorizedIdempotentReplay,
  isFreshOrderCartAccess,
  requireAuthorizedOrderCart: createRequireAuthorizedOrderCart(),
};
