// frontend/src/admin/users/adminUsersHelpers.js

import { getAdminPasswordPolicyError } from '../security/adminPasswordPolicy';

export const EMPTY_FORM = {
  firstName: '',
  lastName: '',
  username: '',
  email: '',
  phone: '',
  documentType: 'CC',
  documentNumber: '',
  password: '',
  role: 'cashier',
  branchId: '',
  assignedBranches: [],
  status: 'active',
  mustChangePassword: true,
};

export const EMPTY_PASSWORD_FORM = {
  password: '',
  confirmPassword: '',
  mustChangePassword: true,
};

export function formatRole(roleCode, roles = []) {
  const found = roles.find((role) => role.code === roleCode);
  return found?.name || roleCode || 'Sin rol';
}

export function formatStatus(status) {
  const value = String(status || '').toLowerCase();

  if (value === 'active') return 'Activo';
  if (value === 'inactive') return 'Inactivo';
  if (value === 'blocked') return 'Bloqueado';
  if (value === 'pending') return 'Pendiente';

  return status || 'Sin estado';
}

export function getStatusClasses(status) {
  const value = String(status || '').toLowerCase();

  if (value === 'active') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  }

  if (value === 'blocked') {
    return 'border-red-200 bg-red-50 text-red-700';
  }

  if (value === 'inactive') {
    return 'border-slate-200 bg-slate-100 text-slate-600';
  }

  return 'border-amber-200 bg-amber-50 text-amber-700';
}

export function getBranchName(item, branches = []) {
  const branchValue = item?.branch;
  const branchId =
    typeof branchValue === 'object' && branchValue !== null
      ? branchValue._id
      : branchValue;

  const found = branches.find((branch) => branch._id === branchId);

  return (
    item?.branchName ||
    item?.branchCode ||
    found?.name ||
    found?.code ||
    'Sede'
  );
}

export function getDefaultBranchId(branches = []) {
  const mainBranch =
    branches.find((branch) => branch.isMain) ||
    branches.find((branch) => branch.isDefaultForOnlineOrders) ||
    branches[0];

  return mainBranch?._id || '';
}

export function getUserBranchId(user, branches = []) {
  const defaultBranch =
    typeof user?.defaultBranch === 'object' && user?.defaultBranch !== null
      ? user.defaultBranch._id
      : user?.defaultBranch;

  if (defaultBranch) return defaultBranch;

  const defaultAssignedBranch =
    Array.isArray(user?.branches) && user.branches.length > 0
      ? user.branches.find((item) => item.isDefault) || user.branches[0]
      : null;

  const branchValue = defaultAssignedBranch?.branch;

  if (typeof branchValue === 'object' && branchValue !== null) {
    return branchValue._id || getDefaultBranchId(branches);
  }

  return branchValue || getDefaultBranchId(branches);
}

const branchIdOf = (item) => String(item?.branch?._id || item?.branch || item?._id || '');

export function getUserAssignedBranches(user, branches = []) {
  const assigned = (user?.branches || []).map((item) => ({
    branch: branchIdOf(item),
    canSell: item.canSell !== false,
    canManageInventory: item.canManageInventory === true,
    canInvoice: item.canInvoice === true,
  })).filter((item) => item.branch);
  if (assigned.length) return assigned;
  const id = getUserBranchId(user, branches);
  return id ? [{ branch: String(id), canSell: true, canManageInventory: false, canInvoice: false }] : [];
}

export function roleCanManageInventory(role) {
  return ['owner', 'admin', 'manager', 'warehouse'].includes(role);
}

export function roleCanInvoice(role) {
  return ['owner', 'admin', 'manager', 'billing'].includes(role);
}

export function getNewBranchAssignment(branchId, role, actorBranches = [], globalAccess = false) {
  const actorAccess = actorBranches.find((item) =>
    String(item.branch?._id || item.branch) === String(branchId));
  return {
    branch: branchId,
    canSell: globalAccess || actorAccess?.canSell === true,
    canManageInventory: roleCanManageInventory(role) &&
      (globalAccess || actorAccess?.canManageInventory === true),
    canInvoice: roleCanInvoice(role) &&
      (globalAccess || actorAccess?.canInvoice === true),
  };
}

export function buildFormFromUser(user, branches = [], roles = []) {
  return {
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    username: user?.username || '',
    email: user?.email || '',
    phone: user?.phone || '',
    documentType: user?.documentType || 'CC',
    documentNumber: user?.documentNumber || '',
    password: '',
    role:
      user?.role ||
      roles.find((role) => role.code === 'cashier')?.code ||
      roles[0]?.code ||
      'cashier',
    branchId: getUserBranchId(user, branches),
    assignedBranches: getUserAssignedBranches(user, branches),
    status: user?.status || 'active',
    mustChangePassword: user?.mustChangePassword === true,
  };
}

export function validateUserForm(form, modalMode) {
  if (!form.username.trim()) {
    return 'El usuario es obligatorio.';
  }

  if (modalMode === 'create' && !form.password.trim()) {
    return 'La contraseña temporal es obligatoria.';
  }

  if (modalMode === 'create') {
    const passwordPolicyError = getAdminPasswordPolicyError(form.password);

    if (passwordPolicyError) return passwordPolicyError;
  }

  if (!form.role) {
    return 'Debes seleccionar un rol.';
  }

  if (!form.assignedBranches?.length || !form.branchId ||
      !form.assignedBranches.some((item) => item.branch === form.branchId)) {
    return 'Selecciona al menos una sede y marca cuál será la principal.';
  }

  return '';
}

export function validatePasswordForm(form) {
  if (!form.password.trim()) {
    return 'La contraseña temporal es obligatoria.';
  }

  const passwordPolicyError = getAdminPasswordPolicyError(form.password);

  if (passwordPolicyError) return passwordPolicyError;

  if (!form.confirmPassword.trim()) {
    return 'Debes confirmar la contraseña temporal.';
  }

  if (form.password !== form.confirmPassword) {
    return 'Las contraseñas no coinciden.';
  }

  return '';
}

export function buildUserPayload(form) {
  return {
    firstName: form.firstName.trim(),
    lastName: form.lastName.trim(),
    username: form.username.trim(),
    email: form.email.trim(),
    phone: form.phone.trim(),
    documentType: form.documentType,
    documentNumber: form.documentNumber.trim(),
    role: form.role,
    status: form.status,
    active: form.status === 'active',
    mustChangePassword: form.mustChangePassword,
    defaultBranch: form.branchId,
    branches: form.assignedBranches.map((item) => ({
      branch: item.branch,
      isDefault: item.branch === form.branchId,
      canSell: item.canSell !== false,
      canManageInventory: item.canManageInventory === true,
      canInvoice: item.canInvoice === true,
    })),
  };
}

export function buildUserEditPayload(form, originalUser, branches = [], roles = []) {
  const payload = buildUserPayload(form);
  const original = buildFormFromUser(originalUser, branches, roles);

  for (const field of [
    'firstName', 'lastName', 'username', 'email', 'phone',
    'documentType', 'documentNumber', 'role', 'status', 'mustChangePassword',
  ]) {
    if (String(form[field]).trim() === String(original[field]).trim()) {
      delete payload[field];
    }
  }

  if (!Object.hasOwn(payload, 'status')) delete payload.active;
  const branchSettings = (assigned) => [...assigned]
    .sort((a, b) => a.branch.localeCompare(b.branch));
  if (form.branchId === original.branchId &&
      JSON.stringify(branchSettings(form.assignedBranches)) ===
      JSON.stringify(branchSettings(original.assignedBranches))) {
    delete payload.defaultBranch;
    delete payload.branches;
  }

  return payload;
}

export function buildPasswordPayload(form) {
  return {
    password: form.password,
    newPassword: form.password,
    mustChangePassword: form.mustChangePassword,
  };
}
