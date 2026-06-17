// frontend/src/admin/dashboard/dashboardMockData.js

export const dashboardQuickActions = [
  {
    id: 'new-order',
    label: 'Nueva orden',
    icon: 'plus',
    path: '/admin/ordenes',
  },
  {
    id: 'new-product',
    label: 'Agregar producto',
    icon: 'tag',
    path: '/admin/productos',
  },
  {
    id: 'reservations',
    label: 'Ver reservas',
    icon: 'calendar',
    path: '/admin/inventario',
  },
  {
    id: 'sales-report',
    label: 'Reporte de ventas',
    icon: 'chart',
    path: '/admin/ordenes',
  },
  {
    id: 'export-data',
    label: 'Exportar datos',
    icon: 'download',
    path: '/admin/inventario',
  },
];

export const dashboardKpis = [
  {
    id: 'income',
    title: 'Ingresos',
    value: '$128,940.00',
    helper: 'vs. semana anterior',
    trend: '+18.5%',
    trendType: 'up',
    icon: 'income',
    accent: 'pink',
    sparkline: [28, 23, 26, 31, 27, 24, 29, 35, 33, 39],
  },
  {
    id: 'new-orders',
    title: 'Pedidos nuevos',
    value: '243',
    helper: 'vs. semana anterior',
    trend: '+12.7%',
    trendType: 'up',
    icon: 'cart',
    accent: 'rose',
    sparkline: [17, 19, 16, 22, 18, 20, 25, 24, 28, 31],
  },
  {
    id: 'active-carts',
    title: 'Carritos activos',
    value: '37',
    helper: 'vs. semana anterior',
    trend: '+9.1%',
    trendType: 'up',
    icon: 'cart-active',
    accent: 'fuchsia',
    sparkline: [10, 15, 13, 18, 16, 14, 21, 18, 23, 20],
  },
  {
    id: 'favorites',
    title: 'Favoritos',
    value: '592',
    helper: 'vs. semana anterior',
    trend: '+15.2%',
    trendType: 'up',
    icon: 'heart',
    accent: 'soft',
    sparkline: [21, 22, 24, 28, 26, 30, 33, 31, 35, 38],
  },
  {
    id: 'low-stock',
    title: 'Stock bajo',
    value: '14',
    helper: 'Productos críticos',
    trend: '',
    trendType: 'warning',
    icon: 'warning',
    accent: 'warning',
    sparkline: [],
  },
];

export const salesChartData = [
  {
    label: 'Lun',
    value: 29000,
  },
  {
    label: 'Mar',
    value: 20000,
  },
  {
    label: 'Mié',
    value: 30000,
  },
  {
    label: 'Jue',
    value: 41230,
  },
  {
    label: 'Vie',
    value: 27000,
  },
  {
    label: 'Sáb',
    value: 42000,
  },
  {
    label: 'Dom',
    value: 38000,
  },
];

export const topProducts = [
  {
    id: 'top-1',
    name: 'Vestido Elegancia Rosa',
    sku: 'VER-001',
    sales: 87,
    income: '$20,880.00',
    trend: [12, 15, 13, 18, 17, 22, 25],
    image:
      'https://images.unsplash.com/photo-1519238263530-99bdd11df2ea?auto=format&fit=crop&w=120&q=80',
  },
  {
    id: 'top-2',
    name: 'Blusa Satinada Perla',
    sku: 'BSP-002',
    sales: 65,
    income: '$14,625.00',
    trend: [8, 12, 11, 16, 14, 18, 20],
    image:
      'https://images.unsplash.com/photo-1520975682031-a5d3b31f260b?auto=format&fit=crop&w=120&q=80',
  },
  {
    id: 'top-3',
    name: 'Bolso Rosa Chic',
    sku: 'BRC-003',
    sales: 52,
    income: '$12,480.00',
    trend: [6, 9, 8, 12, 10, 14, 16],
    image:
      'https://images.unsplash.com/photo-1594223274512-ad4803739b7c?auto=format&fit=crop&w=120&q=80',
  },
];

export const dashboardAlerts = [
  {
    id: 'alert-stock',
    title: '14 productos con stock bajo',
    description: 'Revisa el inventario para evitar quiebres.',
    action: 'Revisar',
    type: 'stock',
  },
  {
    id: 'alert-category',
    title: '3 productos sin categoría',
    description: 'Organiza tus productos para mejor visibilidad.',
    action: 'Revisar',
    type: 'category',
  },
  {
    id: 'alert-orders',
    title: '5 órdenes por confirmar',
    description: 'Tienes órdenes pendientes de revisión.',
    action: 'Revisar',
    type: 'orders',
  },
];

export const monthlyGoal = {
  title: 'Meta de ingresos',
  goal: '$250,000.00',
  current: '$128,940.00',
  percentage: 52,
  detail: '$128,940.00 / $250,000.00',
};

export const inventoryByBranch = [
  {
    id: 'branch-main',
    branch: 'Tienda Principal',
    products: 1240,
    percentage: 78,
  },
  {
    id: 'branch-center',
    branch: 'Sucursal Centro',
    products: 890,
    percentage: 64,
  },
  {
    id: 'branch-online',
    branch: 'Tienda Online',
    products: 560,
    percentage: 53,
  },
  {
    id: 'branch-outlet',
    branch: 'Outlet',
    products: 320,
    percentage: 41,
  },
];

export const recentOrders = [
  {
    id: 'ORD-1053',
    customer: 'María García',
    total: '$2,450.00',
    status: 'Confirmada',
    statusType: 'success',
    date: '22 May, 10:45',
  },
  {
    id: 'ORD-1052',
    customer: 'Laura Méndez',
    total: '$1,890.00',
    status: 'Pendiente',
    statusType: 'warning',
    date: '22 May, 09:32',
  },
  {
    id: 'ORD-1051',
    customer: 'Daniela Ruiz',
    total: '$3,120.00',
    status: 'Enviado',
    statusType: 'info',
    date: '21 May, 18:10',
  },
  {
    id: 'ORD-1050',
    customer: 'Andrea Torres',
    total: '$950.00',
    status: 'Cancelada',
    statusType: 'danger',
    date: '21 May, 15:22',
  },
  {
    id: 'ORD-1049',
    customer: 'Sofía Vargas',
    total: '$1,760.00',
    status: 'Confirmada',
    statusType: 'success',
    date: '21 May, 11:05',
  },
];