'use strict';

const crypto = require('node:crypto');
const mongoose = require('mongoose');

const CashJourneyClose = require('../models/CashJourneyClose');
const { buildCashJourneySummary, buildSummaryPeriod } = require('./cashReconciliationService');
const { createCashError, getCashVarianceTolerance } = require('./cashSessionService');

function cleanText(value, max = 1000) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, max);
}

function toObjectId(value) {
  const id = cleanText(value, 80);
  return mongoose.Types.ObjectId.isValid(id) ? new mongoose.Types.ObjectId(id) : null;
}

function bogotaBusinessDate(value = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(value instanceof Date ? value : new Date(value));
}

function buildAdminSnapshot(admin = {}) {
  return {
    username: cleanText(admin.username || admin.adminUsername || 'admin', 80).toLowerCase(),
    displayName: cleanText(admin.displayName || admin.fullName || admin.username || 'Administrador', 160),
    role: cleanText(admin.role || admin.adminRole || 'admin', 40).toLowerCase(),
    adminRole: cleanText(admin.adminRole || admin.role || 'admin', 40).toLowerCase(),
  };
}

function certificatePayload(summary = {}) {
  return {
    version: summary.version,
    branchId: summary.branchId,
    period: summary.period,
    status: summary.status,
    issueCounts: summary.issueCounts,
    totals: summary.totals,
    alerts: summary.alerts,
    sessions: summary.sessions,
  };
}

function digestSnapshot(snapshot) {
  return crypto.createHash('sha256').update(JSON.stringify(snapshot)).digest('hex');
}

function serializeJourneyClose(close = {}) {
  const doc = close?.toObject ? close.toObject() : { ...close };
  if (!doc?._id && !doc?.id) return null;
  return {
    id: String(doc._id || doc.id),
    branchId: String(doc.branch || ''),
    businessDate: doc.businessDate,
    timezone: doc.timezone,
    periodStart: doc.periodStart,
    periodEnd: doc.periodEnd,
    status: doc.status,
    summaryVersion: doc.summaryVersion,
    snapshot: doc.snapshot,
    contentDigest: doc.contentDigest,
    notes: doc.notes || '',
    certifiedBy: doc.certifiedBy ? String(doc.certifiedBy) : '',
    certifiedBySnapshot: doc.certifiedBySnapshot || {},
    certifiedAt: doc.certifiedAt,
  };
}

async function getCashJourneyClose({ branchId, now = new Date() } = {}) {
  const branch = toObjectId(branchId);
  if (!branch) return null;
  return CashJourneyClose.findOne({ branch, businessDate: bogotaBusinessDate(now) }).lean();
}

async function assertJourneyCanOpen({ branchId, now = new Date() } = {}) {
  const close = await getCashJourneyClose({ branchId, now });
  if (!close) return;
  throw createCashError(
    'La jornada de caja de hoy ya fue certificada. No se pueden abrir nuevas cajas en esta sede.',
    'CASH_JOURNEY_ALREADY_CERTIFIED',
    409,
    { businessDate: close.businessDate, journeyCloseId: String(close._id) }
  );
}

async function certifyCashJourney({ branchId, branchIds, notes = '', now = new Date(), admin = {} } = {}) {
  const branch = toObjectId(branchId);
  if (!branch) {
    throw createCashError('Debes seleccionar una sede válida.', 'CASH_JOURNEY_BRANCH_REQUIRED', 400);
  }
  const businessDate = bogotaBusinessDate(now);
  const existing = await CashJourneyClose.findOne({ branch, businessDate });
  if (existing) return { close: existing, alreadyCertified: true };

  const summary = await buildCashJourneySummary({
    branchId: branch,
    branchIds,
    range: 'today',
    now,
    toleranceAmount: getCashVarianceTolerance(),
  });
  const blockers = [];
  if (!summary.totals.sessionsCount) blockers.push('La jornada no contiene sesiones de caja.');
  if (summary.totals.openSessionsCount) blockers.push(`${summary.totals.openSessionsCount} caja(s) continúan abiertas.`);
  if (summary.totals.pendingReviewCount) blockers.push(`${summary.totals.pendingReviewCount} arqueo(s) continúan pendientes.`);
  if (summary.issueCounts.critical) blockers.push(`${summary.issueCounts.critical} caja(s) tienen inconsistencias críticas.`);
  if (blockers.length) {
    throw createCashError(
      'La jornada no puede certificarse hasta resolver sus controles pendientes.',
      'CASH_JOURNEY_CLOSE_BLOCKED',
      409,
      { blockers }
    );
  }

  const cleanNotes = cleanText(notes, 1000);
  if ((summary.totals.shortages > 0 || summary.totals.overages > 0) && !cleanNotes) {
    throw createCashError(
      'Debes registrar una observación para certificar una jornada con diferencias.',
      'CASH_JOURNEY_CLOSE_NOTES_REQUIRED',
      400
    );
  }

  const period = buildSummaryPeriod('today', now);
  const snapshot = certificatePayload(summary);
  const adminId = toObjectId(admin.id || admin._id || admin.adminUserId);
  try {
    const close = await CashJourneyClose.create({
      branch,
      businessDate,
      periodStart: period.start,
      periodEnd: period.end,
      snapshot,
      contentDigest: digestSnapshot(snapshot),
      notes: cleanNotes,
      certifiedBy: adminId,
      certifiedBySnapshot: buildAdminSnapshot(admin),
      certifiedAt: now,
    });
    return { close, alreadyCertified: false };
  } catch (error) {
    if (String(error?.code || '') === '11000') {
      const close = await CashJourneyClose.findOne({ branch, businessDate });
      if (close) return { close, alreadyCertified: true };
    }
    throw error;
  }
}

module.exports = {
  assertJourneyCanOpen,
  bogotaBusinessDate,
  certificatePayload,
  certifyCashJourney,
  digestSnapshot,
  getCashJourneyClose,
  serializeJourneyClose,
};
