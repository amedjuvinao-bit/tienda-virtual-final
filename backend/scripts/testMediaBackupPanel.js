'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { sha256, listMediaBackups } = require('../services/freeBackupArchive');

async function main() {
  const root = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'media-panel-test-'));
  const prior = { ...process.env };
  try {
    process.env.BACKUP_DIRECTORY = path.join(root, 'backups');
    process.env.BACKUP_ENCRYPTION_KEY = crypto.randomBytes(32).toString('hex');
    process.env.BACKUP_PANEL_SINGLE_INSTANCE = 'true';
    process.env.CLOUDINARY_CLOUD_NAME = 'demo';
    process.env.CLOUDINARY_API_KEY = 'test-key';
    process.env.CLOUDINARY_API_SECRET = 'test-secret';
    const preload = path.join(root, 'mock-cloudinary.js');
    const data = 'A fake product image';
    await fs.promises.writeFile(preload, `
const cloud = require(${JSON.stringify(require.resolve('cloudinary'))}).v2;
cloud.api.resources = async ({ resource_type }) => ({ resources: resource_type === 'image'
  ? [{ asset_id: 'test-asset', public_id: 'shop/product', bytes: ${data.length}, resource_type: 'image', type: 'upload',
    secure_url: 'https://res.cloudinary.com/demo/image/upload/v1/shop/product.jpg', format: 'jpg', version: 1 }] : [] });
global.fetch = async () => process.env.TEST_MEDIA_DOWNLOAD_FAIL === 'true'
  ? { ok: false, status: 403 } : { ok: true, body: new ReadableStream({ start(controller) {
      controller.enqueue(Buffer.from(${JSON.stringify(data)})); controller.close();
    } }) };
`);
    process.env.NODE_OPTIONS = `--require=${preload}`;
    const maintenance = require('../services/backupMaintenanceService');
    assert.equal((await maintenance.readiness('media')).ready, true);
    let id = await maintenance.begin({ owner: 'test-owner', kind: 'media' });
    assert.equal(maintenance.status().maintenance, true);
    await maintenance.launch(id);
    assert.equal(maintenance.status().phase, 'completado');
    assert.equal(maintenance.status().maintenance, false);
    let record = JSON.parse(await fs.promises.readFile(path.join(process.env.BACKUP_DIRECTORY, `media-${id}.json`)));
    assert.equal(record.status, 'verificado');
    assert.equal(record.cloudinaryCount, 1);
    assert.ok(record.localCount >= 4);
    assert.equal(await sha256(path.join(process.env.BACKUP_DIRECTORY, `media-${id}.bundle.enc`)), record.sha256);
    assert.equal((await listMediaBackups())[0].available, true);
    const extracted = path.join(root, 'restored');
    const command = spawnSync(process.execPath, ['scripts/extractMediaBackup.js',
      path.join(process.env.BACKUP_DIRECTORY, `media-${id}.bundle.enc`),
      path.join(process.env.BACKUP_DIRECTORY, `media-${id}.json`), extracted],
    { cwd: path.join(__dirname, '..'), env: { ...process.env, NODE_OPTIONS: '' }, encoding: 'utf8' });
    assert.equal(command.status, 0, command.stderr);
    assert.equal(await fs.promises.readFile(path.join(extracted, 'cloudinary/image/test-asset'), 'utf8'), data);
    assert.equal(fs.existsSync(path.join(process.env.BACKUP_DIRECTORY, '.backup-maintenance.json')), false);
    process.env.TEST_MEDIA_DOWNLOAD_FAIL = 'true';
    id = await maintenance.begin({ owner: 'test-owner', kind: 'media' });
    await maintenance.launch(id);
    assert.equal(maintenance.status().phase, 'fallido');
    assert.equal(maintenance.status().maintenance, false);
    record = JSON.parse(await fs.promises.readFile(path.join(process.env.BACKUP_DIRECTORY, `media-${id}.json`)));
    assert.equal(record.status, 'fallido');
    assert.equal(fs.existsSync(path.join(process.env.BACKUP_DIRECTORY, `media-${id}.bundle.enc`)), false);
    assert.equal(fs.existsSync(path.join(process.env.BACKUP_DIRECTORY, '.backup-maintenance.json')), false);
    console.log('Panel archivos: éxito, recuperación del descargado, fallo sin copia parcial y reapertura OK');
  } finally {
    process.env = prior;
    await fs.promises.rm(root, { recursive: true, force: true });
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
