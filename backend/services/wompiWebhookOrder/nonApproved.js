'use strict';

function createNonApprovedProcessor({
  OrderEventModel,
  OrderModel,
  claimNonApprovedPaymentAttempt,
  clean,
  loadStoreCredit,
  logger,
  merchantFingerprintFor,
  mongooseAdapter,
  paymentInventoryFailureService,
  resolveTransition,
  runInventoryTransaction,
}) {
  return async function processNonApproved({
    existingOrder,
    mapped,
    orderNumber,
    transaction,
    payments,
    reference,
    eventName,
  }) {
    const monotonicTransition = resolveTransition(existingOrder, mapped);

    if (monotonicTransition.ignored) {
      return {
        ok: true,
        received: true,
        ignored: true,
        reason: monotonicTransition.reason,
        event: eventName,
        orderNumber,
        orderStatus: existingOrder.status,
        paymentStatus: 'paid',
        transactionId: clean(
          existingOrder.payment?.transactionId || transaction.id,
          120
        ),
        reference: clean(existingOrder.payment?.reference, 180) || reference,
      };
    }

    const shouldRecoverFailedInventory =
      mapped.paymentStatus === 'failed' || mapped.paymentStatus === 'cancelled';

    return runInventoryTransaction({
      startSession: () => mongooseAdapter.startSession(),
      work: async (session) => {
        const order = await OrderModel.findOne({ orderNumber }).session(session);

        if (!order) {
          throw new Error(`ORDER_NOT_FOUND_TX_${orderNumber}`);
        }

        const attemptClaim = await claimNonApprovedPaymentAttempt(
          {
            order,
            provider: 'wompi',
            reference,
            transactionId: clean(transaction.id, 120),
            amountInCents: transaction.amount_in_cents,
            currency: transaction.currency || '',
            providerStatus: transaction.status,
            paymentStatus: mapped.paymentStatus,
            merchantFingerprint: merchantFingerprintFor(
              'wompi',
              payments?.credentials?.wompi?.publicKey
            ),
          },
          { session }
        );
        if (!attemptClaim.allowed) {
          return {
            ok: true,
            received: true,
            ignored: true,
            reason: attemptClaim.reason || 'PAYMENT_ATTEMPT_NOT_ACTIVE',
            event: eventName,
            orderNumber: order.orderNumber,
            orderStatus: order.status,
            paymentStatus: order.payment?.status || 'pending_gateway',
            transactionId: clean(transaction.id, 120),
            reference,
          };
        }

        const approvalContext = {
          orderId: order._id,
          provider: 'wompi',
          paymentReference: reference,
          paymentTransactionId: clean(transaction.id, 120),
        };

        const transitionInTransaction = resolveTransition(
          order,
          mapped,
          approvalContext
        );

        if (transitionInTransaction.ignored) {
          return {
            ok: true,
            received: true,
            ignored: true,
            reason: transitionInTransaction.reason,
            event: eventName,
            orderNumber: order.orderNumber,
            orderStatus: order.status,
            paymentStatus: 'paid',
            transactionId: clean(
              order.payment?.transactionId || transaction.id,
              120
            ),
            reference: clean(order.payment?.reference, 180) || reference,
          };
        }

        let inventoryRecovery = null;
        if (shouldRecoverFailedInventory) {
          inventoryRecovery = await paymentInventoryFailureService.process({
            order,
            paymentStatus: mapped.paymentStatus,
            provider: 'wompi',
            paymentReference: reference,
            paymentTransactionId: clean(transaction.id, 120),
            session,
            approvalContext,
          });
          if (inventoryRecovery.canonicalApproval === true) {
            return {
              ok: true,
              received: true,
              ignored: true,
              reason: 'APPROVED_IS_TERMINAL',
              event: eventName,
              orderNumber: order.orderNumber,
              orderStatus: order.status,
              paymentStatus: order.payment?.status || 'paid',
              transactionId: clean(
                order.payment?.transactionId || transaction.id,
                120
              ),
              reference: clean(order.payment?.reference, 180) || reference,
            };
          }
        }

        const beforeOrderStatus = String(order.status || '')
          .trim()
          .toLowerCase();
        const beforePaymentStatus = String(order.payment?.status || '')
          .trim()
          .toLowerCase();

        if (!order.payment || typeof order.payment !== 'object') {
          order.payment = {
            active: true,
            provider: 'wompi',
            providerLabel: 'Wompi',
            mode: payments.mode || 'sandbox',
            currency: payments.currency || 'COP',
            checkoutLabel: 'Wompi',
            enableWebhook: true,
            status: 'pending_gateway',
          };
        }

        order.payment.provider = 'wompi';
        order.payment.providerLabel = order.payment.providerLabel || 'Wompi';
        order.payment.mode = payments.mode || order.payment.mode || 'sandbox';
        order.payment.currency =
          clean(transaction.currency, 12).toUpperCase() ||
          order.payment.currency ||
          'COP';
        order.payment.enableWebhook = true;
        order.payment.status = mapped.paymentStatus;

        order.payment.methodType = clean(transaction.payment_method_type, 80);
        order.payment.method = clean(transaction.payment_method?.type, 80);
        order.payment.methodLabel =
          clean(transaction.payment_method_type, 80) ||
          clean(transaction.payment_method?.type, 80) ||
          '';

        order.payment.transactionId = clean(transaction.id, 120);
        order.payment.reference = clean(
          transaction.reference || reference,
          180
        );
        order.payment.amountInCents = Number(transaction.amount_in_cents || 0);
        order.payment.amount = Number(transaction.amount_in_cents || 0) / 100;
        order.payment.rawMethod = transaction.payment_method || {};

        if (mapped.orderStatus) {
          order.status = mapped.orderStatus;
        }

        const afterOrderStatus = String(order.status || '')
          .trim()
          .toLowerCase();
        const afterPaymentStatus = String(order.payment?.status || '')
          .trim()
          .toLowerCase();

        order.timeline = Array.isArray(order.timeline) ? order.timeline : [];

        if (
          beforeOrderStatus !== afterOrderStatus ||
          beforePaymentStatus !== afterPaymentStatus
        ) {
          const message = `Wompi webhook: ${mapped.label}${
            transaction.id ? ` · TX ${transaction.id}` : ''
          }${
            transaction.amount_in_cents
              ? ` · Valor ${transaction.amount_in_cents}`
              : ''
          }`;
          order.timeline.push({
            type: 'system',
            message,
            by: 'wompi_webhook',
            at: new Date(),
          });

          await OrderEventModel.create(
            [
              {
                orderId: order._id,
                type: 'payment_updated',
                message,
                meta: {
                  by: 'wompi_webhook',
                  provider: 'wompi',
                  transactionId: clean(transaction.id, 120),
                  reference,
                  fromOrderStatus: beforeOrderStatus || null,
                  toOrderStatus: afterOrderStatus || null,
                  fromPaymentStatus: beforePaymentStatus || null,
                  toPaymentStatus: afterPaymentStatus || null,
                },
              },
            ],
            { session }
          );
        }

        if (
          shouldRecoverFailedInventory &&
          inventoryRecovery?.duplicate !== true &&
          inventoryRecovery?.ignored !== true
        ) {
          await OrderEventModel.create(
            [
              {
                orderId: order._id,
                type:
                  inventoryRecovery.action === 'release_reservation'
                    ? 'inventory_reservation_released'
                    : 'inventory_failure_recovery_completed',
                message:
                  inventoryRecovery.action === 'legacy_compensation'
                    ? 'Inventario heredado compensado por pago no aprobado.'
                    : 'Recuperacion de inventario completada por pago no aprobado.',
                meta: {
                  provider: 'wompi',
                  orderNumber: order.orderNumber,
                  paymentStatus: mapped.paymentStatus,
                  action: inventoryRecovery.action,
                },
              },
            ],
            { session }
          );
        }

        if (shouldRecoverFailedInventory && order.storeCredit?.applied === true) {
          const { releaseReservedStoreCreditForOrder } = loadStoreCredit();
          const storeCreditRelease = await releaseReservedStoreCreditForOrder(
            order,
            {
              session,
              reason:
                mapped.paymentStatus === 'cancelled'
                  ? 'El pago restante fue cancelado en Wompi.'
                  : 'El pago restante fue rechazado por Wompi.',
            }
          );
          if (
            storeCreditRelease.released === true &&
            storeCreditRelease.duplicate !== true
          ) {
            await OrderEventModel.create(
              [
                {
                  orderId: order._id,
                  type: 'store_credit_released',
                  message:
                    'El saldo a favor reservado volvió a quedar disponible.',
                  meta: {
                    provider: 'store_credit',
                    amount: Number(storeCreditRelease.usage?.amount || 0),
                    currency: storeCreditRelease.usage?.currency || 'COP',
                    paymentStatus: mapped.paymentStatus,
                  },
                },
              ],
              { session }
            );
          }
        }

        await order.save({ session });

        logger.log('✅ ORDEN GUARDADA DESDE WEBHOOK WOMPI', {
          orderNumber: order.orderNumber,
          orderStatus: order.status,
          paymentStatus: order.payment?.status || '',
          restockedOnFailure: order.inventoryControl?.restockedOnFailure,
        });

        return {
          ok: true,
          received: true,
          event: eventName,
          orderNumber: order.orderNumber,
          orderStatus: order.status,
          paymentStatus: order.payment?.status || '',
          transactionId: clean(transaction.id, 120),
          reference,
        };
      },
    });
  };
}

module.exports = { createNonApprovedProcessor };
