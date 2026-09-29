const OPERATION_DETAILS = [
  ['activeStockCount', 'productos con stock', '/admin/inventario', 'Inventario'],
  ['reservedStockCount', 'stock reservado', '/admin/inventario', 'Inventario'],
  ['pendingReservationsCount', 'reservas pendientes', '/admin/inventario', 'Inventario'],
  ['pendingMovementsCount', 'movimientos de inventario pendientes', '/admin/inventario', 'Inventario'],
  ['openCashSessionsCount', 'cajas abiertas', '/admin/caja', 'Caja'],
  ['pendingOrdersCount', 'pedidos pendientes', '/admin/ordenes', 'Órdenes'],
  ['heldSalesCount', 'ventas POS en espera', '/admin/pos', 'POS'],
  ['pendingReturnsCount', 'devoluciones pendientes', '/admin/ordenes', 'Órdenes'],
  ['pendingRefundsCount', 'reembolsos por conciliar', '/admin/ordenes', 'Órdenes'],
  ['pendingExpensesCount', 'gastos o cuentas por pagar pendientes', '/admin/finanzas', 'Finanzas'],
  ['activeBudgetsCount', 'presupuestos activos', '/admin/finanzas', 'Finanzas'],
  ['provisionalPeriodClosesCount', 'cierres financieros provisionales', '/admin/finanzas', 'Finanzas'],
  ['historicalStockRowsCount', 'registros de inventario en el historial', '/admin/inventario', 'Inventario'],
  ['historicalReservationsCount', 'reservas en el historial', '/admin/inventario', 'Inventario'],
  ['historicalMovementsCount', 'movimientos en el historial', '/admin/inventario', 'Inventario'],
  ['historicalCashSessionsCount', 'sesiones de caja en el historial', '/admin/caja', 'Caja'],
  ['historicalOrdersCount', 'pedidos en el historial', '/admin/ordenes', 'Órdenes'],
  ['historicalHeldSalesCount', 'ventas POS en el historial', '/admin/pos', 'POS'],
  ['historicalReturnsCount', 'devoluciones en el historial', '/admin/ordenes', 'Órdenes'],
  ['historicalRefundsCount', 'reembolsos en el historial', '/admin/ordenes', 'Órdenes'],
  ['historicalExpensesCount', 'gastos en el historial', '/admin/finanzas', 'Finanzas'],
  ['historicalBudgetsCount', 'presupuestos en el historial', '/admin/finanzas', 'Finanzas'],
  ['historicalPeriodClosesCount', 'cierres financieros en el historial', '/admin/finanzas', 'Finanzas'],
];

export function getBranchBlockerDetails(data = {}) {
  const details = [];
  const usersCount = Number(data?.usersCount);
  if (Number.isFinite(usersCount) && usersCount > 0) {
    details.push({ key: 'usersCount', count: usersCount, label: 'usuarios asignados',
      href: '/admin/configuracion/usuarios', destination: 'Usuarios' });
  }

  for (const [key, label, href, destination] of OPERATION_DETAILS) {
    const count = Number(data?.operationSummary?.[key]);
    if (!Number.isFinite(count) || count <= 0) continue;
    details.push({ key, count, label, href, destination });
  }
  return details;
}

export function formatBranchOperationMessage(data = {}) {
  const message = data?.message || 'Esta sede tiene operaciones asociadas.';
  const details = getBranchBlockerDetails(data).filter(({ key }) => key !== 'usersCount');
  return details.length
    ? `${message} Operación detectada: ${details.map(({ count, label }) => `${label}: ${count}`).join(', ')}.`
    : message;
}
