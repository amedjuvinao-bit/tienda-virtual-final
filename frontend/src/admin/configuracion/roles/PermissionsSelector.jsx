import { useMemo, useState } from 'react';
import { Check, Search } from 'lucide-react';
import { getPermissionGroupsArray, normalizePermissions, togglePermission, togglePermissionGroup } from './rolesHelpers';

const muted = 'var(--admin-card-muted, #6b7280)';
const border = 'var(--admin-border, rgba(0,0,0,0.10))';
const primary = 'var(--admin-button-bg, var(--admin-primary, #be185d))';

export default function PermissionsSelector({
  availablePermissions = [],
  permissionCatalog = [],
  selectedPermissions = [],
  onChange,
  disabled = false,
}) {
  const [showAll, setShowAll] = useState(false);
  const [activeModule, setActiveModule] = useState('');
  const [search, setSearch] = useState('');
  const available = useMemo(() => normalizePermissions(availablePermissions), [availablePermissions]);
  const selected = useMemo(() => normalizePermissions(selectedPermissions), [selectedPermissions]);
  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const groups = useMemo(
    () => getPermissionGroupsArray(available, permissionCatalog),
    [available, permissionCatalog]
  );
  const allModules = showAll || selected.length === 0;
  const visibleGroups = groups.filter((group) => {
    const hasPermission = allModules || group.permissions.some((item) => selectedSet.has(item.value));
    const matches = !search.trim() || group.label.toLocaleLowerCase('es').includes(search.trim().toLocaleLowerCase('es'));
    return hasPermission && matches;
  });
  const active = visibleGroups.find((group) => group.module === activeModule) || visibleGroups[0];
  const activeValues = active?.permissions.map((permission) => permission.value) || [];
  const activeCount = activeValues.filter((value) => selectedSet.has(value)).length;

  function emit(next) {
    if (!disabled) onChange?.(normalizePermissions(next));
  }

  return (
    <section className="min-w-0 rounded-3xl border p-4 sm:p-5" style={{ background: 'var(--admin-card-bg, #fff)', borderColor: border, color: 'var(--admin-card-text, #111827)' }}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-black">¿Qué puede hacer este perfil?</h3>
          <p className="mt-1 text-sm font-medium" style={{ color: muted }}>
            Activa solo las acciones necesarias para su trabajo.
          </p>
        </div>
        <span className="rounded-full px-3 py-1 text-xs font-black" style={{ background: 'rgba(190,24,93,.1)', color: 'var(--admin-primary, #be185d)' }}>
          {selected.length} accesos asignados
        </span>
      </div>

      {groups.length === 0 ? (
        <p className="mt-5 text-sm" style={{ color: muted }}>No hay permisos disponibles para mostrar.</p>
      ) : (
        <>
          <div className="mt-4 flex flex-wrap gap-2" aria-label="Filtrar módulos">
            <button type="button" disabled={disabled || selected.length === 0} onClick={() => { setShowAll(false); setSearch(''); }} aria-pressed={!allModules} className="rounded-xl border px-3 py-2 text-xs font-bold disabled:opacity-50" style={{ borderColor: border, background: !allModules ? primary : 'transparent', color: !allModules ? '#fff' : 'inherit' }}>
              Asignados ({groups.filter((group) => group.permissions.some((permission) => selectedSet.has(permission.value))).length})
            </button>
            <button type="button" disabled={disabled} onClick={() => { setShowAll(true); setSearch(''); }} aria-pressed={allModules} className="rounded-xl border px-3 py-2 text-xs font-bold disabled:opacity-50" style={{ borderColor: border, background: allModules ? primary : 'transparent', color: allModules ? '#fff' : 'inherit' }}>
              Explorar todos ({groups.length})
            </button>
          </div>

          {allModules && (
            <label className="mt-3 flex items-center gap-2 rounded-xl border px-3 py-2" style={{ borderColor: border }}>
              <Search size={16} aria-hidden="true" style={{ color: muted }} />
              <span className="sr-only">Buscar módulos</span>
              <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} disabled={disabled} placeholder="Buscar módulo, por ejemplo: ventas" className="w-full bg-transparent text-sm outline-none" />
            </label>
          )}

          {visibleGroups.length === 0 ? (
            <p className="mt-5 text-sm font-semibold" style={{ color: muted }}>No hay módulos con ese nombre.</p>
          ) : (
            <div className="mt-4 grid min-h-0 gap-4 lg:grid-cols-[190px_minmax(0,1fr)]">
              <nav aria-label="Módulos para asignar permisos" className="flex max-h-[330px] gap-2 overflow-auto pb-1 lg:flex-col lg:pr-1">
                {visibleGroups.map((group) => {
                  const count = group.permissions.filter((permission) => selectedSet.has(permission.value)).length;
                  const current = group.module === active?.module;
                  return (
                    <button key={group.module} type="button" disabled={disabled} onClick={() => setActiveModule(group.module)} aria-current={current ? 'true' : undefined} className="flex min-w-[155px] items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-xs font-bold transition disabled:opacity-50 lg:min-w-0" style={{ background: current ? primary : 'var(--admin-soft-bg, rgba(248,250,252,.75))', color: current ? '#fff' : 'inherit' }}>
                      <span className="line-clamp-2">{group.label}</span>
                      <span className="shrink-0">{count}/{group.permissions.length}</span>
                    </button>
                  );
                })}
              </nav>

              <div className="min-w-0 rounded-2xl border p-4" style={{ borderColor: border, background: 'var(--admin-soft-bg, rgba(248,250,252,.75))' }}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h4 className="text-sm font-black">{active.label}</h4>
                    {active.description && <p className="mt-1 text-xs leading-snug" style={{ color: muted }}>{active.description}</p>}
                    <p className="mt-1 text-xs font-semibold" style={{ color: muted }}>{activeCount} de {active.permissions.length} acciones activas</p>
                  </div>
                  <button type="button" disabled={disabled} onClick={() => emit(togglePermissionGroup(selected, activeValues))} className="rounded-xl border px-3 py-2 text-xs font-bold disabled:opacity-50" style={{ borderColor: border, background: 'var(--admin-card-bg, #fff)' }}>
                    {activeCount === activeValues.length ? 'Quitar módulo' : 'Activar módulo'}
                  </button>
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {active.permissions.map((permission) => {
                    const checked = selectedSet.has(permission.value);
                    return (
                      <button key={permission.value} type="button" disabled={disabled} aria-pressed={checked} onClick={() => emit(togglePermission(selected, permission.value))} className="flex min-w-0 items-start gap-2 rounded-xl border px-3 py-2 text-left transition disabled:opacity-50" style={{ borderColor: checked ? 'var(--admin-primary, #be185d)' : border, background: checked ? 'rgba(190,24,93,.07)' : 'var(--admin-card-bg, #fff)' }}>
                        <span aria-hidden="true" className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border" style={{ borderColor: checked ? 'var(--admin-primary, #be185d)' : border, background: checked ? primary : 'transparent', color: '#fff' }}>{checked && <Check size={12} />}</span>
                        <span className="min-w-0">
                          <span className="block text-xs font-bold leading-snug">{permission.label}</span>
                          {permission.description && <span className="mt-0.5 block text-[11px] leading-snug" style={{ color: muted }}>{permission.description}</span>}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}
