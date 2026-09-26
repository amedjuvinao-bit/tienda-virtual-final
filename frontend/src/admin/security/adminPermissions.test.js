import { describe, expect, it } from 'vitest';
import { canAccessAdminPath, getAdminLandingPath } from './adminPermissions';

describe('acceso inicial de perfiles administrativos', () => {
  it('envía al catálogo a un perfil que solo puede ver productos', () => {
    const user = { role: 'prueba-acceso', permissions: ['products:view'] };

    expect(canAccessAdminPath(user, '/admin/dashboard')).toBe(false);
    expect(canAccessAdminPath(user, '/admin/productos')).toBe(true);
    expect(canAccessAdminPath(user, '/admin/configuracion/seguridad')).toBe(true);
    expect(getAdminLandingPath(user)).toBe('/admin/productos');
  });

  it('conserva Dashboard para el propietario y ofrece seguridad si no hay módulos', () => {
    expect(getAdminLandingPath({ role: 'owner' })).toBe('/admin/dashboard');
    expect(getAdminLandingPath({ role: 'prueba', permissions: [] })).toBe('/admin/configuracion/seguridad');
  });
});
