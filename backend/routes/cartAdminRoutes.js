'use strict';

const express = require('express');
const Cart = require('../models/Cart');
const Order = require('../models/Order');
const {
  defaultCartCanonicalValidationService,
  toStoredCartItem,
} = require('../services/cartCanonicalValidationService');
const {
  classifyCartLifecycle,
  exportAdminCarts,
  getAdminCartSummary,
  getCartMetrics,
  listAdminCarts,
} = require('../services/cartAdminOperationsService');
const { createCartRecoveryService } = require('../services/cartRecoveryService');
const { stripCartSecrets } = require('../services/cartAccessService');

const router = express.Router();

function clean(value, max = 2000) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, max);
}

function versionOf(cart) {
  const date = new Date(cart?.updatedAt || 0);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString();
}

function readVersion(req) {
  const raw = clean(req.headers?.['if-match-updated-at'], 80);
  const date = new Date(raw);
  return raw && !Number.isNaN(date.getTime()) && date.toISOString() === raw
    ? date
    : null;
}

function recoveryService(req) {
  return req?.app?.locals?.cartRecoveryService || createCartRecoveryService();
}

function canonicalService(req) {
  return req?.app?.locals?.cartCanonicalValidationService ||
    defaultCartCanonicalValidationService;
}

function adminIdentity(req) {
  return {
    authorId: clean(req.adminUserId, 80),
    authorName: clean(
      req.adminDisplayName || req.adminUsername || req.adminUser || 'admin',
      160
    ),
  };
}

function sendConflict(res, current) {
  return res.status(409).json({
    ok: false,
    error: 'CART_ADMIN_WRITE_CONFLICT',
    message: 'El carrito cambio. Recarga la version vigente y confirma nuevamente.',
    version: versionOf(current),
  });
}

function sendNotFound(res) {
  return res.status(404).json({
    ok: false,
    error: 'CART_ADMIN_NOT_FOUND',
    message: 'Carrito no encontrado.',
  });
}

function mapAlert(reason) {
  const labels = {
    PRODUCT_NOT_FOUND: 'Producto eliminado',
    PRODUCT_NOT_AVAILABLE: 'Producto inactivo o no visible',
    OUT_OF_STOCK: 'Sin inventario disponible',
    INSUFFICIENT_STOCK: 'Inventario insuficiente',
    INVALID_VARIANT: 'Variante invalida',
    INVALID_PRODUCT_ID: 'Identificador inconsistente',
    PRICE_CHANGED: 'Precio actual diferente',
  };
  return { code: reason, message: labels[reason] || 'Requiere revision' };
}

async function buildDetail(req, cart) {
  const plain = stripCartSecrets(cart);
  const storedItems = Array.isArray(plain.items) ? plain.items : [];
  const validation = await canonicalService(req).validateItems(storedItems, {
    mode: 'soft',
  });
  const items = storedItems.map((stored, index) => {
    const current = validation.items[index] || {};
    const storedPrice = Number(stored.price || 0);
    const currentPrice = Number(current.price || 0);
    const codes = [];
    if (!current.valid) codes.push(current.invalidReason || 'PRODUCT_NOT_AVAILABLE');
    if (current.valid && storedPrice !== currentPrice) codes.push('PRICE_CHANGED');
    return {
      stored: {
        productId: String(stored._id || stored.productId || ''),
        title: stored.title || '',
        image: stored.image || '',
        price: storedPrice,
        qty: Number(stored.qty ?? stored.quantity ?? 0),
        variantKey: stored.variantKey || stored.variantId || '',
        variantLabel: stored.variantLabel || '',
        variantAttributes: stored.variantAttributes || [],
      },
      current: {
        exists: current.invalidReason !== 'PRODUCT_NOT_FOUND',
        valid: Boolean(current.valid),
        title: current.title || '',
        image: current.image || '',
        price: currentPrice,
        sku: current.variantSku || '',
        barcode: current.variantBarcode || '',
        variantKey: current.variantKey || '',
        variantLabel: current.variantLabel || '',
        availableStock: current.availableStock,
        inventoryTracked: current.inventoryTracked !== false,
        validationMessage: current.validationMessage || '',
      },
      alerts: codes.map(mapAlert),
    };
  });
  const relatedOrder = plain.convertedOrderId
    ? await Order.findById(plain.convertedOrderId)
        .select('orderNumber status payment.status total createdAt')
        .lean()
    : null;
  const mail = await recoveryService(req).getMailAvailability();
  return {
    ...plain,
    items,
    version: versionOf(plain),
    activityAt: plain.lastCustomerActivityAt || plain.updatedAt || plain.createdAt,
    lifecycle: classifyCartLifecycle(plain),
    summary: getCartMetrics(plain),
    relatedOrder,
    recovery: {
      attempts: Array.isArray(plain.recoveryAttempts) ? plain.recoveryAttempts : [],
      attemptsCount: Array.isArray(plain.recoveryAttempts)
        ? plain.recoveryAttempts.length
        : 0,
      activeLinkExpiresAt:
        plain.recoveryAccess?.usedAt ? null : plain.recoveryAccess?.expiresAt || null,
      emailAvailable: Boolean(mail.available),
      emailUnavailableReason: mail.reason || '',
    },
  };
}

function filterError(res, error, fallbackCode, fallbackMessage) {
  const invalid = error?.code === 'CART_ADMIN_FILTER_INVALID';
  return res.status(invalid ? 400 : 500).json({
    error: invalid ? error.code : fallbackCode,
    message: invalid ? error.message : fallbackMessage,
  });
}

router.get('/summary', async (req, res) => {
  try {
    return res.json(await getAdminCartSummary(req.query));
  } catch (error) {
    return filterError(res, error, 'CART_ADMIN_SUMMARY_FAILED', 'No fue posible calcular el resumen.');
  }
});

router.post('/export', async (req, res) => {
  try {
    const csv = await exportAdminCarts(
      req.body?.filters || {},
      req.body?.sessionIds || []
    );
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="carritos.csv"');
    return res.send(csv);
  } catch (error) {
    return filterError(res, error, 'CART_ADMIN_EXPORT_FAILED', 'No fue posible exportar los carritos.');
  }
});

router.get('/export', async (req, res) => {
  try {
    const csv = await exportAdminCarts(req.query, []);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="carritos.csv"');
    return res.send(csv);
  } catch (error) {
    return filterError(res, error, 'CART_ADMIN_EXPORT_FAILED', 'No fue posible exportar los carritos.');
  }
});

router.post('/follow-ups', async (req, res) => {
  const targets = Array.isArray(req.body?.targets) ? req.body.targets.slice(0, 100) : [];
  const note = clean(req.body?.note);
  if (!targets.length || !note) {
    return res.status(400).json({
      error: 'CART_FOLLOW_UP_INVALID',
      message: 'Selecciona carritos y escribe el seguimiento.',
    });
  }
  const administrator = adminIdentity(req);
  const results = [];
  for (const target of targets) {
    const sessionId = clean(target?.sessionId, 120);
    const expectedVersion = new Date(target?.version || '');
    if (!sessionId || Number.isNaN(expectedVersion.getTime())) {
      results.push({ sessionId, ok: false, error: 'INVALID_TARGET' });
      continue;
    }
    const current = await Cart.findOne({ sessionId }).lean();
    if (!current || current.convertedOrderId || getCartMetrics(current).totalUnits <= 0) {
      results.push({ sessionId, ok: false, error: 'CART_NOT_RECOVERABLE' });
      continue;
    }
    const when = new Date();
    const result = await Cart.updateOne(
      { sessionId, updatedAt: expectedVersion },
      {
        $set: {
          lastCustomerActivityAt: current.lastCustomerActivityAt || current.updatedAt,
          lastAdminActivityAt: when,
          lastRecoveryAttemptAt: when,
        },
        $push: {
          adminNotes: { text: note, ...administrator, createdAt: when },
          recoveryAttempts: {
            channel: 'note',
            result: 'recorded',
            detail: note.slice(0, 500),
            administratorId: administrator.authorId,
            administratorName: administrator.authorName,
            createdAt: when,
          },
        },
        $currentDate: { updatedAt: true },
      },
      { timestamps: false }
    );
    results.push({
      sessionId,
      ok: result.modifiedCount === 1,
      error: result.modifiedCount ? '' : 'CART_ADMIN_WRITE_CONFLICT',
    });
  }
  return res.status(results.every((item) => item.ok) ? 200 : 207).json({ results });
});

router.get('/', async (req, res) => {
  try {
    return res.json(await listAdminCarts(req.query));
  } catch (error) {
    return filterError(res, error, 'CART_ADMIN_LIST_FAILED', 'No fue posible listar los carritos.');
  }
});

router.get('/:sessionId', async (req, res) => {
  try {
    const cart = await Cart.findOne({ sessionId: req.params.sessionId }).lean();
    if (!cart) return sendNotFound(res);
    return res.json(await buildDetail(req, cart));
  } catch (error) {
    console.error('Error obteniendo carrito administrativo:', error?.code || 'unknown');
    return res.status(500).json({
      error: 'CART_ADMIN_DETAIL_FAILED',
      message: 'No fue posible obtener el carrito.',
    });
  }
});

async function updateItems(req, res) {
  if (!Array.isArray(req.body?.items)) {
    return res.status(400).json({
      error: 'CART_ITEMS_REQUIRED',
      message: 'La lista de productos es invalida.',
    });
  }
  const expectedVersion = readVersion(req);
  if (!expectedVersion) {
    return res.status(428).json({
      error: 'CART_ADMIN_VERSION_REQUIRED',
      message: 'Se requiere la version vigente del carrito.',
    });
  }
  try {
    const current = await Cart.findOne({ sessionId: req.params.sessionId }).lean();
    if (!current) return sendNotFound(res);
    const validation = await canonicalService(req).validateItems(req.body.items, {
      mode: 'strict',
    });
    if (!validation.ok) {
      return res.status(409).json({
        error: 'CART_ITEMS_INVALID',
        message: 'El carrito contiene productos que no pueden comprarse.',
        items: validation.invalidItems,
      });
    }
    const updated = await Cart.findOneAndUpdate(
      { sessionId: req.params.sessionId, updatedAt: expectedVersion },
      {
        $set: {
          items: validation.items.map(toStoredCartItem),
          lastCustomerActivityAt: current.lastCustomerActivityAt || current.updatedAt,
          lastAdminActivityAt: new Date(),
          ...(validation.items.length === 0
            ? { 'recoveryAccess.usedAt': new Date() }
            : {}),
        },
        $currentDate: { updatedAt: true },
      },
      { new: true, runValidators: true, timestamps: false }
    ).lean();
    if (!updated) {
      return sendConflict(
        res,
        await Cart.findOne({ sessionId: req.params.sessionId }).lean()
      );
    }
    return res.json({ message: 'Carrito actualizado.', cart: await buildDetail(req, updated) });
  } catch (error) {
    console.error('Error actualizando carrito administrativo:', error?.code || 'unknown');
    return res.status(500).json({
      error: 'CART_ADMIN_UPDATE_FAILED',
      message: 'No fue posible actualizar el carrito.',
    });
  }
}

router.patch('/:sessionId/items', updateItems);
router.put('/:sessionId', updateItems);

router.post('/:sessionId/notes', async (req, res) => {
  const text = clean(req.body?.text);
  const expectedVersion = readVersion(req);
  if (!text) return res.status(400).json({ error: 'CART_NOTE_REQUIRED', message: 'Escribe una nota.' });
  if (!expectedVersion) return res.status(428).json({ error: 'CART_ADMIN_VERSION_REQUIRED', message: 'Se requiere la version vigente.' });
  const current = await Cart.findOne({ sessionId: req.params.sessionId }).lean();
  if (!current) return sendNotFound(res);
  const when = new Date();
  const updated = await Cart.findOneAndUpdate(
    { sessionId: req.params.sessionId, updatedAt: expectedVersion },
    {
      $set: {
        lastCustomerActivityAt: current.lastCustomerActivityAt || current.updatedAt,
        lastAdminActivityAt: when,
      },
      $push: { adminNotes: { text, ...adminIdentity(req), createdAt: when } },
      $currentDate: { updatedAt: true },
    },
    { new: true, timestamps: false }
  ).lean();
  if (!updated) return sendConflict(res, await Cart.findOne({ sessionId: req.params.sessionId }).lean());
  return res.json({ cart: await buildDetail(req, updated) });
});

router.put('/:sessionId/tags', async (req, res) => {
  const expectedVersion = readVersion(req);
  if (!expectedVersion) return res.status(428).json({ error: 'CART_ADMIN_VERSION_REQUIRED', message: 'Se requiere la version vigente.' });
  const tags = Array.from(new Set(
    (Array.isArray(req.body?.tags) ? req.body.tags : [])
      .map((value) => clean(value, 80).toLowerCase())
      .filter(Boolean)
  )).slice(0, 20);
  const current = await Cart.findOne({ sessionId: req.params.sessionId }).lean();
  if (!current) return sendNotFound(res);
  const updated = await Cart.findOneAndUpdate(
    { sessionId: req.params.sessionId, updatedAt: expectedVersion },
    {
      $set: {
        adminTags: tags,
        lastCustomerActivityAt: current.lastCustomerActivityAt || current.updatedAt,
        lastAdminActivityAt: new Date(),
      },
      $currentDate: { updatedAt: true },
    },
    { new: true, runValidators: true, timestamps: false }
  ).lean();
  if (!updated) return sendConflict(res, await Cart.findOne({ sessionId: req.params.sessionId }).lean());
  return res.json({ cart: await buildDetail(req, updated) });
});

router.post('/:sessionId/recovery-link', async (req, res) => {
  try {
    const data = await recoveryService(req).issueLink(
      req.params.sessionId,
      req,
      req.body || {}
    );
    if (!data) return sendNotFound(res);
    return res.json(data);
  } catch (error) {
    const publicCodes = new Set([
      'CART_ALREADY_CONVERTED',
      'CART_RECOVERY_EMAIL_REQUIRED',
      'CART_NOT_RECOVERABLE',
      'CART_RECOVERY_EXPIRATION_INVALID',
      'CART_RECOVERY_URL_UNAVAILABLE',
    ]);
    const known = publicCodes.has(error?.code);
    return res.status(known ? 409 : 500).json({
      error: known ? error.code : 'CART_RECOVERY_LINK_FAILED',
      message: known ? error.message : 'No fue posible generar el enlace.',
    });
  }
});

router.post('/:sessionId/recoveries', async (req, res) => {
  try {
    const result = await recoveryService(req).sendRecoveryEmail(
      req.params.sessionId,
      req,
      { ...req.body, idempotencyKey: req.headers['idempotency-key'] }
    );
    if (!result) return sendNotFound(res);
    return res.json(result);
  } catch (error) {
    const statuses = {
      CART_RECOVERY_IDEMPOTENCY_REQUIRED: 400,
      CART_NOT_RECOVERABLE: 409,
      CART_RECOVERY_COOLDOWN: 409,
      CART_RECOVERY_MAIL_UNAVAILABLE: 503,
      CART_RECOVERY_EMAIL_FAILED: 502,
    };
    const status = statuses[error?.code] || 500;
    return res.status(status).json({
      error: statuses[error?.code] ? error.code : 'CART_RECOVERY_FAILED',
      message: statuses[error?.code] ? error.message : 'No fue posible registrar la recuperacion.',
    });
  }
});

router.delete('/:sessionId', async (req, res) => {
  const expectedVersion = readVersion(req);
  if (!expectedVersion) return res.status(428).json({ error: 'CART_ADMIN_VERSION_REQUIRED', message: 'Se requiere la version vigente.' });
  try {
    const deleted = await Cart.findOneAndDelete({
      sessionId: req.params.sessionId,
      updatedAt: expectedVersion,
    });
    if (!deleted) {
      const current = await Cart.findOne({ sessionId: req.params.sessionId }).lean();
      return current ? sendConflict(res, current) : sendNotFound(res);
    }
    return res.json({ message: 'Carrito eliminado correctamente.' });
  } catch (error) {
    console.error('Error eliminando carrito administrativo:', error?.code || 'unknown');
    return res.status(500).json({
      error: 'CART_ADMIN_DELETE_FAILED',
      message: 'No fue posible eliminar el carrito.',
    });
  }
});

module.exports = router;
module.exports.buildDetail = buildDetail;
