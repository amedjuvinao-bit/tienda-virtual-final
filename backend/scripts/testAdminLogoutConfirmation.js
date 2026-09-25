'use strict';

const assert = require('node:assert/strict');
const express = require('express');
const AdminSession = require('../models/AdminSession');

process.env.JWT_SECRET ||= 'admin-logout-confirmation-test-secret-32-characters';
const adminAuth = require('../routes/adminAuth');

async function main() {
  const app = express();
  app.use(express.json());
  app.use('/api/admin/auth', adminAuth);
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));

  const originalUpdateOne = AdminSession.updateOne;
  const originalError = console.error;
  let shouldFail = false;
  let unacknowledged = false;
  let revocations = 0;
  AdminSession.updateOne = async (query, update) => {
    assert.equal(query.sessionId, 's'.repeat(32));
    assert.equal(query.revokedAt, null);
    assert.equal(update.$set.revokeReason, 'logout');
    revocations += 1;
    if (shouldFail) throw new Error('database temporarily unavailable');
    if (unacknowledged) return { acknowledged: false, modifiedCount: 0 };
    return { acknowledged: true, modifiedCount: 1 };
  };
  console.error = () => {};

  const logout = () => fetch(`http://127.0.0.1:${server.address().port}/api/admin/auth/logout`, {
    method: 'POST',
    headers: {
      origin: 'http://localhost:5173',
      'content-type': 'application/json',
      cookie: `rb_admin_refresh=${'s'.repeat(32)}.${'k'.repeat(64)}`,
    },
    body: '{}',
  });

  try {
    const invalidJson = await fetch(`http://127.0.0.1:${server.address().port}/api/admin/auth/logout`, {
      method: 'POST',
      headers: { origin: 'http://localhost:5173', 'content-type': 'application/json' },
      body: 'null',
    });
    assert.equal(invalidJson.status, 400, 'Express rejects the old null JSON body before logout');

    const validRefresh = await fetch(`http://127.0.0.1:${server.address().port}/api/admin/auth/refresh`, {
      method: 'POST',
      headers: { origin: 'http://localhost:5173', 'content-type': 'application/json' },
      body: '{}',
    });
    assert.equal(validRefresh.status, 401, 'a valid empty JSON body reaches refresh authentication');

    shouldFail = true;
    const failed = await logout();
    assert.equal(failed.status, 503);
    assert.equal((await failed.json()).ok, false);
    assert.equal(failed.headers.get('set-cookie'), null,
      'must retain HttpOnly cookie to retry server revocation');

    shouldFail = false;
    unacknowledged = true;
    const notConfirmed = await logout();
    assert.equal(notConfirmed.status, 503);
    assert.equal(notConfirmed.headers.get('set-cookie'), null);

    unacknowledged = false;
    const success = await logout();
    assert.equal(success.status, 200);
    assert.equal((await success.json()).ok, true);
    assert.match(success.headers.get('set-cookie') || '', /rb_admin_access=.*Expires=/);
    assert.equal(revocations, 3);

    const noSession = await fetch(`http://127.0.0.1:${server.address().port}/api/admin/auth/logout`, {
      method: 'POST', headers: { origin: 'http://localhost:5173' },
    });
    assert.equal(noSession.status, 200, 'already expired sessions can finish logout');
    assert.equal(revocations, 3);
    console.log('Admin logout confirmation: failure, retry, and expired cookie passed');
  } finally {
    AdminSession.updateOne = originalUpdateOne;
    console.error = originalError;
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
