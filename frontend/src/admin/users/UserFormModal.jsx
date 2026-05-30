// frontend/src/admin/users/UserFormModal.jsx

import { useEffect } from 'react';
import { createPortal } from 'react-dom';

export default function UserFormModal({
  open,
  mode,
  roles,
  branches,
  form,
  setForm,
  saving,
  error,
  onClose,
  onSubmit,
}) {
  const isEditMode = mode === 'edit';

  useEffect(() => {
    if (!open) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, onClose]);

  if (!open || typeof document === 'undefined') return null;

  const updateField = (field, value) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const selectedRole =
    roles.find((role) => String(role.code) === String(form.role)) || null;

  const selectedRolePermissionCount = Array.isArray(selectedRole?.permissions)
    ? selectedRole.permissions.length
    : 0;

  const roleScopeLabels = {
    global: 'Global',
    branch: 'Por sede',
    branches: 'Por sedes',
    warehouse: 'Bodega',
    own: 'Propio',
    custom: 'Personalizado',
  };

  const selectedRoleScopeLabel =
    roleScopeLabels[selectedRole?.scope] || selectedRole?.scope || 'No definido';

  const inputStyle = {
    background: 'var(--admin-input-bg)',
    borderColor: 'var(--admin-input-border)',
    color: 'var(--admin-input-text)',
  };

  const labelStyle = {
    color: 'var(--admin-modal-text)',
  };

  const sectionTitleStyle = {
    color: 'var(--admin-modal-text)',
  };

  const mutedTextStyle = {
    color: 'var(--admin-modal-muted-text)',
  };

  const optionStyle = {
    background: 'var(--admin-input-bg)',
    color: 'var(--admin-input-text)',
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[99999] flex items-center justify-center p-4 backdrop-blur-[6px]"
      style={{
        background: 'var(--admin-modal-overlay)',
      }}
    >
      <button
        type="button"
        aria-label="Cerrar formulario de usuario"
        className="absolute inset-0 h-full w-full cursor-default"
        onClick={onClose}
      />

      <form
        onSubmit={onSubmit}
        className="relative z-10 flex max-h-[88vh] w-full max-w-4xl flex-col overflow-hidden rounded-[32px] border shadow-2xl"
        style={{
          background: 'var(--admin-modal-bg)',
          borderColor: 'var(--admin-glass-border)',
          color: 'var(--admin-modal-text)',
          boxShadow: 'var(--admin-glass-shadow-hover)',
        }}
      >
        <div
          className="shrink-0 border-b px-5 py-4 md:px-6"
          style={{
            borderColor: 'var(--admin-glass-border)',
            background: 'var(--admin-glass-strong-bg)',
          }}
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <p
                className="text-xs font-black uppercase tracking-[0.25em]"
                style={mutedTextStyle}
              >
                {isEditMode
                  ? 'Editar acceso administrativo'
                  : 'Nuevo acceso administrativo'}
              </p>

              <h3
                className="mt-2 text-2xl font-black"
                style={{ color: 'var(--admin-modal-text)' }}
              >
                {isEditMode ? 'Editar usuario' : 'Crear usuario'}
              </h3>

              <p
                className="mt-1 max-w-2xl text-sm leading-6"
                style={mutedTextStyle}
              >
                {isEditMode
                  ? 'Actualiza los datos, perfil, sede y estado del usuario administrativo.'
                  : 'Registra un usuario interno, asígnale perfil, sede y una contraseña temporal.'}
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border text-xl font-black transition hover:scale-105 disabled:cursor-not-allowed disabled:opacity-60"
              style={{
                borderColor: 'var(--admin-light-panel-border)',
                color: 'var(--admin-light-panel-text)',
                background: 'var(--admin-light-panel-bg)',
              }}
            >
              ×
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5 md:p-6">
          {error && (
            <div
              className="mb-5 rounded-2xl border px-4 py-3 text-sm font-semibold"
              style={{
                borderColor: 'var(--admin-danger)',
                background: 'var(--admin-danger-soft-bg)',
                color: 'var(--admin-danger-text)',
              }}
            >
              {error}
            </div>
          )}

          <div className="grid gap-5">
            <div>
              <h4
                className="mb-3 text-sm font-black uppercase tracking-[0.18em]"
                style={sectionTitleStyle}
              >
                Datos personales
              </h4>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="grid gap-2">
                  <span className="text-sm font-bold" style={labelStyle}>
                    Nombres
                  </span>
                  <input
                    type="text"
                    value={form.firstName}
                    onChange={(event) =>
                      updateField('firstName', event.target.value)
                    }
                    className="rounded-2xl border px-4 py-3 text-sm outline-none"
                    placeholder="Ej: María"
                    style={inputStyle}
                  />
                </label>

                <label className="grid gap-2">
                  <span className="text-sm font-bold" style={labelStyle}>
                    Apellidos
                  </span>
                  <input
                    type="text"
                    value={form.lastName}
                    onChange={(event) =>
                      updateField('lastName', event.target.value)
                    }
                    className="rounded-2xl border px-4 py-3 text-sm outline-none"
                    placeholder="Ej: Pérez"
                    style={inputStyle}
                  />
                </label>

                <label className="grid gap-2">
                  <span className="text-sm font-bold" style={labelStyle}>
                    Tipo de documento
                  </span>
                  <select
                    value={form.documentType}
                    onChange={(event) =>
                      updateField('documentType', event.target.value)
                    }
                    className="rounded-2xl border px-4 py-3 text-sm outline-none"
                    style={inputStyle}
                  >
                    <option value="CC" style={optionStyle}>
                      Cédula de ciudadanía
                    </option>
                    <option value="CE" style={optionStyle}>
                      Cédula de extranjería
                    </option>
                    <option value="NIT" style={optionStyle}>
                      NIT
                    </option>
                    <option value="PASSPORT" style={optionStyle}>
                      Pasaporte
                    </option>
                    <option value="OTHER" style={optionStyle}>
                      Otro
                    </option>
                  </select>
                </label>

                <label className="grid gap-2">
                  <span className="text-sm font-bold" style={labelStyle}>
                    Número de documento
                  </span>
                  <input
                    type="text"
                    value={form.documentNumber}
                    onChange={(event) =>
                      updateField('documentNumber', event.target.value)
                    }
                    className="rounded-2xl border px-4 py-3 text-sm outline-none"
                    placeholder="Ej: 123456789"
                    style={inputStyle}
                  />
                </label>
              </div>
            </div>

            <div>
              <h4
                className="mb-3 text-sm font-black uppercase tracking-[0.18em]"
                style={sectionTitleStyle}
              >
                Acceso al panel
              </h4>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="grid gap-2">
                  <span className="text-sm font-bold" style={labelStyle}>
                    Usuario *
                  </span>
                  <input
                    type="text"
                    value={form.username}
                    onChange={(event) =>
                      updateField('username', event.target.value)
                    }
                    className="rounded-2xl border px-4 py-3 text-sm outline-none"
                    placeholder="Ej: cajero2"
                    required
                    style={inputStyle}
                  />
                </label>

                {!isEditMode && (
                  <label className="grid gap-2">
                    <span className="text-sm font-bold" style={labelStyle}>
                      Contraseña temporal *
                    </span>
                    <input
                      type="password"
                      value={form.password}
                      onChange={(event) =>
                        updateField('password', event.target.value)
                      }
                      className="rounded-2xl border px-4 py-3 text-sm outline-none"
                      placeholder="Mínimo 8 caracteres"
                      required
                      style={inputStyle}
                    />
                  </label>
                )}

                <label className="grid gap-2">
                  <span className="text-sm font-bold" style={labelStyle}>
                    Correo
                  </span>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(event) => updateField('email', event.target.value)}
                    className="rounded-2xl border px-4 py-3 text-sm outline-none"
                    placeholder="correo@tienda.com"
                    style={inputStyle}
                  />
                </label>

                <label className="grid gap-2">
                  <span className="text-sm font-bold" style={labelStyle}>
                    Teléfono
                  </span>
                  <input
                    type="text"
                    value={form.phone}
                    onChange={(event) => updateField('phone', event.target.value)}
                    className="rounded-2xl border px-4 py-3 text-sm outline-none"
                    placeholder="Ej: 3000000000"
                    style={inputStyle}
                  />
                </label>
              </div>
            </div>

            <div>
              <h4
                className="mb-3 text-sm font-black uppercase tracking-[0.18em]"
                style={sectionTitleStyle}
              >
                Perfil y sede
              </h4>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-2">
                  <span className="text-sm font-bold" style={labelStyle}>
                    Perfil administrativo *
                  </span>

                  <select
                    value={form.role}
                    onChange={(event) => updateField('role', event.target.value)}
                    className="rounded-2xl border px-4 py-3 text-sm outline-none"
                    required
                    style={inputStyle}
                  >
                    {roles.map((role) => (
                      <option
                        key={role._id || role.code}
                        value={role.code}
                        style={optionStyle}
                      >
                        {role.name} ({role.code})
                      </option>
                    ))}
                  </select>

                  <div
                    className="rounded-2xl border px-4 py-3"
                    style={{
                      borderColor: 'var(--admin-primary-soft-border)',
                      background: 'var(--admin-primary-soft-bg)',
                      color: 'var(--admin-modal-text)',
                    }}
                  >
                    {selectedRole ? (
                      <>
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className="rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-[0.14em]"
                            style={{
                              background: 'var(--admin-button-bg)',
                              color: 'var(--admin-button-text)',
                            }}
                          >
                            {selectedRole.code}
                          </span>

                          <span
                            className="text-xs font-black"
                            style={{ color: 'var(--admin-modal-text)' }}
                          >
                            Nivel {selectedRole.level ?? '—'}
                          </span>

                          <span
                            className="text-xs font-black"
                            style={{ color: 'var(--admin-modal-text)' }}
                          >
                            {selectedRoleScopeLabel}
                          </span>
                        </div>

                        <p
                          className="mt-2 text-xs leading-5"
                          style={mutedTextStyle}
                        >
                          Este perfil asignará {selectedRolePermissionCount}{' '}
                          permisos al usuario administrativo.
                        </p>

                        {selectedRole.description && (
                          <p
                            className="mt-1 text-xs leading-5"
                            style={mutedTextStyle}
                          >
                            {selectedRole.description}
                          </p>
                        )}
                      </>
                    ) : (
                      <p className="text-xs font-semibold" style={mutedTextStyle}>
                        Selecciona un perfil para ver el resumen de permisos.
                      </p>
                    )}
                  </div>
                </div>

                <label className="grid gap-2">
                  <span className="text-sm font-bold" style={labelStyle}>
                    Sede *
                  </span>
                  <select
                    value={form.branchId}
                    onChange={(event) =>
                      updateField('branchId', event.target.value)
                    }
                    className="rounded-2xl border px-4 py-3 text-sm outline-none"
                    required
                    style={inputStyle}
                  >
                    <option value="" style={optionStyle}>
                      Seleccionar sede
                    </option>
                    {branches.map((branch) => (
                      <option
                        key={branch._id}
                        value={branch._id}
                        style={optionStyle}
                      >
                        {branch.name} ({branch.code})
                      </option>
                    ))}
                  </select>
                </label>

                <label className="grid gap-2">
                  <span className="text-sm font-bold" style={labelStyle}>
                    Estado
                  </span>
                  <select
                    value={form.status}
                    onChange={(event) => updateField('status', event.target.value)}
                    className="rounded-2xl border px-4 py-3 text-sm outline-none"
                    style={inputStyle}
                  >
                    <option value="active" style={optionStyle}>
                      Activo
                    </option>
                    <option value="inactive" style={optionStyle}>
                      Inactivo
                    </option>
                    <option value="pending" style={optionStyle}>
                      Pendiente
                    </option>
                    <option value="blocked" style={optionStyle}>
                      Bloqueado
                    </option>
                  </select>
                </label>

                <label
                  className="flex items-center gap-3 rounded-2xl border px-4 py-3"
                  style={{
                    borderColor: 'var(--admin-input-border)',
                    background: 'var(--admin-glass-soft-bg)',
                    color: 'var(--admin-modal-text)',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={form.mustChangePassword}
                    onChange={(event) =>
                      updateField('mustChangePassword', event.target.checked)
                    }
                    className="h-4 w-4"
                    style={{
                      accentColor: 'var(--admin-primary)',
                    }}
                  />
                  <span className="text-sm font-bold">
                    Debe cambiar contraseña al ingresar
                  </span>
                </label>
              </div>
            </div>
          </div>
        </div>

        <div
          className="flex shrink-0 flex-col-reverse gap-3 border-t px-5 py-4 sm:flex-row sm:justify-end md:px-6"
          style={{
            borderColor: 'var(--admin-glass-border)',
            background: 'var(--admin-glass-soft-bg)',
          }}
        >
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-2xl border px-5 py-2.5 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-60"
            style={{
              borderColor: 'var(--admin-light-panel-border)',
              color: 'var(--admin-light-panel-text)',
              background: 'var(--admin-light-panel-bg)',
            }}
          >
            Cancelar
          </button>

          <button
            type="submit"
            disabled={saving}
            className="rounded-2xl border px-5 py-2.5 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-60"
            style={{
              borderColor: 'var(--admin-button-bg)',
              background: 'var(--admin-button-bg)',
              color: 'var(--admin-button-text)',
            }}
          >
            {saving
              ? 'Guardando...'
              : isEditMode
                ? 'Guardar cambios'
                : 'Crear usuario'}
          </button>
        </div>
      </form>
    </div>,
    document.body
  );
}