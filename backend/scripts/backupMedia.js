'use strict';

require('../config/env');
const fs = require('node:fs');
const path = require('node:path');
const cloudinary = require('cloudinary').v2;
const { env } = require('../config/env');
const { backupDirectory, encryptionKey, sha256, encryptArchive, decryptArchive,
  verifiedPlaintextDigest } = require('../services/freeBackupArchive');
const { localFiles, cloudinaryFiles, createBundle, extractBundle } = require('../services/mediaBackupBundle');

async function writeRecord(file, record) {
  const handle = await fs.promises.open(`${file}.writing`, 'w', 0o600);
  try { await handle.writeFile(JSON.stringify(record, null, 2)); await handle.sync(); }
  finally { await handle.close(); }
  await fs.promises.rename(`${file}.writing`, file);
}

async function main() {
  const id = process.env.BACKUP_RUN_ID;
  if (!process.argv.includes('--managed-maintenance') || !/^[a-f\d]{24}$/.test(id || '')) {
    throw new Error('Esta copia solo puede iniciarse desde el panel con la tienda pausada.');
  }
  if (!env.cloudinary.cloudName || !env.cloudinary.apiKey || !env.cloudinary.apiSecret) {
    throw new Error('Configura las credenciales backend de Cloudinary antes de copiar archivos.');
  }
  const dir = backupDirectory();
  const key = encryptionKey();
  const lock = JSON.parse(await fs.promises.readFile(path.join(dir, '.backup-maintenance.json'), 'utf8'));
  if (lock.id !== id || lock.childPid !== process.pid) throw new Error('La tienda no está pausada para esta copia.');
  cloudinary.config({ cloud_name: env.cloudinary.cloudName, api_key: env.cloudinary.apiKey,
    api_secret: env.cloudinary.apiSecret });
  const recordPath = path.join(dir, `media-${id}.json`);
  const encrypted = path.join(dir, `media-${id}.bundle.enc`);
  const record = JSON.parse(await fs.promises.readFile(recordPath, 'utf8'));
  if (record.id !== id || record.status !== 'en_proceso' || record.kind !== 'media') {
    throw new Error('Registro de archivos inválido.');
  }
  let tempDir;
  let success = false;
  async function step(name) {
    record.steps.push({ name, at: new Date().toISOString() });
    await writeRecord(recordPath, record);
    process.stdout.write(`${name}\n`);
  }
  try {
    tempDir = await fs.promises.mkdtemp(path.join(dir, `.working-${id}-`));
    await fs.promises.chmod(tempDir, 0o700);
    const uploads = path.resolve(process.env.BACKUP_SERVED_UPLOADS_DIRECTORY || path.join(__dirname, '..', 'uploads'));
    const backendUploads = path.resolve(__dirname, '..', 'uploads');
    async function inventoryLocal() {
      const served = await localFiles(uploads);
      if (uploads === backendUploads) return served;
      const additional = (await localFiles(backendUploads)).map((entry) => ({
        ...entry, name: entry.name.replace(/^uploads\//, 'backend-uploads/'),
      }));
      return [...served, ...additional];
    }
    const beforeLocal = await inventoryLocal();
    const beforeCloud = await cloudinaryFiles(cloudinary.api, env.cloudinary.cloudName);
    await step(`Inventario: ${beforeCloud.length} recursos Cloudinary y ${beforeLocal.length} archivos locales`);
    const bundle = path.join(tempDir, 'media.bundle');
    const inventory = await createBundle(bundle, [...beforeCloud, ...beforeLocal]);
    await step('Originales copiados y huellas SHA-256 individuales registradas');
    const [afterLocal, afterCloud] = await Promise.all([
      inventoryLocal(), cloudinaryFiles(cloudinary.api, env.cloudinary.cloudName),
    ]);
    if (JSON.stringify(beforeLocal) !== JSON.stringify(afterLocal) ||
        JSON.stringify(beforeCloud) !== JSON.stringify(afterCloud)) {
      throw new Error('Cambió el inventario de archivos durante la copia. Revisa las cargas externas a Cloudinary.');
    }
    await step('Inventario antes y después coincide');
    const digest = await sha256(bundle);
    await encryptArchive(bundle, encrypted, key);
    if (await verifiedPlaintextDigest(encrypted, key) !== digest) throw new Error('Falló la comprobación de cifrado.');
    await fs.promises.rm(bundle);
    // Prove that the downloadable envelope can actually be decrypted and extracted.
    const decrypted = path.join(tempDir, 'decrypted.bundle');
    await decryptArchive(encrypted, decrypted, key);
    if (await sha256(decrypted) !== digest) throw new Error('La copia cifrada no se recuperó correctamente.');
    const extracted = path.join(tempDir, 'extracted');
    await fs.promises.mkdir(extracted, { mode: 0o700 });
    await extractBundle(decrypted, extracted, inventory);
    await step('Descifrado, extracción de prueba e integridad de cada original confirmados');
    record.inventory = inventory;
    record.cloudinaryCount = beforeCloud.length;
    record.localCount = beforeLocal.length;
    record.size = (await fs.promises.stat(encrypted)).size;
    record.sha256 = await sha256(encrypted);
    record.status = 'verificado';
    record.completedAt = new Date().toISOString();
    await step('Copia cifrada AES-256-GCM y recuperación de prueba confirmadas');
    success = true;
  } catch (error) {
    record.status = 'fallido';
    record.completedAt = new Date().toISOString();
    record.steps.push({ name: `Error: ${error.message}`, at: record.completedAt });
    await writeRecord(recordPath, record).catch(() => {});
    process.stderr.write(`Copia de archivos fallida: ${error.message}\n`);
  } finally {
    if (!success) await fs.promises.rm(encrypted, { force: true }).catch(() => {});
    if (tempDir) await fs.promises.rm(tempDir, { recursive: true, force: true }).catch((error) => {
      process.stderr.write(`No se pudo limpiar un temporal: ${error.message}\n`);
      success = false;
    });
  }
  if (!success) process.exitCode = 1;
}

main().catch((error) => { console.error('Copia de archivos no iniciada:', error.message); process.exitCode = 1; });
