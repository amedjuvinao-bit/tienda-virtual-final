'use strict';

const assert = require('node:assert/strict');

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function poll(label, load, matches, options = {}) {
  const timeoutMs = Number(options.timeoutMs || 90_000);
  const intervalMs = Number(options.intervalMs || 1_500);
  const startedAt = Date.now();
  let value = await load();
  while (!matches(value) && Date.now() - startedAt < timeoutMs) {
    await wait(intervalMs);
    value = await load();
  }
  assert(matches(value), `${label} no llegó mediante el webhook de Envia.`);
  return value;
}

module.exports = { poll, wait };
