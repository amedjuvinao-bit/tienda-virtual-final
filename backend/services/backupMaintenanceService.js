'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const { backupDirectory } = require('./freeBackupArchive');
const { resolveMongoTool } = require('./backupMongoTools');
const { configuration } = require('../scripts/backupAtlasFree');
const adminAccessGate = require('../middleware/adminAccessGate');

const STATUS_PATH = '/api/backup-maintenance/status';
let state = { phase: 'inactivo', id: null, progress: '' };
let active = false;
let preparing = false;
let activeRequests = 0;
let workersIdle = () => true;

function lockPath() { return path.join(backupDirectory(), '.backup-maintenance.json'); }

try {
  const lock = JSON.parse(fs.readFileSync(lockPath(), 'utf8'));
  if (/^[a-f\d]{24}$/.test(lock.id)) {
    active = true;
    state = { phase: 'requiere_revision', id: lock.id, progress: 'Se interrumpió el servidor durante una copia. La tienda permanece pausada.' };
  }
} catch (error) {
  if (error.code !== 'ENOENT' && !/BACKUP_DIRECTORY/.test(error.message)) {
    active = true;
    state = { phase: 'requiere_revision', id: null, progress: 'No se pudo leer el bloqueo de mantenimiento.' };
  }
}

function isActive() { return active; }
function status() { return { ...state, maintenance: active, recoverable: recoverableNow() }; }
function setWorkersIdle(check) { workersIdle = check; }

function recoverableNow() {
  if (!active || state.phase !== 'requiere_revision') return false;
  try {
    const lock = JSON.parse(fs.readFileSync(lockPath(), 'utf8'));
    if (!/^[a-f\d]{24}$/.test(lock.id)) return false;
    if (Number.isInteger(lock.childPid) && lock.childPid > 0) {
      try { process.kill(lock.childPid, 0); return false; }
      catch (error) { if (error.code !== 'ESRCH') return false; }
    }
    if (fs.readdirSync(backupDirectory()).some((file) => file.startsWith(`.working-${lock.id}-`))) return false;
    const record = JSON.parse(fs.readFileSync(path.join(backupDirectory(), `backup-${lock.id}.json`), 'utf8'));
    return record.id === lock.id && ['verificado', 'fallido'].includes(record.status);
  } catch { return false; }
}

function middleware(req, res, next) {
  if (req.method === 'GET' && req.path === STATUS_PATH) {
    res.set('Cache-Control', 'no-store');
    return res.json(status());
  }
  if (req.method === 'POST' && req.path === '/api/admin/backup-preferences/recover' && recoverableNow()) {
    activeRequests += 1;
    let ended = false;
    const finish = () => { if (!ended) { ended = true; activeRequests -= 1; } };
    res.once('finish', finish);
    res.once('close', finish);
    return next();
  }
  if (active && req.method !== 'OPTIONS') {
    res.set('Retry-After', '600');
    res.set('Cache-Control', 'no-store');
    return res.status(503).json({ ok: false, code: 'BACKUP_MAINTENANCE',
      message: 'Tienda temporalmente en mantenimiento por respaldo de datos. Intenta de nuevo más tarde.' });
  }
  activeRequests += 1;
  let ended = false;
  const finish = () => { if (!ended) { ended = true; activeRequests -= 1; } };
  res.once('finish', finish);
  res.once('close', finish);
  return next();
}

function toolAvailable(binary) {
  return new Promise((resolve) => {
    const child = spawn(resolveMongoTool(binary), ['--version'], { shell: false, stdio: 'ignore', windowsHide: true });
    let settled = false;
    const done = (available) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      resolve(available);
    };
    const timeout = setTimeout(() => { child.kill(); done(false); }, 5000);
    child.once('error', () => done(false));
    child.once('exit', (code) => done(code === 0));
  });
}

async function readiness() {
  const checks = [];
  if (process.env.BACKUP_PANEL_SINGLE_INSTANCE !== 'true') {
    checks.push('El servidor debe confirmar que esta es la única instancia del backend y que no hay otros clientes que escriban en MongoDB (BACKUP_PANEL_SINGLE_INSTANCE=true).');
  }
  try { configuration(); }
  catch (error) { checks.push(error.message); }
  const [dump, restore] = await Promise.all([toolAvailable('mongodump'), toolAvailable('mongorestore')]);
  if (!dump || !restore) checks.push('Instala MongoDB Database Tools en el servidor (mongodump y mongorestore).');
  if (active) checks.push('Ya hay una copia o un mantenimiento pendiente de revisión.');
  return { ready: checks.length === 0, checks };
}

async function writeLock(lock) {
  const file = lockPath();
  const temp = `${file}.${process.pid}.${crypto.randomBytes(6).toString('hex')}.tmp`;
  try {
    const handle = await fs.promises.open(temp, 'wx', 0o600);
    try { await handle.writeFile(JSON.stringify(lock)); await handle.sync(); }
    finally { await handle.close(); }
    await fs.promises.rename(temp, file);
  } finally { await fs.promises.rm(temp, { force: true }).catch(() => {}); }
}

async function begin({ owner }) {
  if (preparing || active) throw new Error('Ya hay una copia o mantenimiento en curso.');
  preparing = true;
  try {
    const check = await readiness();
    if (!check.ready) throw new Error(check.checks.join(' '));
    const dir = backupDirectory();
    await fs.promises.mkdir(dir, { recursive: true, mode: 0o700 });
    backupDirectory(); // Validate the resolved path after creation, including symlinks.
    await fs.promises.chmod(dir, 0o700);
    const id = crypto.randomBytes(12).toString('hex');
    const lock = { id, startedAt: new Date().toISOString(), parentPid: process.pid, childPid: null };
    const handle = await fs.promises.open(lockPath(), 'wx', 0o600);
    try { await handle.writeFile(JSON.stringify(lock)); await handle.sync(); }
    finally { await handle.close(); }
    state = { phase: 'pausando', id, progress: 'Pausando la tienda y esperando operaciones en curso.' };
    active = true;
    const record = { id, database: process.env.BACKUP_DB_NAME, startedAt: lock.startedAt,
      status: 'en_proceso', steps: [{ name: `Copia solicitada desde el panel por ${String(owner).slice(0, 120)}`, at: lock.startedAt }] };
    await fs.promises.writeFile(path.join(dir, `backup-${id}.json`), JSON.stringify(record, null, 2), { flag: 'wx', mode: 0o600 });
    return id;
  } catch (error) {
    if (active && state.phase === 'pausando') {
      state = { ...state, phase: 'requiere_revision', progress: 'No se pudo registrar el inicio; revisa el mantenimiento.' };
    }
    throw error;
  } finally { preparing = false; }
}

async function waitForDrain(timeoutMs = 120000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (activeRequests === 0 && adminAccessGate.pendingAuditCount() === 0 && workersIdle()) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('No terminaron las operaciones anteriores en dos minutos. La copia no se inició.');
}

async function failBeforeChild(id, error) {
  const file = path.join(backupDirectory(), `backup-${id}.json`);
  const record = JSON.parse(await fs.promises.readFile(file, 'utf8'));
  record.status = 'fallido';
  record.completedAt = new Date().toISOString();
  record.steps.push({ name: `Error: ${error.message}`, at: record.completedAt });
  await fs.promises.writeFile(file, JSON.stringify(record, null, 2), { mode: 0o600 });
}

async function release(id, phase, progress) {
  try {
    const file = lockPath();
    const lock = JSON.parse(await fs.promises.readFile(file, 'utf8'));
    if (lock.id !== id) throw new Error('El bloqueo cambió durante el respaldo.');
    const dir = backupDirectory();
    if ((await fs.promises.readdir(dir)).some((name) => name.startsWith(`.working-${id}-`))) {
      throw new Error('Quedó un temporal de respaldo sin cifrar. Requiere revisión antes de reabrir.');
    }
    const record = JSON.parse(await fs.promises.readFile(path.join(dir, `backup-${id}.json`), 'utf8'));
    if (record.id !== id ||
        (phase === 'completado' && record.status !== 'verificado') ||
        (phase === 'fallido' && record.status !== 'fallido')) {
      throw new Error('La copia no tiene un resultado final coherente.');
    }
    await fs.promises.unlink(file);
    active = false;
    state = { id, phase, progress };
  } catch (error) {
    state = { id, phase: 'requiere_revision', progress: `La tienda sigue pausada: ${error.message}` };
    console.error('[backup-maintenance] No se pudo levantar el mantenimiento:', error.message);
  }
}

async function launch(id) {
  let child = null;
  let childDone = null;
  try {
    await waitForDrain();
    state = { id, phase: 'copiando', progress: 'Generando y comprobando la copia.' };
    const script = path.join(__dirname, '..', 'scripts', 'backupAtlasFree.js');
    child = spawn(process.execPath, [script, '--managed-maintenance'], {
      cwd: path.join(__dirname, '..'), shell: false, windowsHide: true,
      env: { ...process.env, BACKUP_RUN_ID: id }, stdio: ['ignore', 'pipe', 'pipe'],
    });
    childDone = new Promise((resolve) => {
      child.once('error', () => resolve(1));
      child.once('close', (exitCode) => resolve(exitCode ?? 1));
    });
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk) => { state = { ...state, progress: String(chunk).trim().slice(-300) }; });
    child.stderr.on('data', (chunk) => { console.error('[backup-maintenance]', String(chunk).trim().slice(-500)); });
    const lock = JSON.parse(await fs.promises.readFile(lockPath(), 'utf8'));
    await writeLock({ ...lock, childPid: child.pid });
    const code = await childDone;
    if (code !== 0) {
      try {
        const record = JSON.parse(await fs.promises.readFile(path.join(backupDirectory(), `backup-${id}.json`), 'utf8'));
        if (record.status === 'en_proceso') await failBeforeChild(id, new Error('El proceso se interrumpió sin resultado final.'));
      } catch (error) { console.error('[backup-maintenance] No se pudo cerrar el registro:', error.message); }
    }
    await release(id, code === 0 ? 'completado' : 'fallido',
      code === 0 ? 'Copia verificada. Ya puedes descargarla desde el panel.' : 'La copia falló. Revisa el historial.');
  } catch (error) {
    if (child && child.exitCode === null) child.kill();
    if (childDone) await childDone;
    console.error('[backup-maintenance] No se inició la copia:', error.message);
    await failBeforeChild(id, error).catch(() => {});
    await release(id, 'fallido', error.message);
  }
}

async function recover() {
  if (!active || state.phase !== 'requiere_revision') throw new Error('No hay un mantenimiento interrumpido.');
  const lock = JSON.parse(await fs.promises.readFile(lockPath(), 'utf8'));
  if (!/^[a-f\d]{24}$/.test(lock.id)) throw new Error('Bloqueo inválido.');
  if (Number.isInteger(lock.childPid) && lock.childPid > 0) {
    try { process.kill(lock.childPid, 0); throw new Error('El proceso de respaldo continúa activo.'); }
    catch (error) { if (error.code !== 'ESRCH') throw error; }
  }
  const dir = backupDirectory();
  const files = await fs.promises.readdir(dir);
  if (files.some((file) => file.startsWith(`.working-${lock.id}-`))) {
    throw new Error('Quedó un archivo temporal del respaldo. Un operador debe retirarlo antes de reabrir.');
  }
  const record = JSON.parse(await fs.promises.readFile(path.join(dir, `backup-${lock.id}.json`), 'utf8'));
  if (record.id !== lock.id || !['verificado', 'fallido'].includes(record.status)) throw new Error('La copia no tiene resultado final. Revisa el proceso antes de reabrir.');
  await release(lock.id, record.status === 'verificado' ? 'completado' : 'fallido', 'Mantenimiento recuperado.');
  const result = status();
  if (result.maintenance) throw new Error(result.progress);
  return result;
}

module.exports = { middleware, status, isActive, setWorkersIdle, readiness, begin, launch, recover };
