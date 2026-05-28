// frontend/src/admin/users/AdminUsersPage.jsx

import { useEffect, useMemo, useState } from 'react';
import {
  getAdminUsers,
  getAdminUsersMeta,
} from '../api/adminUsersApi';

function formatRole(roleCode, roles = []) {
  const found = roles.find((role) => role.code === roleCode);
  return found?.name || roleCode || 'Sin rol';
}

function formatStatus(status) {
  const value = String(status || '').toLowerCase();

  if (value === 'active') return 'Activo';
  if (value === 'inactive') return 'Inactivo';
  if (value === 'blocked') return 'Bloqueado';
  if (value === 'pending') return 'Pendiente';

  return status || 'Sin estado';
}

function getStatusClasses(status) {
  const value = String(status || '').toLowerCase();

  if (value === 'active') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  }

  if (value === 'blocked') {
    return 'border-red-200 bg-red-50 text-red-700';
  }

  if (value === 'inactive') {
    return 'border-slate-200 bg-slate-100 text-slate-600';
  }

  return 'border-amber-200 bg-amber-50 text-amber-700';
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [metaLoading, setMetaLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();

    if (!q) return users;

    return users.filter((user) => {
      const text = [
        user.username,
        user.email,
        user.displayName,
        user.firstName,
        user.lastName,
        user.role,
        user.status,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return text.includes(q);
    });
  }, [users, search]);

  const loadMeta = async () => {
    try {
      setMetaLoading(true);

      const response = await getAdminUsersMeta();

      setRoles(response?.data?.roles || []);
      setBranches(response?.data?.branches || []);
    } catch (err) {
      console.error('❌ Error cargando meta usuarios:', err);
      setError(err?.userMessage || 'No se pudo cargar la información base.');
    } finally {
      setMetaLoading(false);
    }
  };

  const loadUsers = async () => {
    try {
      setLoading(true);
      setError('');

      const response = await getAdminUsers({
        page: 1,
        limit: 50,
        sort: '-createdAt',
      });

      setUsers(response?.data || []);
    } catch (err) {
      console.error('❌ Error cargando usuarios administrativos:', err);
      setError(err?.userMessage || 'No se pudieron cargar los usuarios.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMeta();
    loadUsers();
  }, []);

  return (
    <div className="space-y-6">
      <section
        className="rounded-[28px] border p-6 shadow-sm"
        style={{
          background: 'var(--admin-card-bg)',
          borderColor: 'var(--admin-card-border)',
          color: 'var(--admin-card-text)',
        }}
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p
              className="text-sm font-semibold uppercase tracking-[0.25em]"
              style={{ color: 'var(--admin-card-muted)' }}
            >
              Administración
            </p>

            <h1 className="mt-2 text-2xl font-black md:text-3xl">
              Usuarios administrativos
            </h1>

            <p
              className="mt-2 max-w-2xl text-sm leading-6"
              style={{ color: 'var(--admin-card-muted)' }}
            >
              Gestiona los usuarios internos que pueden entrar al panel,
              asignar roles, sedes y permisos de operación.
            </p>
          </div>

          <button
            type="button"
            onClick={loadUsers}
            disabled={loading}
            className="rounded-2xl px-5 py-3 text-sm font-bold text-white shadow-md transition hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-60"
            style={{
              background:
                'linear-gradient(135deg, var(--admin-primary), var(--admin-accent))',
            }}
          >
            {loading ? 'Actualizando...' : 'Actualizar'}
          </button>
        </div>
      </section>

      <section
        className="rounded-[28px] border p-5 shadow-sm"
        style={{
          background: 'var(--admin-card-bg)',
          borderColor: 'var(--admin-card-border)',
          color: 'var(--admin-card-text)',
        }}
      >
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-black">Listado de usuarios</h2>
            <p
              className="mt-1 text-sm"
              style={{ color: 'var(--admin-card-muted)' }}
            >
              Total cargados: {filteredUsers.length}
            </p>
          </div>

          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por nombre, usuario, correo o rol..."
            className="w-full rounded-2xl border px-4 py-3 text-sm outline-none md:max-w-sm"
            style={{
              background: 'var(--admin-input-bg)',
              borderColor: 'var(--admin-card-border)',
              color: 'var(--admin-card-text)',
            }}
          />
        </div>

        {error && (
          <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            {error}
          </div>
        )}

        {(loading || metaLoading) && (
          <div
            className="mt-6 rounded-2xl border px-4 py-6 text-center text-sm font-semibold"
            style={{
              borderColor: 'var(--admin-card-border)',
              color: 'var(--admin-card-muted)',
            }}
          >
            Cargando usuarios administrativos...
          </div>
        )}

        {!loading && !metaLoading && filteredUsers.length === 0 && (
          <div
            className="mt-6 rounded-2xl border px-4 py-6 text-center text-sm font-semibold"
            style={{
              borderColor: 'var(--admin-card-border)',
              color: 'var(--admin-card-muted)',
            }}
          >
            No hay usuarios para mostrar.
          </div>
        )}

        {!loading && !metaLoading && filteredUsers.length > 0 && (
          <div className="mt-6 overflow-hidden rounded-2xl border"
            style={{ borderColor: 'var(--admin-card-border)' }}
          >
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead
                  style={{
                    background: 'var(--admin-table-head-bg)',
                    color: 'var(--admin-card-muted)',
                  }}
                >
                  <tr>
                    <th className="px-5 py-4 font-black">Usuario</th>
                    <th className="px-5 py-4 font-black">Correo</th>
                    <th className="px-5 py-4 font-black">Rol</th>
                    <th className="px-5 py-4 font-black">Sedes</th>
                    <th className="px-5 py-4 font-black">Estado</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredUsers.map((user) => (
                    <tr
                      key={user._id}
                      className="border-t"
                      style={{ borderColor: 'var(--admin-card-border)' }}
                    >
                      <td className="px-5 py-4">
                        <div className="font-black">
                          {user.displayName ||
                            `${user.firstName || ''} ${user.lastName || ''}`.trim() ||
                            user.username}
                        </div>
                        <div
                          className="mt-1 text-xs"
                          style={{ color: 'var(--admin-card-muted)' }}
                        >
                          @{user.username}
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        {user.email || (
                          <span style={{ color: 'var(--admin-card-muted)' }}>
                            Sin correo
                          </span>
                        )}
                      </td>

                      <td className="px-5 py-4 font-semibold">
                        {formatRole(user.role, roles)}
                      </td>

                      <td className="px-5 py-4">
                        {Array.isArray(user.branches) && user.branches.length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            {user.branches.map((item) => (
                              <span
                                key={item._id || item.branch || item.branchCode}
                                className="rounded-full border px-3 py-1 text-xs font-bold"
                                style={{
                                  borderColor: 'var(--admin-card-border)',
                                  color: 'var(--admin-card-text)',
                                }}
                              >
                                {item.branchName ||
                                  item.branchCode ||
                                  branches.find((branch) => branch._id === item.branch)?.name ||
                                  'Sede'}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span style={{ color: 'var(--admin-card-muted)' }}>
                            Sin sede
                          </span>
                        )}
                      </td>

                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex rounded-full border px-3 py-1 text-xs font-black ${getStatusClasses(
                            user.status
                          )}`}
                        >
                          {formatStatus(user.status)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}