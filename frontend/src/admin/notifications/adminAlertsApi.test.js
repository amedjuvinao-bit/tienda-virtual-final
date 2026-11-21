import { describe, expect, it } from 'vitest';
import { getAdminAlertSources } from './adminAlertsApi';

const ownerSources = getAdminAlertSources({ role: 'owner' });
const source = (id) => ownerSources.find((entry) => entry.id === id);

describe('alertas de los procesos del panel', () => {
  it('limita la PQR a propietario y administrador y respeta los permisos de otros módulos', () => {
    const limited = getAdminAlertSources({ role: 'operator', permissions: ['inventory:view', 'billing:settings'] });
    expect(limited.map((item) => item.id)).toEqual(['inventory', 'security']);
    expect(source('pqr')).toBeDefined();
    expect(getAdminAlertSources({ role: 'admin' }).some((item) => item.id === 'pqr')).toBe(true);
  });

  it('enlaza la PQR por identificador y muestra si hay más radicados recibidos', () => {
    const id = '507f1f77bcf86cd799439011';
    const rows = source('pqr').alerts({ count: 3, cases: [{ id, reference: 'PQR-1' }] });
    expect(rows[0]).toMatchObject({
      reference: 'PQR-1',
      href: `/admin/ordenes/reclamos?radicado=${id}`,
    });
    expect(rows[1]).toMatchObject({ count: 2, href: '/admin/ordenes/reclamos' });
  });

  it('envía cada aviso operativo al flujo que puede atenderlo y omite los contadores vacíos', () => {
    const id = '507f1f77bcf86cd799439011';
    expect(source('orders').alerts({ operational: { dispatch: 4 } })).toEqual([
      expect.objectContaining({ count: 4, href: '/admin/ordenes?vista=dispatch' }),
    ]);
    expect(source('post-sale').alerts({ refunds: [{ _id: id, order: id, refundNumber: 'R-1' }] })).toEqual([
      expect.objectContaining({ href: `/admin/ordenes?openOrder=${id}&pestana=payment&registro=${id}`, reference: 'R-1' }),
    ]);
    expect(source('billing').alerts({ data: { pending: 1, errors: 0 } })).toEqual([
      expect.objectContaining({ href: '/admin/facturacion/ordenes' }),
    ]);
    expect(source('inventory').alerts({ data: { summary: { expiredReservations: 2 } } })).toEqual([
      expect.objectContaining({ href: '/admin/inventario?alertas=1' }),
    ]);
    expect(source('cash').alerts({ sessions: [{ _id: id, branch: id, cashRegisterCode: 'CAJA POS' }] })).toEqual([
      expect.objectContaining({ href: `/admin/caja?sede=${id}&caja=CAJA+POS` }),
    ]);
    expect(source('finance').alerts({ data: { total: 1 } })).toEqual([
      expect.objectContaining({ href: '/admin/finanzas?gastos=pendientes' }),
    ]);
    expect(source('customers').alerts({ summary: { overdue: 1 } })).toEqual([
      expect.objectContaining({ href: '/admin/clientes?seguimiento=overdue' }),
    ]);
    expect(source('catalog').alerts({ image: 2 })).toEqual([
      expect.objectContaining({ href: '/admin/productos?faltante=image' }),
    ]);
    expect(source('security').alerts({ security: { summary: { pendingAlerts: 1 } } })).toEqual([
      expect.objectContaining({ href: '/admin/configuracion/seguridad?alertas=1' }),
    ]);
  });
});
