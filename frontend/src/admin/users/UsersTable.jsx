// frontend/src/admin/users/UsersTable.jsx

import { useEffect, useRef, useState } from 'react';
import {
  Building2,
  KeyRound,
  Mail,
  MoreHorizontal,
  Pencil,
  Power,
  ShieldCheck,
  Trash2,
  UserRound,
} from 'lucide-react';

import {
  formatRole,
  formatStatus,
  getBranchName,
} from './adminUsersHelpers';

function getUserDisplayName(user) {
  return (
    user.displayName ||
    `${user.firstName || ''} ${user.lastName || ''}`.trim() ||
    user.username ||
    'Usuario'
  );
}

function getUserInitials(user) {
  const name = getUserDisplayName(user);
  const parts = name.split(' ').filter(Boolean);

  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }

  return name.slice(0, 2).toUpperCase();
}

function getPrimaryBranchLabel(user, branches) {
  if (!Array.isArray(user.branches) || user.branches.length === 0) {
    return 'Sin sede';
  }

  const defaultBranch =
    user.branches.find((item) => item.isDefault) || user.branches[0];

  return getBranchName(defaultBranch, branches);
}

function getRoleScopeLabel(scope) {
  const labels = {
    global: 'Global',
    branch: 'Por sede',
    branches: 'Por sedes',
    warehouse: 'Bodega',
    own: 'Propio',
    custom: 'Personalizado',
  };

  return labels[scope] || scope || 'Sin alcance';
}

function getUserRoleDetails(user, roles) {
  const userRoleCode = String(user.role || '').toLowerCase();

  const roleFromRef =
    user.roleRef && typeof user.roleRef === 'object' ? user.roleRef : null;

  const roleFromList =
    roles.find(
      (role) => String(role.code || '').toLowerCase() === userRoleCode
    ) || null;

  const roleSource = roleFromRef || roleFromList || null;

  const permissions = Array.isArray(roleSource?.permissions)
    ? roleSource.permissions
    : Array.isArray(roleFromList?.permissions)
      ? roleFromList.permissions
      : [];

  return {
    name: roleSource?.name || formatRole(user.role, roles),
    code: roleSource?.code || user.role || 'sin-rol',
    level:
      roleSource?.level !== undefined && roleSource?.level !== null
        ? roleSource.level
        : roleFromList?.level,
    scope: roleSource?.scope || roleFromList?.scope || '',
    permissionsCount: permissions.length,
  };
}

function getStatusStyle(status) {
  const value = String(status || '').toLowerCase();

  if (value === 'active') {
    return {
      borderColor: 'var(--admin-primary-soft-border)',
      background: 'var(--admin-primary-soft-bg)',
      color: 'var(--admin-primary-soft-text)',
    };
  }

  if (value === 'blocked') {
    return {
      borderColor: 'var(--admin-danger)',
      background: 'var(--admin-danger-soft-bg)',
      color: 'var(--admin-danger-text)',
    };
  }

  if (value === 'pending') {
    return {
      borderColor: 'var(--admin-warning)',
      background: 'var(--admin-warning-soft-bg)',
      color: 'var(--admin-warning-text)',
    };
  }

  return {
    borderColor: 'var(--admin-disabled-border)',
    background: 'var(--admin-disabled-bg)',
    color: 'var(--admin-disabled-text)',
  };
}

function getReadableButtonStyle() {
  return {
    borderColor: 'var(--admin-light-panel-border)',
    background: 'var(--admin-light-panel-bg)',
    color: 'var(--admin-light-panel-text)',
    boxShadow: 'var(--admin-glass-shadow)',
  };
}

function getPrimaryButtonStyle() {
  return {
    borderColor: 'var(--admin-button-bg)',
    background: 'var(--admin-button-bg)',
    color: 'var(--admin-button-text)',
    boxShadow: 'var(--admin-glass-shadow-hover)',
  };
}

function getInfoBoxStyle() {
  return {
    borderColor: 'var(--admin-glass-border)',
    background: 'var(--admin-glass-soft-bg)',
    color: 'var(--admin-card-text)',
  };
}

function getToggleActionStyle(isActive) {
  if (isActive) {
    return {
      borderColor: 'var(--admin-warning)',
      background: 'var(--admin-warning)',
      color: 'var(--admin-warning-text-on-bg)',
    };
  }

  return {
    borderColor: 'var(--admin-button-bg)',
    background: 'var(--admin-button-bg)',
    color: 'var(--admin-button-text)',
  };
}

function getDeleteActionStyle() {
  return {
    borderColor: 'var(--admin-danger)',
    background: 'var(--admin-danger)',
    color: 'var(--admin-danger-text-on-bg)',
  };
}

export default function UsersTable({
  users,
  roles,
  branches,
  statusSavingId,
  deleteSavingId,
  onEditUser,
  onChangePassword,
  onToggleStatus,
  onDeleteUser,
}) {
  const [openActionsId, setOpenActionsId] = useState('');
  const actionsRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!actionsRef.current) return;

      if (!actionsRef.current.contains(event.target)) {
        setOpenActionsId('');
      }
    };

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setOpenActionsId('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  const toggleActions = (userId) => {
    setOpenActionsId((current) => (current === userId ? '' : userId));
  };

  const closeActions = () => {
    setOpenActionsId('');
  };

  return (
    <div className="relative z-0 mt-6 grid gap-3">
      {users.map((user) => {
        const displayName = getUserDisplayName(user);
        const initials = getUserInitials(user);
        const isActive = String(user.status || '').toLowerCase() === 'active';
        const isSavingStatus = statusSavingId === user._id;
        const isDeleting = deleteSavingId === user._id;
        const isOwnerUser = user.username === 'owner' || user.role === 'owner';
        const isActionsOpen = openActionsId === user._id;
        const primaryBranch = getPrimaryBranchLabel(user, branches);
        const roleDetails = getUserRoleDetails(user, roles);
        const roleLevelText =
          roleDetails.level !== undefined && roleDetails.level !== null
            ? `Nivel ${roleDetails.level}`
            : 'Sin nivel';

        return (
          <article
            key={user._id}
            className={`relative overflow-visible rounded-[26px] border px-4 py-4 transition hover:-translate-y-0.5 md:px-5 ${
              isActionsOpen ? 'z-[90]' : 'z-0'
            }`}
            style={{
              borderColor: isActionsOpen
                ? 'var(--admin-primary-soft-border)'
                : 'var(--admin-glass-border)',
              background: isActionsOpen
                ? 'var(--admin-glass-strong-bg)'
                : 'var(--admin-glass-bg)',
              boxShadow: isActionsOpen
                ? 'var(--admin-glass-shadow-hover)'
                : 'var(--admin-glass-shadow)',
              color: 'var(--admin-card-text)',
            }}
          >
            <div className="grid gap-4 xl:grid-cols-[minmax(230px,1fr)_minmax(430px,1.45fr)_96px] xl:items-center">
              <div className="flex min-w-0 items-center gap-4">
                <div
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border text-sm font-black"
                  style={{
                    borderColor: 'var(--admin-primary-soft-border)',
                    background: 'var(--admin-primary-soft-bg)',
                    color: 'var(--admin-primary-soft-text)',
                    boxShadow: 'var(--admin-glass-shadow)',
                  }}
                >
                  {initials || <UserRound className="h-5 w-5" />}
                </div>

                <div className="min-w-0 flex-1">
                  <h3
                    className="break-words text-sm font-black leading-5"
                    style={{ color: 'var(--admin-card-text)' }}
                  >
                    {displayName}
                  </h3>

                  <p
                    className="mt-0.5 break-words text-xs font-bold"
                    style={{ color: 'var(--admin-card-muted-text)' }}
                  >
                    @{user.username}
                  </p>

                  <div
                    className="mt-2 flex min-w-0 items-center gap-2 text-xs"
                    style={{ color: 'var(--admin-card-muted-text)' }}
                  >
                    <Mail className="h-3.5 w-3.5 shrink-0" />

                    <span className="break-all">
                      {user.email || 'Sin correo'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid min-w-0 gap-3 md:grid-cols-[minmax(270px,1.45fr)_minmax(160px,0.75fr)]">
                <div
                  className="flex min-w-0 items-start gap-2 rounded-2xl border px-3 py-2.5"
                  style={getInfoBoxStyle()}
                >
                  <ShieldCheck
                    className="mt-0.5 h-4 w-4 shrink-0"
                    style={{ color: 'var(--admin-primary)' }}
                  />

                  <div className="min-w-0">
                    <p
                      className="text-[10px] font-black uppercase tracking-[0.16em]"
                      style={{ color: 'var(--admin-card-muted-text)' }}
                    >
                      Perfil
                    </p>

                    <p
                      className="break-words text-xs font-black leading-4"
                      style={{ color: 'var(--admin-card-text)' }}
                    >
                      {roleDetails.name}
                    </p>

                    <div
                      className="mt-1 flex flex-wrap gap-x-2 gap-y-1 text-[11px] font-bold leading-4"
                      style={{ color: 'var(--admin-card-muted-text)' }}
                    >
                      <span>{roleDetails.code}</span>
                      <span>·</span>
                      <span>{roleLevelText}</span>
                      <span>·</span>
                      <span>{getRoleScopeLabel(roleDetails.scope)}</span>
                    </div>

                    <p
                      className="mt-1 text-[11px] font-bold leading-4"
                      style={{ color: 'var(--admin-card-muted-text)' }}
                    >
                      {roleDetails.permissionsCount} permisos asignados
                    </p>
                  </div>
                </div>

                <div
                  className="flex min-w-0 items-center gap-2 rounded-2xl border px-3 py-2.5"
                  style={getInfoBoxStyle()}
                >
                  <Building2
                    className="h-4 w-4 shrink-0"
                    style={{ color: 'var(--admin-primary)' }}
                  />

                  <div className="min-w-0">
                    <p
                      className="text-[10px] font-black uppercase tracking-[0.16em]"
                      style={{ color: 'var(--admin-card-muted-text)' }}
                    >
                      Sede
                    </p>

                    <p
                      className="break-words text-xs font-black leading-4"
                      style={{ color: 'var(--admin-card-text)' }}
                    >
                      {primaryBranch}
                    </p>
                  </div>
                </div>
              </div>

              <div className="relative flex w-full flex-col items-stretch gap-2">
                <span
                  className="inline-flex w-full justify-center rounded-full border px-3 py-1 text-xs font-black"
                  style={getStatusStyle(user.status)}
                >
                  {formatStatus(user.status)}
                </span>

                <button
                  type="button"
                  onClick={() => {
                    closeActions();
                    onEditUser(user);
                  }}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border px-3 py-2 text-xs font-black transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
                  style={getReadableButtonStyle()}
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Editar
                </button>

                <div
                  ref={isActionsOpen ? actionsRef : null}
                  className="relative z-[100] w-full"
                >
                  <button
                    type="button"
                    onClick={() => toggleActions(user._id)}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border px-3 py-2 text-xs font-black transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
                    style={
                      isActionsOpen
                        ? getPrimaryButtonStyle()
                        : getReadableButtonStyle()
                    }
                  >
                    <MoreHorizontal className="h-4 w-4" />
                    Más
                  </button>

                  {isActionsOpen && (
                    <div
                      className="absolute right-0 top-[calc(100%+10px)] z-[999] w-64 overflow-hidden rounded-3xl border p-2 text-left"
                      style={{
                        borderColor: 'var(--admin-glass-border)',
                        background: 'var(--admin-light-panel-bg)',
                        color: 'var(--admin-light-panel-text)',
                        boxShadow: 'var(--admin-glass-shadow-hover)',
                        backdropFilter: 'blur(var(--admin-glass-blur))',
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          closeActions();
                          onChangePassword(user);
                        }}
                        className="flex w-full items-center gap-3 rounded-2xl border px-3 py-2.5 text-left text-xs font-black transition hover:opacity-90"
                        style={{
                          borderColor: 'var(--admin-light-panel-border)',
                          background: 'var(--admin-light-panel-soft-bg)',
                          color: 'var(--admin-light-panel-text)',
                        }}
                      >
                        <KeyRound
                          className="h-4 w-4"
                          style={{ color: 'var(--admin-primary)' }}
                        />
                        Cambiar contraseña
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          closeActions();
                          onToggleStatus(user);
                        }}
                        disabled={isSavingStatus}
                        className="mt-1 flex w-full items-center gap-3 rounded-2xl border px-3 py-2.5 text-left text-xs font-black transition disabled:cursor-not-allowed disabled:opacity-60"
                        style={getToggleActionStyle(isActive)}
                      >
                        <Power className="h-4 w-4" />
                        {isSavingStatus
                          ? 'Guardando...'
                          : isActive
                            ? 'Desactivar usuario'
                            : 'Activar usuario'}
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          closeActions();
                          onDeleteUser(user);
                        }}
                        disabled={isDeleting || isOwnerUser}
                        title={
                          isOwnerUser
                            ? 'El propietario principal no se puede eliminar'
                            : 'Eliminar usuario'
                        }
                        className="mt-1 flex w-full items-center gap-3 rounded-2xl border px-3 py-2.5 text-left text-xs font-black transition disabled:cursor-not-allowed disabled:opacity-50"
                        style={getDeleteActionStyle()}
                      >
                        <Trash2 className="h-4 w-4" />
                        {isDeleting ? 'Eliminando...' : 'Eliminar usuario'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}