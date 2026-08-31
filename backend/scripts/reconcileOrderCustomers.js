/* eslint-disable no-console */
'use strict';

require('dotenv').config({
  path: require('path').join(__dirname, '..', '.env'),
  quiet: true,
});

const mongoose = require('mongoose');

const Order = require('../models/Order');
const {
  applyCustomerResolutionToOrderData,
  applyCustomerStatsForOrder,
  buildCustomerPayloadFromOrder,
  findCustomerMatch,
  hasCustomerIdentity,
  isDemoOrder,
  resolveCustomerForOrder,
} = require('../services/customerOrderLinkService');

function parseOptions(argv = process.argv.slice(2)) {
  const apply = argv.includes('--apply');
  const limitArg = argv.find((item) => item.startsWith('--limit='));
  const sourcesArg = argv.find((item) => item.startsWith('--sources='));
  const limit = Math.min(
    5000,
    Math.max(1, Number(limitArg?.split('=')[1] || 1000) || 1000)
  );
  const sources = String(
    sourcesArg?.split('=')[1] || 'online,admin,manual,import'
  )
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter((value) => ['online', 'admin', 'manual', 'import'].includes(value));

  return {
    apply,
    limit,
    sources: sources.length ? sources : ['online'],
  };
}

function buildCandidateFilter({ sources, limit }) {
  return {
    filter: {
      source: { $in: sources },
      $or: [
        { 'customer.customerId': null },
        { 'customer.customerId': { $exists: false } },
      ],
    },
    limit,
  };
}

async function previewOrder(order) {
  if (isDemoOrder(order)) return { action: 'skip_demo' };

  const payload = buildCustomerPayloadFromOrder(order, {
    source: order.source,
  });
  if (!hasCustomerIdentity(payload)) return { action: 'skip_identity' };

  const match = await findCustomerMatch(payload);
  return match?.customer
    ? {
        action: 'link_existing',
        matchedBy: match.matchedBy,
        customerId: String(match.customer._id),
      }
    : { action: 'create_and_link' };
}

async function applyOrder(orderId) {
  const session = await mongoose.startSession();
  let result = { action: 'not_found' };

  try {
    await session.withTransaction(async () => {
      const order = await Order.findById(orderId).session(session);
      if (!order) return;
      if (isDemoOrder(order)) {
        result = { action: 'skip_demo' };
        return;
      }

      const resolution = await resolveCustomerForOrder(order, {
        session,
        source: order.source,
      });
      if (resolution.skipped) {
        result = { action: resolution.reason || 'skipped' };
        return;
      }

      const updated = applyCustomerResolutionToOrderData(
        order.toObject({ virtuals: false }),
        resolution
      );
      order.customer = updated.customer;
      order.customerRelationship = updated.customerRelationship;
      await order.save({ session });
      const stats = await applyCustomerStatsForOrder(order, { session });

      result = {
        action: resolution.created ? 'created_and_linked' : 'linked_existing',
        matchedBy: resolution.matchedBy,
        customerId: String(resolution.customer._id),
        statsApplied: stats.applied === true,
      };
    });
  } finally {
    await session.endSession();
  }

  return result;
}

async function main() {
  const options = parseOptions();
  const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;

  if (!mongoUri) {
    throw new Error('MONGODB_URI es obligatoria para conciliar órdenes y clientes.');
  }

  await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 12_000 });

  try {
    const { filter, limit } = buildCandidateFilter(options);
    const orders = await Order.find(filter)
      .sort({ createdAt: 1, _id: 1 })
      .limit(limit)
      .lean();
    const summary = {
      mode: options.apply ? 'APPLY' : 'DRY_RUN',
      sources: options.sources,
      inspected: orders.length,
      linked_existing: 0,
      linked_existing_preview: 0,
      created_and_linked: 0,
      create_and_link_preview: 0,
      skipped_demo: 0,
      skipped_identity: 0,
      stats_applied: 0,
      errors: 0,
    };

    for (const order of orders) {
      try {
        const result = options.apply
          ? await applyOrder(order._id)
          : await previewOrder(order);

        if (result.action === 'linked_existing') summary.linked_existing += 1;
        if (result.action === 'link_existing') summary.linked_existing_preview += 1;
        if (result.action === 'created_and_linked') summary.created_and_linked += 1;
        if (result.action === 'create_and_link') summary.create_and_link_preview += 1;
        if (result.action === 'skip_demo') summary.skipped_demo += 1;
        if (['skip_identity', 'customer_identity_required'].includes(result.action)) {
          summary.skipped_identity += 1;
        }
        if (result.statsApplied) summary.stats_applied += 1;
      } catch (error) {
        summary.errors += 1;
        console.error(
          `ERROR ${order.orderNumber || order._id}: ${error.code || error.message}`
        );
      }
    }

    console.log('\nCONCILIACIÓN ÓRDENES → CLIENTES');
    console.log(JSON.stringify(summary, null, 2));
    if (!options.apply) {
      console.log(
        '\nVista previa únicamente. Para aplicar usa: npm run orders:customers-reconcile:apply'
      );
    }

    if (summary.errors > 0) process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message || error);
    process.exitCode = 1;
  });
}

module.exports = {
  buildCandidateFilter,
  parseOptions,
};
