'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const express = require('express');

async function main() {
  const directory = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'tv-backup-gate-'));
  const previous = process.env.BACKUP_DIRECTORY;
  const id = 'a'.repeat(24);
  process.env.BACKUP_DIRECTORY = directory;
  await fs.promises.writeFile(path.join(directory, '.backup-maintenance.json'), JSON.stringify({ id, childPid: null }));
  await fs.promises.writeFile(path.join(directory, `backup-${id}.json`), JSON.stringify({ id, status: 'fallido' }));
  const maintenance = require('../services/backupMaintenanceService');
  const app = express();
  app.use(maintenance.middleware);
  app.post('/api/payments/webhook', (_req, res) => res.json({ wrote: true }));
  app.get('/api/products', (_req, res) => res.json({ ok: true }));
  const server = await new Promise((resolve) => {
    const listener = app.listen(0, () => resolve(listener));
  });
  try {
    assert.equal(maintenance.isActive(), true);
    const base = `http://127.0.0.1:${server.address().port}`;
    const blocked = await fetch(`${base}/api/payments/webhook`, { method: 'POST' });
    assert.equal(blocked.status, 503);
    assert.equal(blocked.headers.get('retry-after'), '600');
    const status = await (await fetch(`${base}/api/backup-maintenance/status`)).json();
    assert.equal(status.phase, 'requiere_revision');
    assert.equal(status.recoverable, true);
    await maintenance.recover();
    assert.equal(maintenance.isActive(), false);
    assert.equal((await fetch(`${base}/api/products`)).status, 200);
    assert.equal(fs.existsSync(path.join(directory, '.backup-maintenance.json')), false);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await fs.promises.rm(directory, { recursive: true, force: true });
    if (previous === undefined) delete process.env.BACKUP_DIRECTORY;
    else process.env.BACKUP_DIRECTORY = previous;
  }
  console.log('Mantenimiento: bloqueo tras reinicio, webhook 503 y recuperación controlada OK');
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
