// frontend/src/admin/configuracion/roles/RoleFormModal.jsx

import { useEffect, useState } from 'react';
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
  permissionCatalog = [],
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

      if (field === 'name' && !isEditMode &&
        (!prevForm.code || prevForm.code === normalizeRoleCode(prevForm.name))) {
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
    <div className="fixed inset-0 z-[9999] flex items-center justify-center px-3 py-3 sm:px-4">
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
        className="relative z-10 flex max-h-[94dvh] w-full max-w-6xl flex-col overflow-hidden rounded-[2rem] border shadow-2xl"
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
                Define qué puede hacer y dónde puede trabajar.
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

        <div className="min-h-0 overflow-y-auto px-5 py-4 sm:px-7">
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

          <div className="grid gap-4 lg:grid-cols-[310px_minmax(0,1fr)]">
            <section
              className="rounded-3xl border p-4"
              style={{
                background: 'var(--admin-soft-bg, rgba(248, 250, 252, 0.75))',
                borderColor: 'var(--admin-border, rgba(0,0,0,0.10))',
              }}
            >
              <h3 className="text-base font-black">Datos del perfil</h3>

              <div className="mt-4">
                <div>
                  <label htmlFor="role-name" className="block text-[11px] font-black uppercase tracking-[0.12em]">
                    Nombre
                  </label>

                  <input
                    id="role-name"
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

              </div>

              <div className="mt-3">
                <label htmlFor="role-description" className="block text-[11px] font-black uppercase tracking-[0.12em]">
                  Descripción
                </label>

                <textarea
                  id="role-description"
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

              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="role-scope" className="block h-[14px] whitespace-nowrap text-[10px] font-black uppercase tracking-[0.1em]">
                    Dónde puede trabajar
                  </label>

                  <select
                    id="role-scope"
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
                  <label htmlFor="role-status" className="block h-[14px] whitespace-nowrap text-[10px] font-black uppercase tracking-[0.1em]">
                    Estado
                  </label>

                  <select
                    id="role-status"
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

              <p className="mt-2 text-xs leading-snug" style={{ color: 'var(--admin-card-muted, #6b7280)' }}>
                {ROLE_SCOPE_OPTIONS.find((option) => option.value === form.scope)?.description}
              </p>

              <details className="mt-4 rounded-2xl border px-4 py-3" style={{ borderColor: 'var(--admin-border, rgba(0,0,0,0.10))' }}>
                <summary className="cursor-pointer text-sm font-black">Configuración avanzada</summary>
                <p className="mt-2 text-xs" style={{ color: 'var(--admin-card-muted, #6b7280)' }}>Identificador interno y jerarquía de autoridad.</p>
                <label className="mt-3 block text-xs font-bold">
                  Código interno
                  <input
                    type="text"
                    value={form.code}
                    disabled={loading || (isEditMode && isSystemRole)}
                    onChange={(event) => updateField('code', normalizeRoleCode(event.target.value))}
                    className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
                    style={{ background: 'var(--admin-input-bg, #fff)', borderColor: 'var(--admin-border, rgba(0,0,0,0.12))' }}
                  />
                </label>
                {isEditMode && isSystemRole && <p className="mt-1 text-xs" style={{ color: 'var(--admin-card-muted, #6b7280)' }}>El código de un perfil del sistema no se modifica.</p>}
                <label className="mt-3 block text-xs font-bold">
                  Nivel de autoridad
                  <input type="number" min="1" max="100" value={form.level} disabled={loading} onChange={(event) => updateField('level', event.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2 text-sm" style={{ background: 'var(--admin-input-bg, #fff)', borderColor: 'var(--admin-border, rgba(0,0,0,0.12))' }} />
                </label>
                <p className="mt-1 text-xs" style={{ color: 'var(--admin-card-muted, #6b7280)' }}>1 es la mayor autoridad. Cajero: 50; solo consulta: 80.</p>

              <label
                className="mt-3 flex cursor-pointer items-start gap-3 rounded-2xl border px-3 py-2"
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

            </section>

            <PermissionsSelector
              availablePermissions={availablePermissions}
              permissionCatalog={permissionCatalog}
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
