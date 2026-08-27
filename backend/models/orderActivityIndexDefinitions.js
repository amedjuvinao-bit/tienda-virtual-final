'use strict';

const ORDER_EVENT_COLLECTION = 'order_events';
const ORDER_NOTE_COLLECTION = 'order_notes';
const ORDER_EVENT_RECENT_INDEX_NAME = 'order_events_order_recent';
const ORDER_NOTE_PINNED_RECENT_INDEX_NAME =
  'order_notes_order_pinned_recent';

function orderEventRecentIndexDefinition() {
  return {
    collection: ORDER_EVENT_COLLECTION,
    key: { orderId: 1, _id: -1 },
    options: { name: ORDER_EVENT_RECENT_INDEX_NAME },
  };
}

function orderNotePinnedRecentIndexDefinition() {
  return {
    collection: ORDER_NOTE_COLLECTION,
    key: { orderId: 1, pinned: -1, createdAt: -1 },
    options: { name: ORDER_NOTE_PINNED_RECENT_INDEX_NAME },
  };
}

function orderActivityIndexDefinitions() {
  return [
    orderEventRecentIndexDefinition(),
    orderNotePinnedRecentIndexDefinition(),
  ];
}

module.exports = {
  ORDER_EVENT_COLLECTION,
  ORDER_EVENT_RECENT_INDEX_NAME,
  ORDER_NOTE_COLLECTION,
  ORDER_NOTE_PINNED_RECENT_INDEX_NAME,
  orderActivityIndexDefinitions,
  orderEventRecentIndexDefinition,
  orderNotePinnedRecentIndexDefinition,
};
