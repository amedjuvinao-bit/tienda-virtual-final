// frontend/src/admin/configuracion/roles/PermissionsSelector.jsx

import { useEffect, useMemo, useState } from 'react';

import {
  getPermissionGroupsArray,
  isPermissionGroupSelected,
  isPermissionSelected,
  normalizePermissions,
  togglePermission,
  togglePermissionGroup,
} from './rolesHelpers';

/* ============================================================
 * SELECTOR VISUAL DE PERMISOS
 * ------------------------------------------------------------
 * Versión compacta:
 * - No muestra todos los permisos hacia abajo.
 * - Muestra módulos como pestañas.
 * - Solo muestra permisos del módulo activo.
 * - Pensado para trabajar dentro del modal sin scroll.
 * ============================================================ */

const THEME = {
  cardBg: 'var(--admin-card-bg, #ffffff)',
  cardText: 'var(--admin-card-text, #111827)',
  mutedText: 'var(--admin-card-muted-text, var(--admin-card-muted, #6b7280))',
  border:
    'var(--admin-card-border, var(--admin-border, rgba(148, 163, 184, 0.22)))',
  softBg: 'var(--admin-soft-bg, rgba(255,255,255,0.55))',
  primaryBg: 'var(--admin-button-bg, var(--admin-primary, #be185d))',
  primaryText: 'var(--admin-button-text, #ffffff)',
  inputBg: 'var(--admin-input-bg, #ffffff)',
  inputText: 'var(--admin-input-text, var(--admin-card-text, #111827))',
  inputBorder:
    'var(--admin-input-border, var(--admin-card-border, rgba(148, 163, 184, 0.22)))',
};

function getGroupSelectedCount(selectedPermissions = [], groupPermissions = []) {
  const selected = normalizePermissions(selectedPermissions);
  const group = normalizePermissions(groupPermissions);

  return group.filter((permission) => selected.includes(permission)).length;
}

export default function PermissionsSelector({
  availablePermissions = [],
  selectedPermissions = [],
  onChange,
  disabled = false,
}) {
  const [activeModule, setActiveModule] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const normalizedAvailablePermissions = useMemo(
    () => normalizePermissions(availablePermissions),
    [availablePermissions]
  );

  const normalizedSelectedPermissions = useMemo(
    () => normalizePermissions(selectedPermissions),
    [selectedPermissions]
  );

  const permissionGroups = useMemo(() => {
    return getPermissionGroupsArray(normalizedAvailablePermissions);
  }, [normalizedAvailablePermissions]);

  const selectedCount = normalizedSelectedPermissions.length;
  const totalCount = normalizedAvailablePermissions.length;

  const activeGroup = useMemo(() => {
    if (!permissionGroups.length) return null;

    return (
      permissionGroups.find((group) => group.module === activeModule) ||
      permissionGroups[0]
    );
  }, [permissionGroups, activeModule]);

  const activeGroupPermissions = useMemo(() => {
    if (!activeGroup?.permissions) return [];

    return activeGroup.permissions.map((permission) => permission.value);
  }, [activeGroup]);

  const filteredActivePermissions = useMemo(() => {
    const cleanSearch = searchTerm.trim().toLowerCase();

    if (!activeGroup?.permissions) return [];

    if (!cleanSearch) return activeGroup.permissions;

    return activeGroup.permissions.filter((permission) => {
      const label = String(permission.label || '').toLowerCase();
      const value = String(permission.value || '').toLowerCase();
      const actionLabel = String(permission.actionLabel || '').toLowerCase();

      return (
        label.includes(cleanSearch) ||
        value.includes(cleanSearch) ||
        actionLabel.includes(cleanSearch)
      );
    });
  }, [activeGroup, searchTerm]);

  const activeGroupSelected = isPermissionGroupSelected(
    normalizedSelectedPermissions,
    activeGroupPermissions
  );

  const selectedInActiveGroup = getGroupSelectedCount(
    normalizedSelectedPermissions,
    activeGroupPermissions
  );

  useEffect(() => {
    if (!permissionGroups.length) {
      setActiveModule('');
      return;
    }

    const activeExists = permissionGroups.some(
      (group) => group.module === activeModule
    );

    if (!activeExists) {
      setActiveModule(permissionGroups[0].module);
    }
  }, [permissionGroups, activeModule]);

  function emitChange(nextPermissions) {
    if (disabled) return;

    if (typeof onChange === 'function') {
      onChange(normalizePermissions(nextPermissions));
    }
  }

  function handleTogglePermission(permission) {
    const nextPermissions = togglePermission(
      normalizedSelectedPermissions,
      permission
    );

    emitChange(nextPermissions);
  }

  function handleToggleActiveGroup() {
    const nextPermissions = togglePermissionGroup(
      normalizedSelectedPermissions,
      activeGroupPermissions
    );

    emitChange(nextPermissions);
  }

  function handleSelectAll() {
    emitChange(normalizedAvailablePermissions);
  }

  function handleClearAll() {
    emitChange([]);
  }

  return (
    <div
      className="rounded-3xl border p-4"
      style={{
        background: THEME.cardBg,
        borderColor: THEME.border,
        color: THEME.cardText,
      }}
    >
      <div
        className="flex items-start justify-between gap-4 border-b pb-3"
        style={{
          borderColor: THEME.border,
        }}
      >
        <div>
          <h3 className="text-sm font-black uppercase tracking-[0.16em]">
            Permisos
          </h3>

          <p
            className="mt-1 text-xs font-semibold"
            style={{
              color: THEME.mutedText,
            }}
          >
            Selecciona un módulo y activa sus acciones.
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <span
            className="rounded-full px-3 py-1 text-xs font-black"
            style={{
              background: 'rgba(212, 175, 55, 0.14)',
              color: THEME.cardText,
              border: '1px solid rgba(212, 175, 55, 0.35)',
            }}
          >
            {selectedCount}/{totalCount}
          </span>

          <button
            type="button"
            disabled={disabled || totalCount === 0}
            onClick={handleSelectAll}
            className="rounded-full px-3 py-1 text-xs font-black transition hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-50"
            style={{
              background: THEME.primaryBg,
              color: THEME.primaryText,
              border: `1px solid ${THEME.primaryBg}`,
            }}
          >
            Todo
          </button>

          <button
            type="button"
            disabled={disabled || selectedCount === 0}
            onClick={handleClearAll}
            className="rounded-full border px-3 py-1 text-xs font-black transition hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-50"
            style={{
              borderColor: THEME.border,
              color: THEME.cardText,
              background: THEME.cardBg,
            }}
          >
            Limpiar
          </button>
        </div>
      </div>

      {permissionGroups.length === 0 ? (
        <div
          className="mt-4 rounded-2xl border border-dashed p-5 text-center text-sm font-semibold"
          style={{
            borderColor: THEME.border,
            color: THEME.mutedText,
          }}
        >
          No hay permisos disponibles para mostrar.
        </div>
      ) : (
        <>
          <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-5">
            {permissionGroups.map((group) => {
              const groupPermissionValues = group.permissions.map(
                (permission) => permission.value
              );

              const selectedInGroup = getGroupSelectedCount(
                normalizedSelectedPermissions,
                groupPermissionValues
              );

              const isActive = group.module === activeGroup?.module;

              return (
                <button
                  key={group.module}
                  type="button"
                  disabled={disabled}
                  onClick={() => {
                    setActiveModule(group.module);
                    setSearchTerm('');
                  }}
                  className="min-h-[42px] rounded-2xl border px-3 py-2 text-left transition hover:-translate-y-[1px] disabled:cursor-not-allowed disabled:opacity-60"
                  style={{
                    background: isActive ? THEME.primaryBg : THEME.softBg,
                    color: isActive ? THEME.primaryText : THEME.cardText,
                    borderColor: isActive ? THEME.primaryBg : THEME.border,
                  }}
                >
                  <span className="block truncate text-[11px] font-black">
                    {group.label}
                  </span>

                  <span
                    className="mt-0.5 block text-[10px] font-bold"
                    style={{
                      color: isActive ? THEME.primaryText : THEME.mutedText,
                      opacity: isActive ? 0.9 : 1,
                    }}
                  >
                    {selectedInGroup} de {group.permissions.length}
                  </span>
                </button>
              );
            })}
          </div>

          <section
            className="mt-3 rounded-3xl border p-3"
            style={{
              background: THEME.softBg,
              borderColor: THEME.border,
            }}
          >
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_260px] lg:items-center">
              <div>
                <h4 className="text-sm font-black">
                  {activeGroup?.label || 'Permisos'}
                </h4>

                <p
                  className="mt-1 text-xs font-semibold"
                  style={{
                    color: THEME.mutedText,
                  }}
                >
                  {selectedInActiveGroup} de {activeGroup?.permissions?.length || 0}{' '}
                  permisos activos
                </p>
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={searchTerm}
                  disabled={disabled}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Buscar aquí..."
                  className="min-w-0 flex-1 rounded-2xl border px-3 py-2 text-xs font-semibold outline-none transition focus:ring-2 disabled:cursor-not-allowed disabled:opacity-60"
                  style={{
                    background: THEME.inputBg,
                    color: THEME.inputText,
                    borderColor: THEME.inputBorder,
                    '--tw-ring-color': 'rgba(190, 24, 93, 0.22)',
                  }}
                />

                <button
                  type="button"
                  disabled={disabled || !activeGroup}
                  onClick={handleToggleActiveGroup}
                  className="shrink-0 rounded-2xl px-3 py-2 text-xs font-black transition hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-50"
                  style={{
                    background: activeGroupSelected
                      ? 'rgba(212, 175, 55, 0.16)'
                      : THEME.primaryBg,
                    color: activeGroupSelected
                      ? THEME.cardText
                      : THEME.primaryText,
                    border: activeGroupSelected
                      ? '1px solid rgba(212, 175, 55, 0.42)'
                      : `1px solid ${THEME.primaryBg}`,
                  }}
                >
                  {activeGroupSelected ? 'Quitar' : 'Módulo'}
                </button>
              </div>
            </div>

            <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {filteredActivePermissions.map((permission) => {
                const checked = isPermissionSelected(
                  normalizedSelectedPermissions,
                  permission.value
                );

                return (
                  <button
                    key={permission.value}
                    type="button"
                    disabled={disabled}
                    onClick={() => handleTogglePermission(permission.value)}
                    className="flex min-h-[42px] items-center gap-3 rounded-2xl border px-3 py-2 text-left transition hover:-translate-y-[1px] disabled:cursor-not-allowed disabled:opacity-60"
                    style={{
                      background: checked
                        ? 'rgba(190, 24, 93, 0.10)'
                        : THEME.cardBg,
                      borderColor: checked ? THEME.primaryBg : THEME.border,
                    }}
                  >
                    <span
                      className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md border text-[11px] font-black"
                      style={{
                        background: checked ? THEME.primaryBg : 'transparent',
                        borderColor: checked ? THEME.primaryBg : THEME.border,
                        color: checked ? THEME.primaryText : 'transparent',
                      }}
                    >
                      ✓
                    </span>

                    <span
                      className="block min-w-0 truncate text-xs font-black"
                      style={{
                        color: THEME.cardText,
                      }}
                    >
                      {permission.actionLabel}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        </>
      )}
    </div>
  );
}