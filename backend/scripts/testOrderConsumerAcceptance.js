'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { buildAuthorizedOrderBody } = require('../services/authorizedCartOrderService');
const { acceptConsumerOffer } = require('../services/consumer/checkoutContract');

const fingerprint = 'a'.repeat(64);
const offer = { ready: true, fingerprint, pricing: { total: 100000 }, seller: { legalName: 'Vendedor de prueba' } };
const cart = { items: [] };
const authorize = body => buildAuthorizedOrderBody(body, cart, 'sesion-autorizada', { provider: 'manual', status: 'pending_manual' });

test('la aceptación llega desde el filtro de carrito hasta el contrato del servidor sin aceptar pruebas fabricadas', () => {
  const source = {
    total: 1, consumerContract: { acceptedAt: 'fecha-inventada', pricing: { total: 1 } },
    consumerAcceptance: { terms: true, privacy: true, fingerprint, acceptedAt: 'fecha-inventada', seller: 'otro-vendedor' },
  };
  const original = structuredClone(source);
  const authorized = authorize(source);
  assert.deepEqual(authorized.consumerAcceptance, { terms: true, privacy: true, fingerprint });
  assert.equal(authorized.total, undefined);
  assert.equal(authorized.consumerContract, undefined);
  const now = new Date('2026-11-20T12:00:00Z');
  const contract = acceptConsumerOffer(offer, authorized.consumerAcceptance, now);
  assert.equal(contract.acceptedAt, now);
  assert.equal(contract.pricing.total, 100000);
  assert.equal(contract.seller.legalName, offer.seller.legalName);
  assert.equal(contract.termsAccepted, true);
  assert.equal(contract.privacyAuthorized, true);
  assert.deepEqual(source, original);
});

test('ausencia, arrays y valores que aparentan true no conceden aceptación', () => {
  for (const acceptance of [undefined, null, [], 'true', { terms: 'true', privacy: true, fingerprint },
    { terms: true, privacy: 1, fingerprint }, { terms: false, privacy: true, fingerprint }]) {
    const authorized = authorize({ consumerAcceptance: acceptance });
    assert.throws(() => acceptConsumerOffer(offer, authorized.consumerAcceptance),
      error => error.code === 'CONSUMER_ACCEPTANCE_REQUIRED');
  }
});

test('una huella diferente o inválida llega al control de cambio de oferta y no genera un contrato', () => {
  for (const value of ['otra-oferta', {}, null, 'a'.repeat(256)]) {
    const authorized = authorize({ consumerAcceptance: { terms: true, privacy: true, fingerprint: value } });
    assert.throws(() => acceptConsumerOffer(offer, authorized.consumerAcceptance),
      error => error.code === 'CONSUMER_OFFER_CHANGED');
  }
});
