// frontend/src/admin/configuracion/roles/RolesTable.jsx

import {
  Edit3,
  Eye,
  Lock,
  Power,
  ShieldCheck,
  Trash2,
  Unlock,
} from 'lucide-react';

import {
  canDeleteRole,
  canDisableRole,
  canEditRole,
  getRoleScopeLabel,
  getRoleStatusBadge,
  getRoleTypeLabel,
} from './rolesHelpers';

/* ============================================================
 * LISTADO PREMIUM DE PERFILES / ROLES
 * ------------------------------------------------------------
 * Vista moderna basada en tarjetas.
 * Usa variables globales del tema administrativo.
 * ============================================================ */

const THEME = {
  cardBg: 'var(--admin-card-bg, #ffffff)',
  cardText: 'var(--admin-card-text, #111827)',
  mutedText: 'var(--admin-card-muted-text, var(--admin-card-muted, #6b7280))',
  border: 'var(--admin-card-border, var(--admin-border, rgba(148, 163, 184, 0.22)))',
  softBg: 'var(--admin-soft-bg, rgba(255,255,255,0.55))',
  lightPanelBg: 'var(--admin-light-panel-bg, rgba(255,255,255,0.14))',
  lightPanelText: 'var(--admin-light-panel-text, var(--admin-card-text, #111827))',
  lightPanelBorder:
    'var(--admin-light-panel-border, var(--admin-card-border, rgba(148, 163, 184, 0.22)))',
  primaryBg: 'var(--admin-button-bg, var(--admin-primary, #06b6d4))',
  primaryText: 'var(--admin-button-text, #ffffff)',
  inputBg: 'var(--admin-input-bg, rgba(255,255,255,0.08))',
  inputText: 'var(--admin-input-text, var(--admin-card-text, #111827))',
  inputBorder:
    'var(--admin-input-border, var(--admin-card-border, rgba(148, 163, 184, 0.22)))',
};

function resolveStatusInfo(role) {
  const raw = getRoleStatusBadge(role);

  if (typeof raw === 'string') {
    const lower = raw.toLowerCase();
    return {
      label: raw,
      tone: lower.includes('activo') || lower === 'active' ? 'success' : 'danger',
    };
  }

  if (raw && typeof raw === 'object') {
    return {
      label: raw.label || 'Sin estado',
      tone: raw.tone || 'neutral',
    };
  }

  const isActive = role?.active !== false && String(role?.status || '').toLowerCase() !== 'inactive';

  return {
    label: isActive ? 'Activo' : 'Inactivo',
    tone: isActive ? 'success' : 'danger',
  };
}

function EmptyState() {
  return (
    <div
      className="rounded-[2rem] border border-dashed px-6 py-12 text-center"
      style={{
        background: THEME.cardBg,
        borderColor: THEME.border,
        color: THEME.cardText,
      }}
    >
      <div
        className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl"
        style={{
          background: 'rgba(6, 182, 212, 0.12)',
          color: 'var(--admin-primary, #06b6d4)',
        }}
      >
        <ShieldCheck size={26} />
      </div>

      <h3 className="mt-4 text-base font-black">No hay perfiles para mostrar</h3>

      <p
        className="mx-auto mt-2 max-w-md text-sm font-semibold"
        style={{ color: THEME.mutedText }}
      >
        Cuando existan perfiles administrativos o apliques filtros, aparecerán aquí.
      </p>
    </div>
  );
}

function LoadingState() {
  return (
    <div
      className="rounded-[2rem] border px-6 py-12 text-center"
      style={{
        background: THEME.cardBg,
        borderColor: THEME.border,
        color: THEME.cardText,
      }}
    >
      <div
        className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-t-transparent"
        style={{
          borderColor: 'rgba(6, 182, 212, 0.25)',
          borderTopColor: 'transparent',
        }}
      />

      <p className="mt-4 text-sm font-black" style={{ color: THEME.mutedText }}>
        Cargando perfiles administrativos...
      </p>
    </div>
  );
}

function StatusBadge({ role }) {
  const status = resolveStatusInfo(role);
  const isSuccess = status.tone === 'success';

  return (
    <span
      className="inline-flex items-center justify-center rounded-full px-3 py-1 text-xs font-black"
      style={{
        background: isSuccess ? 'var(--admin-success-soft-bg)' : 'var(--admin-danger-soft-bg)',
        color: isSuccess ? 'var(--admin-success-text)' : 'var(--admin-danger-text)',
        border: isSuccess
          ? '1px solid var(--admin-success-border)'
          : '1px solid var(--admin-danger-border)',
      }}
    >
      {status.label}
    </span>
  );
}

function TypeBadge({ role }) {
  const isSystem = role?.isSystem === true;

  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-black"
      style={{
        background: isSystem ? 'rgba(212, 175, 55, 0.12)' : 'rgba(6, 182, 212, 0.10)',
        color: THEME.cardText,
        border: isSystem
          ? '1px solid rgba(212, 175, 55, 0.28)'
          : '1px solid rgba(6, 182, 212, 0.20)',
      }}
    >
      {isSystem ? <Lock size={12} /> : <Unlock size={12} />}
      {getRoleTypeLabel(role)}
    </span>
  );
}

function ActionButton({
  title,
  label,
  onClick,
  disabled = false,
  variant = 'secondary',
  children,
}) {
  let style = {
    background: THEME.lightPanelBg,
    color: THEME.lightPanelText,
    borderColor: THEME.lightPanelBorder,
  };

  if (variant === 'primary') {
    style = {
      background: THEME.primaryBg,
      color: THEME.primaryText,
      borderColor: THEME.primaryBg,
    };
  }

  if (variant === 'danger') {
    style = {
      background: 'var(--admin-danger-soft-bg)',
      color: 'var(--admin-danger-text)',
      borderColor: 'var(--admin-danger-border)',
    };
  }

  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-black transition hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-45"
      style={style}
    >
      {children}
      <span>{label}</span>
    </button>
  );
}

function RoleCard({
  role,
  currentAdminRole,
  canEdit,
  canDisable,
  canManageTarget,
  canViewUsers,
  onViewPermissions,
  onViewUsers,
  onEdit,
  onToggleStatus,
  onDelete,
}) {
  const permissionsCount = Array.isArray(role?.permissions) ? role.permissions.length : 0;
  const isActive = role?.active !== false && role?.status !== 'inactive';
  const usersCount = Number(role?.usersCount || 0);
  const manageable = canManageTarget?.(role) === true;
  const editable = canEdit && manageable && canEditRole(role, currentAdminRole);
  const disableable = canDisable && manageable && canDisableRole(role, currentAdminRole) && (!isActive || usersCount === 0);
  const deletable = canDisable && manageable && canDeleteRole(role, currentAdminRole) && usersCount === 0;

  return (
    <article
      className="rounded-2xl border px-4 py-3 shadow-sm"
      style={{ background: THEME.cardBg, borderColor: THEME.border, color: THEME.cardText }}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
            style={{ background: 'rgba(6, 182, 212, 0.10)', color: 'var(--admin-primary, #06b6d4)' }}
          >
            <ShieldCheck size={19} />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-black">{role?.name || 'Sin nombre'}</h3>
              <StatusBadge role={role} />
              <TypeBadge role={role} />
              {role?.isDefault && (
                <span className="rounded-full border px-2 py-1 text-[10px] font-black" style={{ borderColor: 'rgba(212, 175, 55, 0.45)' }}>
                  Predeterminado
                </span>
              )}
            </div>
            <p className="mt-1 break-all text-xs font-semibold" style={{ color: THEME.mutedText }}>
              {role?.code || 'sin-codigo'}
              {role?.description ? ` · ${role.description}` : ''}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => onViewUsers?.(role)}
          disabled={!canViewUsers || usersCount === 0}
          className="rounded-xl border px-3 py-2 text-left text-xs font-black transition hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
          style={{ borderColor: THEME.border, background: THEME.softBg }}
          aria-label={`Ver ${usersCount} usuarios de ${role?.name || 'este perfil'}`}
          title={!canViewUsers ? 'No tienes acceso al listado de usuarios' : usersCount === 0 ? 'Aún no tiene usuarios' : 'Abrir usuarios de este perfil'}
        >
          {usersCount} {usersCount === 1 ? 'usuario' : 'usuarios'} →
        </button>
      </div>
      <div
        className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t pt-3"
        style={{ borderColor: THEME.border }}
      >
        <div className="flex flex-wrap items-center gap-2 text-xs font-bold" style={{ color: THEME.mutedText }}>
          <span>Alcance: {getRoleScopeLabel(role?.scope)}</span>
          <span aria-hidden="true">·</span>
          <span>Nivel {role?.level ?? 50}</span>
          <span aria-hidden="true">·</span>
          <span>{permissionsCount} permisos</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <ActionButton title="Ver permisos" label="Permisos" onClick={() => onViewPermissions?.(role)}>
            <Eye size={14} />
          </ActionButton>
          <ActionButton title="Editar perfil" label="Editar" variant="primary" disabled={!editable} onClick={() => onEdit?.(role)}>
            <Edit3 size={14} />
          </ActionButton>
          <ActionButton
            title={isActive && usersCount ? `Tiene ${usersCount} usuarios asignados` : isActive ? 'Desactivar perfil' : 'Activar perfil'}
            label={isActive ? 'Desactivar' : 'Activar'}
            disabled={!disableable}
            onClick={() => onToggleStatus?.(role)}
          >
            <Power size={14} />
          </ActionButton>
          <ActionButton
            title={usersCount ? `Tiene ${usersCount} usuarios asignados` : 'Eliminar perfil'}
            label="Eliminar"
            variant="danger"
            disabled={!deletable}
            onClick={() => onDelete?.(role)}
          >
            <Trash2 size={14} />
          </ActionButton>
        </div>
      </div>
    </article>
  );
}

export default function RolesTable({
  roles = [],
  loading = false,
  currentAdminRole = '',
  canEdit = false,
  canDisable = false,
  canManageTarget,
  canViewUsers = false,
  onViewPermissions,
  onViewUsers,
  onEdit,
  onToggleStatus,
  onDelete,
}) {
  if (loading) {
    return <LoadingState />;
  }

  if (!Array.isArray(roles) || roles.length === 0) {
    return <EmptyState />;
  }

  return (
    <div className="grid gap-2">
      {roles.map((role) => (
        <RoleCard
          key={role?._id || role?.id || role?.code}
          role={role}
          currentAdminRole={currentAdminRole}
          canEdit={canEdit}
          canDisable={canDisable}
          canManageTarget={canManageTarget}
          canViewUsers={canViewUsers}
          onViewPermissions={onViewPermissions}
          onViewUsers={onViewUsers}
          onEdit={onEdit}
          onToggleStatus={onToggleStatus}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}
