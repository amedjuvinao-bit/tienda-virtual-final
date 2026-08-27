'use strict';

const crypto = require('crypto');

const { buildFulfillmentEmail, getCustomerEmail } = require('./presentation');
const { clean } = require('./support');

async function sendFulfillmentNotification({
  order,
  previous,
  now,
  OrderModel,
  mailer,
  randomUUID = () => crypto.randomUUID(),
}) {
  const alreadySent = previous.notificationStatus === 'sent';

  if (alreadySent) {
    return { skipped: false, reused: true, order };
  }

  const staleClaimBefore = new Date(
    now.getTime() - 10 * 60 * 1000
  );
  const notificationClaimId = clean(randomUUID(), 120);
  if (!notificationClaimId) {
    throw Object.assign(
      new Error('No fue posible crear el reclamo de notificación.'),
      { code: 'FULFILLMENT_NOTIFICATION_CLAIM_ID_REQUIRED' }
    );
  }
  const notificationClaim = await OrderModel.findOneAndUpdate(
    {
      _id: order._id,
      $or: [
        {
          'fulfillment.notificationStatus': {
            $in: ['pending', 'failed'],
          },
        },
        {
          'fulfillment.notificationStatus': 'sending',
          'fulfillment.notificationClaimedAt': {
            $lt: staleClaimBefore,
          },
        },
      ],
    },
    {
      $set: {
        'fulfillment.notificationStatus': 'sending',
        'fulfillment.notificationClaimId': notificationClaimId,
        'fulfillment.notificationClaimedAt': now,
        'fulfillment.notificationError': '',
      },
    },
    { new: true }
  );

  if (!notificationClaim) {
    return {
      skipped: false,
      reused: true,
      notificationInProgress: true,
      order,
    };
  }

  const to = getCustomerEmail(order);
  const claimFence = {
    _id: order._id,
    'fulfillment.notificationStatus': 'sending',
    'fulfillment.notificationClaimId': notificationClaimId,
  };
  if (!to) {
    await OrderModel.updateOne(
      claimFence,
      {
        $set: {
          'fulfillment.notificationStatus': 'failed',
          'fulfillment.notificationClaimId': '',
          'fulfillment.notificationClaimedAt': null,
          'fulfillment.notificationError':
            'La orden no tiene correo del cliente.',
        },
      }
    );
    return {
      skipped: false,
      notified: false,
      order,
    };
  }

  try {
    const message = buildFulfillmentEmail(order);
    await mailer({
      to,
      subject: message.subject,
      html: message.html,
    });
    await OrderModel.updateOne(
      claimFence,
      {
        $set: {
          'fulfillment.notificationStatus': 'sent',
          'fulfillment.notificationClaimId': '',
          'fulfillment.notificationClaimedAt': null,
          'fulfillment.notifiedAt': new Date(),
          'fulfillment.notificationError': '',
        },
      }
    );
    return {
      skipped: false,
      notified: true,
      order,
    };
  } catch (error) {
    await OrderModel.updateOne(
      claimFence,
      {
        $set: {
          'fulfillment.notificationStatus': 'failed',
          'fulfillment.notificationClaimId': '',
          'fulfillment.notificationClaimedAt': null,
          'fulfillment.notificationError': clean(
            error.message,
            500
          ),
        },
      }
    );
    return {
      skipped: false,
      notified: false,
      notificationError: error.message,
      order,
    };
  }
}

module.exports = {
  sendFulfillmentNotification,
};
