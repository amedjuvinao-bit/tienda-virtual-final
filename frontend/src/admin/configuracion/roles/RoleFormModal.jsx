// frontend/src/admin/configuracion/roles/RoleFormModal.jsx

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Save, ShieldCheck, X } from 'lucide-react';

import PermissionsSelector from './PermissionsSelector';

import {
  ROLE_SCOPE_OPTIONS,
  ROLE_STATUS_OPTIONS,
  buildRoleFormFromRole,
  buildRolePayload,
  createEmptyRoleForm,
  normalizeRoleCode,
  validateRoleForm,
} from './rolesHelpers';

/* ============================================================
 * MODAL CREAR / EDITAR PERFIL
 * ------------------------------------------------------------
 * Modal compacto:
 * - Datos a la izquierda.
 * - Permisos a la derecha.
 * - Sin scroll interno.
 * - Sin lista larga de permisos.
 * ============================================================ */

export default function RoleFormModal({
  open = false,
  mode = 'create',
  role = null,
  availablePermissions = [],
  loading = false,
  error = '',
  onClose,
  onSubmit,
}) {
  const [form, setForm] = useState(createEmptyRoleForm());
  const [localError, setLocalError] = useState('');

  const isEditMode = mode === 'edit';
  const isSystemRole = role?.isSystem === true;
  const title = isEditMode ? 'Editar perfil' : 'Crear perfil';
  const submitLabel = isEditMode ? 'Guardar cambios' : 'Crear perfil';

  const permissionCount = useMemo(
    () => (Array.isArray(form.permissions) ? form.permissions.length : 0),
    [form.permissions]
  );

  useEffect(() => {
    if (!open) return;

    setLocalError('');

    if (isEditMode && role) {
      setForm(buildRoleFormFromRole(role));
      return;
    }

    setForm(createEmptyRoleForm());
  }, [open, isEditMode, role]);

  function updateField(field, value) {
    setForm((prevForm) => {
      const nextForm = {
        ...prevForm,
        [field]: value,
      };

      if (field === 'name' && !isEditMode && !prevForm.code) {
        nextForm.code = normalizeRoleCode(value);
      }

      if (field === 'status') {
        nextForm.active = value === 'active';
      }

      return nextForm;
    });
  }

  function handlePermissionsChange(nextPermissions) {
    setForm((prevForm) => ({
      ...prevForm,
      permissions: nextPermissions,
    }));
  }

  function handleSubmit(event) {
    event.preventDefault();

    const validationError = validateRoleForm(form);

    if (validationError) {
      setLocalError(validationError);
      return;
    }

    const payload = buildRolePayload(form);

    if (isEditMode && isSystemRole) {
      delete payload.code;
    }

    setLocalError('');

    if (typeof onSubmit === 'function') {
      onSubmit(payload);
    }
  }

  if (!open) {
    return null;
  }

  const visibleError = localError || error;

  return (
    <div className="fixed inset-0 z-[9999] flex items-start justify-center px-4 py-4">
      <div
        className="fixed inset-0"
        style={{
          background: 'rgba(15, 23, 42, 0.52)',
          backdropFilter: 'blur(8px)',
        }}
        onClick={loading ? undefined : onClose}
      />

      <form
        onSubmit={handleSubmit}
        className="relative z-10 mt-2 w-full max-w-7xl overflow-hidden rounded-[2rem] border shadow-2xl"
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
              <ShieldCheck size={22} />
            </div>

            <div>
              <h2 className="text-lg font-black sm:text-xl">{title}</h2>

              <p
                className="mt-1 text-xs font-semibold sm:text-sm"
                style={{
                  color: 'var(--admin-card-muted, #6b7280)',
                }}
              >
                Define datos principales, alcance y permisos del perfil.
              </p>
            </div>
          </div>

          <button
            type="button"
            disabled={loading}
            onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border transition hover:scale-105 disabled:cursor-not-allowed disabled:opacity-50"
            style={{
              borderColor: 'rgba(244, 114, 182, 0.35)',
              color: '#0f172a',
              background: 'rgba(255, 255, 255, 0.96)',
            }}
            aria-label="Cerrar modal"
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-5 py-4 sm:px-7">
          {visibleError ? (
            <div
              className="mb-4 flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm font-bold"
              style={{
                background: 'rgba(239, 68, 68, 0.08)',
                borderColor: 'rgba(239, 68, 68, 0.25)',
                color: '#b91c1c',
              }}
            >
              <AlertTriangle size={18} className="mt-0.5 shrink-0" />
              <span>{visibleError}</span>
            </div>
          ) : null}

          {isEditMode && isSystemRole ? (
            <div
              className="mb-4 rounded-2xl border px-4 py-3 text-xs font-bold leading-relaxed"
              style={{
                background: 'rgba(212, 175, 55, 0.12)',
                borderColor: 'rgba(212, 175, 55, 0.35)',
                color: 'var(--admin-card-text, #1f2937)',
              }}
            >
              Este es un perfil del sistema. Puedes ajustar datos permitidos y
              permisos, pero el código interno no se modifica.
            </div>
          ) : null}

          <div className="grid gap-4 xl:grid-cols-[390px_minmax(0,1fr)]">
            <section
              className="rounded-3xl border p-4"
              style={{
                background: 'var(--admin-soft-bg, rgba(248, 250, 252, 0.75))',
                borderColor: 'var(--admin-border, rgba(0,0,0,0.10))',
              }}
            >
              <h3 className="text-sm font-black uppercase tracking-[0.16em]">
                Datos del perfil
              </h3>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-[11px] font-black uppercase tracking-[0.12em]">
                    Nombre
                  </label>

                  <input
                    type="text"
                    value={form.name}
                    disabled={loading}
                    onChange={(event) => updateField('name', event.target.value)}
                    placeholder="Auxiliar ventas"
                    className="mt-2 w-full rounded-2xl border px-4 py-2.5 text-sm font-semibold outline-none transition focus:ring-2 disabled:cursor-not-allowed disabled:opacity-60"
                    style={{
                      background: 'var(--admin-input-bg, #ffffff)',
                      color: 'var(--admin-card-text, #1f2937)',
                      borderColor: 'var(--admin-border, rgba(0,0,0,0.12))',
                      '--tw-ring-color': 'rgba(190, 24, 93, 0.22)',
                    }}
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-black uppercase tracking-[0.12em]">
                    Código
                  </label>

                  <input
                    type="text"
                    value={form.code}
                    disabled={loading || (isEditMode && isSystemRole)}
                    onChange={(event) =>
                      updateField('code', normalizeRoleCode(event.target.value))
                    }
                    placeholder="auxiliar-ventas"
                    className="mt-2 w-full rounded-2xl border px-4 py-2.5 text-sm font-semibold outline-none transition focus:ring-2 disabled:cursor-not-allowed disabled:opacity-60"
                    style={{
                      background: 'var(--admin-input-bg, #ffffff)',
                      color: 'var(--admin-card-text, #1f2937)',
                      borderColor: 'var(--admin-border, rgba(0,0,0,0.12))',
                      '--tw-ring-color': 'rgba(190, 24, 93, 0.22)',
                    }}
                  />
                </div>
              </div>

              <div className="mt-3">
                <label className="block text-[11px] font-black uppercase tracking-[0.12em]">
                  Descripción
                </label>

                <textarea
                  value={form.description}
                  disabled={loading}
                  onChange={(event) =>
                    updateField('description', event.target.value)
                  }
                  placeholder="Función de este perfil dentro del sistema."
                  rows={2}
                  className="mt-2 w-full resize-none rounded-2xl border px-4 py-2.5 text-sm font-semibold outline-none transition focus:ring-2 disabled:cursor-not-allowed disabled:opacity-60"
                  style={{
                    background: 'var(--admin-input-bg, #ffffff)',
                    color: 'var(--admin-card-text, #1f2937)',
                    borderColor: 'var(--admin-border, rgba(0,0,0,0.12))',
                    '--tw-ring-color': 'rgba(190, 24, 93, 0.22)',
                  }}
                />
              </div>

              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <div>
                  <label className="block h-[14px] whitespace-nowrap text-[10px] font-black uppercase tracking-[0.1em]">
                    Alcance
                  </label>

                  <select
                    value={form.scope}
                    disabled={loading}
                    onChange={(event) => updateField('scope', event.target.value)}
                    className="mt-2 w-full rounded-2xl border px-3 py-2.5 text-sm font-bold outline-none transition focus:ring-2 disabled:cursor-not-allowed disabled:opacity-60"
                    style={{
                      background: 'var(--admin-input-bg, #ffffff)',
                      color: 'var(--admin-card-text, #1f2937)',
                      borderColor: 'var(--admin-border, rgba(0,0,0,0.12))',
                      '--tw-ring-color': 'rgba(190, 24, 93, 0.22)',
                    }}
                  >
                    {ROLE_SCOPE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block h-[14px] whitespace-nowrap text-[10px] font-black uppercase tracking-[0.1em]">
                    Nivel
                  </label>

                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={form.level}
                    disabled={loading}
                    onChange={(event) => updateField('level', event.target.value)}
                    className="mt-2 w-full rounded-2xl border px-3 py-2.5 text-sm font-bold outline-none transition focus:ring-2 disabled:cursor-not-allowed disabled:opacity-60"
                    style={{
                      background: 'var(--admin-input-bg, #ffffff)',
                      color: 'var(--admin-card-text, #1f2937)',
                      borderColor: 'var(--admin-border, rgba(0,0,0,0.12))',
                      '--tw-ring-color': 'rgba(190, 24, 93, 0.22)',
                    }}
                  />
                </div>

                <div>
                  <label className="block h-[14px] whitespace-nowrap text-[10px] font-black uppercase tracking-[0.1em]">
                    Estado
                  </label>

                  <select
                    value={form.status}
                    disabled={loading}
                    onChange={(event) => updateField('status', event.target.value)}
                    className="mt-2 w-full rounded-2xl border px-3 py-2.5 text-sm font-bold outline-none transition focus:ring-2 disabled:cursor-not-allowed disabled:opacity-60"
                    style={{
                      background: 'var(--admin-input-bg, #ffffff)',
                      color: 'var(--admin-card-text, #1f2937)',
                      borderColor: 'var(--admin-border, rgba(0,0,0,0.12))',
                      '--tw-ring-color': 'rgba(190, 24, 93, 0.22)',
                    }}
                  >
                    {ROLE_STATUS_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div
                className="mt-2 rounded-xl border px-3 py-2 text-[11px] font-bold leading-snug"
                style={{
                  background: 'rgba(6, 182, 212, 0.08)',
                  borderColor: 'rgba(6, 182, 212, 0.22)',
                  color: 'var(--admin-card-text, #1f2937)',
                }}
              >
                <span className="font-black">Nivel:</span> menor número = más autoridad.
                Ej: 1 propietario, 10 administrador, 30 encargado, 50 vendedor/cajero, 80 consulta.
              </div>

              <label
                className="mt-3 flex cursor-pointer items-start gap-3 rounded-2xl border px-4 py-3"
                style={{
                  background: 'var(--admin-card-bg, #ffffff)',
                  borderColor: 'var(--admin-border, rgba(0,0,0,0.10))',
                  color: 'var(--admin-card-text, #1f2937)',
                }}
              >
                <input
                  type="checkbox"
                  checked={form.isDefault}
                  disabled={loading}
                  onChange={(event) =>
                    updateField('isDefault', event.target.checked)
                  }
                  className="mt-1 h-4 w-4"
                />

                <span>
                  <span className="block text-sm font-black">
                    Perfil predeterminado
                  </span>

                  <span
                    className="mt-1 block text-xs font-semibold"
                    style={{
                      color: 'var(--admin-card-muted, #6b7280)',
                    }}
                  >
                    Se usará como rol base si el sistema necesita uno por defecto.
                  </span>
                </span>
              </label>

              <details
                className="mt-3 rounded-2xl border px-4 py-3"
                style={{
                  borderColor: 'var(--admin-border, rgba(0,0,0,0.10))',
                  color: 'var(--admin-card-text, #1f2937)',
                }}
              >
                <summary className="cursor-pointer text-sm font-black">
                  Opciones avanzadas
                </summary>

                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <input
                    type="text"
                    value={form.color}
                    disabled={loading}
                    onChange={(event) => updateField('color', event.target.value)}
                    placeholder="Color: #be185d"
                    className="rounded-2xl border px-4 py-2.5 text-sm font-semibold outline-none transition focus:ring-2 disabled:cursor-not-allowed disabled:opacity-60"
                    style={{
                      background: 'var(--admin-input-bg, #ffffff)',
                      color: 'var(--admin-card-text, #1f2937)',
                      borderColor: 'var(--admin-border, rgba(0,0,0,0.12))',
                      '--tw-ring-color': 'rgba(190, 24, 93, 0.22)',
                    }}
                  />

                  <input
                    type="text"
                    value={form.icon}
                    disabled={loading}
                    onChange={(event) => updateField('icon', event.target.value)}
                    placeholder="Ícono: shield"
                    className="rounded-2xl border px-4 py-2.5 text-sm font-semibold outline-none transition focus:ring-2 disabled:cursor-not-allowed disabled:opacity-60"
                    style={{
                      background: 'var(--admin-input-bg, #ffffff)',
                      color: 'var(--admin-card-text, #1f2937)',
                      borderColor: 'var(--admin-border, rgba(0,0,0,0.12))',
                      '--tw-ring-color': 'rgba(190, 24, 93, 0.22)',
                    }}
                  />
                </div>
              </details>

              <div
                className="mt-3 rounded-2xl border px-4 py-3 text-sm font-bold"
                style={{
                  background: 'rgba(190, 24, 93, 0.08)',
                  borderColor: 'rgba(190, 24, 93, 0.18)',
                  color: 'var(--admin-card-text, #1f2937)',
                }}
              >
                Permisos seleccionados:{' '}
                <span style={{ color: 'var(--admin-primary, #be185d)' }}>
                  {permissionCount}
                </span>
              </div>
            </section>

            <PermissionsSelector
              availablePermissions={availablePermissions}
              selectedPermissions={form.permissions}
              onChange={handlePermissionsChange}
              disabled={loading}
            />
          </div>
        </div>

        <div
          className="flex flex-col-reverse gap-3 border-t px-5 py-4 sm:flex-row sm:justify-end sm:px-7"
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
              background: 'rgba(255, 255, 255, 0.96)',
              borderColor: 'rgba(244, 114, 182, 0.35)',
              color: '#0f172a',
            }}
          >
            Cancelar
          </button>

          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-black transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60"
            style={{
              background:
                'var(--admin-button-bg, var(--admin-primary, #be185d))',
              color: '#ffffff',
              border: '1px solid var(--admin-button-bg, var(--admin-primary, #be185d))',
            }}
          >
            <Save size={17} />
            {loading ? 'Guardando...' : submitLabel}
          </button>
        </div>
      </form>
    </div>
  );
}