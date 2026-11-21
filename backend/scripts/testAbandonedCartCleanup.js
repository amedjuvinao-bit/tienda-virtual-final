'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { deleteEligibleCart } = require('./cleanupAbandonedCarts');
const { buildCartRetentionMatch } = require('./previewAbandonedCartRetention');

const candidate = { _id: 'cart-id', sessionId: 'cart-session' };
const now = new Date('2026-11-17T01:35:33Z');

test('un pedido creado después de la simulación impide el borrado', async () => {
  const session = { withTransaction: (operation) => operation() };
  const orders = {
    async findOne(query, options) {
      assert.deepEqual(query, { sessionId: candidate.sessionId });
      assert.equal(options.session, session);
      return { _id: 'order-id' };
    },
  };
  const carts = {
    async deleteOne() {
      assert.fail('No se puede borrar un carrito con pedido');
    },
  };

  const deleted = await deleteEligibleCart(candidate, { carts, orders, session });
  assert.equal(deleted, 0);
});

test('el borrado exige que el carrito actual cumpla todo el filtro de conservación', async () => {
  const session = { withTransaction: (operation) => operation() };
  const orders = { async findOne() { return null; } };
  const carts = {
    async deleteOne(query, options) {
      assert.equal(options.session, session);
      assert.deepEqual(query, {
        ...buildCartRetentionMatch(now),
        _id: candidate._id,
        sessionId: candidate.sessionId,
      });
      return { deletedCount: 0 };
    },
  };

  const deleted = await deleteEligibleCart(candidate, {
    carts,
    orders,
    session,
    clock: () => now,
  });
  assert.equal(deleted, 0);
});

test('un reintento vuelve a consultar pedidos y devuelve solo el resultado confirmado', async () => {
  let attempts = 0;
  let deleteAttempts = 0;
  const session = {
    async withTransaction(operation) {
      attempts += 1;
      await operation();
      attempts += 1;
      return operation();
    },
  };
  const orders = {
    async findOne() {
      return attempts === 1 ? null : { _id: 'order-id' };
    },
  };
  const carts = {
    async deleteOne() {
      deleteAttempts += 1;
      return { deletedCount: 1 };
    },
  };

  const deleted = await deleteEligibleCart(candidate, {
    carts,
    orders,
    session,
    clock: () => now,
  });
  assert.equal(attempts, 2);
  assert.equal(deleteAttempts, 1);
  assert.equal(deleted, 0);
});
