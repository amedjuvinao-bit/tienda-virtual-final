'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { pipeline } = require('node:stream/promises');
const { Writable } = require('node:stream');

const MAGIC = Buffer.from('TVFBK001');

function backupDirectory() {
  const directory = String(process.env.BACKUP_DIRECTORY || '').trim();
  if (!path.isAbsolute(directory)) throw new Error('BACKUP_DIRECTORY debe ser una ruta absoluta fuera del proyecto.');
  const project = path.resolve(__dirname, '..', '..');
  const resolved = path.resolve(directory);
  let actual = resolved;
  try { actual = fs.realpathSync(resolved); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (resolved === project || resolved.startsWith(`${project}${path.sep}`)) {
    throw new Error('BACKUP_DIRECTORY no puede estar dentro del proyecto.');
  }
  if (actual === project || actual.startsWith(`${project}${path.sep}`)) {
    throw new Error('BACKUP_DIRECTORY apunta dentro del proyecto.');
  }
  return resolved;
}

function encryptionKey() {
  const secret = String(process.env.BACKUP_ENCRYPTION_KEY || '').trim();
  if (!/^[a-f\d]{64}$/i.test(secret)) throw new Error('BACKUP_ENCRYPTION_KEY debe ser una clave aleatoria de 32 bytes en hexadecimal.');
  return Buffer.from(secret, 'hex');
}

async function sha256(file) {
  const digest = crypto.createHash('sha256');
  await pipeline(fs.createReadStream(file), new Writable({
    write(chunk, _encoding, done) { digest.update(chunk); done(); },
  }));
  return digest.digest('hex');
}

async function encryptArchive(source, destination, key) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const handle = await fs.promises.open(destination, 'wx', 0o600);
  try {
    await handle.write(Buffer.concat([MAGIC, iv]));
    await pipeline(fs.createReadStream(source), cipher, fs.createWriteStream(destination, { flags: 'a', mode: 0o600 }));
    const size = (await handle.stat()).size;
    await handle.write(cipher.getAuthTag(), 0, 16, size);
    await handle.sync();
  } finally {
    await handle.close();
  }
}

async function verifiedPlaintextDigest(encrypted, key) {
  const handle = await fs.promises.open(encrypted, 'r');
  let size;
  let prefix;
  let tag;
  try {
    size = (await handle.stat()).size;
    if (size < 36) throw new Error('Archivo cifrado incompleto.');
    prefix = Buffer.alloc(20);
    tag = Buffer.alloc(16);
    await handle.read(prefix, 0, 20, 0);
    await handle.read(tag, 0, 16, size - 16);
  } finally {
    await handle.close();
  }
  if (!prefix.subarray(0, 8).equals(MAGIC)) throw new Error('Formato de respaldo inválido.');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, prefix.subarray(8));
  decipher.setAuthTag(tag);
  const hash = crypto.createHash('sha256');
  await pipeline(fs.createReadStream(encrypted, { start: 20, end: size - 17 }), decipher,
    new Writable({ write(chunk, _encoding, done) { hash.update(chunk); done(); } }));
  return hash.digest('hex');
}

async function decryptArchive(encrypted, output, key) {
  const handle = await fs.promises.open(encrypted, 'r');
  let size;
  const prefix = Buffer.alloc(20);
  const tag = Buffer.alloc(16);
  try {
    size = (await handle.stat()).size;
    if (size < 36) throw new Error('Archivo cifrado incompleto.');
    await handle.read(prefix, 0, 20, 0);
    await handle.read(tag, 0, 16, size - 16);
  } finally { await handle.close(); }
  if (!prefix.subarray(0, 8).equals(MAGIC)) throw new Error('Formato de respaldo inválido.');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, prefix.subarray(8));
  decipher.setAuthTag(tag);
  let created = false;
  try {
    const outputHandle = await fs.promises.open(output, 'wx', 0o600);
    created = true;
    await outputHandle.close();
    await pipeline(fs.createReadStream(encrypted, { start: 20, end: size - 17 }), decipher,
      fs.createWriteStream(output, { flags: 'w', mode: 0o600 }));
  } catch (error) {
    if (created) await fs.promises.rm(output, { force: true });
    throw error;
  }
}

function safeBackupId(id) {
  return /^[a-f\d]{24}$/i.test(String(id || ''));
}

async function listBackups() {
  const dir = backupDirectory();
  let files;
  try { files = await fs.promises.readdir(dir); }
  catch (error) { if (error.code === 'ENOENT') return []; throw error; }
  const records = await Promise.all(files.filter((file) => /^backup-[a-f\d]{24}\.json$/.test(file)).map(async (file) => {
    const raw = await fs.promises.readFile(path.join(dir, file), 'utf8');
    const record = JSON.parse(raw);
    let available = false;
    if (record.status === 'verificado' && safeBackupId(record.id)) {
      try {
        const stat = await fs.promises.lstat(path.join(dir, `backup-${record.id}.archive.gz.enc`));
        available = stat.isFile() && !stat.isSymbolicLink() && stat.size === record.size;
      } catch (error) { if (error.code !== 'ENOENT') throw error; }
    }
    return {
      id: record.id, status: record.status, startedAt: record.startedAt,
      completedAt: record.completedAt || null, database: record.database,
      size: record.size || null, sha256: record.sha256 || null, available,
      restoreTest: record.restoreTest || null,
      steps: record.steps || [],
    };
  }));
  return records.sort((a, b) => b.startedAt.localeCompare(a.startedAt)).slice(0, 50);
}

async function listMediaBackups() {
  const dir = backupDirectory();
  let files;
  try { files = await fs.promises.readdir(dir); }
  catch (error) { if (error.code === 'ENOENT') return []; throw error; }
  const records = await Promise.all(files.filter((file) => /^media-[a-f\d]{24}\.json$/.test(file)).map(async (file) => {
    const record = JSON.parse(await fs.promises.readFile(path.join(dir, file), 'utf8'));
    let available = false;
    if (record.status === 'verificado' && safeBackupId(record.id)) {
      try {
        const stat = await fs.promises.lstat(path.join(dir, `media-${record.id}.bundle.enc`));
        available = stat.isFile() && !stat.isSymbolicLink() && stat.size === record.size;
      } catch (error) { if (error.code !== 'ENOENT') throw error; }
    }
    return { id: record.id, status: record.status, startedAt: record.startedAt,
      completedAt: record.completedAt || null, cloudinaryCount: record.cloudinaryCount || 0,
      localCount: record.localCount || 0, size: record.size || null,
      sha256: record.sha256 || null, available, steps: record.steps || [] };
  }));
  return records.sort((a, b) => b.startedAt.localeCompare(a.startedAt)).slice(0, 50);
}

module.exports = { backupDirectory, encryptionKey, sha256, encryptArchive, decryptArchive, verifiedPlaintextDigest, safeBackupId, listBackups, listMediaBackups };
