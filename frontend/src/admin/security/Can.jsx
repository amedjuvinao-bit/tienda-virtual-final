// frontend/src/admin/security/Can.jsx

import useAdminPermissions from './useAdminPermissions';

export default function Can({
  permission,
  permissions = [],
  any = true,
  fallback = null,
  children,
}) {
  const { can, canAny } = useAdminPermissions();

  const allowed = permission
    ? can(permission)
    : canAny(permissions);

  if (!allowed) {
    return fallback;
  }

  return children;
}