// frontend/src/admin/security/useAdminPermissions.js

import { useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  hasAdminPermission,
  hasAnyAdminPermission,
  canAccessAdminPath,
  getAdminUserPermissions,
  getAdminUserRole,
  isPrivilegedAdmin,
} from './adminPermissions';

export default function useAdminPermissions() {
  const { adminUser } = useAuth();

  const permissions = useMemo(() => {
    return Array.from(getAdminUserPermissions(adminUser));
  }, [adminUser]);

  const role = useMemo(() => {
    return getAdminUserRole(adminUser);
  }, [adminUser]);

  const isPrivileged = useMemo(() => {
    return isPrivilegedAdmin(adminUser);
  }, [adminUser]);

  const can = (permission) => {
    return hasAdminPermission(adminUser, permission);
  };

  const canAny = (requiredPermissions = []) => {
    return hasAnyAdminPermission(adminUser, requiredPermissions);
  };

  const canAccess = (pathname) => {
    return canAccessAdminPath(adminUser, pathname);
  };

  return {
    adminUser,
    role,
    permissions,
    isPrivileged,
    can,
    canAny,
    canAccess,
  };
}