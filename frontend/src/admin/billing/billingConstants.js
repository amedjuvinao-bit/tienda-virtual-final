import {
  BarChart3,
  ClipboardList,
  FileText,
  ReceiptText,
  RotateCcw,
  Settings2,
} from 'lucide-react';

export const BASE_PATH = '/admin/facturacion';

export const BILLING_TABS = [
  {
    id: 'resumen',
    label: 'Resumen',
    icon: ReceiptText,
    permission: 'billing:view',
    description: 'Estado general de facturación, pendientes y alertas.',
  },
  {
    id: 'documentos',
    label: 'Documentos',
    icon: FileText,
    permission: 'billing:view',
    description: 'Facturas, comprobantes y soportes generados.',
  },
  {
    id: 'notas-credito',
    label: 'Notas crédito',
    icon: RotateCcw,
    permission: 'billing:view',
    description: 'Bandeja de notas crédito asociadas a facturas electrónicas.',
  },
  {
    id: 'ordenes',
    label: 'Órdenes por facturar',
    icon: ClipboardList,
    permission: 'billing:view',
    description: 'Ventas pagadas que aún requieren comprobante.',
  },
  {
    id: 'reportes',
    label: 'Reportes',
    icon: BarChart3,
    permission: 'billing:view',
    description: 'Ventas, impuestos, notas crédito, estados y exportación por período.',
  },
  {
    id: 'configuracion',
    label: 'Configuración',
    icon: Settings2,
    permission: 'billing:settings',
    description: 'Datos fiscales, proveedor, resolución, impuestos y textos legales.',
  },
];

export const STATUS_OPTIONS = [
  { value: 'all', label: 'Todos' },
  { value: 'pending', label: 'Pendientes' },
  { value: 'processing', label: 'Procesando' },
  { value: 'generated', label: 'Generadas' },
  { value: 'sent', label: 'Enviadas' },
  { value: 'accepted', label: 'Aceptadas' },
  { value: 'validated', label: 'Validadas' },
  { value: 'rejected', label: 'Rechazadas' },
  { value: 'failed', label: 'Fallidas' },
  { value: 'error', label: 'Error' },
];

export const CREDIT_NOTE_STATUS_OPTIONS = [
  { value: 'all', label: 'Todos' },
  { value: 'created', label: 'Creadas' },
  { value: 'processing', label: 'Procesando' },
  { value: 'sent', label: 'Enviadas' },
  { value: 'validated', label: 'Validadas' },
  { value: 'pending', label: 'Pendientes' },
  { value: 'rejected', label: 'Rechazadas' },
  { value: 'failed', label: 'Fallidas' },
];

export const CREDIT_NOTE_TYPE_OPTIONS = [
  { value: 'all', label: 'Todos los tipos' },
  { value: 'total', label: 'Total' },
  { value: 'partial', label: 'Parcial' },
];

export const REPORT_STATUS_OPTIONS = [
  { value: 'all', label: 'Todos los estados' },
  { value: 'validated', label: 'Validados' },
  { value: 'pending', label: 'Pendientes' },
  { value: 'processing', label: 'Procesando' },
  { value: 'generated', label: 'Generados' },
  { value: 'sent', label: 'Enviados' },
  { value: 'rejected', label: 'Rechazados' },
  { value: 'failed', label: 'Fallidos' },
  { value: 'error', label: 'Con error' },
];

export const REPORT_TYPE_OPTIONS = [
  { value: 'all', label: 'Facturas y notas crédito' },
  { value: 'invoice', label: 'Solo facturas' },
  { value: 'credit_note', label: 'Solo notas crédito' },
];
