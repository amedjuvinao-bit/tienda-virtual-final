'use strict';

const {
  actorSnapshot,
  cleanLower,
  cleanText,
  createReturnError,
  idValue,
  toQuantity,
} = require('./normalization');

function assertExpectedRevision(returnCase, expectedRevision) {
  const revision = Number(expectedRevision);
  if (!Number.isInteger(revision) || revision < 0) {
    throw createReturnError('Debes enviar la revisión actual del RMA.', 'RETURN_REVISION_REQUIRED', 400);
  }
  if (Number(returnCase.revision || 0) !== revision) {
    throw createReturnError(
      'Otro usuario modificó este RMA. Recarga la información antes de continuar.',
      'RETURN_REVISION_CONFLICT',
      409,
      { expectedRevision: revision, currentRevision: Number(returnCase.revision || 0) }
    );
  }
}

function itemPatchMap(items = []) {
  return new Map(
    (Array.isArray(items) ? items : []).map((item) => [
      idValue(item?.orderItemId || item?._id),
      item || {},
    ])
  );
}

function applyAuthorization(returnCase, payload, actor, now) {
  if (returnCase.status !== 'requested') {
    throw createReturnError('Solo un RMA solicitado puede autorizarse.', 'RETURN_STATUS_INVALID', 409);
  }
  const patches = itemPatchMap(payload.items);
  let total = 0;
  for (const item of returnCase.items) {
    const patch = patches.get(idValue(item.orderItemId)) || {};
    const quantity = Object.prototype.hasOwnProperty.call(patch, 'authorizedQuantity')
      ? toQuantity(patch.authorizedQuantity)
      : item.requestedQuantity;
    if (quantity > item.requestedQuantity) {
      throw createReturnError('La autorización supera la cantidad solicitada.', 'RETURN_AUTHORIZED_QUANTITY_INVALID', 400);
    }
    item.authorizedQuantity = quantity;
    total += quantity;
  }
  if (!total) throw createReturnError('Autoriza al menos una unidad.', 'RETURN_AUTHORIZED_ITEMS_REQUIRED', 400);
  if (returnCase.riskAssessment?.decision === 'manual_review') {
    const reviewNote = cleanText(payload.riskReviewNote, 800);
    if (reviewNote.length < 8) {
      throw createReturnError(
        'Documenta la revisión de riesgo antes de autorizar.',
        'RETURN_RISK_REVIEW_REQUIRED',
        400
      );
    }
    returnCase.riskAssessment.decision = 'approved';
    returnCase.riskAssessment.reviewedAt = now;
    returnCase.riskAssessment.reviewNote = reviewNote;
    returnCase.riskAssessment.reviewedBy = actorSnapshot(actor);
  }
  returnCase.shipping = {
    ...(returnCase.shipping?.toObject?.() || returnCase.shipping || {}),
    method: cleanLower(payload.shipping?.method || 'pending', 40),
    carrierName: cleanText(payload.shipping?.carrierName, 160),
    trackingNumber: cleanText(payload.shipping?.trackingNumber, 180),
    trackingUrl: cleanText(payload.shipping?.trackingUrl, 1000),
    labelUrl: cleanText(payload.shipping?.labelUrl, 1000),
    labelType: cleanLower(
      payload.shipping?.labelUrl
        ? 'carrier'
        : payload.shipping?.labelType || 'internal_rma',
      40
    ),
    instructions: cleanText(
      payload.shipping?.instructions || returnCase.shipping?.instructions,
      1600
    ),
  };
  returnCase.status = 'authorized';
  returnCase.authorizedAt = now;
  returnCase.authorizedBy = actorSnapshot(actor);
}

function applyReceipt(returnCase, payload, actor, now) {
  if (!['authorized', 'in_transit'].includes(returnCase.status)) {
    throw createReturnError('El RMA no está listo para recepción.', 'RETURN_STATUS_INVALID', 409);
  }
  const patches = itemPatchMap(payload.items);
  let total = 0;
  for (const item of returnCase.items) {
    const patch = patches.get(idValue(item.orderItemId)) || {};
    const quantity = Object.prototype.hasOwnProperty.call(patch, 'receivedQuantity')
      ? toQuantity(patch.receivedQuantity)
      : item.authorizedQuantity;
    if (quantity > item.authorizedQuantity) {
      throw createReturnError('La recepción supera la cantidad autorizada.', 'RETURN_RECEIVED_QUANTITY_INVALID', 400);
    }
    item.receivedQuantity = quantity;
    total += quantity;
  }
  if (!total) throw createReturnError('Registra al menos una unidad recibida.', 'RETURN_RECEIVED_ITEMS_REQUIRED', 400);
  returnCase.status = 'received';
  returnCase.receivedAt = now;
  returnCase.receivedBy = actorSnapshot(actor);
}

function validateInspection(returnCase, inspections = []) {
  const patches = itemPatchMap(inspections);
  return returnCase.items.map((item) => {
    const patch = patches.get(idValue(item.orderItemId));
    if (!patch && item.receivedQuantity > 0) {
      throw createReturnError(`Falta inspeccionar ${item.title}.`, 'RETURN_INSPECTION_REQUIRED', 400);
    }
    const sellableQuantity = toQuantity(patch?.sellableQuantity);
    const damagedQuantity = toQuantity(patch?.damagedQuantity);
    const quarantineQuantity = toQuantity(patch?.quarantineQuantity);
    const rejectedQuantity = toQuantity(patch?.rejectedQuantity);
    const inspectedTotal =
      sellableQuantity + damagedQuantity + quarantineQuantity + rejectedQuantity;
    if (inspectedTotal !== toQuantity(item.receivedQuantity)) {
      throw createReturnError(
        `La inspección de ${item.title} debe clasificar exactamente ${item.receivedQuantity} unidad(es).`,
        'RETURN_INSPECTION_TOTAL_MISMATCH',
        400,
        { orderItemId: idValue(item.orderItemId), receivedQuantity: item.receivedQuantity, inspectedTotal }
      );
    }
    return {
      orderItemId: idValue(item.orderItemId),
      sellableQuantity,
      damagedQuantity,
      quarantineQuantity,
      rejectedQuantity,
      acceptedQuantity: sellableQuantity + damagedQuantity + quarantineQuantity,
      inspectionNote: cleanText(patch?.inspectionNote, 1000),
    };
  });
}

module.exports = {
  applyAuthorization,
  applyReceipt,
  assertExpectedRevision,
  validateInspection,
};
