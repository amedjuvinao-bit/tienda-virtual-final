import { useEffect, useState } from 'react';
import { Check, Eye, ShieldCheck, X } from 'lucide-react';

import { getPermissionGroupsArray } from './rolesHelpers';

const muted = 'var(--admin-card-muted, #6b7280)';
const border = 'var(--admin-border, rgba(0,0,0,0.10))';

export default function RolePermissionsModal({ open = false, role = null, permissionCatalog = [], onClose }) {
  const [selectedModule, setSelectedModule] = useState('');
  const permissionGroups = getPermissionGroupsArray(role?.permissions || [], permissionCatalog);
  const selectedGroup = permissionGroups.find((group) => group.module === selectedModule)
    || permissionGroups[0];
  const permissionsCount = permissionGroups.reduce(
    (total, group) => total + group.permissions.length, 0
  );

  useEffect(() => {
    setSelectedModule('');
  }, [role?._id, role?.code]);

  useEffect(() => {
    if (!open) return undefined;
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [open, onClose]);

  if (!open || !role) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center px-3 py-4 sm:px-5">
      <div
        className="absolute inset-0"
        style={{ background: 'rgba(15, 23, 42, 0.52)', backdropFilter: 'blur(8px)' }}
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="role-permissions-title"
        className="relative z-10 flex max-h-[min(720px,92dvh)] w-full max-w-4xl flex-col overflow-hidden rounded-[1.75rem] border shadow-2xl"
        style={{ background: 'var(--admin-card-bg, #ffffff)', borderColor: border, color: 'var(--admin-card-text, #1f2937)' }}
      >
        <header className="flex items-start justify-between gap-3 border-b px-5 py-4 sm:px-6" style={{ borderColor: border }}>
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ background: 'rgba(190, 24, 93, 0.12)', color: 'var(--admin-primary, #be185d)' }}>
              <Eye size={20} />
            </span>
            <div className="min-w-0">
              <h2 id="role-permissions-title" className="truncate text-lg font-black">Permisos de {role.name || 'perfil sin nombre'}</h2>
              <p className="text-xs font-semibold" style={{ color: muted }}>
                {permissionsCount} permisos en {permissionGroups.length} módulos · {role.active === false || role.status === 'inactive' ? 'Inactivo' : 'Activo'} · {role.isSystem ? 'Sistema' : 'Personalizado'}
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar permisos" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition hover:scale-105" style={{ borderColor: border }}>
            <X size={18} />
          </button>
        </header>

        {permissionGroups.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm font-semibold" style={{ color: muted }}>
            <ShieldCheck size={28} className="mx-auto mb-3" />
            Este perfil no tiene permisos asignados.
          </div>
        ) : (
          <div className="flex min-h-0 flex-col sm:grid sm:grid-cols-[220px_minmax(0,1fr)]">
            <nav aria-label="Módulos del perfil" className="flex shrink-0 gap-1.5 overflow-x-auto border-b p-3 sm:max-h-[min(520px,65dvh)] sm:flex-col sm:overflow-x-hidden sm:overflow-y-auto sm:border-b-0 sm:border-r sm:p-4" style={{ borderColor: border }}>
              {permissionGroups.map((group) => {
                const active = group.module === selectedGroup?.module;
                return (
                  <button
                    key={group.module}
                    type="button"
                    aria-current={active ? 'true' : undefined}
                    onClick={() => setSelectedModule(group.module)}
                    className="flex min-w-max items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-xs font-bold transition sm:w-full sm:min-w-0"
                    style={{ background: active ? 'var(--admin-button-bg, var(--admin-primary, #be185d))' : 'transparent', color: active ? '#fff' : 'var(--admin-card-text, #1f2937)' }}
                  >
                    <span className="sm:truncate">{group.label}</span>
                    <span className="shrink-0 opacity-80">{group.permissions.length}</span>
                  </button>
                );
              })}
            </nav>

            <section aria-label={`Permisos de ${selectedGroup.label}`} className="min-h-0 overflow-y-auto px-5 py-5 sm:max-h-[min(520px,65dvh)] sm:px-6">
              <div className="mb-4">
                <h3 className="text-base font-black">{selectedGroup.label}</h3>
                <p className="mt-0.5 text-xs font-semibold" style={{ color: muted }}>
                  {selectedGroup.permissions.length} {selectedGroup.permissions.length === 1 ? 'acción autorizada' : 'acciones autorizadas'}
                </p>
              </div>
              <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {selectedGroup.permissions.map((permission) => (
                  <li key={permission.value} title={permission.value} className="flex min-h-10 items-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold" style={{ borderColor: border, background: 'var(--admin-soft-bg, rgba(248, 250, 252, 0.75))' }}>
                    <Check size={15} className="shrink-0" style={{ color: 'var(--admin-primary, #be185d)' }} aria-hidden="true" />
                    <span className="break-words">{permission.actionLabel}</span>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        )}

        <footer className="flex justify-end border-t px-5 py-3 sm:px-6" style={{ borderColor: border }}>
          <button type="button" onClick={onClose} className="rounded-xl px-5 py-2.5 text-sm font-black text-white" style={{ background: 'var(--admin-button-bg, var(--admin-primary, #be185d))' }}>
            Cerrar
          </button>
        </footer>
      </div>
    </div>
  );
}
