// frontend/src/admin/configuracion/roles/RoleConfirmModal.jsx

import { AlertTriangle, Power, Trash2, X } from 'lucide-react';

/* ============================================================
 * MODAL DE CONFIRMACIÓN PARA PERFILES / ROLES
 * ------------------------------------------------------------
 * Sirve para confirmar:
 * - activar perfil
 * - desactivar perfil
 * - eliminar perfil
 * ============================================================ */

export default function RoleConfirmModal({
  open = false,
  action = '',
  role = null,
  loading = false,
  error = '',
  onClose,
  onConfirm,
}) {
  if (!open || !role) {
    return null;
  }

  const isDelete = action === 'delete';
  const isDeactivate = action === 'deactivate';
  const isActivate = action === 'activate';

  const title = isDelete
    ? 'Eliminar perfil'
    : isDeactivate
      ? 'Desactivar perfil'
      : 'Activar perfil';

  const message = isDelete
    ? 'Esta acción eliminará el perfil administrativo. Solo se permitirá si no tiene usuarios asignados.'
    : isDeactivate
      ? 'Este perfil quedará inactivo y no podrá usarse para nuevos accesos administrativos.'
      : 'Este perfil volverá a estar activo dentro del sistema.';

  const buttonLabel = isDelete
    ? 'Eliminar perfil'
    : isDeactivate
      ? 'Desactivar perfil'
      : 'Activar perfil';

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center px-4 py-6">
      <div
        className="absolute inset-0"
        style={{
          background: 'rgba(15, 23, 42, 0.52)',
          backdropFilter: 'blur(8px)',
        }}
        onClick={loading ? undefined : onClose}
      />

      <div
        className="relative z-10 w-full max-w-lg overflow-hidden rounded-[2rem] border shadow-2xl"
        style={{
          background: 'var(--admin-card-bg, #ffffff)',
          borderColor: 'var(--admin-border, rgba(0,0,0,0.12))',
          color: 'var(--admin-card-text, #1f2937)',
        }}
      >
        <div
          className="flex items-start justify-between gap-4 border-b px-5 py-4"
          style={{
            borderColor: 'var(--admin-border, rgba(0,0,0,0.10))',
          }}
        >
          <div className="flex items-start gap-3">
            <div
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl"
              style={{
                background: isDelete
                  ? 'rgba(239, 68, 68, 0.10)'
                  : 'rgba(190, 24, 93, 0.12)',
                color: isDelete ? '#dc2626' : 'var(--admin-primary, #be185d)',
              }}
            >
              {isDelete ? <Trash2 size={22} /> : <Power size={22} />}
            </div>

            <div>
              <h2 className="text-lg font-black">
                {title}
              </h2>

              <p
                className="mt-1 text-sm font-semibold"
                style={{
                  color: 'var(--admin-card-muted, #6b7280)',
                }}
              >
                Confirma la acción sobre este perfil.
              </p>
            </div>
          </div>

          <button
            type="button"
            disabled={loading}
            onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border transition hover:scale-105 disabled:cursor-not-allowed disabled:opacity-50"
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

        <div className="px-5 py-5">
          {error ? (
            <div
              className="mb-4 flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm font-bold"
              style={{
                background: 'rgba(239, 68, 68, 0.08)',
                borderColor: 'rgba(239, 68, 68, 0.25)',
                color: '#b91c1c',
              }}
            >
              <AlertTriangle size={18} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          ) : null}

          <div
            className="rounded-3xl border p-4"
            style={{
              background: 'var(--admin-soft-bg, rgba(248, 250, 252, 0.75))',
              borderColor: 'var(--admin-border, rgba(0,0,0,0.10))',
            }}
          >
            <p className="text-sm font-bold leading-relaxed">
              {message}
            </p>

            <div
              className="mt-4 rounded-2xl border px-4 py-3"
              style={{
                background: 'var(--admin-card-bg, #ffffff)',
                borderColor: 'var(--admin-border, rgba(0,0,0,0.10))',
              }}
            >
              <p className="text-sm font-black">
                {role.name || 'Perfil sin nombre'}
              </p>

              <p
                className="mt-1 break-all text-xs font-semibold"
                style={{
                  color: 'var(--admin-card-muted, #6b7280)',
                }}
              >
                Código: {role.code || 'sin-codigo'}
              </p>

              {role.isSystem ? (
                <p
                  className="mt-2 text-xs font-bold"
                  style={{
                    color: '#b45309',
                  }}
                >
                  Este perfil pertenece al sistema.
                </p>
              ) : null}
            </div>
          </div>
        </div>

        <div
          className="flex flex-col-reverse gap-3 border-t px-5 py-4 sm:flex-row sm:justify-end"
          style={{
            borderColor: 'var(--admin-border, rgba(0,0,0,0.10))',
          }}
        >
          <button
            type="button"
            disabled={loading}
            onClick={onClose}
            className="rounded-2xl border px-5 py-3 text-sm font-black transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-50"
            style={{
              background: 'var(--admin-card-bg, #ffffff)',
              borderColor: 'var(--admin-border, rgba(0,0,0,0.14))',
              color: 'var(--admin-card-text, #1f2937)',
            }}
          >
            Cancelar
          </button>

          <button
            type="button"
            disabled={loading}
            onClick={onConfirm}
            className="inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-black text-white transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60"
            style={{
              background: isDelete
                ? '#dc2626'
                : 'var(--admin-button-bg, var(--admin-primary, #be185d))',
            }}
          >
            {isDelete ? <Trash2 size={17} /> : <Power size={17} />}
            {loading ? 'Procesando...' : buttonLabel}
          </button>
        </div>
      </div>
    </div>
  );
}