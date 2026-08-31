'use strict';

const MAX_ORDER_TIMELINE_ENTRIES = 200;

function retainRecentOrderTimeline(
  entries,
  maximum = MAX_ORDER_TIMELINE_ENTRIES
) {
  const source = Array.isArray(entries) ? entries : [];
  const safeMaximum = Number.isInteger(maximum) && maximum > 0
    ? maximum
    : MAX_ORDER_TIMELINE_ENTRIES;
  return source.length > safeMaximum
    ? source.slice(source.length - safeMaximum)
    : source;
}

function applyOrderTimelineRetention(order) {
  if (!order) return [];
  if (!Array.isArray(order.timeline)) {
    order.timeline = [];
    return order.timeline;
  }
  const current = order.timeline;
  const retained = retainRecentOrderTimeline(current);
  if (retained !== current) order.timeline = retained;
  return retained;
}

module.exports = {
  MAX_ORDER_TIMELINE_ENTRIES,
  applyOrderTimelineRetention,
  retainRecentOrderTimeline,
};
