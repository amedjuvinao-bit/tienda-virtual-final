// backend/middleware/adminAccessGate.js

const crypto = require('crypto');

const requireAdmin = require('./requireAdmin');
const requirePermission = require('./requirePermission');
const AdminAuditLog = require('../models/AdminAuditLog');

const {
  findAdminRoutePermission,
  normalizePath,
} = require('../security/adminRoutePermissionMap');

const {
  canonicalPermission,
  getPermissionMeta,
} = require('../security/adminPermissionCatalog');

const SENSITIVE_BODY_KEYS = [
  'password',
  'passwordHash',
  'currentPassword',
  'newPassword',
  'confirmPassword',
  'token',
  'accessToken',
  'refreshToken',
  'authorization',
  'apiKey',
  'privateKey',
  'publicKey',
  'integrityKey',
  'secret',
  'clientSecret',
  'apiLogin',
  'softwarePin',
  'softwareSecurityCode',
  'technicalKey',
  'certificatePath',
  'jwt',
  'smtpPassword',
  'wompiPrivateKey',
  'wompiPublicKey',
  'factusClientSecret',
  'factusClientId',
  'certificate',
  'certificatePassword',
  // Datos personales y fiscales. El historial funcional de Clientes guarda
  // huellas y vistas enmascaradas; el log administrativo global no debe
  // duplicar PII cruda dentro del snapshot HTTP.
  'email',
  'phone',
  'cellphone',
  'mobile',
  'documentNumber',
  'firstName',
  'lastName',
  'fullName',
  'displayName',
  'businessName',
  'address',
  'postalCode',
  'fiscalProfile',
  'marketingConsent',
  'proofReference',
  'retentionHoldReason',
  'notes',
  'note',
  'q',
  'search',
  'searchTerm',
];

function isPlainObject(value) {
  return Boolean(
    value &&
      typeof value === 'object' &&
      !Array.isArray(value)
  );
}

function sanitizeValue(value, depth = 0) {
  if (depth > 5) return '[MAX_DEPTH]';

  if (Array.isArray(value)) {
    return value.slice(0, 50).map((item) => sanitizeValue(item, depth + 1));
  }

  if (isPlainObject(value)) {
    const result = {};

    for (const [key, itemValue] of Object.entries(value)) {
      const lowerKey = String(key || '').toLowerCase();

      const isSensitive = SENSITIVE_BODY_KEYS.some((sensitiveKey) => {
        const candidate = String(sensitiveKey).toLowerCase();
        return candidate.length <= 2
          ? lowerKey === candidate
          : lowerKey.includes(candidate);
      });

      result[key] = isSensitive
        ? '[REDACTED]'
        : sanitizeValue(itemValue, depth + 1);
    }

    return result;
  }

  if (typeof value === 'string' && value.length > 1000) {
    return `${value.slice(0, 1000)}...[TRUNCATED]`;
  }

  return value;
}

function getClientIp(req) {
  const forwardedFor = String(req.headers['x-forwarded-for'] || '')
    .split(',')[0]
    .trim();

  return (
    forwardedFor ||
    req.ip ||
    req.connection?.remoteAddress ||
    req.socket?.remoteAddress ||
    ''
  );
}

function getRequestId(req) {
  return (
    String(req.headers['x-request-id'] || '').trim() ||
    String(req.headers['x-correlation-id'] || '').trim() ||
    crypto.randomUUID()
  );
}

function splitPath(pathname) {
  return normalizePath(pathname)
    .split('/')
    .filter(Boolean);
}

function extractRouteParams(routePattern, requestPath) {
  const patternSegments = splitPath(routePattern);
  const requestSegments = splitPath(requestPath);

  const params = {};

  for (let index = 0; index < patternSegments.length; index += 1) {
    const patternSegment = patternSegments[index];
    const requestSegment = requestSegments[index];

    if (!patternSegment || !requestSegment) continue;

    if (patternSegment.startsWith(':')) {
      const paramName = patternSegment.slice(1);
      params[paramName] = decodeURIComponent(requestSegment);
    }
  }

  return params;
}

function getResourceId(rule, req) {
  const requestPath = normalizePath(req.originalUrl || req.url || '');
  const routeParams = extractRouteParams(rule.path, requestPath);

  return (
    routeParams.id ||
    routeParams.orderId ||
    routeParams.customerId ||
    routeParams.productId ||
    routeParams.userId ||
    routeParams.roleId ||
    routeParams.branchId ||
    routeParams.reviewId ||
    routeParams.noteId ||
    ''
  );
}

function getModuleFromPermission(permission) {
  return String(permission || '').split(':')[0] || '';
}

function shouldAudit(rule) {
  return Boolean(rule?.audit === true);
}

function buildAuditPayload(req, res, rule, startedAt, extra = {}) {
  const permission = canonicalPermission(rule.permission);
  const permissionMeta = getPermissionMeta(permission);

  const requestPath = normalizePath(req.originalUrl || req.url || '');

  return {
    action: permission,
    permission,
    module: permissionMeta?.module || getModuleFromPermission(permission),
    description: rule.description || permissionMeta?.description || '',

    method: req.method,
    path: requestPath,
    routePattern: rule.path,

    resourceId: getResourceId(rule, req),

    adminUserId: req.adminUserId || null,
    adminUsername: req.adminUsername || req.adminUser || '',
    adminRole: req.adminRole || '',

    statusCode: res.statusCode || null,
    success:
      typeof res.statusCode === 'number'
        ? res.statusCode >= 200 && res.statusCode < 400
        : null,

    ip: getClientIp(req),
    userAgent: String(req.headers['user-agent'] || ''),
    requestId: req.adminRequestId || getRequestId(req),

    query: sanitizeValue(req.query || {}),
    params: sanitizeValue({
      ...(req.params || {}),
      ...extractRouteParams(rule.path, requestPath),
    }),
    bodySnapshot: sanitizeValue(req.body || {}),

    responseSnapshot: sanitizeValue(extra.responseSnapshot || {}),
    errorMessage: extra.errorMessage || '',

    metadata: {
      danger: Boolean(rule.danger),
      reserved: Boolean(rule.reserved),
      dynamic: Boolean(rule.dynamic),
      requiredPermissions: rule.requiredPermissions || [permission],
      elapsedMs: Date.now() - startedAt,
    },
  };
}

function attachAuditLogger(req, res, rule) {
  if (!shouldAudit(rule)) return;

  const startedAt = Date.now();

  req.adminRequestId = getRequestId(req);

  res.once('finish', async () => {
    try {
      const payload = buildAuditPayload(req, res, rule, startedAt);

      await AdminAuditLog.create(payload);
    } catch (error) {
      console.error('[adminAccessGate] Error guardando auditoría:', error.message);
    }
  });
}

function rejectUnknownPermission(req, res, rule) {
  return res.status(500).json({
    ok: false,
    error: 'UNKNOWN_PERMISSION',
    message: 'La ruta administrativa exige un permiso que no existe en el catálogo.',
    permission: rule.permission,
    requiredPermissions: rule.requiredPermissions || [rule.permission],
    route: rule.path,
    method: rule.method,
  });
}

function adminAccessGate(req, res, next) {
  if (req.method === 'OPTIONS') {
    return next();
  }

  const rule = findAdminRoutePermission(
    req.method,
    req.originalUrl || req.url,
    req.query
  );

  if (!rule) {
    return next();
  }

  if (!rule.knownPermission) {
    return rejectUnknownPermission(req, res, rule);
  }

  attachAuditLogger(req, res, rule);

  return requireAdmin(req, res, () => {
    return requirePermission(
      rule.requiredPermissions || [rule.permission]
    )(req, res, next);
  });
}

module.exports = adminAccessGate;
module.exports.sanitizeValue = sanitizeValue;
