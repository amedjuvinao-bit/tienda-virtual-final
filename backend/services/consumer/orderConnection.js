"use strict";
const {
  resolveAuthorizedPublicPaymentOrder,
} = require("../publicPaymentAccessService");
const {
  resolveAuthorizedPublicReturnOrder,
} = require("../orderReturnAccessService");
const { error } = require("./cases");
async function authorizedCaseOrder(req, OrderModel) {
  const id = req.body?.orderId;
  if (!id) return null;
  if (typeof id !== "string" || !/^[a-f0-9]{24}$/i.test(id))
    throw error(
      "No pudimos verificar el acceso a la compra.",
      "CONSUMER_ORDER_ACCESS_INVALID",
      404,
    );
  const resolve = req.headers?.["x-order-return-token"]
    ? resolveAuthorizedPublicReturnOrder
    : resolveAuthorizedPublicPaymentOrder;
  const access = await resolve({ req, OrderModel, orderId: id });
  if (!access.allowed)
    throw error(
      "No pudimos verificar el acceso a la compra. Puedes radicar sin vincularla y escribir el número de pedido.",
      "CONSUMER_ORDER_ACCESS_INVALID",
      404,
    );
  return access.order;
}
function casesForOrder(order) {
  return {
    $or: [
      { order: order._id },
      { order: null, orderNumber: order.orderNumber },
    ],
  };
}
async function linkCaseToOrder(Model, doc, order, actor, revision) {
  if (!Number.isInteger(revision) || revision < 0)
    throw error("Actualiza la solicitud antes de vincularla.");
  if (!doc || doc.order)
    throw error(
      "La solicitud ya está vinculada o no está disponible.",
      "CONSUMER_CASE_CONFLICT",
      409,
    );
  const result = await Model.updateOne(
    { _id: doc._id, order: null, revision },
    {
      $set: {
        order: order._id,
        orderNumber: order.orderNumber,
        orderLink: { method: "admin_verified", at: new Date(), admin: actor },
      },
      $inc: { revision: 1 },
    },
  );
  if (result.modifiedCount !== 1)
    throw error(
      "La solicitud cambió. Actualiza antes de vincularla.",
      "CONSUMER_CASE_CONFLICT",
      409,
    );
}
module.exports = { authorizedCaseOrder, casesForOrder, linkCaseToOrder };
