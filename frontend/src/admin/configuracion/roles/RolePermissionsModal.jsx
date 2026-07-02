// frontend/src/admin/configuracion/roles/RolePermissionsModal.jsx

import { Eye, ShieldCheck, X } from 'lucide-react';

import { getPermissionGroupsArray } from './rolesHelpers';

/* ============================================================
 * MODAL PARA VER PERMISOS DE UN PERFIL
 * ------------------------------------------------------------
 * Solo muestra permisos agrupados por módulo.
 * No edita ni guarda.
 * ============================================================ */

export default function RolePermissionsModal({
  open = false,
  role = null,
  onClose,
}) {
  if (!open || !role) {
    return null;
  }

  const permissionGroups = getPermissionGroupsArray(role.permissions || []);
  const permissionsCount = Array.isArray(role.permissions)
    ? role.permissions.length
    : 0;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center px-4 py-6">
      <div
        className="absolute inset-0"
        style={{
          background: 'rgba(15, 23, 42, 0.52)',
          backdropFilter: 'blur(8px)',
        }}
        onClick={onClose}
      />

      <div
        className="relative z-10 flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-[2rem] border shadow-2xl"
        style={{
          background: 'var(--admin-card-bg, #ffffff)',
          borderColor: 'var(--admin-border, rgba(0,0,0,0.12))',
          color: 'var(--admin-card-text, #1f2937)',
        }}
      >
        <div
          className="flex items-start justify-between gap-4 border-b px-5 py-4 sm:px-7"
          style={{
            borderColor: 'var(--admin-border, rgba(0,0,0,0.10))',
          }}
        >
          <div className="flex items-start gap-3">
            <div
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl"
              style={{
                background: 'rgba(190, 24, 93, 0.12)',
                color: 'var(--admin-primary, #be185d)',
              }}
            >
              <Eye size={22} />
            </div>

            <div>
              <h2 className="text-lg font-black sm:text-xl">
                Permisos del perfil
              </h2>

              <p
                className="mt-1 text-xs font-semibold sm:text-sm"
                style={{
                  color: 'var(--admin-card-muted, #6b7280)',
                }}
              >
                {role.name || 'Perfil sin nombre'} · {permissionsCount} permisos asignados
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border transition hover:scale-105"
            style={{
              borderColor: 'var(--admin-border, rgba(0,0,0,0.14))',
              color: 'var(--admin-card-text, #1f2937)',
              background: 'var(--admin-card-bg, #ffffff)',
            }}
            aria-label="Cerrar modal"
          >
            <X size={18} />
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-5 sm:px-7">
          <div
            className="mb-5 rounded-3xl border p-4"
            style={{
              background: 'var(--admin-soft-bg, rgba(248, 250, 252, 0.75))',
              borderColor: 'var(--admin-border, rgba(0,0,0,0.10))',
            }}
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-base font-black">
                  {role.name || 'Perfil sin nombre'}
                </h3>

                <p
                  className="mt-1 break-all text-xs font-bold"
                  style={{
                    color: 'var(--admin-card-muted, #6b7280)',
                  }}
                >
                  Código: {role.code || 'sin-codigo'}
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <span
                  className="rounded-full px-3 py-1 text-xs font-black"
                  style={{
                    background:
                      role.active === false || role.status === 'inactive'
                        ? 'rgba(239, 68, 68, 0.10)'
                        : 'rgba(22, 163, 74, 0.10)',
                    color:
                      role.active === false || role.status === 'inactive'
                        ? '#b91c1c'
                        : '#15803d',
                    border:
                      role.active === false || role.status === 'inactive'
                        ? '1px solid rgba(239, 68, 68, 0.22)'
                        : '1px solid rgba(22, 163, 74, 0.22)',
                  }}
                >
                  {role.active === false || role.status === 'inactive'
                    ? 'Inactivo'
                    : 'Activo'}
                </span>

                <span
                  className="rounded-full px-3 py-1 text-xs font-black"
                  style={{
                    background: role.isSystem
                      ? 'rgba(212, 175, 55, 0.14)'
                      : 'rgba(190, 24, 93, 0.10)',
                    color: 'var(--admin-card-text, #1f2937)',
                    border: role.isSystem
                      ? '1px solid rgba(212, 175, 55, 0.35)'
                      : '1px solid rgba(190, 24, 93, 0.18)',
                  }}
                >
                  {role.isSystem ? 'Sistema' : 'Personalizado'}
                </span>
              </div>
            </div>

            {role.description ? (
              <p
                className="mt-4 text-sm font-semibold leading-relaxed"
                style={{
                  color: 'var(--admin-card-muted, #6b7280)',
                }}
              >
                {role.description}
              </p>
            ) : null}
          </div>

          {permissionGroups.length === 0 ? (
            <div
              className="rounded-3xl border border-dashed px-6 py-10 text-center"
              style={{
                borderColor: 'var(--admin-border, rgba(0,0,0,0.16))',
                color: 'var(--admin-card-muted, #6b7280)',
              }}
            >
              <ShieldCheck size={28} className="mx-auto mb-3" />

              <p className="text-sm font-bold">
                Este perfil no tiene permisos asignados.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {permissionGroups.map((group) => (
                <section
                  key={group.module}
                  className="rounded-3xl border p-4"
                  style={{
                    background: 'var(--admin-soft-bg, rgba(248, 250, 252, 0.75))',
                    borderColor: 'var(--admin-border, rgba(0,0,0,0.10))',
                  }}
                >
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <h3 className="text-sm font-black">
                      {group.label}
                    </h3>

                    <span
                      className="text-xs font-black"
                      style={{
                        color: 'var(--admin-card-muted, #6b7280)',
                      }}
                    >
                      {group.permissions.length} permisos
                    </span>
                  </div>

                  <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {group.permissions.map((permission) => (
                      <div
                        key={permission.value}
                        className="rounded-2xl border px-3 py-3"
                        style={{
                          background: 'var(--admin-card-bg, #ffffff)',
                          borderColor: 'var(--admin-border, rgba(0,0,0,0.10))',
                        }}
                      >
                        <p className="text-xs font-black">
                          {permission.actionLabel}
                        </p>

                        <p
                          className="mt-1 break-all text-[11px] font-semibold"
                          style={{
                            color: 'var(--admin-card-muted, #6b7280)',
                          }}
                        >
                          {permission.value}
                        </p>
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>

        <div
          className="flex justify-end border-t px-5 py-4 sm:px-7"
          style={{
            borderColor: 'var(--admin-border, rgba(0,0,0,0.10))',
          }}
        >
          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl px-5 py-3 text-sm font-black text-white transition hover:scale-[1.01]"
            style={{
              background: 'var(--admin-button-bg, var(--admin-primary, #be185d))',
            }}
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
}