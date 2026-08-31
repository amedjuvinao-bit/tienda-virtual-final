'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const mongoose = require('mongoose');
const {
  buildOrderAdminCursorCriteria,
  buildPagePipeline,
  decodeOrderAdminCursor,
  encodeOrderAdminCursor,
  isCanonicalCursorSort,
  queryAdminOrders,
  resolveOrderAdminCursorPagination,
} = require('../services/orderAdminQueryService');

const ROOT = path.resolve(__dirname, '..', '..');
const INVOICE_MODEL = { collection: { name: 'electronicinvoices' } };

const checks = [];
function ok(message) {
  checks.push(message);
  console.log(`OK ${checks.length}: ${message}`);
}

function objectIdFromNumber(value) {
  return new mongoose.Types.ObjectId(
    Number(value).toString(16).padStart(24, '0')
  );
}

function findCursorCriteria(value) {
  if (!value || typeof value !== 'object') return null;
  if (
    Array.isArray(value.$or) &&
    value.$or.length === 2 &&
    value.$or[0]?.createdAt?.$lt instanceof Date &&
    value.$or[1]?.createdAt instanceof Date &&
    value.$or[1]?._id?.$lt
  ) {
    return value;
  }
  for (const child of Object.values(value)) {
    if (Array.isArray(child)) {
      for (const entry of child) {
        const found = findCursorCriteria(entry);
        if (found) return found;
      }
    } else {
      const found = findCursorCriteria(child);
      if (found) return found;
    }
  }
  return null;
}

function createVolumeOrderModel(rows, calls) {
  return {
    aggregate(pipeline) {
      const summary = pipeline.some((stage) => stage.$facet);
      const call = { pipeline, summary, allowDiskUse: false };
      calls.push(call);
      let output;
      if (summary) {
        output = [
          {
            financial: {
              totalOrders: rows.length,
              totalSales: 0,
              pendingAmount: 0,
              paidOrders: 0,
              pendingOrders: rows.length,
              cancelledOrders: 0,
              invoiceRequiredOrders: rows.length,
              withInvoiceOrders: 0,
              validatedInvoiceOrders: 0,
              averageTicket: 0,
            },
            operational: { total: rows.length },
          },
        ];
      } else {
        const cursor = findCursorCriteria(pipeline[0]?.$match);
        const limit = pipeline.find((stage) => stage.$limit)?.$limit || 20;
        output = rows
          .filter((row) => {
            if (!cursor) return true;
            const dateLimit = cursor.$or[0].createdAt.$lt;
            const idLimit = cursor.$or[1]._id.$lt;
            return (
              row.createdAt < dateLimit ||
              (row.createdAt.getTime() === dateLimit.getTime() &&
                String(row._id) < String(idLimit))
            );
          })
          .sort((left, right) => {
            const byDate = right.createdAt.getTime() - left.createdAt.getTime();
            if (byDate) return byDate;
            return String(right._id).localeCompare(String(left._id));
          })
          .slice(0, limit);
      }
      return {
        allowDiskUse(value) {
          call.allowDiskUse = value;
          return Promise.resolve(output);
        },
      };
    },
  };
}

async function run() {
  const cursorRow = {
    _id: objectIdFromNumber(42),
    createdAt: new Date('2026-08-27T15:30:45.123Z'),
  };
  const token = encodeOrderAdminCursor(cursorRow);
  const decoded = decodeOrderAdminCursor(token);
  assert.equal(decoded.createdAt.toISOString(), cursorRow.createdAt.toISOString());
  assert.equal(String(decoded._id), String(cursorRow._id));
  assert.equal(token.includes(String(cursorRow._id)), false);
  ok('el cursor opaco conserva únicamente createdAt e _id canónicos');

  const arbitraryObject = Buffer.from(
    JSON.stringify({ $where: 'return true', createdAt: cursorRow.createdAt }),
    'utf8'
  ).toString('base64url');
  const malformed = [
    arbitraryObject,
    `${token}!`,
    Buffer.from(`v2.${Date.now().toString(36)}.${String(cursorRow._id)}`).toString(
      'base64url'
    ),
    Buffer.from(`v1.zzzzzzzzzzzzzzzz.${String(cursorRow._id)}`).toString(
      'base64url'
    ),
    'a'.repeat(181),
  ];
  malformed.forEach((value) =>
    assert.throws(
      () => decodeOrderAdminCursor(value),
      (error) =>
        error.code === 'ORDER_ADMIN_CURSOR_INVALID' && error.statusCode === 400
    )
  );
  ok('objetos, versiones, fechas y alfabetos arbitrarios se rechazan con 400');

  assert.equal(isCanonicalCursorSort(''), true);
  assert.equal(isCanonicalCursorSort('createdAt:-1'), true);
  assert.equal(isCanonicalCursorSort('createdAt:desc,_id:-1'), true);
  assert.equal(isCanonicalCursorSort('total:desc'), false);
  assert.equal(isCanonicalCursorSort('createdAt:asc'), false);
  assert.equal(isCanonicalCursorSort('campo_inseguro:desc'), false);
  assert.throws(
    () =>
      resolveOrderAdminCursorPagination({
        pagination: 'cursor',
        sort: 'total:desc',
      }),
    (error) => error.code === 'ORDER_ADMIN_CURSOR_SORT_UNSUPPORTED'
  );
  assert.throws(
    () => resolveOrderAdminCursorPagination({ cursor: token, page: '2' }),
    (error) => error.code === 'ORDER_ADMIN_CURSOR_PAGE_CONFLICT'
  );
  assert.throws(
    () =>
      resolveOrderAdminCursorPagination({
        pagination: 'cursor',
        format: 'csv',
      }),
    (error) => error.code === 'ORDER_ADMIN_CURSOR_FORMAT_UNSUPPORTED'
  );
  assert.equal(resolveOrderAdminCursorPagination({ page: '3' }).enabled, false);
  ok('cursor solo admite el sort canónico y no mezcla page ni CSV');

  const criteria = buildOrderAdminCursorCriteria(decoded);
  const scopedFilter = {
    $or: [{ orderNumber: /^ORD/ }, { 'customer.name': /^ORD/ }],
  };
  const cursorPipeline = buildPagePipeline({
    filter: scopedFilter,
    invoiceFilter: 'all',
    sort: { createdAt: -1, _id: -1 },
    skip: 999999,
    limit: 101,
    cursorCriteria: criteria,
    cursorMode: true,
    ElectronicInvoiceModel: INVOICE_MODEL,
  });
  assert.equal(cursorPipeline.some((stage) => '$skip' in stage), false);
  assert.deepEqual(cursorPipeline.find((stage) => stage.$sort)?.$sort, {
    createdAt: -1,
    _id: -1,
  });
  assert.equal(cursorPipeline.find((stage) => stage.$limit)?.$limit, 101);
  assert.deepEqual(cursorPipeline[0].$match.$and[0], scopedFilter);
  assert.deepEqual(cursorPipeline[0].$match.$and[1], criteria);
  ok('el pipeline keyset combina filtros sin pisar $or y nunca agrega $skip');

  const baseDate = new Date('2026-08-27T12:00:00.000Z');
  const rows = Array.from({ length: 10_250 }, (_, index) => ({
    _id: objectIdFromNumber(index + 1),
    createdAt: new Date(baseDate.getTime() - Math.floor(index / 250) * 1000),
    orderNumber: `VOL-${String(index + 1).padStart(6, '0')}`,
    status: 'pending',
    total: 1000,
    items: [],
  }));
  const calls = [];
  const OrderModel = createVolumeOrderModel(rows, calls);
  const first = await queryAdminOrders(
    {
      adminRole: 'owner',
      query: { pagination: 'cursor', limit: '100' },
    },
    { OrderModel, ElectronicInvoiceModel: INVOICE_MODEL }
  );
  assert.equal(first.page, 1);
  assert.equal(first.limit, 100);
  assert.equal(first.paginationMode, 'cursor');
  assert.equal(first.data.length, 100);
  assert.equal(first.hasMore, true);
  assert.ok(first.nextCursor);
  assert.equal(first.total, 10_250);
  assert.equal(first.totalPages, 103);
  assert.equal(calls.length, 2);
  assert.equal(calls.every((call) => call.allowDiskUse), true);
  const firstPageCall = calls.find((call) => !call.summary);
  const firstSummaryCall = calls.find((call) => call.summary);
  assert.equal(firstPageCall.pipeline.some((stage) => '$skip' in stage), false);
  assert.equal(firstPageCall.pipeline.find((stage) => stage.$limit).$limit, 101);
  assert.equal(findCursorCriteria(firstSummaryCall.pipeline), null);
  ok('10.250 órdenes entregan 100 filas y métricas globales sin SKIP');

  const firstIds = new Set(first.data.map((row) => String(row._id)));
  const firstBoundary = decodeOrderAdminCursor(first.nextCursor);
  rows.push({
    _id: new mongoose.Types.ObjectId('ffffffffffffffffffffffff'),
    createdAt: new Date(baseDate.getTime() + 1000),
    orderNumber: 'VOL-NEWER-AFTER-FIRST-PAGE',
    status: 'pending',
    total: 1000,
    items: [],
  });
  calls.length = 0;
  const second = await queryAdminOrders(
    {
      adminRole: 'owner',
      query: {
        pagination: 'cursor',
        cursor: first.nextCursor,
        limit: '1000',
        includeSummary: '0',
        sort: 'createdAt:-1,_id:-1',
      },
    },
    { OrderModel, ElectronicInvoiceModel: INVOICE_MODEL }
  );
  assert.equal(second.limit, 100);
  assert.equal(second.data.length, 100);
  assert.equal(second.summaryIncluded, false);
  assert.equal(second.data.some((row) => firstIds.has(String(row._id))), false);
  assert.equal(
    second.data.some((row) => row.orderNumber === 'VOL-NEWER-AFTER-FIRST-PAGE'),
    false
  );
  assert.equal(second.data[0].createdAt.getTime(), firstBoundary.createdAt.getTime());
  assert.ok(String(second.data[0]._id) < String(firstBoundary._id));
  assert.equal(calls.length, 1);
  assert.equal(calls[0].pipeline.some((stage) => '$skip' in stage), false);
  const secondCriteria = findCursorCriteria(calls[0].pipeline[0].$match);
  assert.equal(secondCriteria.$or[0].createdAt.$lt.getTime(), firstBoundary.createdAt.getTime());
  assert.equal(String(secondCriteria.$or[1]._id.$lt), String(firstBoundary._id));
  ok('empates de fecha continúan por _id y una inserción nueva no duplica filas');

  const orderedRows = rows
    .filter((row) => row.orderNumber !== 'VOL-NEWER-AFTER-FIRST-PAGE')
    .sort((left, right) => {
      const byDate = right.createdAt.getTime() - left.createdAt.getTime();
      return byDate || String(right._id).localeCompare(String(left._id));
    });
  const nearEndCursor = encodeOrderAdminCursor(orderedRows[10_199]);
  const finalPage = await queryAdminOrders(
    {
      adminRole: 'owner',
      query: {
        pagination: 'cursor',
        cursor: nearEndCursor,
        limit: '100',
        includeSummary: '0',
      },
    },
    { OrderModel, ElectronicInvoiceModel: INVOICE_MODEL }
  );
  assert.equal(finalPage.data.length, 50);
  assert.equal(finalPage.hasMore, false);
  assert.equal(finalPage.nextCursor, null);
  ok('la última página informa hasMore=false y no emite un cursor ficticio');

  let aggregateCalls = 0;
  await assert.rejects(
    () =>
      queryAdminOrders(
        {
          adminRole: 'owner',
          query: { pagination: 'cursor', cursor: arbitraryObject },
        },
        {
          OrderModel: {
            aggregate() {
              aggregateCalls += 1;
              throw new Error('AGGREGATE_MUST_NOT_RUN');
            },
          },
          ElectronicInvoiceModel: INVOICE_MODEL,
        }
      ),
    (error) => error.code === 'ORDER_ADMIN_CURSOR_INVALID'
  );
  assert.equal(aggregateCalls, 0);
  const controllerSource = fs.readFileSync(
    path.join(ROOT, 'backend/controllers/orderAdminQueryController.js'),
    'utf8'
  );
  assert.ok(controllerSource.includes("Number(error?.statusCode) === 400"));
  assert.ok(controllerSource.includes("error.code || 'ORDER_ADMIN_QUERY_INVALID'"));
  ok('un cursor inválido falla antes de consultar MongoDB y conserva HTTP 400');

  const legacyPipeline = buildPagePipeline({
    filter: {},
    invoiceFilter: 'all',
    sort: { total: 1, _id: 1 },
    skip: 40,
    limit: 20,
    ElectronicInvoiceModel: INVOICE_MODEL,
  });
  assert.equal(legacyPipeline.find((stage) => stage.$skip).$skip, 40);
  assert.equal(legacyPipeline.find((stage) => stage.$limit).$limit, 20);
  ok('page/limit y sorts alternos mantienen su pipeline anterior');

  console.log(`\nPaginación cursor de Órdenes: ${checks.length}/${checks.length} controles aprobados.`);
}

run().catch((error) => {
  console.error('\nFAIL paginación cursor de Órdenes');
  console.error(error);
  process.exitCode = 1;
});
