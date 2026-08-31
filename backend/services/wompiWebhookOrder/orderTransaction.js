'use strict';

function createOrderTransactionRunner({
  mongooseAdapter,
  OrderModel,
  OrderEventModel,
  loadStoreCredit,
}) {
  return async function withOrderTransaction(orderNumber, work) {
    const session = await mongooseAdapter.startSession();

    try {
      let result;
      await session.withTransaction(async () => {
        const order = await OrderModel.findOne({ orderNumber }).session(session);

        if (!order) {
          throw Object.assign(
            new Error(`No se encontro la orden ${orderNumber}.`),
            { code: 'ORDER_NOT_FOUND' }
          );
        }

        result = await work(order, { session });

        if (
          order.storeCredit?.applied === true &&
          String(order.payment?.status || '').trim().toLowerCase() === 'paid'
        ) {
          const { consumeReservedStoreCreditForOrder } = loadStoreCredit();
          const storeCreditResult = await consumeReservedStoreCreditForOrder(
            order,
            { session }
          );
          if (
            storeCreditResult.consumed === true &&
            storeCreditResult.duplicate !== true
          ) {
            await OrderEventModel.create(
              [
                {
                  orderId: order._id,
                  type: 'store_credit_consumed',
                  message: 'Saldo a favor aplicado definitivamente al pago.',
                  meta: {
                    provider: 'store_credit',
                    amount: Number(storeCreditResult.usage?.amount || 0),
                    currency: storeCreditResult.usage?.currency || 'COP',
                  },
                },
              ],
              { session }
            );
          }
        }
        await order.save({ session });
      });
      return result;
    } finally {
      await session.endSession();
    }
  };
}

module.exports = { createOrderTransactionRunner };
