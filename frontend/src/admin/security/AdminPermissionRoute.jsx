// frontend/src/admin/security/AdminPermissionRoute.jsx

import { useLocation } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import {
  canAccessAdminPath,
  getRequiredPermissionsForAdminPath,
} from './adminPermissions';

export default function AdminPermissionRoute({ children }) {
  const location = useLocation();
  const { adminUser, authLoading } = useAuth();

  if (authLoading) {
    return (
      <div
        className="flex min-h-[50vh] items-center justify-center rounded-[28px] border p-6 text-center"
        style={{
          background: 'var(--admin-card-bg)',
          borderColor: 'var(--admin-card-border)',
          color: 'var(--admin-card-text)',
        }}
      >
        <p className="text-sm font-semibold">Validando permisos...</p>
      </div>
    );
  }

  const canAccess = canAccessAdminPath(adminUser, location.pathname);

  if (canAccess) {
    return children;
  }

  const requiredPermissions = getRequiredPermissionsForAdminPath(
    location.pathname
  );

  return (
    <div
      className="flex min-h-[60vh] items-center justify-center rounded-[32px] border p-6 text-center shadow-sm"
      style={{
        background: 'var(--admin-glass-bg)',
        borderColor: 'var(--admin-glass-border)',
        color: 'var(--admin-card-text)',
        boxShadow: 'var(--admin-glass-shadow)',
      }}
    >
      <div className="mx-auto max-w-xl">
        <div
          className="mx-auto flex h-16 w-16 items-center justify-center rounded-[24px] border"
          style={{
            background: 'var(--admin-danger-soft-bg)',
            borderColor: 'var(--admin-danger)',
            color: 'var(--admin-danger-text)',
          }}
        >
          <ShieldAlert className="h-8 w-8" />
        </div>

        <h2
          className="mt-5 text-2xl font-black"
          style={{ color: 'var(--admin-card-text)' }}
        >
          Acceso restringido
        </h2>

        <p
          className="mt-2 text-sm leading-6"
          style={{ color: 'var(--admin-card-muted-text)' }}
        >
          Tu perfil administrativo no tiene permiso para ingresar a esta sección
          del panel.
        </p>

        {requiredPermissions.length > 0 && (
          <div
            className="mt-5 rounded-2xl border px-4 py-3 text-left"
            style={{
              background: 'var(--admin-card-bg)',
              borderColor: 'var(--admin-card-border)',
              color: 'var(--admin-card-text)',
            }}
          >
            <p
              className="text-xs font-black uppercase tracking-[0.18em]"
              style={{ color: 'var(--admin-card-muted-text)' }}
            >
              Permiso requerido
            </p>

            <div className="mt-3 flex flex-wrap gap-2">
              {requiredPermissions.map((permission) => (
                <span
                  key={permission}
                  className="rounded-full border px-3 py-1 text-xs font-bold"
                  style={{
                    background: 'var(--admin-danger-soft-bg)',
                    borderColor: 'var(--admin-danger)',
                    color: 'var(--admin-danger-text)',
                  }}
                >
                  {permission}
                </span>
              ))}
            </div>
          </div>
        )}

        <p
          className="mt-4 text-xs leading-5"
          style={{ color: 'var(--admin-card-muted-text)' }}
        >
          Si necesitas acceso, un administrador principal debe modificar los
          permisos de tu perfil.
        </p>
      </div>
    </div>
  );
}