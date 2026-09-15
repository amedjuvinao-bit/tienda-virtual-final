'use strict';

const express = require('express');

const AdminAuditLog = require('../models/AdminAuditLog');
const AdminLoginAudit = require('../models/AdminLoginAudit');
const requireAdmin = require('../middleware/requireAdmin');
const requirePermission = require('../middleware/requirePermission');

const router = express.Router();

function parseBoundedInteger(value, fallback, minimum, maximum) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(maximum, Math.max(minimum, parsed));
}

function normalizeScope(value) {
  return String(value || '').trim().toLowerCase() === 'operations'
    ? 'operations'
    : 'login';
}

function csvCell(value) {
  const text = String(value ?? '').replace(/\r?\n/g, ' ');
  return `"${text.replace(/"/g, '""')}"`;
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
    status: log?.success === false ? 'failed' : 'success',
    reason: log?.description || log?.action || '',
    userAgent: log?.userAgent || '',
    permission: log?.permission || '',
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
      const page = parseBoundedInteger(req.query.page, 1, 1, 100_000);
      const limit = parseBoundedInteger(req.query.limit, 50, 1, 100);
      const model = getLogModel(scope);
      const [rows, total] = await Promise.all([
        model
          .find({})
          .sort({ createdAt: -1 })
          .skip((page - 1) * limit)
          .limit(limit)
          .lean(),
        model.countDocuments({}),
      ]);

      return res.json({
        ok: true,
        data: rows.map((row) => serializeLog(scope, row)),
        pagination: {
          page,
          limit,
          total,
          pages: Math.max(1, Math.ceil(total / limit)),
        },
        scope,
      });
    } catch (error) {
      return next(error);
    }
  }
);

router.get(
  '/export',
  requireAdmin,
  requirePermission('logs:export'),
  async (req, res, next) => {
    try {
      const scope = normalizeScope(req.query.scope);
      const limit = parseBoundedInteger(req.query.limit, 1000, 1, 5000);
      const rows = await getLogModel(scope)
        .find({})
        .sort({ createdAt: -1 })
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
      return next(error);
    }
  }
);

module.exports = router;
module.exports.normalizeScope = normalizeScope;
module.exports.serializeLoginLog = serializeLoginLog;
module.exports.serializeOperationLog = serializeOperationLog;
