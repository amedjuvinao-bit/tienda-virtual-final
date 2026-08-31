'use strict';

const assert = require('assert');
const mongoose = require('mongoose');

const OrderEvent = require('../models/OrderEvent');
const OrderNote = require('../models/OrderNote');
const {
  DEFAULT_ACTIVITY_PAGE_SIZE,
  MAX_ACTIVITY_PAGE_SIZE,
  listOrderNotesPage,
  listOrderTimelinePage,
  parseActivityPage,
  parseTimelineCursor,
} = require('../services/orderActivityQueryService');

function hasNamedIndex(model, name, keys) {
  return model.schema.indexes().some(([fields, options]) => (
    options.name === name &&
    Object.keys(fields).length === Object.keys(keys).length &&
    Object.entries(keys).every(([field, direction]) => fields[field] === direction)
  ));
}

function fakeQueryModel(documents, capture) {
  return {
    find(filter) {
      capture.filter = filter;
      const state = { skip: 0, limit: documents.length };
      return {
        sort(value) {
          capture.sort = value;
          return this;
        },
        skip(value) {
          state.skip = value;
          capture.skip = value;
          return this;
        },
        limit(value) {
          state.limit = value;
          capture.limit = value;
          return this;
        },
        async lean() {
          return documents.slice(state.skip, state.skip + state.limit);
        },
      };
    },
  };
}

async function main() {
  assert.deepStrictEqual(parseActivityPage({}), {
    limit: DEFAULT_ACTIVITY_PAGE_SIZE,
    page: 1,
    skip: 0,
  });
  assert.deepStrictEqual(parseActivityPage({ limit: 9999, page: 3 }), {
    limit: MAX_ACTIVITY_PAGE_SIZE,
    page: 3,
    skip: MAX_ACTIVITY_PAGE_SIZE * 2,
  });
  assert.deepStrictEqual(parseActivityPage({ limit: -5, page: 0 }), {
    limit: 1,
    page: 1,
    skip: 0,
  });

  const cursorId = new mongoose.Types.ObjectId();
  assert.strictEqual(String(parseTimelineCursor(cursorId)), String(cursorId));
  assert.strictEqual(parseTimelineCursor('cursor-invalido'), null);

  assert(
    hasNamedIndex(
      OrderEvent,
      'order_events_order_recent',
      { orderId: 1, _id: -1 }
    )
  );
  assert(
    hasNamedIndex(
      OrderNote,
      'order_notes_order_pinned_recent',
      { orderId: 1, pinned: -1, createdAt: -1 }
    )
  );

  const noteCapture = {};
  const notePage = await listOrderNotesPage(
    { orderId: 'order-1', query: { limit: 2 } },
    {
      OrderNoteModel: fakeQueryModel(
        [{ _id: 'n3' }, { _id: 'n2' }, { _id: 'n1' }],
        noteCapture
      ),
    }
  );
  assert.deepStrictEqual(noteCapture.sort, { pinned: -1, createdAt: -1 });
  assert.strictEqual(noteCapture.limit, 3);
  assert.strictEqual(notePage.items.length, 2);
  assert.strictEqual(notePage.pagination.hasMore, true);

  const timelineCapture = {};
  const timelinePage = await listOrderTimelinePage(
    { orderId: 'order-1', query: { limit: 2, cursor: cursorId } },
    {
      OrderEventModel: fakeQueryModel(
        [
          { _id: new mongoose.Types.ObjectId() },
          { _id: new mongoose.Types.ObjectId() },
          { _id: new mongoose.Types.ObjectId() },
        ],
        timelineCapture
      ),
    }
  );
  assert.strictEqual(String(timelineCapture.filter._id.$lt), String(cursorId));
  assert.deepStrictEqual(timelineCapture.sort, { _id: -1 });
  assert.strictEqual(timelineCapture.limit, 3);
  assert.strictEqual(timelinePage.items.length, 2);
  assert.strictEqual(timelinePage.pagination.hasMore, true);
  assert.strictEqual(
    timelinePage.pagination.nextCursor,
    String(timelinePage.items[1]._id)
  );

  console.log('OK  Timeline y notas tienen límites e índices orientados a sus consultas');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
