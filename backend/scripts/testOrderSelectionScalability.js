'use strict';

const assert = require('assert');
const mongoose = require('mongoose');

const {
  MAX_ORDER_SELECTION_SIZE,
  parseSelectedOrderIds,
} = require('../services/orderRouteAccessService');

function main() {
  const first = new mongoose.Types.ObjectId();
  const second = new mongoose.Types.ObjectId();
  const parsed = parseSelectedOrderIds([
    String(first),
    String(first),
    String(second),
  ]);
  assert.strictEqual(parsed.valid, true);
  assert.strictEqual(parsed.tooMany, false);
  assert.strictEqual(parsed.count, 2);
  assert.deepStrictEqual(parsed.objectIds.map(String), [String(first), String(second)]);

  const invalid = parseSelectedOrderIds([String(first), 'orden-invalida']);
  assert.strictEqual(invalid.valid, false);

  const excessive = parseSelectedOrderIds(
    Array.from(
      { length: MAX_ORDER_SELECTION_SIZE + 1 },
      () => String(new mongoose.Types.ObjectId())
    )
  );
  assert.strictEqual(excessive.tooMany, true);
  assert.strictEqual(excessive.maximum, MAX_ORDER_SELECTION_SIZE);

  console.log('OK  Operaciones masivas deduplican, validan y limitan la selección');
}

main();
