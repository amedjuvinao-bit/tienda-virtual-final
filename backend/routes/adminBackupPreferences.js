'use strict';

const express = require('express');
const path = require('node:path');
const fs = require('node:fs');
const rateLimit = require('express-rate-limit');
const requireAdmin = require('../middleware/requireAdmin');
const requirePermission = require('../middleware/requirePermission');
const BackupPreference = require('../models/BackupPreference');
const AdminUser = require('../models/AdminUser');
const { decryptTwoFactorSecret, verifyTotp } = require('../security/adminTwoFactorCrypto');
const { backupDirectory, listBackups, safeBackupId, sha256 } = require('../services/freeBackupArchive');

const router = express.Router();
const STRATEGIES = new Set(['free_manual', 'atlas_managed']);

async function serialize(preference) {
  let backupVerified = false;
  try { backupVerified = (await listBackups()).some((run) => run.status === 'verificado' && run.available); }
  catch { /* La preferencia puede consultarse antes de configurar el directorio. */ }
  return {
    strategy: preference?.strategy || null,
    revision: preference?.revision || 0,
    updatedAt: preference?.updatedAt || null,
    updatedBy: preference?.updatedBy || null,
    backupVerified,
  };
}

router.use(requireAdmin, requirePermission.ownerOnly());

router.get('/', async (_req, res, next) => {
  try {
    const preference = await BackupPreference.findById('primary').lean();
    res.set('Cache-Control', 'no-store, private');
    return res.json(await serialize(preference));
  } catch (error) {
    return next(error);
  }
});

router.put('/', async (req, res, next) => {
  const { strategy, revision } = req.body || {};
  if (!STRATEGIES.has(strategy) || !Number.isSafeInteger(revision) || revision < 0 ||
      Object.keys(req.body || {}).some((key) => !['strategy', 'revision'].includes(key))) {
    return res.status(400).json({ ok: false, message: 'Selecciona un método válido y actualiza la página antes de guardar.' });
  }

  try {
    const updatedBy = String(req.adminUsername || req.adminUserId).slice(0, 120);
    let preference;
    if (revision === 0) {
      preference = await BackupPreference.create({ _id: 'primary', strategy, revision: 1, updatedBy });
    } else {
      preference = await BackupPreference.findOneAndUpdate(
        { _id: 'primary', revision },
        { $set: { strategy, updatedBy }, $inc: { revision: 1 } },
        { new: true, runValidators: true }
      );
    }
    if (!preference) {
      return res.status(409).json({ ok: false, message: 'La preferencia cambió en otra sesión. Actualiza la página.' });
    }
    res.set('Cache-Control', 'no-store, private');
    return res.json(await serialize(preference));
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ ok: false, message: 'La preferencia cambió en otra sesión. Actualiza la página.' });
    }
    return next(error);
  }
});

router.get('/runs', async (_req, res, next) => {
  try {
    res.set('Cache-Control', 'no-store, private');
    return res.json({ runs: await listBackups() });
  } catch (error) { return next(error); }
});

const downloadLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 5, standardHeaders: true,
  legacyHeaders: false, message: { message: 'Demasiados intentos. Espera 15 minutos.' } });
router.post('/runs/:id/download', downloadLimiter, async (req, res, next) => {
  const { id } = req.params;
  if (!safeBackupId(id)) return res.status(400).json({ message: 'Identificador inválido.' });
  try {
    const owner = await AdminUser.findById(req.adminUserId).select('+passwordHash +twoFactorSecret');
    if (!owner || !owner.twoFactorEnabled || !owner.twoFactorSecret ||
        !(await owner.comparePassword(String(req.body?.currentPassword || ''))) ||
        !verifyTotp(decryptTwoFactorSecret(owner.twoFactorSecret), String(req.body?.twoFactorCode || ''))) {
      return res.status(403).json({ message: 'Contraseña o código de seguridad incorrecto.' });
    }
    const directory = backupDirectory();
    const record = JSON.parse(await fs.promises.readFile(path.join(directory, `backup-${id}.json`), 'utf8'));
    if (record.id !== id || record.status !== 'verificado' || !record.sha256) {
      return res.status(409).json({ message: 'La copia no está verificada.' });
    }
    const filename = `backup-${id}.archive.gz.enc`;
    const file = path.join(directory, filename);
    const stat = await fs.promises.lstat(file);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size !== record.size || await sha256(file) !== record.sha256) {
      return res.status(409).json({ message: 'La copia no coincide con el registro. Revisa el almacenamiento.' });
    }
    res.set('Cache-Control', 'no-store, private');
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('Content-Type', 'application/octet-stream');
    return res.download(file, filename, (error) => { if (error && !res.headersSent) next(error); });
  } catch (error) {
    if (error.code === 'ENOENT') return res.status(404).json({ message: 'No se encontró la copia en este servidor.' });
    return next(error);
  }
});

module.exports = router;
