'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');

async function main() {
  if (process.platform === 'win32') {
    console.log('Ensayo del coordinador omitido en Windows (usa ejecutables simulados Unix).');
    return;
  }
  const dir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'tv-backup-web-flow-'));
  const toolsDir = path.join(dir, 'tools');
  const backupDir = path.join(dir, 'backups');
  const old = { ...process.env };
  try {
    await fs.promises.mkdir(toolsDir);
    for (const binary of ['mongodump', 'mongorestore']) {
      const file = path.join(toolsDir, binary);
      await fs.promises.writeFile(file, '#!/usr/bin/env node\nprocess.exit(process.argv.includes("--version") ? 0 : 1);\n', { mode: 0o755 });
      await fs.promises.chmod(file, 0o755);
    }
    process.env.PATH = `${toolsDir}${path.delimiter}${process.env.PATH}`;
    process.env.MONGO_URI = 'mongodb://127.0.0.1:1/tienda_virtual';
    delete process.env.BACKUP_MONGODB_URI;
    process.env.STAGING_MONGODB_URI = 'mongodb://127.0.0.1:2/staging';
    process.env.BACKUP_DB_NAME = 'tienda_virtual';
    process.env.BACKUP_DIRECTORY = backupDir;
    process.env.BACKUP_ENCRYPTION_KEY = crypto.randomBytes(32).toString('hex');
    process.env.BACKUP_PANEL_SINGLE_INSTANCE = 'true';
    const maintenance = require('../services/backupMaintenanceService');
    assert.equal((await maintenance.readiness()).ready, true);
    const id = await maintenance.begin({ owner: 'test-owner' });
    assert.equal(maintenance.status().maintenance, true);
    await maintenance.launch(id);
    assert.equal(maintenance.status().phase, 'fallido');
    assert.equal(maintenance.status().maintenance, false);
    const record = JSON.parse(await fs.promises.readFile(path.join(backupDir, `backup-${id}.json`), 'utf8'));
    assert.equal(record.status, 'fallido');
    assert.equal(fs.existsSync(path.join(backupDir, '.backup-maintenance.json')), false);
    assert.equal((await fs.promises.readdir(backupDir)).some((name) => name.startsWith(`.working-${id}-`)), false);

    const mongoosePath = require.resolve('mongoose');
    const preload = path.join(dir, 'mock-mongo.js');
    await fs.promises.writeFile(preload, `const mongoose = require(${JSON.stringify(mongoosePath)});
mongoose.createConnection = () => ({ asPromise: async () => ({
  db: {
    listCollections: () => ({ toArray: async () => [{ name: 'adminusers', type: 'collection' }] }),
    collection: () => ({
      find: () => ({ async *[Symbol.asyncIterator]() { yield { _id: 1, username: 'owner' }; }, close: async () => {} }),
      listIndexes: () => ({ toArray: async () => [{ name: '_id_', key: { _id: 1 }, unique: true }] }),
    }),
    dropDatabase: async () => {},
  }, close: async () => {},
}) });
`);
    process.env.NODE_OPTIONS = `--require=${preload}`;
    await fs.promises.writeFile(path.join(toolsDir, 'mongodump'),
      '#!/usr/bin/env node\nconst fs=require("fs"); const archive=process.argv.find(a=>a.startsWith("--archive=")); if(archive) fs.writeFileSync(archive.slice(10), "test-archive"); process.exit(0);\n', { mode: 0o755 });
    await fs.promises.chmod(path.join(toolsDir, 'mongodump'), 0o755);
    await fs.promises.writeFile(path.join(toolsDir, 'mongorestore'), '#!/usr/bin/env node\nprocess.exit(0);\n', { mode: 0o755 });
    await fs.promises.chmod(path.join(toolsDir, 'mongorestore'), 0o755);
    const verifiedId = await maintenance.begin({ owner: 'test-owner' });
    await maintenance.launch(verifiedId);
    assert.equal(maintenance.status().phase, 'completado');
    assert.equal(maintenance.status().maintenance, false);
    const verified = JSON.parse(await fs.promises.readFile(path.join(backupDir, `backup-${verifiedId}.json`), 'utf8'));
    assert.equal(verified.status, 'verificado');
    assert.ok(verified.steps.some((step) => step.name.includes('test-owner')));
    assert.equal(verified.restoreTest.documents, 1);
    assert.equal(fs.existsSync(path.join(backupDir, `backup-${verifiedId}.archive.gz.enc`)), true);
    assert.equal(fs.existsSync(path.join(backupDir, '.backup-maintenance.json')), false);
  } finally {
    process.env = old;
    await fs.promises.rm(dir, { recursive: true, force: true });
  }
  console.log('Panel: pausa, fallo controlado y éxito simulado con archivo cifrado y reapertura OK');
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
