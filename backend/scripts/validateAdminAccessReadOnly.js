'use strict';

const mongoose = require('mongoose');
const roleDefaultIndex = require('../models/adminRoleDefaultIndex');
const branchSelectionIndexes = require('../models/branchSelectionIndexes');

const id = (value) => value == null ? '' : String(value);
const available = (document) => Boolean(document && document.active === true && document.status === 'active');
const messages = {
  default_role_invalid: 'Debe existir un único perfil predeterminado activo.',
  main_branch_invalid: 'Debe existir una única sede principal activa.',
  online_branch_invalid: 'Debe existir una única sede predeterminada para pedidos web activa.',
  required_index_missing: 'Falta un índice que protege la selección única de perfil o sede.',
  active_owner_missing: 'Debe existir al menos un propietario activo con un perfil owner disponible.',
  active_user_role_unavailable: 'Hay usuarios activos con perfil inexistente o inactivo.',
  inactive_user_role_unavailable: 'Hay usuarios inactivos con perfil inexistente o inactivo.',
  active_user_role_mismatch: 'El código del perfil difiere del perfil asignado en usuarios activos.',
  inactive_user_role_mismatch: 'El código del perfil difiere del perfil asignado en usuarios inactivos.',
  legacy_user_without_role_ref: 'Hay usuarios heredados vinculados al perfil únicamente por código.',
  active_user_without_branch: 'Hay usuarios activos sin sede asignada.',
  inactive_user_without_branch: 'Hay usuarios inactivos sin sede asignada.',
  duplicate_user_branch: 'Una sede está asignada más de una vez al mismo usuario.',
  user_default_branch_mismatch: 'La sede predeterminada del usuario no coincide con su asignación.',
  active_user_branch_unavailable: 'Hay usuarios activos asignados a sedes inexistentes o inactivas.',
  inactive_user_branch_unavailable: 'Hay usuarios inactivos asignados a sedes inexistentes o inactivas.',
};

function indexMatches(actual, expected) {
  return Boolean(actual?.unique &&
    JSON.stringify(actual.key) === JSON.stringify(expected.key) &&
    JSON.stringify(actual.partialFilterExpression) ===
      JSON.stringify(expected.options.partialFilterExpression));
}

function evaluate({ users, roles, branches, roleIndexes, branchIndexes }) {
  const issues = new Map();
  const add = (code, scope, value) => {
    if (!issues.has(code)) issues.set(code, { code, message: messages[code], count: 0, samples: [] });
    const entry = issues.get(code);
    entry.count += 1;
    if (entry.samples.length < 5) entry.samples.push(`${scope}:${id(value)}`);
  };

  const roleById = new Map(roles.map((role) => [id(role._id), role]));
  const roleByCode = new Map(roles.map((role) => [role.code, role]));
  const branchById = new Map(branches.map((branch) => [id(branch._id), branch]));
  const selectedRole = roles.filter((role) => role.isDefault === true);
  const selectedMain = branches.filter((branch) => branch.isMain === true);
  const selectedOnline = branches.filter((branch) => branch.isDefaultForOnlineOrders === true);
  if (!users.some((user) => {
    const role = user.roleRef ? roleById.get(id(user.roleRef)) : roleByCode.get('owner');
    return available(user) && user.role === 'owner' && available(role) && role.code === 'owner';
  })) {
    add('active_owner_missing', 'users', 'none');
  }

  for (const [code, selected] of [
    ['default_role', selectedRole], ['main_branch', selectedMain], ['online_branch', selectedOnline],
  ]) {
    if (selected.length !== 1 || !available(selected[0])) {
      add(`${code}_invalid`, 'selection', selected.map((item) => id(item._id)).join(',') || 'none');
    }
  }

  for (const [collection, indexes, expected] of [
    ['roles', roleIndexes, roleDefaultIndex],
    ...branchSelectionIndexes.map((item) => ['branches', branchIndexes, item]),
  ]) {
    if (!indexMatches(indexes.find((index) => index.name === expected.options.name), expected)) {
      add('required_index_missing', collection, expected.options.name);
    }
  }

  for (const user of users) {
    const userId = id(user._id);
    const active = available(user);
    const role = user.roleRef ? roleById.get(id(user.roleRef)) : roleByCode.get(user.role);
    if (!role || !available(role)) {
      add(active ? 'active_user_role_unavailable' : 'inactive_user_role_unavailable', 'user', userId);
    } else if (user.role !== role.code) {
      add(active ? 'active_user_role_mismatch' : 'inactive_user_role_mismatch', 'user', userId);
    }
    if (!user.roleRef && role && available(role)) {
      add('legacy_user_without_role_ref', 'user', userId);
    }

    const assigned = Array.isArray(user.branches) ? user.branches : [];
    const assignedIds = assigned.map((item) => id(item.branch));
    if (!assigned.length) {
      add(active ? 'active_user_without_branch' : 'inactive_user_without_branch', 'user', userId);
    }
    if (new Set(assignedIds).size !== assignedIds.length) {
      add('duplicate_user_branch', 'user', userId);
    }
    const defaults = assigned.filter((item) => item.isDefault === true);
    if (assigned.length && (defaults.length !== 1 || id(defaults[0]?.branch) !== id(user.defaultBranch))) {
      add('user_default_branch_mismatch', 'user', userId);
    }
    for (const branchId of new Set(assignedIds)) {
      if (!available(branchById.get(branchId))) {
        add(active ? 'active_user_branch_unavailable' : 'inactive_user_branch_unavailable', 'user', userId);
      }
    }
  }

  const warnings = new Set([
    'legacy_user_without_role_ref', 'inactive_user_role_unavailable',
    'inactive_user_role_mismatch', 'inactive_user_without_branch', 'inactive_user_branch_unavailable',
  ]);
  const findings = [...issues.values()].sort((a, b) => a.code.localeCompare(b.code));
  return {
    mode: 'read-only',
    scope: 'integridad de Usuarios, Perfiles y Sedes; no valida toda la salida a producción',
    counts: {
      users: users.length, activeUsers: users.filter(available).length,
      roles: roles.length, activeRoles: roles.filter(available).length,
      branches: branches.length, activeBranches: branches.filter(available).length,
    },
    selections: {
      defaultRole: selectedRole.map((item) => id(item._id)),
      mainBranch: selectedMain.map((item) => id(item._id)),
      onlineBranch: selectedOnline.map((item) => id(item._id)),
    },
    blockers: findings.filter((item) => !warnings.has(item.code)),
    warnings: findings.filter((item) => warnings.has(item.code)),
    relationshipsReady: !findings.some((item) => !warnings.has(item.code)),
  };
}

async function readCollection(db, name, projection) {
  if (!await db.listCollections({ name }, { nameOnly: true }).hasNext()) return [];
  return db.collection(name).find({ deletedAt: null }, { projection }).toArray();
}

async function readIndexes(db, name) {
  if (!await db.listCollections({ name }, { nameOnly: true }).hasNext()) return [];
  return db.collection(name).listIndexes().toArray();
}

async function inspect(db) {
  const [users, roles, branches, roleIndexes, branchIndexes] = await Promise.all([
    readCollection(db, 'adminusers', { _id: 1, role: 1, roleRef: 1, branches: 1,
      defaultBranch: 1, active: 1, status: 1 }),
    readCollection(db, 'adminroles', { _id: 1, code: 1, isDefault: 1, active: 1, status: 1 }),
    readCollection(db, 'branches', { _id: 1, isMain: 1, isDefaultForOnlineOrders: 1,
      active: 1, status: 1 }),
    readIndexes(db, 'adminroles'),
    readIndexes(db, 'branches'),
  ]);
  return evaluate({ users, roles, branches, roleIndexes, branchIndexes });
}

async function run(argv = process.argv.slice(2)) {
  if (argv.length) throw new Error('Este comando no acepta argumentos: solo consulta la base configurada.');
  const { env } = require('../config/env');
  if (!env.mongoUri) throw new Error('Configura MONGODB_URI o MONGO_URI en backend/.env.');
  await mongoose.connect(env.mongoUri, { autoIndex: false, serverSelectionTimeoutMS: 10000 });
  try {
    return await inspect(mongoose.connection.db);
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  run().then((result) => {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    if (!result.relationshipsReady) process.exitCode = 1;
  }).catch((error) => { console.error(error.message); process.exitCode = 1; });
}

module.exports = { evaluate, inspect, run };
