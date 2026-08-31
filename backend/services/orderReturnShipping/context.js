'use strict';

const mongoose = require('mongoose');

const Branch = require('../../models/Branch');
const Order = require('../../models/Order');
const OrderReturn = require('../../models/OrderReturn');
const { createReturnError, idValue } = require('../orderReturns/normalization');
const { assertExpectedRevision } = require('../orderReturns/validation');

function orderBranchIds(order = {}) {
  const ids = new Set();
  [order.branch, ...(order.inventoryAllocations || []).map((item) => item?.branch),
    ...(order.fulfillment?.shipments || []).map((item) => item?.branch)]
    .map(idValue)
    .filter(Boolean)
    .forEach((id) => ids.add(id));
  return ids;
}

function validObjectId(value, label) {
  const id = idValue(value);
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw createReturnError(
      `${label} no es válida.`,
      'RETURN_SHIPPING_DESTINATION_INVALID',
      400
    );
  }
  return new mongoose.Types.ObjectId(id);
}

function destinationSnapshot(branch = {}) {
  return {
    name: branch.name || '',
    code: branch.code || '',
    phone: branch.contact?.phone || branch.contact?.whatsapp || '',
    email: branch.contact?.email || '',
    addressLine: branch.address?.addressLine || '',
    neighborhood: branch.address?.neighborhood || '',
    city: branch.address?.city || '',
    cityCode: branch.address?.cityCode || '',
    department: branch.address?.department || '',
    departmentCode: branch.address?.departmentCode || '',
    country: branch.address?.country || '',
    postalCode: branch.address?.postalCode || '',
  };
}

function defaultPackagesForBranch(order, branchId) {
  const shipment = (order.fulfillment?.shipments || []).find(
    (item) => idValue(item?.branch) === idValue(branchId) &&
      Array.isArray(item?.packages) && item.packages.length
  );
  return (shipment?.packages || []).map((item, index) => ({
    code: `RET-${index + 1}`,
    weightGrams: Number(item?.weightGrams || 0),
    lengthCm: Number(item?.lengthCm || 0),
    widthCm: Number(item?.widthCm || 0),
    heightCm: Number(item?.heightCm || 0),
  }));
}

async function returnShippingDestinations(
  order,
  { BranchModel = Branch } = {}
) {
  const ids = [...orderBranchIds(order)];
  if (!ids.length) return [];
  const query = BranchModel.find({
    _id: { $in: ids },
    active: true,
    status: 'active',
    deletedAt: null,
  });
  const branches = typeof query?.lean === 'function' ? await query.lean() : await query;
  return (branches || []).map((branch) => ({
    _id: branch._id,
    ...destinationSnapshot(branch),
    defaultPackages: defaultPackagesForBranch(order, branch._id),
  }));
}

async function loadReturnShippingContext(
  {
    orderFilter,
    returnId,
    expectedRevision,
    destinationBranchId = '',
    requireDestination = true,
    allowRevisionMismatch = false,
  } = {},
  {
    OrderModel = Order,
    OrderReturnModel = OrderReturn,
    BranchModel = Branch,
  } = {}
) {
  const order = await OrderModel.findOne(orderFilter);
  if (!order) {
    throw createReturnError('Orden no encontrada.', 'ORDER_NOT_FOUND', 404);
  }
  const returnCase = await OrderReturnModel.findOne({
    _id: validObjectId(returnId, 'El RMA'),
    order: order._id,
  });
  if (!returnCase) {
    throw createReturnError('RMA no encontrado.', 'RETURN_NOT_FOUND', 404);
  }
  let revisionMatches = true;
  try {
    assertExpectedRevision(returnCase, expectedRevision);
  } catch (error) {
    if (!allowRevisionMismatch || error?.code !== 'RETURN_REVISION_CONFLICT') {
      throw error;
    }
    revisionMatches = false;
  }
  if (!['authorized', 'in_transit'].includes(returnCase.status)) {
    throw createReturnError(
      'La logística inversa solo puede operar un RMA autorizado o en tránsito.',
      'RETURN_SHIPPING_STATUS_INVALID',
      409
    );
  }

  const requestedDestination =
    idValue(destinationBranchId) || idValue(returnCase.shipping?.destinationBranch);
  if (!requestedDestination && !requireDestination) {
    return { order, returnCase, destination: null, revisionMatches };
  }
  const destinationId = validObjectId(requestedDestination, 'La sede de recepción');
  if (!orderBranchIds(order).has(idValue(destinationId))) {
    throw createReturnError(
      'La sede de recepción debe pertenecer al recorrido original de la orden.',
      'RETURN_SHIPPING_DESTINATION_FORBIDDEN',
      403
    );
  }
  const destinationQuery = BranchModel.findOne({
    _id: destinationId,
    active: true,
    status: 'active',
    deletedAt: null,
  });
  const destination = typeof destinationQuery?.lean === 'function'
    ? await destinationQuery.lean()
    : await destinationQuery;
  if (!destination) {
    throw createReturnError(
      'La sede de recepción no está operativa.',
      'RETURN_SHIPPING_DESTINATION_UNAVAILABLE',
      409
    );
  }
  return { order, returnCase, destination, revisionMatches };
}

module.exports = {
  defaultPackagesForBranch,
  destinationSnapshot,
  loadReturnShippingContext,
  orderBranchIds,
  returnShippingDestinations,
};
