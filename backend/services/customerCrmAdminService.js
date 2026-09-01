'use strict';

const mongoose = require('mongoose');

const AdminUser = require('../models/AdminUser');
const {
  buildCustomerBranchAccess,
} = require('./customerAdminScopeService');

const GLOBAL_ADMIN_ROLES = new Set(['owner', 'admin']);

function cleanText(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function asAdminId(value) {
  const raw = typeof value === 'object' && value
    ? value.id || value._id
    : value;
  const id = cleanText(raw);
  return mongoose.Types.ObjectId.isValid(id) ? id : '';
}

function adminBranchIds(admin = {}) {
  return [
    ...(Array.isArray(admin.branches)
      ? admin.branches.map((item) => item?.branch)
      : []),
    admin.defaultBranch,
  ]
    .filter(Boolean)
    .map(String)
    .filter((value, index, values) => values.indexOf(value) === index);
}

function isGlobalAdmin(admin = {}) {
  return GLOBAL_ADMIN_ROLES.has(cleanText(admin.role).toLowerCase());
}

function canServeBranch(admin = {}, branchId = '') {
  if (isGlobalAdmin(admin)) return true;
  const target = cleanText(branchId);
  return !target || adminBranchIds(admin).includes(target);
}

function serializeCrmAdmin(admin = {}) {
  if (!admin) return null;
  const name = cleanText(
    admin.displayName ||
      `${admin.firstName || ''} ${admin.lastName || ''}` ||
      admin.username
  );
  return {
    id: String(admin._id || admin.id || ''),
    name: name || cleanText(admin.username),
    username: cleanText(admin.username),
    role: cleanText(admin.role).toLowerCase(),
    branchIds: adminBranchIds(admin),
  };
}

function createAssignmentError(message, code, statusCode = 400) {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  return error;
}

async function listAssignableCrmAdmins(req, { branchId = '' } = {}) {
  const access = buildCustomerBranchAccess(req, {
    requestedBranchId: branchId || undefined,
  });
  if (!access.ok) {
    throw createAssignmentError(
      access.message || 'No tienes acceso a esa sede.',
      access.error || 'CUSTOMER_BRANCH_FORBIDDEN',
      access.status || 403
    );
  }

  const admins = await AdminUser.find({
    status: 'active',
    active: true,
  })
    .select('username displayName firstName lastName role branches defaultBranch')
    .sort({ displayName: 1, username: 1 })
    .lean();
  const allowedBranches = new Set(access.branchIds || []);
  const targetBranch = cleanText(branchId);

  return admins
    .filter((admin) => {
      if (isGlobalAdmin(admin)) return true;
      const candidateBranches = adminBranchIds(admin);
      if (targetBranch) return candidateBranches.includes(targetBranch);
      if (access.mode === 'all') return true;
      return candidateBranches.some((id) => allowedBranches.has(id));
    })
    .map(serializeCrmAdmin);
}

async function resolveAssignableCrmAdmin(
  req,
  value,
  { branchId = '', allowUnassigned = true } = {}
) {
  const raw = typeof value === 'object' && value
    ? value.id || value._id
    : value;
  const cleanValue = cleanText(raw);

  if (!cleanValue || cleanValue === 'unassigned') {
    if (allowUnassigned) return null;
    throw createAssignmentError(
      'Debes seleccionar un responsable.',
      'CUSTOMER_CRM_ASSIGNEE_REQUIRED'
    );
  }

  const adminId = asAdminId(cleanValue);
  if (!adminId) {
    throw createAssignmentError(
      'El responsable seleccionado no es válido.',
      'CUSTOMER_CRM_ASSIGNEE_INVALID'
    );
  }

  const candidates = await listAssignableCrmAdmins(req, { branchId });
  if (!candidates.some((candidate) => candidate.id === adminId)) {
    throw createAssignmentError(
      'El responsable no está activo o no pertenece a una sede autorizada.',
      'CUSTOMER_CRM_ASSIGNEE_FORBIDDEN',
      403
    );
  }

  return new mongoose.Types.ObjectId(adminId);
}

module.exports = {
  adminBranchIds,
  asAdminId,
  canServeBranch,
  listAssignableCrmAdmins,
  resolveAssignableCrmAdmin,
  serializeCrmAdmin,
};
