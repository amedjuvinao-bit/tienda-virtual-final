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

  it('respeta permisos revocados aunque queden copias antiguas del perfil', () => {
    const user = {
      role: 'manager',
      permissions: [],
      roleRef: { permissions: ['orders:view'] },
      profile: { permissions: ['orders:view'] },
    };

    expect(canAccessAdminPath(user, '/admin/ordenes')).toBe(false);
    expect(getAdminLandingPath(user)).toBe('/admin/configuracion/seguridad');
  });

  it('reserva la configuración de respaldos al propietario incluso ante comodines de permisos', () => {
    expect(canAccessAdminPath({ adminRole: 'owner' }, '/admin/configuracion/respaldos')).toBe(true);
    expect(canAccessAdminPath({ adminRole: 'admin', permissions: ['*'] }, '/admin/configuracion/respaldos')).toBe(false);
    expect(canAccessAdminPath({ adminRole: 'manager', permissions: ['settings:store'] }, '/admin/configuracion/respaldos')).toBe(false);
  });
});
