'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { localFiles, cloudinaryFiles, createBundle, extractBundle } = require('../services/mediaBackupBundle');
const { sha256, encryptArchive, decryptArchive, verifiedPlaintextDigest } = require('../services/freeBackupArchive');
const { findAdminRoutePermission } = require('../security/adminRoutePermissionMap');

async function run() {
  const root = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'media-backup-test-'));
  try {
    const uploads = path.join(root, 'uploads');
    await fs.promises.mkdir(path.join(uploads, 'nested'), { recursive: true });
    await fs.promises.writeFile(path.join(uploads, 'nested', 'receipt.pdf'), 'Local receipt data');
    const data = Buffer.from('Cloudinary original data');
    const cloud = { asset_id: 'asset-1', public_id: 'tienda_virtual/product-1', bytes: data.length,
      secure_url: 'https://res.cloudinary.com/demo/image/upload/v123/tienda_virtual/product-1.png',
      resource_type: 'image', type: 'upload', format: 'png', version: 123 };
    const calls = [];
    const api = { async resources(options) {
      calls.push(options);
      if (options.resource_type !== 'image') return { resources: [] };
      return options.next_cursor ? { resources: [cloud] } : { resources: [], next_cursor: 'next' };
    } };
    const cloudEntries = await cloudinaryFiles(api, 'demo');
    assert.equal(cloudEntries.length, 1);
    assert.deepEqual(calls.map((item) => item.resource_type), ['image', 'image', 'video', 'raw']);
    const localEntries = await localFiles(uploads);
    assert.equal(localEntries.length, 1);
    const bundle = path.join(root, 'bundle');
    const fetchImpl = async () => ({ ok: true, body: new ReadableStream({
      start(controller) { controller.enqueue(data); controller.close(); },
    }) });
    const inventory = await createBundle(bundle, [...cloudEntries, ...localEntries], fetchImpl);
    assert.equal(inventory.length, 2);
    const restored = path.join(root, 'restored');
    await fs.promises.mkdir(restored);
    assert.deepEqual(await extractBundle(bundle, restored, inventory), inventory);
    assert.equal(await fs.promises.readFile(path.join(restored, 'cloudinary/image/asset-1.png'), 'utf8'), data.toString());
    assert.equal(await fs.promises.readFile(path.join(restored, 'uploads/nested/receipt.pdf'), 'utf8'), 'Local receipt data');
    const key = crypto.randomBytes(32);
    const encrypted = path.join(root, 'bundle.enc');
    await encryptArchive(bundle, encrypted, key);
    const digest = await sha256(bundle);
    assert.equal(await verifiedPlaintextDigest(encrypted, key), digest);
    const decrypted = path.join(root, 'decrypted');
    await decryptArchive(encrypted, decrypted, key);
    assert.equal(await sha256(decrypted), digest);
    await assert.rejects(verifiedPlaintextDigest(encrypted, crypto.randomBytes(32)));
    const tampered = path.join(root, 'tampered');
    await fs.promises.copyFile(bundle, tampered);
    const handle = await fs.promises.open(tampered, 'r+');
    await handle.write(Buffer.from('X'), 0, 1, 0);
    await handle.close();
    await fs.promises.mkdir(path.join(root, 'tamper-out'));
    await assert.rejects(extractBundle(tampered, path.join(root, 'tamper-out'), inventory));
    await assert.rejects(cloudinaryFiles({ resources: async () => ({ resources: [{ ...cloud,
      secure_url: 'https://example.com/private' }] }) }, 'demo'));
    assert.equal(findAdminRoutePermission('POST', '/api/admin/backup-preferences/media-start').audit, true);
    assert.equal(findAdminRoutePermission('POST', '/api/admin/backup-preferences/media-runs/abcdefabcdefabcdefabcdef/download').danger, true);
    console.log('Archivos: paginación, originales, extracción, cifrado, integridad y permisos OK');
  } finally { await fs.promises.rm(root, { recursive: true, force: true }); }
}

run().catch((error) => { console.error(error); process.exitCode = 1; });
