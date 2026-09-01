'use strict';

const crypto = require('crypto');
const mongoose = require('mongoose');

const CustomerAuditEvent = require('../models/CustomerAuditEvent');
const requirePermission = require('../middleware/requirePermission');

const DEFAULT_RETENTION_DAYS = 3650;
const SENSITIVE_PATH = /(email|phone|document|address|postal|fiscal|businessname|notes|taxresponsibilities)/i;

function cleanText(value, max = 500) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, max);
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== 'object' || value instanceof Date) {
    return value instanceof Date ? value.toISOString() : value;
  }
  return Object.keys(value)
    .sort()
    .reduce((result, key) => {
      result[key] = stableValue(value[key]);
      return result;
    }, {});
}

function hashValue(value) {
  return crypto
    .createHash('sha256')
    .update(JSON.stringify(stableValue(value ?? null)))
    .digest('hex');
}

function maskEmail(value) {
  const email = cleanText(value, 180).toLowerCase();
  const [local, domain] = email.split('@');
  if (!local || !domain) return email ? '***' : '';
  return `${local.slice(0, Math.min(2, local.length))}***@${domain}`;
}

function maskPhone(value) {
  const phone = cleanText(value, 40);
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  return digits ? `••••••${digits.slice(-4)}` : '••••';
}

function maskDocument(value) {
  const document = cleanText(value, 80);
  if (!document) return '';
  return `••••${document.replace(/\s/g, '').slice(-4)}`;
}

function previewValue(path, value) {
  if (value === undefined || value === null || value === '') return '';
  if (/email/i.test(path)) return maskEmail(value);
  if (/phone/i.test(path)) return maskPhone(value);
  if (/document/i.test(path)) return maskDocument(value);
  if (SENSITIVE_PATH.test(path)) return '[DATO PROTEGIDO]';
  if (Array.isArray(value)) return `[${value.length} elemento(s)]`;
  if (typeof value === 'object') return '[OBJETO ACTUALIZADO]';
  return cleanText(value, 240);
}

function buildAuditChanges(before = {}, after = {}, paths = []) {
  return [...new Set(paths.map((path) => cleanText(path, 160)).filter(Boolean))]
    .map((path) => {
      const beforeValue = path.split('.').reduce((value, key) => value?.[key], before);
      const afterValue = path.split('.').reduce((value, key) => value?.[key], after);
      if (hashValue(beforeValue) === hashValue(afterValue)) return null;
      return {
        path,
        beforeHash: hashValue(beforeValue),
        afterHash: hashValue(afterValue),
        beforePreview: previewValue(path, beforeValue),
        afterPreview: previewValue(path, afterValue),
      };
    })
    .filter(Boolean);
}

function requestIp(req = {}) {
  return cleanText(
    String(req.headers?.['x-forwarded-for'] || '').split(',')[0] ||
      req.ip ||
      req.socket?.remoteAddress ||
      '',
    160
  );
}

function auditSecret() {
  return String(
    process.env.CUSTOMER_AUDIT_HASH_SECRET ||
      process.env.JWT_SECRET ||
      'customer-audit-local-integrity-key'
  );
}

function hmac(value) {
  return crypto.createHmac('sha256', auditSecret()).update(String(value || '')).digest('hex');
}

function eventHashPayload(event = {}) {
  return {
    customer: String(event.customer || ''),
    customerCode: event.customerCode || '',
    eventType: event.eventType || '',
    action: event.action || '',
    actorAdmin: String(event.actorAdmin?._id || event.actorAdmin?.id || event.actorAdmin || ''),
    actorUsername: event.actorUsername || '',
    actorRole: event.actorRole || '',
    branch: String(event.branch?._id || event.branch?.id || event.branch || ''),
    requestId: event.requestId || '',
    ipHash: event.ipHash || '',
    changes: event.changes || [],
    metadata: event.metadata || {},
    previousHash: event.previousHash || '',
    createdAt: new Date(event.createdAt).toISOString(),
  };
}

function calculateEventHash(event = {}) {
  return hmac(JSON.stringify(stableValue(eventHashPayload(event))));
}

function safeMetadata(metadata = {}) {
  const output = {};
  Object.entries(metadata || {}).slice(0, 40).forEach(([key, value]) => {
    if (SENSITIVE_PATH.test(key)) {
      output[cleanText(key, 80)] = value === undefined ? '' : hashValue(value);
      return;
    }
    if (value === null || ['string', 'number', 'boolean'].includes(typeof value)) {
      output[cleanText(key, 80)] = typeof value === 'string' ? cleanText(value, 500) : value;
    }
  });
  return output;
}

function adminId(req = {}) {
  const value = req.adminUserId || req.adminProfile?.id || null;
  return value && mongoose.Types.ObjectId.isValid(String(value)) ? value : null;
}

async function recordCustomerAuditEvent({
  req,
  customer,
  eventType,
  action,
  changes = [],
  metadata = {},
  branchId = null,
} = {}) {
  const customerId = customer?._id || customer?.id || customer;
  if (!customerId || !mongoose.Types.ObjectId.isValid(String(customerId))) {
    throw new TypeError('CUSTOMER_AUDIT_CUSTOMER_REQUIRED');
  }

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const previous = await CustomerAuditEvent.findOne({ customer: customerId })
      .sort({ createdAt: -1, _id: -1 })
      .select('eventHash')
      .lean();
    const createdAt = new Date();
    const payload = {
      customer: customerId,
      customerCode: cleanText(customer?.customerCode, 80).toUpperCase(),
      eventType,
      action: cleanText(action, 180),
      actorAdmin: adminId(req),
      actorUsername: cleanText(req?.adminUsername || req?.adminUser, 120),
      actorRole: cleanText(req?.adminRole, 80).toLowerCase(),
      branch: branchId || customer?.defaultBranch || null,
      requestId: cleanText(
        req?.adminRequestId || req?.headers?.['x-request-id'] || req?.headers?.['x-correlation-id'],
        160
      ),
      ipHash: requestIp(req) ? hmac(requestIp(req)) : '',
      changes: Array.isArray(changes) ? changes.slice(0, 80) : [],
      metadata: safeMetadata(metadata),
      previousHash: previous?.eventHash || '',
      createdAt,
    };
    payload.eventHash = calculateEventHash(payload);

    try {
      return await CustomerAuditEvent.create(payload);
    } catch (error) {
      if (Number(error?.code) !== 11000 || attempt === 3) throw error;
    }
  }
  return null;
}

function verifyCustomerAuditChain(events = [], initialPreviousHash = '') {
  let previousHash = initialPreviousHash;
  for (const event of events) {
    const raw = typeof event.toObject === 'function' ? event.toObject() : event;
    if (String(raw.previousHash || '') !== previousHash) return false;
    if (calculateEventHash(raw) !== raw.eventHash) return false;
    previousHash = raw.eventHash;
  }
  return true;
}

function serializeAuditEvent(event = {}) {
  const raw = typeof event.toObject === 'function'
    ? event.toObject({ virtuals: true })
    : event;
  const actor = raw.actorAdmin && typeof raw.actorAdmin === 'object'
    ? raw.actorAdmin
    : null;
  return {
    id: String(raw._id || raw.id || ''),
    eventType: raw.eventType || '',
    action: raw.action || '',
    actor: {
      id: String(actor?._id || actor?.id || raw.actorAdmin || ''),
      name: cleanText(
        actor?.displayName ||
          `${actor?.firstName || ''} ${actor?.lastName || ''}` ||
          raw.actorUsername
      ) || raw.actorUsername || '',
      role: actor?.role || raw.actorRole || '',
    },
    changes: raw.changes || [],
    metadata: raw.metadata || {},
    previousHash: raw.previousHash || '',
    eventHash: raw.eventHash || '',
    createdAt: raw.createdAt || null,
  };
}

async function canViewSensitiveCustomerData(req) {
  return requirePermission.hasEffectivePermission(req, 'customers:sensitive');
}

function protectCustomerData(customer = {}, canViewSensitive = false) {
  if (canViewSensitive) return customer;
  return {
    ...customer,
    phone: maskPhone(customer.phone),
    email: maskEmail(customer.email),
    documentNumber: maskDocument(customer.documentNumber),
    address: customer.address ? '[DIRECCIÓN PROTEGIDA]' : '',
    postalCode: customer.postalCode ? '••••' : '',
    addresses: Array.isArray(customer.addresses)
      ? customer.addresses.map((address) => ({
          ...address,
          address: address?.address ? '[DIRECCIÓN PROTEGIDA]' : '',
          postalCode: address?.postalCode ? '••••' : '',
        }))
      : [],
    fiscalProfile: customer.fiscalProfile
      ? {
          ...customer.fiscalProfile,
          businessName: customer.fiscalProfile.businessName ? '[DATO FISCAL PROTEGIDO]' : '',
          verificationDigit: customer.fiscalProfile.verificationDigit ? '•' : '',
          taxResponsibilities: [],
        }
      : {},
    notes: customer.notes ? '[NOTA INTERNA PROTEGIDA]' : '',
    marketingConsent: customer.marketingConsent
      ? {
          ...customer.marketingConsent,
          proofReference: customer.marketingConsent.proofReference
            ? '[EVIDENCIA PROTEGIDA]'
            : '',
          history: Array.isArray(customer.marketingConsent.history)
            ? customer.marketingConsent.history.map((entry) => ({
                ...entry,
                proofReference: entry?.proofReference ? '[EVIDENCIA PROTEGIDA]' : '',
                note: entry?.note ? '[NOTA PROTEGIDA]' : '',
              }))
            : [],
        }
      : {},
    retentionHoldReason: customer.retentionHoldReason
      ? '[MOTIVO PROTEGIDO]'
      : '',
  };
}

function getCustomerRetentionDays() {
  const configured = Number(process.env.CUSTOMER_RETENTION_DAYS || DEFAULT_RETENTION_DAYS);
  return Number.isInteger(configured) && configured >= 30
    ? configured
    : DEFAULT_RETENTION_DAYS;
}

module.exports = {
  DEFAULT_RETENTION_DAYS,
  buildAuditChanges,
  calculateEventHash,
  canViewSensitiveCustomerData,
  getCustomerRetentionDays,
  hashValue,
  maskDocument,
  maskEmail,
  maskPhone,
  protectCustomerData,
  recordCustomerAuditEvent,
  serializeAuditEvent,
  verifyCustomerAuditChain,
};
