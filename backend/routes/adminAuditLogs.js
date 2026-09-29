'use strict';

const express = require('express');

const AdminAuditLog = require('../models/AdminAuditLog');
const AdminLoginAudit = require('../models/AdminLoginAudit');
const requireAdmin = require('../middleware/requireAdmin');
const requirePermission = require('../middleware/requirePermission');

const router = express.Router();

class InvalidLogFilterError extends Error {}

function parseBoundedInteger(value, fallback, minimum, maximum) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) return fallback;
  return Math.min(maximum, Math.max(minimum, parsed));
}

function normalizeScope(value) {
  return String(value || '').trim().toLowerCase() === 'operations'
    ? 'operations'
    : 'login';
}

function csvCell(value) {
  let text = String(value ?? '').replace(/[\r\n\t]/g, ' ');
  if (/^\s*[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

function buildLogFilter(scope, query = {}) {
  const filter = {};
  const username = String(query.username || '').trim();
  if (username.length > 80) throw new InvalidLogFilterError('El usuario no puede superar 80 caracteres.');
  if (username) {
    filter[scope === 'operations' ? 'adminUsername' : 'username'] = {
      $regex: username.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i',
    };
  }

  const status = String(query.status || '').trim().toLowerCase();
  const allowedStatuses = scope === 'operations'
    ? ['success', 'failed']
    : ['success', 'pending', 'failed', 'blocked', 'error'];
  if (status && !allowedStatuses.includes(status)) throw new InvalidLogFilterError('Estado de log inválido.');
  if (status) {
    if (scope === 'operations') filter.success = status === 'success';
    else filter.status = status;
  }

  const moduleName = String(query.module || '').trim().toLowerCase();
  if (moduleName && (scope !== 'operations' || !/^[a-z0-9:-]{1,50}$/.test(moduleName))) {
    throw new InvalidLogFilterError('Módulo de log inválido.');
  }
  if (moduleName) filter.module = moduleName;

  const from = String(query.from || '').trim();
  const to = String(query.to || '').trim();
  for (const date of [from, to]) {
    if (date && (!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{3})?Z$/.test(date) ||
      !Number.isFinite(Date.parse(date)) ||
      new Date(date).toISOString() !== (date.includes('.') ? date : date.replace(/Z$/, '.000Z')))) {
      throw new InvalidLogFilterError('Rango de fechas inválido.');
    }
  }
  if (from && to && Date.parse(from) >= Date.parse(to)) {
    throw new InvalidLogFilterError('La fecha final debe ser posterior a la inicial.');
  }
  if (from || to) {
    filter.createdAt = {};
    if (from) filter.createdAt.$gte = new Date(from);
    if (to) filter.createdAt.$lt = new Date(to);
  }
  return filter;
}

function serializeLoginLog(log) {
  return {
    _id: String(log?._id || ''),
    type: 'login',
    createdAt: log?.createdAt || null,
    username: log?.username || '',
    ip: log?.ip || '',
    status: log?.status || 'error',
    reason: log?.reason || '',
    userAgent: log?.userAgent || '',
  };
}

function serializeOperationLog(log) {
  return {
    _id: String(log?._id || ''),
    type: 'operation',
    createdAt: log?.createdAt || null,
    username: log?.adminUsername || '',
    ip: log?.ip || '',
    status: log?.success === true ? 'success' : log?.success === false ? 'failed' : 'unknown',
    reason: log?.description || log?.action || '',
    userAgent: log?.userAgent || '',
    permission: log?.permission || '',
    module: log?.module || '',
    resourceId: log?.resourceId || '',
    statusCode: log?.statusCode ?? null,
    method: log?.method || '',
    path: log?.path || '',
  };
}

function getLogModel(scope) {
  return scope === 'operations' ? AdminAuditLog : AdminLoginAudit;
}

function serializeLog(scope, log) {
  return scope === 'operations'
    ? serializeOperationLog(log)
    : serializeLoginLog(log);
}

router.get(
  '/',
  requireAdmin,
  requirePermission('logs:view'),
  async (req, res, next) => {
    try {
      const scope = normalizeScope(req.query.scope);
      const page = parseBoundedInteger(req.query.page, 1, 1, 1000);
      const limit = parseBoundedInteger(req.query.limit, 50, 1, 100);
      const filter = buildLogFilter(scope, req.query);
      const model = getLogModel(scope);
      const [rows, total] = await Promise.all([
        model
          .find(filter)
          .sort({ createdAt: -1, _id: -1 })
          .skip((page - 1) * limit)
          .limit(limit)
          .lean(),
        model.countDocuments(filter),
      ]);

      return res.json({
        ok: true,
        data: rows.map((row) => serializeLog(scope, row)),
        pagination: {
          page,
          limit,
          total,
          pages: Math.max(1, Math.min(1000, Math.ceil(total / limit))),
        },
        scope,
      });
    } catch (error) {
      if (error instanceof InvalidLogFilterError) {
        return res.status(400).json({ ok: false, message: error.message });
      }
      return next(error);
    }
  }
);

router.get(
  '/export',
  requireAdmin,
  requirePermission.all(['logs:view', 'logs:export']),
  async (req, res, next) => {
    try {
      const scope = normalizeScope(req.query.scope);
      const limit = parseBoundedInteger(req.query.limit, 1000, 1, 5000);
      const filter = buildLogFilter(scope, req.query);
      const rows = await getLogModel(scope)
        .find(filter)
        .sort({ createdAt: -1, _id: -1 })
        .limit(limit)
        .lean();
      const normalized = rows.map((row) => serializeLog(scope, row));
      const headers = [
        'fecha',
        'tipo',
        'usuario',
        'ip',
        'estado',
        'motivo',
        'permiso',
        'metodo',
        'ruta',
        'modulo',
        'recurso',
        'codigo_http',
      ];
      const lines = normalized.map((row) =>
        [
          row.createdAt ? new Date(row.createdAt).toISOString() : '',
          row.type,
          row.username,
          row.ip,
          row.status,
          row.reason,
          row.permission,
          row.method,
          row.path,
          row.module,
          row.resourceId,
          row.statusCode,
        ]
          .map(csvCell)
          .join(',')
      );
      const csv = `\uFEFF${headers.join(',')}\n${lines.join('\n')}`;

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="admin-${scope}-logs.csv"`
      );
      return res.send(csv);
    } catch (error) {
      if (error instanceof InvalidLogFilterError) {
        return res.status(400).json({ ok: false, message: error.message });
      }
      return next(error);
    }
  }
);

module.exports = router;
module.exports.normalizeScope = normalizeScope;
module.exports.serializeLoginLog = serializeLoginLog;
module.exports.serializeOperationLog = serializeOperationLog;
module.exports.buildLogFilter = buildLogFilter;
module.exports.csvCell = csvCell;
