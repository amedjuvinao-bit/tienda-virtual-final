'use strict';

require('../config/env');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { encryptionKey, sha256, decryptArchive } = require('../services/freeBackupArchive');
const { extractBundle } = require('../services/mediaBackupBundle');

async function main() {
  const [encrypted, recordFile, destination] = process.argv.slice(2);
  if (!encrypted || !recordFile || !destination || !path.isAbsolute(destination)) {
    throw new Error('Uso: npm run backup:media:extract -- <media.bundle.enc> <media.json> <directorio-absoluto-vacío>');
  }
  const record = JSON.parse(await fs.promises.readFile(recordFile, 'utf8'));
  if (record.kind !== 'media' || record.status !== 'verificado' ||
      !/^[a-f\d]{64}$/i.test(record.sha256 || '') || !Array.isArray(record.inventory) ||
      (await fs.promises.stat(encrypted)).size !== record.size ||
      await sha256(encrypted) !== record.sha256) throw new Error('La copia cifrada no coincide con su registro.');
  let temp;
  let created = false;
  try {
    await fs.promises.mkdir(destination, { mode: 0o700 }); // Never merge into an existing directory.
    created = true;
    temp = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'media-extract-'));
    const plain = path.join(temp, 'media.bundle');
    await decryptArchive(encrypted, plain, encryptionKey());
    const recovered = await extractBundle(plain, destination, record.inventory);
    console.log(`Recuperados ${recovered.length} archivos en ${destination}. Originales de Cloudinary quedan en cloudinary/; archivos del servidor en uploads/ y, si aplica, backend-uploads/.`);
  } catch (error) {
    if (created) await fs.promises.rm(destination, { recursive: true, force: true }).catch(() => {});
    throw error;
  } finally {
    if (temp) await fs.promises.rm(temp, { recursive: true, force: true });
  }
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; });
