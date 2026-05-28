// src/admin/configuracion/sections/PerfilesSection.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import InfoCard from '../components/InfoCard';
import EmptyHint from '../components/EmptyHint';
import {
  getAdminRoles,
  getAdminRolesMeta,
} from '../../api/adminRolesApi';

const MODULE_ORDER = [
  'dashboard',
  'orders',
  'pos',
  'products',
  'inventory',
  'customers',
  'billing',
  'admin-users',
  'roles',
  'branches',
  'settings',
  'reports',
];

function formatScope(scope) {
  const value = String(scope || '').toLowerCase();

  if (value === 'global') return 'Global';
  if (value === 'branch') return 'Por sede';
  if (value === 'own') return 'Propio';

  return scope || 'Sin alcance';
}

function formatStatus(status) {
  const value = String(status || '').toLowerCase();

  if (value === 'active') return 'Activo';
  if (value === 'inactive') return 'Inactivo';

  return status || 'Sin estado';
}

function getStatusClasses(status) {
  const value = String(status || '').toLowerCase();

  if (value === 'active') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  }

  return 'border-slate-200 bg-slate-100 text-slate-600';
}

function getPermissionModule(permission) {
  const text = String(permission || '');
  const [moduleName] = text.split(':');
  return moduleName || 'general';
}

function formatPermissionModule(moduleName) {
  const labels = {
    dashboard: 'Dashboard',
    orders: 'Órdenes',
    pos: 'POS',
    products: 'Productos',
    inventory: 'Inventario',
    customers: 'Clientes',
    billing: 'Facturación',
    'admin-users': 'Usuarios',
    roles: 'Roles',
    branches: 'Sedes',
    settings: 'Configuración',
    reports: 'Reportes',
  };

  return labels[moduleName] || moduleName;
}

function formatPermissionAction(permission) {
  const text = String(permission || '');
  const [, action] = text.split(':');

  const labels = {
    view: 'Ver',
    create: 'Crear',
    update: 'Editar',
    delete: 'Eliminar',
    disable: 'Desactivar',
    cancel: 'Cancelar',
    refund: 'Devolver',
    export: 'Exportar',
    discount: 'Descuento',
    transfer: 'Trasladar',
    adjust: 'Ajustar',
    retry: 'Reintentar',
    'credit-note': 'Nota crédito',
    download: 'Descargar',
  };

  return labels[action] || action || permission;
}

function groupPermissionsByModule(permissions = []) {
  const grouped = {};

  permissions.forEach((permission) => {
    const moduleName = getPermissionModule(permission);

    if (!grouped[moduleName]) {
      grouped[moduleName] = [];
    }

    grouped[moduleName].push(permission);
  });

  return grouped;
}

function sortModuleNames(moduleNames = []) {
  return [...moduleNames].sort((a, b) => {
    const indexA = MODULE_ORDER.indexOf(a);
    const indexB = MODULE_ORDER.indexOf(b);

    if (indexA === -1 && indexB === -1) return a.localeCompare(b);
    if (indexA === -1) return 1;
    if (indexB === -1) return -1;

    return indexA - indexB;
  });
}

function PermissionsModal({ selectedRole, groupedSelectedPermissions, onClose }) {
  const moduleNames = useMemo(() => {
    return sortModuleNames(Object.keys(groupedSelectedPermissions || {}));
  }, [groupedSelectedPermissions]);

  const [activeModule, setActiveModule] = useState('');

  const activePermissions = useMemo(() => {
    if (!activeModule) return [];
    return groupedSelectedPermissions?.[activeModule] || [];
  }, [activeModule, groupedSelectedPermissions]);

  useEffect(() => {
    if (moduleNames.length > 0) {
      setActiveModule((current) => current || moduleNames[0]);
    }
  }, [moduleNames]);

  useEffect(() => {
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
  }, [onClose]);

  if (!selectedRole || typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-pink-950/20 p-4 backdrop-blur-[6px]">
      <button
        type="button"
        aria-label="Cerrar ventana de permisos"
        className="absolute inset-0 h-full w-full cursor-default"
        onClick={onClose}
      />

      <div
        className="relative z-10 flex max-h-[82vh] w-full max-w-5xl flex-col overflow-hidden rounded-[32px] border shadow-2xl"
        style={{
          background: 'var(--admin-card-bg)',
          borderColor: 'var(--admin-card-border)',
          color: 'var(--admin-card-text)',
        }}
      >
        <div
          className="shrink-0 border-b px-5 py-4 md:px-6"
          style={{
            borderColor: 'var(--admin-card-border)',
            background:
              'linear-gradient(135deg, rgba(255,255,255,0.42), rgba(255,255,255,0.10))',
          }}
        >
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <p
                className="text-xs font-black uppercase tracking-[0.25em]"
                style={{ color: 'var(--admin-card-muted-text)' }}
              >
                Permisos del perfil
              </p>

              <h3 className="mt-2 text-2xl font-black">
                {selectedRole.name}
              </h3>

              <p
                className="mt-1 max-w-2xl text-sm leading-6"
                style={{ color: 'var(--admin-card-muted-text)' }}
              >
                {selectedRole.description || 'Sin descripción registrada.'}
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border text-xl font-black transition hover:scale-105"
              style={{
                borderColor: 'var(--admin-card-border)',
                color: 'var(--admin-card-text)',
                background: 'rgba(255,255,255,0.35)',
              }}
            >
              ×
            </button>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-pink-200 bg-pink-50 px-4 py-3 text-center">
              <p className="text-2xl font-black text-pink-700">
                {Array.isArray(selectedRole.permissions)
                  ? selectedRole.permissions.length
                  : 0}
              </p>
              <p className="text-[11px] font-bold uppercase tracking-wide text-pink-600">
                Permisos
              </p>
            </div>

            <div
              className="rounded-2xl border px-4 py-3 text-center"
              style={{ borderColor: 'var(--admin-card-border)' }}
            >
              <p className="text-base font-black">
                {formatScope(selectedRole.scope)}
              </p>
              <p
                className="text-[11px] font-bold uppercase tracking-wide"
                style={{ color: 'var(--admin-card-muted-text)' }}
              >
                Alcance
              </p>
            </div>

            <div
              className="rounded-2xl border px-4 py-3 text-center"
              style={{ borderColor: 'var(--admin-card-border)' }}
            >
              <p className="text-base font-black">
                Nivel {selectedRole.level}
              </p>
              <p
                className="text-[11px] font-bold uppercase tracking-wide"
                style={{ color: 'var(--admin-card-muted-text)' }}
              >
                Jerarquía
              </p>
            </div>
          </div>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[280px_1fr]">
          <aside
            className="min-h-0 border-b p-4 md:border-b-0 md:border-r"
            style={{ borderColor: 'var(--admin-card-border)' }}
          >
            <p
              className="mb-3 text-xs font-black uppercase tracking-[0.22em]"
              style={{ color: 'var(--admin-card-muted-text)' }}
            >
              Módulos
            </p>

            <div className="max-h-[260px] space-y-2 overflow-y-auto pr-1 md:max-h-full">
              {moduleNames.map((moduleName) => {
                const isActive = activeModule === moduleName;
                const count = groupedSelectedPermissions?.[moduleName]?.length || 0;

                return (
                  <button
                    key={moduleName}
                    type="button"
                    onClick={() => setActiveModule(moduleName)}
                    className="flex w-full items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left transition hover:translate-x-0.5"
                    style={{
                      borderColor: isActive
                        ? 'var(--admin-primary)'
                        : 'var(--admin-card-border)',
                      background: isActive
                        ? 'linear-gradient(135deg, rgba(236,72,153,0.16), rgba(255,255,255,0.18))'
                        : 'rgba(255,255,255,0.14)',
                      color: 'var(--admin-card-text)',
                    }}
                  >
                    <span className="font-bold">
                      {formatPermissionModule(moduleName)}
                    </span>

                    <span
                      className="min-w-8 rounded-lg px-2 py-1 text-center text-xs font-black"
                      style={{
                        background: isActive
                          ? 'var(--admin-primary)'
                          : 'rgba(255,255,255,0.35)',
                        color: isActive ? '#ffffff' : 'var(--admin-card-text)',
                      }}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </aside>

          <section className="min-h-0 p-4 md:p-5">
            <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <p
                  className="text-xs font-black uppercase tracking-[0.22em]"
                  style={{ color: 'var(--admin-card-muted-text)' }}
                >
                  Permisos del módulo
                </p>

                <h4 className="mt-1 text-xl font-black">
                  {formatPermissionModule(activeModule)}
                </h4>
              </div>

              <div
                className="rounded-2xl border px-4 py-2 text-sm font-bold"
                style={{
                  borderColor: 'var(--admin-card-border)',
                  background: 'rgba(255,255,255,0.20)',
                }}
              >
                {activePermissions.length} permiso
                {activePermissions.length !== 1 ? 's' : ''}
              </div>
            </div>

            <div
              className="overflow-hidden rounded-2xl border"
              style={{ borderColor: 'var(--admin-card-border)' }}
            >
              <div
                className="grid grid-cols-[150px_1fr] gap-3 border-b px-4 py-3 text-[11px] font-black uppercase tracking-wide"
                style={{
                  borderColor: 'var(--admin-card-border)',
                  color: 'var(--admin-card-muted-text)',
                  background: 'rgba(255,255,255,0.18)',
                }}
              >
                <span>Acción</span>
                <span>Código interno</span>
              </div>

              <div className="max-h-[320px] overflow-y-auto">
                {activePermissions.map((permission, index) => (
                  <div
                    key={permission}
                    className="grid grid-cols-[150px_1fr] gap-3 px-4 py-3 text-sm"
                    style={{
                      borderTop:
                        index === 0 ? 'none' : '1px solid var(--admin-card-border)',
                      background:
                        index % 2 === 0
                          ? 'rgba(255,255,255,0.10)'
                          : 'rgba(255,255,255,0.18)',
                    }}
                  >
                    <div className="font-bold">
                      {formatPermissionAction(permission)}
                    </div>

                    <div
                      className="break-all font-mono text-xs"
                      style={{ color: 'var(--admin-card-muted-text)' }}
                    >
                      {permission}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>

        <div
          className="flex shrink-0 justify-end border-t px-5 py-4 md:px-6"
          style={{ borderColor: 'var(--admin-card-border)' }}
        >
          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl bg-pink-500 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-pink-600"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

export default function PerfilesSection() {
  const [roles, setRoles] = useState([]);
  const [meta, setMeta] = useState(null);
  const [selectedRoleId, setSelectedRoleId] = useState('');
  const [loading, setLoading] = useState(true);
  const [metaLoading, setMetaLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const filteredRoles = useMemo(() => {
    const q = search.trim().toLowerCase();

    if (!q) return roles;

    return roles.filter((role) => {
      const text = [
        role.name,
        role.code,
        role.description,
        role.scope,
        role.status,
        ...(Array.isArray(role.permissions) ? role.permissions : []),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return text.includes(q);
    });
  }, [roles, search]);

  const selectedRole = useMemo(() => {
    return roles.find((role) => role._id === selectedRoleId) || null;
  }, [roles, selectedRoleId]);

  const groupedSelectedPermissions = useMemo(() => {
    if (!selectedRole) return {};
    return groupPermissionsByModule(selectedRole.permissions || []);
  }, [selectedRole]);

  const totalPermissions = useMemo(() => {
    if (Array.isArray(meta?.permissions)) return meta.permissions.length;
    if (meta?.permissions && typeof meta.permissions === 'object') {
      return Object.keys(meta.permissions).length;
    }
    return 0;
  }, [meta]);

  const loadMeta = async () => {
    try {
      setMetaLoading(true);

      const response = await getAdminRolesMeta();

      setMeta(response?.data || null);
    } catch (err) {
      console.error('❌ Error cargando meta de perfiles:', err);
      setError(err?.userMessage || 'No se pudo cargar la información base de perfiles.');
    } finally {
      setMetaLoading(false);
    }
  };

  const loadRoles = async () => {
    try {
      setLoading(true);
      setError('');

      const response = await getAdminRoles({
        page: 1,
        limit: 100,
        sort: 'level',
      });

      setRoles(response?.data || []);
    } catch (err) {
      console.error('❌ Error cargando perfiles:', err);
      setError(err?.userMessage || 'No se pudieron cargar los perfiles.');
    } finally {
      setLoading(false);
    }
  };

  const closePermissionsModal = () => {
    setSelectedRoleId('');
  };

  useEffect(() => {
    loadMeta();
    loadRoles();
  }, []);

  return (
    <div className="grid gap-4">
      <InfoCard
        title="Roles y permisos"
        description="Consulta los perfiles del sistema. Los permisos se revisan por módulo para evitar saturación visual."
      >
        <div className="grid gap-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p
                className="text-sm"
                style={{ color: 'var(--admin-card-muted-text)' }}
              >
                Perfiles cargados: <strong>{filteredRoles.length}</strong>
                {totalPermissions > 0 ? (
                  <> · Permisos disponibles: <strong>{totalPermissions}</strong></>
                ) : null}
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <input
                type="text"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar perfil..."
                className="w-full rounded-xl border px-4 py-2 text-sm outline-none sm:w-72"
                style={{
                  background: 'var(--admin-input-bg)',
                  borderColor: 'var(--admin-card-border)',
                  color: 'var(--admin-card-text)',
                }}
              />

              <button
                type="button"
                onClick={loadRoles}
                disabled={loading}
                className="w-fit rounded-xl bg-pink-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-pink-600 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? 'Actualizando...' : 'Actualizar'}
              </button>
            </div>
          </div>

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
              {error}
            </div>
          )}

          {(loading || metaLoading) && (
            <div
              className="rounded-xl border p-4 text-sm"
              style={{
                borderColor: 'var(--admin-card-border)',
                color: 'var(--admin-card-muted-text)',
              }}
            >
              Cargando roles y permisos...
            </div>
          )}

          {!loading && !metaLoading && filteredRoles.length === 0 && (
            <div
              className="rounded-xl border p-4 text-sm"
              style={{
                borderColor: 'var(--admin-card-border)',
                color: 'var(--admin-card-muted-text)',
              }}
            >
              No hay perfiles para mostrar.
            </div>
          )}

          {!loading && !metaLoading && filteredRoles.length > 0 && (
            <div
              className="overflow-hidden rounded-2xl border"
              style={{ borderColor: 'var(--admin-card-border)' }}
            >
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead
                    style={{
                      background: 'rgba(255,255,255,0.22)',
                      color: 'var(--admin-card-muted-text)',
                    }}
                  >
                    <tr>
                      <th className="px-4 py-3 font-bold">Perfil</th>
                      <th className="px-4 py-3 font-bold">Descripción</th>
                      <th className="px-4 py-3 font-bold">Alcance</th>
                      <th className="px-4 py-3 font-bold">Nivel</th>
                      <th className="px-4 py-3 font-bold">Permisos</th>
                      <th className="px-4 py-3 font-bold">Estado</th>
                      <th className="px-4 py-3 font-bold text-right">Acción</th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredRoles.map((role) => {
                      const permissionsCount = Array.isArray(role.permissions)
                        ? role.permissions.length
                        : 0;

                      return (
                        <tr
                          key={role._id || role.code}
                          className="border-t transition hover:bg-white/20"
                          style={{
                            borderColor: 'var(--admin-card-border)',
                          }}
                        >
                          <td className="px-4 py-3">
                            <div className="flex flex-col gap-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-bold">
                                  {role.name || role.code}
                                </span>

                                {role.isSystem && (
                                  <span className="rounded-full border border-pink-200 bg-pink-50 px-2 py-0.5 text-[11px] font-bold text-pink-700">
                                    Sistema
                                  </span>
                                )}

                                {role.isDefault && (
                                  <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-700">
                                    Predeterminado
                                  </span>
                                )}
                              </div>

                              <span
                                className="text-xs"
                                style={{ color: 'var(--admin-card-muted-text)' }}
                              >
                                Código: {role.code}
                              </span>
                            </div>
                          </td>

                          <td
                            className="max-w-[280px] px-4 py-3 text-sm"
                            style={{ color: 'var(--admin-card-muted-text)' }}
                          >
                            {role.description || 'Sin descripción'}
                          </td>

                          <td className="px-4 py-3">
                            {formatScope(role.scope)}
                          </td>

                          <td className="px-4 py-3">
                            {role.level}
                          </td>

                          <td className="px-4 py-3">
                            <span className="rounded-xl border border-pink-200 bg-pink-50 px-3 py-1 text-xs font-bold text-pink-700">
                              {permissionsCount}
                            </span>
                          </td>

                          <td className="px-4 py-3">
                            <span
                              className={`rounded-xl border px-3 py-1 text-xs font-bold ${getStatusClasses(
                                role.status
                              )}`}
                            >
                              {formatStatus(role.status)}
                            </span>
                          </td>

                          <td className="px-4 py-3 text-right">
                            <button
                              type="button"
                              onClick={() => setSelectedRoleId(role._id)}
                              className="rounded-xl border px-3 py-2 text-xs font-bold transition hover:scale-[1.02]"
                              style={{
                                borderColor: 'var(--admin-card-border)',
                                background: 'rgba(255,255,255,0.24)',
                                color: 'var(--admin-card-text)',
                              }}
                            >
                              Ver permisos
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </InfoCard>

      <EmptyHint
        title="Próximo paso"
        text="Luego conectaremos creación y edición de perfiles personalizados. Por ahora esta vista queda solo para consulta clara de roles y permisos."
      />

      {selectedRole && (
        <PermissionsModal
          selectedRole={selectedRole}
          groupedSelectedPermissions={groupedSelectedPermissions}
          onClose={closePermissionsModal}
        />
      )}
    </div>
  );
}