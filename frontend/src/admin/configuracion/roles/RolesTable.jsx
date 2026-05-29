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
        background: isSuccess ? 'rgba(34, 197, 94, 0.12)' : 'rgba(244, 63, 94, 0.12)',
        color: isSuccess ? '#15803d' : '#be123c',
        border: isSuccess
          ? '1px solid rgba(34, 197, 94, 0.24)'
          : '1px solid rgba(244, 63, 94, 0.24)',
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

function InfoChip({ label, value }) {
  return (
    <div
      className="rounded-2xl border px-4 py-3"
      style={{
        background: THEME.softBg,
        borderColor: THEME.border,
      }}
    >
      <p
        className="text-[10px] font-black uppercase tracking-[0.18em]"
        style={{ color: THEME.mutedText }}
      >
        {label}
      </p>

      <p className="mt-1 text-sm font-black" style={{ color: THEME.cardText }}>
        {value}
      </p>
    </div>
  );
}

function PermissionMeter({ count = 0, max = 1 }) {
  const width = Math.max(10, Math.min(100, Math.round((count / max) * 100)));

  return (
    <div
      className="rounded-[1.5rem] border p-4"
      style={{
        background: THEME.softBg,
        borderColor: THEME.border,
      }}
    >
      <div className="flex items-center justify-between gap-3">
        <p
          className="text-[10px] font-black uppercase tracking-[0.2em]"
          style={{ color: THEME.mutedText }}
        >
          Potencia del perfil
        </p>

        <p className="text-xs font-black" style={{ color: THEME.cardText }}>
          {count} permisos
        </p>
      </div>

      <div
        className="mt-3 h-2 overflow-hidden rounded-full"
        style={{ background: 'rgba(148, 163, 184, 0.18)' }}
      >
        <div
          className="h-full rounded-full"
          style={{
            width: `${width}%`,
            background:
              'linear-gradient(90deg, var(--admin-primary, #06b6d4), rgba(212, 175, 55, 0.95))',
          }}
        />
      </div>
    </div>
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
      background: 'rgba(244, 63, 94, 0.10)',
      color: '#be123c',
      borderColor: 'rgba(244, 63, 94, 0.24)',
    };
  }

  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center justify-center gap-2 rounded-2xl border px-4 py-2.5 text-sm font-black transition hover:-translate-y-[1px] disabled:cursor-not-allowed disabled:opacity-45"
      style={style}
    >
      {children}
      <span>{label}</span>
    </button>
  );
}

function RoleCard({
  role,
  maxPermissions,
  currentAdminRole,
  onViewPermissions,
  onEdit,
  onToggleStatus,
  onDelete,
}) {
  const permissionsCount = Array.isArray(role?.permissions) ? role.permissions.length : 0;
  const isActive = role?.active !== false && String(role?.status || '').toLowerCase() !== 'inactive';

  const editable = canEditRole(role, currentAdminRole);
  const disableable = canDisableRole(role, currentAdminRole);
  const deletable = canDeleteRole(role, currentAdminRole);

  return (
    <article
      className="overflow-hidden rounded-[2rem] border shadow-sm transition hover:-translate-y-[1px] hover:shadow-md"
      style={{
        background: THEME.cardBg,
        borderColor: THEME.border,
      }}
    >
      <div
        className="h-[4px]"
        style={{
          background: role?.isDefault
            ? 'linear-gradient(90deg, rgba(212,175,55,0.95), var(--admin-primary, #06b6d4))'
            : 'linear-gradient(90deg, var(--admin-primary, #06b6d4), rgba(212,175,55,0.65))',
        }}
      />

      <div className="p-5">
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0">
            <div className="flex items-start gap-4">
              <div
                className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl"
                style={{
                  background: 'rgba(6, 182, 212, 0.10)',
                  color: 'var(--admin-primary, #06b6d4)',
                }}
              >
                <ShieldCheck size={24} />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3
                    className="text-xl font-black leading-tight"
                    style={{ color: THEME.cardText }}
                  >
                    {role?.name || 'Sin nombre'}
                  </h3>

                  {role?.isDefault ? (
                    <span
                      className="rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em]"
                      style={{
                        background: 'rgba(212, 175, 55, 0.12)',
                        color: THEME.cardText,
                        border: '1px solid rgba(212, 175, 55, 0.28)',
                      }}
                    >
                      Predeterminado
                    </span>
                  ) : null}
                </div>

                <p
                  className="mt-1 text-sm font-bold"
                  style={{ color: THEME.mutedText }}
                >
                  Código interno: {role?.code || 'sin-codigo'}
                </p>

                {role?.description ? (
                  <p
                    className="mt-3 max-w-3xl text-sm font-semibold leading-7"
                    style={{ color: THEME.mutedText }}
                  >
                    {role.description}
                  </p>
                ) : null}

                <div className="mt-4 flex flex-wrap gap-2">
                  <TypeBadge role={role} />
                  <StatusBadge role={role} />
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <PermissionMeter count={permissionsCount} max={maxPermissions} />

            <div className="grid grid-cols-3 gap-3">
              <InfoChip label="Alcance" value={getRoleScopeLabel(role?.scope)} />
              <InfoChip label="Nivel" value={role?.level ?? 50} />
              <InfoChip label="Permisos" value={permissionsCount} />
            </div>
          </div>
        </div>

        <div
          className="mt-5 flex flex-wrap gap-3 border-t pt-4"
          style={{ borderColor: THEME.border }}
        >
          <ActionButton
            title="Ver permisos"
            label="Ver permisos"
            onClick={() => onViewPermissions?.(role)}
          >
            <Eye size={16} />
          </ActionButton>

          <ActionButton
            title="Editar perfil"
            label="Editar"
            variant="primary"
            disabled={!editable}
            onClick={() => onEdit?.(role)}
          >
            <Edit3 size={16} />
          </ActionButton>

          <ActionButton
            title={isActive ? 'Desactivar perfil' : 'Activar perfil'}
            label={isActive ? 'Desactivar' : 'Activar'}
            disabled={!disableable}
            onClick={() => onToggleStatus?.(role)}
          >
            <Power size={16} />
          </ActionButton>

          <ActionButton
            title="Eliminar perfil"
            label="Eliminar"
            variant="danger"
            disabled={!deletable}
            onClick={() => onDelete?.(role)}
          >
            <Trash2 size={16} />
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
  onViewPermissions,
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

  const maxPermissions = Math.max(
    1,
    ...roles.map((role) =>
      Array.isArray(role?.permissions) ? role.permissions.length : 0
    )
  );

  return (
    <div className="grid gap-5">
      {roles.map((role) => (
        <RoleCard
          key={role?._id || role?.id || role?.code}
          role={role}
          maxPermissions={maxPermissions}
          currentAdminRole={currentAdminRole}
          onViewPermissions={onViewPermissions}
          onEdit={onEdit}
          onToggleStatus={onToggleStatus}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}