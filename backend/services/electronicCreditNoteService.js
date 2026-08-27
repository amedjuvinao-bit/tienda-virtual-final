'use strict';

const crypto = require('crypto');
const mongoose = require('mongoose');

const ElectronicInvoice = require('../models/ElectronicInvoice');
const Order = require('../models/Order');
const SiteSettings = require('../models/SiteSettings');
const {
  sendCreditNoteToFactus,
} = require('../lib/dian/providers/factusProvider');
const {
  findCreditNoteByReferenceFromFactus,
} = require('../lib/dian/providers/factusRangeAwareProvider');
const {
  addCreditNoteCreatedEvent,
} = require('../lib/orders/orderTimeline');
const {
  sanitizeProviderPayload,
} = require('./electronicInvoiceIssuanceService');

const CREDIT_NOTE_REASONS = Object.freeze({
  '1': 'Devolución parcial de los bienes y/o no aceptación parcial del servicio',
  '2': 'Anulación de factura electrónica',
  '3': 'Rebaja o descuento parcial o total',
  '4': 'Ajuste de precio',
  '5': 'Descuento comercial por pronto pago',
  '6': 'Descuento comercial por volumen de ventas',
});
const ACTIVE_NOTE_STATUSES = new Set(['pending', 'processing', 'sent', 'validated']);
const COMPLETED_NOTE_STATUSES = new Set(['sent', 'validated']);
const CREDIT_NOTE_LOCK_MS = 5 * 60 * 1000;
const MAX_RECONCILIATION_ABSENCES = 3;

function cleanText(value, max = 500) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, max);
}

function money(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Number(number.toFixed(2)) : 0;
}

function toPlain(value) {
  return value?.toObject ? value.toObject() : value || {};
}

function createCreditNoteError(message, status, code, details = {}) {
  return Object.assign(new Error(message), { status, code, ...details });
}

function itemCode(item = {}, fallback = '') {
  return cleanText(
    item?.codeReference ||
      item?.code_reference ||
      item?.productId ||
      item?.product ||
      item?._id ||
      item?.id ||
      item?.title ||
      fallback,
    180
  );
}

function itemQuantity(item = {}) {
  const quantity = Number(item?.quantity ?? item?.qty ?? 0);
  return Number.isFinite(quantity) ? quantity : 0;
}

function itemPrice(item = {}) {
  return money(item?.price ?? item?.unitPrice ?? item?.priceNumber ?? 0);
}

function normalizeRequest(body = {}) {
  const type = cleanText(body.type, 20).toLowerCase();
  const reasonCode = cleanText(body.reasonCode, 10);
  const reasonText = cleanText(body.reason || body.reasonText, 250);
  const idempotencyKey = cleanText(body.idempotencyKey, 120);

  if (!['total', 'partial'].includes(type)) {
    throw createCreditNoteError(
      'El tipo de nota crédito debe ser total o parcial.',
      422,
      'BILLING_CREDIT_NOTE_TYPE_INVALID'
    );
  }

  if (!CREDIT_NOTE_REASONS[reasonCode]) {
    throw createCreditNoteError(
      'El motivo DIAN de la nota crédito no es válido.',
      422,
      'BILLING_CREDIT_NOTE_REASON_INVALID'
    );
  }

  if (reasonCode === '1' && type !== 'partial') {
    throw createCreditNoteError(
      'El concepto DIAN 1 corresponde únicamente a una devolución parcial.',
      422,
      'BILLING_CREDIT_NOTE_REASON_TYPE_MISMATCH'
    );
  }

  if (reasonCode === '2' && type !== 'total') {
    throw createCreditNoteError(
      'El concepto DIAN 2 corresponde a la anulación total de la factura.',
      422,
      'BILLING_CREDIT_NOTE_REASON_TYPE_MISMATCH'
    );
  }

  if (!reasonText) {
    throw createCreditNoteError(
      'Debes explicar el motivo de la nota crédito.',
      422,
      'BILLING_CREDIT_NOTE_OBSERVATION_REQUIRED'
    );
  }

  if (!/^[A-Za-z0-9_-]{8,120}$/.test(idempotencyKey)) {
    throw createCreditNoteError(
      'La solicitud de nota crédito no tiene una clave idempotente válida.',
      422,
      'BILLING_CREDIT_NOTE_IDEMPOTENCY_KEY_INVALID'
    );
  }

  return {
    type,
    reasonCode,
    reasonText,
    idempotencyKey,
    selectedItems: Array.isArray(body.selectedItems)
      ? body.selectedItems
      : Array.isArray(body.items)
        ? body.items
        : [],
  };
}

function normalizePartialItems(order = {}, requestedItems = []) {
  const orderItems = Array.isArray(order.items)
    ? order.items
    : Array.isArray(order.cart)
      ? order.cart
      : [];
  const originals = new Map(
    orderItems.map((item, index) => [itemCode(item, String(index)), { item, index }])
  );
  const seen = new Set();
  const normalized = [];

  for (const requested of requestedItems) {
    const code = itemCode(requested);
    if (!code || seen.has(code)) {
      throw createCreditNoteError(
        'La selección parcial contiene productos repetidos o sin identificación.',
        422,
        'BILLING_CREDIT_NOTE_ITEMS_INVALID'
      );
    }

    const original = originals.get(code);
    const requestedQuantity = itemQuantity(requested);
    const availableQuantity = itemQuantity(original?.item);

    if (!original || requestedQuantity <= 0 || requestedQuantity > availableQuantity) {
      throw createCreditNoteError(
        'La cantidad seleccionada no corresponde a los productos de la factura.',
        422,
        'BILLING_CREDIT_NOTE_QUANTITY_INVALID'
      );
    }

    seen.add(code);
    normalized.push({
      productId: code,
      codeReference: code,
      name: cleanText(original.item?.title || original.item?.name || 'Producto', 220),
      quantity: requestedQuantity,
      price: itemPrice(original.item),
      taxRate: money(original.item?.taxRate ?? order?.taxes?.iva?.percent ?? 0).toFixed(2),
      isExcluded: Number(original.item?.taxRate ?? order?.taxes?.iva?.percent ?? 0) <= 0,
    });
  }

  if (!normalized.length) {
    throw createCreditNoteError(
      'Para una nota crédito parcial debes seleccionar al menos un producto.',
      422,
      'BILLING_CREDIT_NOTE_ITEMS_REQUIRED'
    );
  }

  return normalized;
}

function buildRequestFingerprint(request = {}, selectedItems = []) {
  const canonical = {
    type: request.type,
    reasonCode: request.reasonCode,
    reasonText: request.reasonText,
    items: selectedItems
      .map((item) => ({ code: itemCode(item), quantity: itemQuantity(item) }))
      .sort((a, b) => a.code.localeCompare(b.code)),
  };
  return crypto.createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
}

function buildReferenceCode(order = {}, idempotencyKey = '') {
  const orderNumber = cleanText(order.orderNumber || order._id || 'ORDEN', 45)
    .replace(/[^A-Za-z0-9_-]+/g, '-');
  const suffix = crypto.createHash('sha256').update(idempotencyKey).digest('hex').slice(0, 16);
  return `NC-${orderNumber}-${suffix}`.slice(0, 100);
}

function isValidatedInvoice(invoice = {}) {
  const status = cleanText(invoice.status, 40).toLowerCase();
  return (
    cleanText(invoice?.provider?.name, 40).toLowerCase() === 'factus' &&
    (invoice?.provider?.isValidated === true || ['accepted', 'validated'].includes(status))
  );
}

function activeNotes(invoice = {}, exceptKey = '') {
  return (Array.isArray(invoice.creditNotes) ? invoice.creditNotes : []).filter((note) => {
    if (cleanText(note?.idempotencyKey, 120) === exceptKey) return false;
    const status = cleanText(note?.status, 40).toLowerCase();
    return ACTIVE_NOTE_STATUSES.has(status) || note?.emission?.state === 'processing';
  });
}

function assertCreditCapacity(invoice = {}, order = {}, request = {}, selectedItems = []) {
  const notes = activeNotes(invoice, request.idempotencyKey);
  const totalNote = notes.find((note) => note.type === 'total');

  if (totalNote) {
    throw createCreditNoteError(
      'La factura ya tiene una nota crédito total activa.',
      409,
      'BILLING_CREDIT_NOTE_TOTAL_EXISTS'
    );
  }

  if (request.type === 'total' && notes.length) {
    throw createCreditNoteError(
      'No se puede acreditar toda la factura porque ya tiene notas crédito parciales activas.',
      409,
      'BILLING_CREDIT_NOTE_PARTIALS_EXIST'
    );
  }

  if (request.type !== 'partial') return;

  const credited = new Map();
  notes.forEach((note) => {
    (Array.isArray(note.items) ? note.items : []).forEach((item) => {
      const code = itemCode(item);
      credited.set(code, money((credited.get(code) || 0) + itemQuantity(item)));
    });
  });

  const orderItems = Array.isArray(order.items)
    ? order.items
    : Array.isArray(order.cart)
      ? order.cart
      : [];
  const available = new Map(
    orderItems.map((item, index) => [itemCode(item, String(index)), itemQuantity(item)])
  );

  selectedItems.forEach((item) => {
    const code = itemCode(item);
    const remaining = money((available.get(code) || 0) - (credited.get(code) || 0));
    if (itemQuantity(item) > remaining) {
      throw createCreditNoteError(
        `La cantidad por acreditar de ${item.name || code} supera la cantidad restante de la factura.`,
        409,
        'BILLING_CREDIT_NOTE_QUANTITY_EXCEEDED'
      );
    }
  });
}

function firstPositiveInteger(...values) {
  for (const value of values) {
    const number = Number(value);
    if (Number.isInteger(number) && number > 0) return number;
  }
  return 0;
}

function extractRemoteDocument(payload = {}, type = 'invoice') {
  const data = payload?.data;
  const nested = data?.data;
  const keys = type === 'credit-note'
    ? ['credit_note', 'creditNote', 'note']
    : ['bill', 'invoice'];

  for (const container of [nested, data, payload]) {
    if (!container || typeof container !== 'object') continue;
    for (const key of keys) {
      if (container[key] && typeof container[key] === 'object') return container[key];
    }
    if (container.id || container.number || container.reference_code) return container;
  }
  return {};
}

function payloadItemsToSnapshot(payload = {}) {
  return (Array.isArray(payload.items) ? payload.items : []).map((item) => {
    const quantity = itemQuantity(item);
    const price = itemPrice(item);
    const discountAmount = money(item.discount_amount || 0);
    const taxable = money(Math.max(0, quantity * price - discountAmount));
    const taxRate = money(item.tax_rate ?? item?.taxes?.[0]?.rate ?? 0);
    const taxAmount = item.is_excluded === true ? 0 : money(taxable * (taxRate / 100));
    return {
      productId: itemCode(item),
      codeReference: itemCode(item),
      name: cleanText(item.name || 'Producto', 220),
      quantity,
      price,
      taxRate: taxRate.toFixed(2),
      isExcluded: item.is_excluded === true,
      reason: cleanText(item.note, 250),
      raw: {
        discountAmount,
        taxable,
        taxAmount,
      },
    };
  });
}

function payloadTotals(payload = {}) {
  return payloadItemsToSnapshot(payload).reduce((acc, item) => {
    const gross = money(item.quantity * item.price);
    const discount = money(item?.raw?.discountAmount || 0);
    const taxable = money(Math.max(0, gross - discount));
    const tax = money(item?.raw?.taxAmount || 0);
    acc.subtotal = money(acc.subtotal + taxable);
    acc.taxAmount = money(acc.taxAmount + tax);
    acc.totalAmount = money(acc.totalAmount + taxable + tax);
    return acc;
  }, { subtotal: 0, taxAmount: 0, totalAmount: 0 });
}

function isAmbiguousProviderFailure(result = {}) {
  const status = Number(result?.status || 0);
  const stage = cleanText(result?.stage, 100).toLowerCase();
  return (
    result?.requiresSync === true ||
    status >= 500 ||
    cleanText(result?.code, 100) === 'FACTUS_PENDING_CREDIT_NOTE' ||
    (!status && stage.includes('exception'))
  );
}

async function markCreditNoteForReconciliation({
  invoiceId,
  noteId,
  lockToken,
  error,
  confirmedNotFound,
}) {
  const now = new Date();
  const noteSet = {
    'creditNotes.$.status': 'processing',
    'creditNotes.$.errorMessage':
      'El resultado está pendiente de conciliación con Factus; no se volverá a emitir hasta confirmarlo.',
    'creditNotes.$.providerErrors': {
      code: error?.code || 'BILLING_CREDIT_NOTE_RECONCILIATION_PENDING',
      stage: error?.providerResult?.stage || '',
      httpStatus: Number(error?.providerResult?.status || 0) || null,
    },
    'creditNotes.$.emission.state': 'reconciliation_pending',
    'creditNotes.$.emission.reconciliationRequestedAt': now,
    'creditNotes.$.emission.lastAttemptAt': now,
  };
  const controlSet = {
    'creditNoteControl.state': 'idle',
    'creditNoteControl.lockToken': '',
    'creditNoteControl.requestKey': '',
    'creditNoteControl.lockedAt': null,
  };
  if (Number.isFinite(Number(confirmedNotFound))) {
    noteSet['creditNotes.$.emission.confirmedNotFound'] = Number(confirmedNotFound);
  }

  const guarded = await ElectronicInvoice.updateOne(
    {
      _id: invoiceId,
      'creditNotes._id': noteId,
      ...(lockToken ? { 'creditNoteControl.lockToken': lockToken } : {}),
    },
    { $set: { ...noteSet, ...controlSet } }
  );

  // Si el proveedor respondió pero se perdió el lease antes de persistir, no
  // liberamos el lease nuevo. Solo cercamos la misma nota si aún no fue
  // completada por otro worker.
  if (Number(guarded?.modifiedCount || guarded?.nModified || 0) === 0) {
    await ElectronicInvoice.updateOne(
      {
        _id: invoiceId,
        creditNotes: {
          $elemMatch: {
            _id: noteId,
            'emission.state': { $ne: 'completed' },
          },
        },
      },
      { $set: noteSet }
    );
  }
}

async function persistRemoteCreditNote({
  invoice,
  noteId,
  lockToken,
  referenceCode,
  remote,
  responseData,
  payload,
  reconciled = false,
}) {
  const noteNumber = cleanText(remote?.number, 160);
  const fiscalKey = cleanText(remote?.cude || remote?.cufe, 220);
  const remoteReferenceCode = cleanText(
    remote?.reference_code || remote?.referenceCode,
    180
  );
  const validated =
    remote?.is_validated === true || remote?.isValidated === true;

  if (!noteNumber) {
    throw createCreditNoteError(
      'Factus respondió, pero no devolvió el número oficial de la nota crédito.',
      503,
      'BILLING_CREDIT_NOTE_NUMBER_MISSING',
      { reconciliationPending: true }
    );
  }
  if (
    remoteReferenceCode &&
    remoteReferenceCode.toUpperCase() !== referenceCode.toUpperCase()
  ) {
    throw createCreditNoteError(
      'Factus devolvió una nota crédito con una referencia diferente a la solicitud.',
      502,
      'BILLING_CREDIT_NOTE_IDENTITY_MISMATCH'
    );
  }
  if (validated && !fiscalKey) {
    throw createCreditNoteError(
      'Factus marcó la nota crédito como validada, pero no devolvió su CUDE.',
      503,
      'BILLING_CREDIT_NOTE_CUDE_MISSING',
      { reconciliationPending: true }
    );
  }

  const completedAt = new Date();
  const snapshots = payloadItemsToSnapshot(payload || {});
  const totals = payloadTotals(payload || {});
  const set = {
    'creditNotes.$.status': validated ? 'validated' : 'sent',
    'creditNotes.$.referenceCode': remoteReferenceCode || referenceCode,
    'creditNotes.$.billNumber': cleanText(
      invoice?.provider?.number || invoice.invoiceNumber,
      160
    ),
    'creditNotes.$.provider': {
      name: 'factus',
      id: firstPositiveInteger(remote.id),
      status: validated ? 'validated' : cleanText(remote.status || 'sent', 80),
      number: noteNumber,
      cufe: fiscalKey,
      cude: fiscalKey,
      isValidated: validated,
      validatedAt: cleanText(remote.validated_at || remote.validatedAt, 120),
      links: sanitizeProviderPayload(remote.links || {}),
      raw: {
        ...sanitizeProviderPayload(remote),
        response: sanitizeProviderPayload(responseData || {}),
      },
    },
    'creditNotes.$.providerErrors': {},
    'creditNotes.$.errorMessage': '',
    'creditNotes.$.emission.state': 'completed',
    'creditNotes.$.emission.completedAt': completedAt,
    'creditNotes.$.emission.lastAttemptAt': completedAt,
    'creditNotes.$.emission.reconciledAt': reconciled ? completedAt : null,
    'creditNotes.$.emission.confirmedNotFound': 0,
    'creditNotes.$.sentAt': completedAt,
    'creditNotes.$.validatedAt': validated ? completedAt : null,
    'creditNotes.$.failedAt': null,
    'creditNoteControl.state': 'idle',
    'creditNoteControl.lockToken': '',
    'creditNoteControl.requestKey': '',
    'creditNoteControl.lockedAt': null,
  };
  if (snapshots.length) {
    set['creditNotes.$.subtotal'] = totals.subtotal;
    set['creditNotes.$.taxAmount'] = totals.taxAmount;
    set['creditNotes.$.totalAmount'] = totals.totalAmount;
    set['creditNotes.$.items'] = snapshots;
  }

  const updated = await ElectronicInvoice.findOneAndUpdate(
    {
      _id: invoice._id,
      'creditNotes._id': noteId,
      'creditNoteControl.lockToken': lockToken,
    },
    { $set: set },
    { new: true, runValidators: true }
  );
  if (!updated) {
    throw createCreditNoteError(
      'Factus procesó la nota, pero no fue posible guardar su resultado. Quedó pendiente de conciliación.',
      503,
      'BILLING_CREDIT_NOTE_PERSISTENCE_ERROR',
      { reconciliationPending: true }
    );
  }
  return updated;
}

async function findInvoice(identifier) {
  const text = cleanText(identifier, 160);
  if (!text) return null;
  if (mongoose.Types.ObjectId.isValid(text)) {
    const byId = await ElectronicInvoice.findById(text);
    if (byId) return byId;
  }
  return ElectronicInvoice.findOne({
    $or: [
      { invoiceNumber: text },
      { orderNumber: text.replace(/^#/, '') },
      { 'provider.number': text },
    ],
  });
}

async function releaseInvoiceLock(invoiceId, lockToken) {
  await ElectronicInvoice.updateOne(
    { _id: invoiceId, 'creditNoteControl.lockToken': lockToken },
    {
      $set: {
        'creditNoteControl.state': 'idle',
        'creditNoteControl.lockToken': '',
        'creditNoteControl.requestKey': '',
        'creditNoteControl.lockedAt': null,
      },
    }
  );
}

async function createOfficialCreditNote(invoiceIdentifier, body = {}, options = {}) {
  const request = normalizeRequest(body);
  const initialInvoice = await findInvoice(invoiceIdentifier);
  if (!initialInvoice) {
    throw createCreditNoteError(
      'Factura relacionada no encontrada.',
      404,
      'BILLING_INVOICE_NOT_FOUND'
    );
  }

  const now = new Date();
  const staleBefore = new Date(now.getTime() - CREDIT_NOTE_LOCK_MS);
  const lockToken = crypto.randomUUID();
  const locked = await ElectronicInvoice.findOneAndUpdate(
    {
      _id: initialInvoice._id,
      $or: [
        { 'creditNoteControl.state': { $ne: 'processing' } },
        { 'creditNoteControl.lockedAt': null },
        { 'creditNoteControl.lockedAt': { $lt: staleBefore } },
      ],
    },
    {
      $set: {
        'creditNoteControl.state': 'processing',
        'creditNoteControl.lockToken': lockToken,
        'creditNoteControl.requestKey': request.idempotencyKey,
        'creditNoteControl.lockedAt': now,
      },
    },
    { new: true }
  );

  if (!locked) {
    throw createCreditNoteError(
      'Ya se está procesando una nota crédito para esta factura.',
      409,
      'BILLING_CREDIT_NOTE_IN_PROGRESS'
    );
  }

  let noteId = null;
  try {
    const invoice = await ElectronicInvoice.findById(locked._id);
    const order = await Order.findById(invoice.orderId);
    if (!order) {
      throw createCreditNoteError('Orden relacionada no encontrada.', 404, 'BILLING_ORDER_NOT_FOUND');
    }
    if (!isValidatedInvoice(invoice)) {
      throw createCreditNoteError(
        'Solo se puede crear una nota crédito sobre una factura Factus validada.',
        422,
        'BILLING_CREDIT_NOTE_INVOICE_NOT_VALIDATED'
      );
    }
    const settings = await SiteSettings.findOne();
    const providerConfig = settings?.billing?.electronicProvider || {};

    const selectedItems = request.type === 'partial'
      ? normalizePartialItems(order, request.selectedItems)
      : [];
    const fingerprint = buildRequestFingerprint(request, selectedItems);
    const existing = invoice.creditNotes.find(
      (note) => cleanText(note.idempotencyKey, 120) === request.idempotencyKey
    );

    if (existing && existing.requestFingerprint && existing.requestFingerprint !== fingerprint) {
      throw createCreditNoteError(
        'La clave idempotente ya fue usada con datos diferentes.',
        409,
        'BILLING_CREDIT_NOTE_IDEMPOTENCY_CONFLICT'
      );
    }

    if (
      existing &&
      (COMPLETED_NOTE_STATUSES.has(cleanText(existing.status, 40).toLowerCase()) ||
        existing?.emission?.state === 'completed')
    ) {
      await releaseInvoiceLock(invoice._id, lockToken);
      return {
        created: false,
        reused: true,
        invoice,
        creditNote: existing,
        message: 'La nota crédito ya había sido procesada; se reutilizó el mismo documento oficial.',
      };
    }

    const referenceCode = existing?.referenceCode || buildReferenceCode(order, request.idempotencyKey);

    if (existing?.emission?.state === 'reconciliation_pending') {
      noteId = existing._id;
      const lookup = await findCreditNoteByReferenceFromFactus({
        settings,
        providerConfig,
        referenceCode,
      });

      if (lookup?.success && lookup?.found && lookup?.document) {
        const recovered = await persistRemoteCreditNote({
          invoice,
          noteId,
          lockToken,
          referenceCode,
          remote: lookup.document,
          responseData: lookup.data,
          payload: null,
          reconciled: true,
        });
        return {
          created: false,
          reused: true,
          invoice: recovered,
          creditNote: recovered.creditNotes.id(noteId),
          message: 'La nota crédito fue recuperada por su referencia exacta sin volver a emitirla.',
        };
      }

      const confirmedNotFound = lookup?.success
        ? Number(existing?.emission?.confirmedNotFound || 0) + 1
        : Number(existing?.emission?.confirmedNotFound || 0);
      if (!lookup?.success || confirmedNotFound < MAX_RECONCILIATION_ABSENCES) {
        const pendingError = createCreditNoteError(
          lookup?.success
            ? `Factus aún no devuelve la referencia exacta. Confirmación ${confirmedNotFound} de ${MAX_RECONCILIATION_ABSENCES}.`
            : 'No fue posible consultar Factus para conciliar la nota crédito.',
          503,
          'BILLING_CREDIT_NOTE_RECONCILIATION_PENDING',
          {
            reconciliationPending: true,
            confirmedNotFound,
            providerResult: lookup,
          }
        );
        throw pendingError;
      }
    }

    assertCreditCapacity(invoice, order, request, selectedItems);

    if (existing) {
      existing.type = request.type;
      existing.reasonCode = request.reasonCode;
      existing.reasonText = request.reasonText;
      existing.requestFingerprint = fingerprint;
      existing.referenceCode = referenceCode;
      existing.status = 'processing';
      existing.errorMessage = '';
      existing.providerErrors = {};
      existing.items = selectedItems;
      existing.emission = {
        ...(toPlain(existing.emission)),
        state: 'processing',
        source: 'admin-billing',
        initiatedBy: cleanText(options.adminUser || 'admin', 160),
        lockToken,
        attempts: Number(existing?.emission?.attempts || 0) + 1,
        firstAttemptAt: existing?.emission?.firstAttemptAt || now,
        lastAttemptAt: now,
      };
      noteId = existing._id;
    } else {
      invoice.creditNotes.push({
        idempotencyKey: request.idempotencyKey,
        requestFingerprint: fingerprint,
        type: request.type,
        status: 'processing',
        reasonCode: request.reasonCode,
        reasonText: request.reasonText,
        referenceCode,
        billNumber: cleanText(invoice?.provider?.number || invoice.invoiceNumber, 160),
        items: selectedItems,
        provider: { name: 'factus', status: 'processing' },
        emission: {
          state: 'processing',
          source: 'admin-billing',
          initiatedBy: cleanText(options.adminUser || 'admin', 160),
          lockToken,
          attempts: 1,
          firstAttemptAt: now,
          lastAttemptAt: now,
        },
        createdBy: cleanText(options.adminUser || 'admin', 160),
        createdAt: now,
      });
      noteId = invoice.creditNotes[invoice.creditNotes.length - 1]._id;
    }

    invoice.markModified('creditNotes');
    await invoice.save();

    const billNumber = cleanText(invoice?.provider?.number || invoice.invoiceNumber, 160);
    if (!billNumber) {
      throw createCreditNoteError(
        'La factura no tiene número oficial de Factus.',
        422,
        'BILLING_CREDIT_NOTE_INVOICE_NUMBER_MISSING'
      );
    }
    const result = await sendCreditNoteToFactus({
      electronicInvoice: invoice,
      order,
      settings,
      providerConfig,
      type: request.type,
      reasonCode: request.reasonCode,
      reasonText: request.reasonText,
      selectedItems,
      billNumber,
      referenceCode,
    });

    if (!result?.success) {
      throw createCreditNoteError(
        cleanText(result?.error, 500) || 'Factus no pudo crear la nota crédito.',
        isAmbiguousProviderFailure(result)
          ? 503
          : result?.status === 409
            ? 409
            : 502,
        result?.code || 'BILLING_CREDIT_NOTE_PROVIDER_ERROR',
        {
          providerResult: result,
          reconciliationPending: isAmbiguousProviderFailure(result),
        }
      );
    }

    const remote = extractRemoteDocument(result.data, 'credit-note');
    const payload = result.payload || {};
    const updated = await persistRemoteCreditNote({
      invoice,
      noteId,
      lockToken,
      referenceCode,
      remote,
      responseData: result.data,
      payload,
    });

    const updatedNote = updated.creditNotes.id(noteId);
    try {
      await addCreditNoteCreatedEvent({
        order,
        creditNoteData: remote,
        by: options.adminUser || 'admin',
      });
    } catch (timelineError) {
      // La auditoría de la orden no puede invalidar un documento fiscal ya emitido.
    }

    return {
      created: true,
      reused: false,
      invoice: updated,
      creditNote: updatedNote,
      message: updatedNote?.provider?.isValidated === true
        ? 'Nota crédito creada y validada correctamente por Factus.'
        : 'Nota crédito creada en Factus y pendiente de validación.',
    };
  } catch (error) {
    if (noteId) {
      if (error?.reconciliationPending === true) {
        await markCreditNoteForReconciliation({
          invoiceId: locked._id,
          noteId,
          lockToken,
          error,
          confirmedNotFound: error?.confirmedNotFound,
        });
        throw error;
      }
      const failedAt = new Date();
      await ElectronicInvoice.updateOne(
        { _id: locked._id, 'creditNotes._id': noteId },
        {
          $set: {
            'creditNotes.$.status': 'failed',
            'creditNotes.$.errorMessage': cleanText(error?.message, 500),
            'creditNotes.$.providerErrors': {
              code: error?.code || 'BILLING_CREDIT_NOTE_ERROR',
              stage: error?.providerResult?.stage || '',
              httpStatus: error?.providerResult?.status || null,
              details: sanitizeProviderPayload(
                error?.providerResult?.validationErrors || {}
              ),
            },
            'creditNotes.$.emission.state': 'failed',
            'creditNotes.$.emission.failedAt': failedAt,
            'creditNotes.$.emission.lastAttemptAt': failedAt,
            'creditNotes.$.failedAt': failedAt,
          },
        }
      );
    }
    await releaseInvoiceLock(locked._id, lockToken);
    throw error;
  }
}

module.exports = {
  ACTIVE_NOTE_STATUSES,
  CREDIT_NOTE_REASONS,
  buildReferenceCode,
  buildRequestFingerprint,
  createOfficialCreditNote,
  extractRemoteDocument,
  normalizePartialItems,
  normalizeRequest,
};
