'use strict';

// Offline mode reserves the API port. Managed mode is run only by the backend
// after its maintenance gate has drained requests and workers.
require('../config/env');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const mongoose = require('mongoose');
const { resolveMongoTool } = require('../services/backupMongoTools');
const {
  backupDirectory, encryptionKey, sha256, encryptArchive, verifiedPlaintextDigest,
} = require('../services/freeBackupArchive');

const managed = process.argv.includes('--managed-maintenance');
const id = managed && /^[a-f\d]{24}$/.test(process.env.BACKUP_RUN_ID || '')
  ? process.env.BACKUP_RUN_ID : crypto.randomBytes(12).toString('hex');
let interrupted = false;
let activeChild = null;
function interrupt() {
  interrupted = true;
  activeChild?.kill();
}
function checkInterrupted() {
  if (interrupted) throw new Error('Operación interrumpida. No se confirmó la copia.');
}
const cleanDb = (name) => /^[a-zA-Z][a-zA-Z0-9_-]{0,62}$/.test(name);
const uriDb = (uri) => decodeURIComponent(new URL(uri).pathname.replace(/^\//, ''));
const uriHost = (uri) => new URL(uri).host.toLowerCase();

function configuration() {
  const sourceApp = process.env.MONGO_URI || process.env.MONGODB_URI || process.env.MONGO_URL || process.env.DATABASE_URL;
  const source = process.env.BACKUP_MONGODB_URI || sourceApp;
  const staging = process.env.STAGING_MONGODB_URI;
  const database = String(process.env.BACKUP_DB_NAME || '').trim();
  const port = Number(process.env.PORT || 5000);
  if (!sourceApp || !source || !staging || !cleanDb(database) || !Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('Configura MONGO_URI/MONGODB_URI, BACKUP_DB_NAME, STAGING_MONGODB_URI y PORT válidos.');
  }
  if (uriDb(sourceApp) !== database || uriDb(source) !== database || uriHost(sourceApp) !== uriHost(source)) {
    throw new Error('La base y el clúster del respaldo deben coincidir con los del backend.');
  }
  if (uriHost(staging) === uriHost(source)) throw new Error('La restauración de prueba requiere otro clúster/servidor MongoDB.');
  if (!['mongodb:', 'mongodb+srv:'].includes(new URL(source).protocol) ||
      !['mongodb:', 'mongodb+srv:'].includes(new URL(staging).protocol)) throw new Error('URI MongoDB inválida.');
  const dir = backupDirectory();
  const key = encryptionKey();
  return { source, staging, database, dir, key, port };
}

function toolFailure(binary, code, output) {
  const text = String(output);
  const destination = binary === 'mongorestore' ? 'clúster de prueba' : 'clúster de origen';
  let reason;
  if (/authentication failed|bad auth|unable to authenticate|authenticat(?:ion|e) error|SCRAM authentication failed/i.test(text)) {
    reason = `No se aceptaron las credenciales del ${destination}. Revisa la URI configurada para ese clúster.`;
  } else if (/not authorized|unauthorized|requires authentication|insufficient privileges/i.test(text)) {
    reason = `El usuario del ${destination} no tiene permisos para esta operación.`;
  } else if (/quota|storage limit|insufficient (?:disk |storage )?space|out of disk space|maximum storage/i.test(text)) {
    reason = `El ${destination} no tiene espacio suficiente para esta operación.`;
  } else if (/server selection|no servers|connection refused|i\/o timeout|network timeout|tls handshake|dns lookup|no such host/i.test(text)) {
    reason = `No se pudo conectar al ${destination}. Comprueba el acceso de red y la URI.`;
  } else if (/error parsing command line options|unknown option|unrecognized option|invalid option/i.test(text)) {
    reason = 'MongoDB Database Tools rechazó una opción del comando. Revisa su versión e instalación.';
  } else {
    reason = 'Consulta el diagnóstico de mongorestore/mongodump en la consola del backend.';
  }
  return new Error(`${binary} terminó con código ${code}; ${reason} No se confirmó la copia.`);
}

function safeToolDiagnostic(output) {
  // Never write a tool's raw output into the audit record or panel. The tool
  // can include the connection URI, passwords, or a customer's document.
  const text = String(output);
  const categories = [
    ['autenticación', /authentication failed|bad auth|unable to authenticate|authenticat(?:ion|e) error|SCRAM authentication failed/i],
    ['permisos', /not authorized|unauthorized|requires authentication|insufficient privileges/i],
    ['espacio', /quota|storage limit|insufficient (?:disk |storage )?space|out of disk space|maximum storage/i],
    ['conexión', /server selection|no servers|connection refused|i\/o timeout|network timeout|tls handshake|dns lookup|no such host/i],
    ['opción inválida', /error parsing command line options|unknown option|unrecognized option|invalid option/i],
  ];
  return categories.filter(([, pattern]) => pattern.test(text)).map(([name]) => name).join(', ') || 'sin categoría';
}

function runTool(binary, args) {
  return new Promise((resolve, reject) => {
    if (interrupted) return reject(new Error('Operación interrumpida.'));
    const child = spawn(resolveMongoTool(binary), args, { shell: false, stdio: ['ignore', 'ignore', 'pipe'], windowsHide: true });
    activeChild = child;
    let timedOut = false;
    let spawnError = null;
    let stderr = '';
    child.stderr?.on('data', (chunk) => { stderr = (stderr + String(chunk)).slice(-16384); });
    const timeout = setTimeout(() => { timedOut = true; child.kill(); }, 2 * 60 * 60 * 1000);
    child.once('error', (error) => { spawnError = error; });
    child.once('close', (code) => {
      activeChild = null;
      clearTimeout(timeout);
      if (spawnError) reject(new Error(`${binary} no está disponible (${spawnError.code || 'error'}).`));
      else if (timedOut) reject(new Error(`${binary} superó el tiempo máximo de dos horas.`));
      else if (code === 0 && !interrupted) resolve();
      else if (interrupted) reject(new Error('Operación interrumpida. No se confirmó la copia.'));
      else {
        process.stderr.write(`[backup-tool] ${binary} código ${code}; diagnóstico: ${safeToolDiagnostic(stderr)}\n`);
        reject(toolFailure(binary, code, stderr));
      }
    });
  });
}

async function counts(uri, database) {
  const connection = await mongoose.createConnection(uri, {
    dbName: database, autoIndex: false, serverSelectionTimeoutMS: 10000,
  }).asPromise();
  try {
    const collections = (await connection.db.listCollections({}, { nameOnly: false }).toArray())
      .filter((item) => !item.name.startsWith('system.'))
      .sort((left, right) => left.name.localeCompare(right.name));
    const result = {};
    for (const collection of collections) {
      if (collection.type === 'collection') {
        const dbCollection = connection.db.collection(collection.name);
        const digest = crypto.createHash('sha256');
        let documents = 0;
        const cursor = dbCollection.find({}, { sort: { _id: 1 }, batchSize: 200 });
        try {
          for await (const document of cursor) {
            const bytes = mongoose.mongo.BSON.serialize(document);
            const length = Buffer.alloc(4);
            length.writeUInt32BE(bytes.length);
            digest.update(length).update(bytes);
            documents += 1;
          }
        } finally { await cursor.close(); }
        result[collection.name] = { type: 'collection', documents, contentSha256: digest.digest('hex'),
          indexes: (await dbCollection.listIndexes().toArray())
            .map((index) => ({ name: index.name, key: index.key, unique: Boolean(index.unique),
              sparse: Boolean(index.sparse), expireAfterSeconds: index.expireAfterSeconds ?? null,
              partialFilterExpression: index.partialFilterExpression ?? null, collation: index.collation ?? null }))
            .sort((left, right) => left.name.localeCompare(right.name)) };
      } else result[collection.name] = { type: collection.type };
    }
    return result;
  } finally { await connection.close(); }
}

async function dropRestoreTest(uri, database) {
  if (!/^restore_check_[a-f\d]{24}$/.test(database)) throw new Error('Nombre de ensayo inválido.');
  const connection = await mongoose.createConnection(uri, {
    dbName: database, autoIndex: false, serverSelectionTimeoutMS: 10000,
  }).asPromise();
  try { await connection.db.dropDatabase(); }
  finally { await connection.close(); }
}

async function reservePort(port) {
  const server = http.createServer((_req, res) => {
    res.writeHead(503, { 'Content-Type': 'application/json; charset=utf-8', 'Retry-After': '600', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify({ ok: false, code: 'BACKUP_MAINTENANCE', message: 'Tienda temporalmente en mantenimiento por respaldo de datos. Intenta de nuevo más tarde.' }));
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, resolve);
  });
  return server;
}

async function writeRecord(file, record) {
  const temp = `${file}.writing`;
  const handle = await fs.promises.open(temp, 'w', 0o600);
  try {
    await handle.writeFile(JSON.stringify(record, null, 2));
    await handle.sync();
  } finally { await handle.close(); }
  await fs.promises.rename(temp, file);
}

async function confirmManagedLock() {
  if (!managed) return;
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      const lock = JSON.parse(await fs.promises.readFile(path.join(backupDirectory(), '.backup-maintenance.json'), 'utf8'));
      if (lock.id === id && lock.childPid === process.pid) return;
    } catch { /* El padre todavía prepara el bloqueo. */ }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('No existe un bloqueo de mantenimiento válido para este proceso.');
}

async function main() {
  const options = configuration();
  await confirmManagedLock();
  await fs.promises.mkdir(options.dir, { recursive: true, mode: 0o700 });
  backupDirectory(); // Recheck after mkdir: an existing symlink must not resolve inside the project.
  await fs.promises.chmod(options.dir, 0o700);
  const recordPath = path.join(options.dir, `backup-${id}.json`);
  const encryptedPath = path.join(options.dir, `backup-${id}.archive.gz.enc`);
  const record = managed
    ? JSON.parse(await fs.promises.readFile(recordPath, 'utf8'))
    : { id, database: options.database, startedAt: new Date().toISOString(), status: 'en_proceso', steps: [] };
  if (record.id !== id || record.status !== 'en_proceso' || !Array.isArray(record.steps)) {
    throw new Error('El registro inicial del respaldo no coincide con el bloqueo de mantenimiento.');
  }
  let server;
  let tempDir;
  let success = false;
  const targetDb = `restore_check_${id}`;
  let stagingTouched = false;
  const step = async (name) => {
    record.steps.push({ name, at: new Date().toISOString() });
    await writeRecord(recordPath, record);
    process.stdout.write(`${name}\n`);
  };
  try {
    if (!managed) {
      server = await reservePort(options.port);
      await step('Puerto de API reservado; tienda en mantenimiento (HTTP 503)');
      // Allows in-flight responses from the old process to finish after its listener closes.
      await new Promise((resolve) => setTimeout(resolve, 15000));
    } else {
      await step('Tienda en mantenimiento desde el panel; solicitudes y trabajadores drenados');
    }
    checkInterrupted();
    tempDir = await fs.promises.mkdtemp(path.join(options.dir, `.working-${id}-`));
    await fs.promises.chmod(tempDir, 0o700);
    const dumpConfig = path.join(tempDir, 'source.yml');
    const restoreConfig = path.join(tempDir, 'staging.yml');
    await fs.promises.writeFile(dumpConfig, `uri: ${JSON.stringify(options.source)}\n`, { mode: 0o600 });
    await fs.promises.writeFile(restoreConfig, `uri: ${JSON.stringify(options.staging)}\n`, { mode: 0o600 });
    const archive = path.join(tempDir, 'dump.archive.gz');
    const before = await counts(options.source, options.database);
    if (!before.adminusers?.documents) throw new Error('La base seleccionada no contiene propietarios administrativos. Revisa BACKUP_DB_NAME.');
    checkInterrupted();
    await step('Inventario y huellas de documentos e índices del origen registrados');
    await runTool('mongodump', [`--config=${dumpConfig}`, `--db=${options.database}`, `--archive=${archive}`, '--gzip']);
    const archiveSize = (await fs.promises.stat(archive)).size;
    if (!archiveSize) throw new Error('mongodump produjo un archivo vacío.');
    await step('Archivo mongodump generado');
    const after = await counts(options.source, options.database);
    checkInterrupted();
    if (JSON.stringify(before) !== JSON.stringify(after)) throw new Error('Cambió el contenido o los índices del origen durante el respaldo. Investiga escrituras externas.');
    await step('Contenido e índices del origen antes/después coinciden');
    stagingTouched = true;
    await runTool('mongorestore', [`--config=${restoreConfig}`, `--archive=${archive}`, '--gzip', '--stopOnError',
      `--nsInclude=${options.database}.*`, `--nsFrom=${options.database}.*`, `--nsTo=${targetDb}.*`]);
    const restored = await counts(options.staging, targetDb);
    checkInterrupted();
    if (JSON.stringify(after) !== JSON.stringify(restored)) throw new Error('La restauración de prueba no coincide con el origen.');
    await step('Restauración de prueba: colecciones, documentos e índices confirmados en servidor separado');
    await dropRestoreTest(options.staging, targetDb);
    checkInterrupted();
    stagingTouched = false;
    await step('Base temporal de ensayo eliminada');
    const plainDigest = await sha256(archive);
    checkInterrupted();
    await encryptArchive(archive, encryptedPath, options.key);
    checkInterrupted();
    if (await verifiedPlaintextDigest(encryptedPath, options.key) !== plainDigest) throw new Error('Falló la comprobación del cifrado.');
    checkInterrupted();
    record.sha256 = await sha256(encryptedPath);
    checkInterrupted();
    record.size = (await fs.promises.stat(encryptedPath)).size;
    record.restoreTest = { server: 'separado', database: targetDb, collections: Object.keys(restored).length,
      documents: Object.values(restored).reduce((sum, value) => sum + (value.documents || 0), 0),
      indexes: Object.values(restored).reduce((sum, value) => sum + (value.indexes?.length || 0), 0),
      contentSha256: crypto.createHash('sha256').update(JSON.stringify(restored)).digest('hex') };
    record.status = 'verificado';
    record.completedAt = new Date().toISOString();
    await step('Archivo cifrado AES-256-GCM e integridad comprobada');
    checkInterrupted();
    success = true;
    process.stdout.write(`Respaldo verificado: ${id}. Conserva la clave fuera del servidor y descarga una copia.\n`);
  } catch (error) {
    record.status = 'fallido';
    record.completedAt = new Date().toISOString();
    record.steps.push({ name: 'Error: ' + error.message, at: record.completedAt });
    await writeRecord(recordPath, record).catch(() => {});
    process.stderr.write(`Respaldo fallido: ${error.message}\n`);
    process.exitCode = 1;
  } finally {
    if (stagingTouched) {
      try { await dropRestoreTest(options.staging, targetDb); }
      catch { process.stderr.write(`Revisa y elimina la base temporal ${targetDb} en el servidor de ensayo.\n`); }
    }
    if (tempDir) {
      try { await fs.promises.rm(tempDir, { recursive: true, force: true }); }
      catch (error) {
        success = false;
        record.status = 'fallido';
        record.steps.push({ name: `URGENTE: no se pudo eliminar el temporal sin cifrar (${tempDir}).`, at: new Date().toISOString() });
        await writeRecord(recordPath, record).catch(() => {});
        process.stderr.write(`URGENTE: elimina manualmente el temporal sin cifrar ${tempDir}: ${error.message}\n`);
        process.exitCode = 1;
      }
    }
    if (!success) await fs.promises.rm(encryptedPath, { force: true }).catch(() => {});
    if (server) await new Promise((resolve) => server.close(resolve));
    process.stdout.write(managed ? 'Copia terminada; el panel reanudará la tienda.\n' :
      'Mantenimiento terminado. Vuelve a iniciar el backend y confirma el estado en el panel.\n');
  }
}

if (require.main === module) {
  process.on('SIGINT', interrupt);
  process.on('SIGTERM', interrupt);
  main().catch((error) => { console.error(`No se inició el respaldo: ${error.message}`); process.exitCode = 1; });
}
module.exports = { configuration, runTool, counts, reservePort, writeRecord };
