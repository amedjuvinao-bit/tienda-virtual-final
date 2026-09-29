'use strict';

require('../config/env');
const fs = require('node:fs');
const path = require('node:path');
const { encryptionKey, sha256, decryptArchive, safeBackupId } = require('../services/freeBackupArchive');

async function main(args = process.argv.slice(2)) {
  const [encrypted, manifest, outputDirectory] = args;
  if (!encrypted || !manifest || !outputDirectory || !path.isAbsolute(outputDirectory)) {
    throw new Error('Uso: npm run backup:decrypt -- <archivo.archive.gz.enc> <registro.json> <directorio-absoluto-salida>');
  }
  const record = JSON.parse(await fs.promises.readFile(manifest, 'utf8'));
  if (!safeBackupId(record.id) || record.status !== 'verificado' ||
      path.basename(encrypted) !== `backup-${record.id}.archive.gz.enc` ||
      path.basename(manifest) !== `backup-${record.id}.json` ||
      (await fs.promises.lstat(encrypted)).isSymbolicLink() ||
      (await fs.promises.stat(encrypted)).size !== record.size ||
      await sha256(encrypted) !== record.sha256) {
    throw new Error('Archivo y registro no coinciden; no se descifra.');
  }
  await fs.promises.mkdir(outputDirectory, { recursive: true, mode: 0o700 });
  const output = path.join(outputDirectory, `backup-${record.id}.archive.gz`);
  await decryptArchive(encrypted, output, encryptionKey());
  process.stdout.write(`Archivo íntegro descifrado: ${output}\nBórralo de forma segura después de la restauración.\n`);
}

if (require.main === module) main().catch((error) => { console.error(error.message); process.exitCode = 1; });
module.exports = { main };
