// frontend/src/admin/customers/AdminCustomersPageTabbed.jsx

import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Activity,
  AlertCircle,
  BadgeCheck,
  BriefcaseBusiness,
  CalendarClock,
  CreditCard,
  DollarSign,
  Edit3,
  Eye,
  FileText,
  History,
  Loader2,
  Mail,
  MapPin,
  MessageSquareText,
  Phone,
  Plus,
  RefreshCw,
  ReceiptText,
  RotateCcw,
  Save,
  Search,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  Truck,
  UserRound,
  UsersRound,
  WalletCards,
  X,
} from 'lucide-react';
import {
  createAdminCustomer,
  createAdminCustomerFollowUp,
  deleteAdminCustomerFollowUp,
  getAdminCustomer,
  getAdminCustomer360,
  getAdminCustomerCrmAssignees,
  getAdminCustomerFollowUps,
  getAdminCustomers,
  recordAdminCustomerFollowUpResult,
  updateAdminCustomer,
} from '../api/adminCustomersApi';
import {
  CUSTOMER_360_TABS,
  Customer360TabContent,
} from './Customer360Tabs';
import CustomerCrmWorkspace from './CustomerCrmWorkspace';
import CustomerSavedSegments from './CustomerSavedSegments';
import CustomerPrivacyPanel from './CustomerPrivacyPanel';
import CustomerFollowUpResultModal from './CustomerFollowUpResultModal';

const EMPTY_FORM = {
  fullName: '',
  phone: '',
  documentType: 'CC',
  documentNumber: '',
  email: '',
  address: '',
  city: '',
  department: '',
  personType: 'natural',
  businessName: '',
  dv: '',
  municipalityCode: '',
  departmentCode: '',
  tributeCode: 'ZZ',
  taxRegime: '',
  taxResponsibilities: '',
  notes: '',
  crmStage: 'new',
  crmPriority: 'normal',
  crmOwnerAdmin: '',
  crmNextReviewAt: '',
};

const EMPTY_FOLLOW_UP = {
  type: 'whatsapp',
  note: '',
  nextAction: '',
  dueAt: '',
  priority: 'normal',
  assignedToAdmin: '',
};

const SOURCE_FILTERS = [
  { key: 'all', label: 'Todos' },
  { key: 'pos', label: 'POS' },
  { key: 'web', label: 'Web' },
  { key: 'admin', label: 'Admin' },
];

const SEGMENT_FILTERS = [
  { key: 'all', label: 'Todos' },
  { key: 'with-purchases', label: 'Con compras' },
  { key: 'without-purchases', label: 'Sin compras' },
  { key: 'with-email', label: 'Con correo' },
  { key: 'without-email', label: 'Sin correo' },
  { key: 'vip', label: 'VIP' },
  { key: 'recurrent', label: 'Recurrentes' },
  { key: 'at-risk', label: 'En riesgo' },
  { key: 'inactive-customers', label: 'Inactivos' },
  { key: 'high-return', label: 'Alta devolución' },
  { key: 'high-value', label: 'Ticket alto' },
  { key: 'abandoned-cart', label: 'Carrito abandonado' },
];

const CRM_STAGES = [
  ['all', 'Todas las etapas'],
  ['prospect', 'Prospecto'],
  ['new', 'Nuevo'],
  ['active', 'Activo'],
  ['loyal', 'Leal'],
  ['at_risk', 'En riesgo'],
  ['inactive', 'Inactivo'],
  ['won_back', 'Recuperado'],
];

const CRM_PRIORITIES = [
  ['all', 'Todas las prioridades'],
  ['vip', 'VIP'],
  ['high', 'Alta'],
  ['normal', 'Normal'],
  ['low', 'Baja'],
];

const FOLLOW_UP_PRIORITIES = [
  ['urgent', 'Urgente'],
  ['high', 'Alta'],
  ['normal', 'Normal'],
  ['low', 'Baja'],
];

const FOLLOW_UP_TYPES = [
  ['note', 'Nota interna'],
  ['whatsapp', 'WhatsApp'],
  ['call', 'Llamada'],
  ['payment', 'Pago pendiente'],
  ['size_request', 'Solicitud de talla'],
  ['reminder', 'Recordatorio'],
  ['complaint', 'Reclamo'],
  ['task', 'Tarea'],
  ['other', 'Otro'],
];

const moneyFormatter = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
});

function cleanText(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function money(value) {
  return moneyFormatter.format(Number(value || 0));
}

function formatDate(value) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return 'Sin registro';
  return date.toLocaleDateString('es-CO', { year: 'numeric', month: 'short', day: '2-digit' });
}

function customerName(customer = {}) {
  return customer.fullName || customer.displayName || 'Cliente sin nombre';
}

function sourceLabel(value) {
  const source = cleanText(value).toLowerCase();
  if (source === 'pos') return 'POS';
  if (source === 'web') return 'Web';
  if (source === 'admin') return 'Admin';
  return source || 'Admin';
}

function sourceTone(value) {
  const source = cleanText(value).toLowerCase();
  if (source === 'pos') return { text: '#be185d', bg: '#fdf2f8', border: '#f9a8d4' };
  if (source === 'web') return { text: '#0369a1', bg: '#f0f9ff', border: '#bae6fd' };
  return { text: '#6d28d9', bg: '#f5f3ff', border: '#ddd6fe' };
}

function statusTone(value) {
  const status = cleanText(value).toLowerCase();
  if (status === 'done' || status === 'paid' || status === 'active') return { text: '#047857', bg: '#ecfdf5', border: '#bbf7d0' };
  if (status === 'cancelled') return { text: '#64748b', bg: '#f8fafc', border: '#e2e8f0' };
  return { text: '#c2410c', bg: '#fff7ed', border: '#fed7aa' };
}

function toEditForm(customer = {}) {
  const fiscal = customer.fiscalProfile || {};
  return {
    fullName: customer.fullName || customer.displayName || '',
    phone: customer.phone || '',
    documentType: customer.documentType || 'CC',
    documentNumber: customer.documentNumber || '',
    email: customer.email || '',
    address: customer.address || '',
    city: customer.city || '',
    department: customer.department || '',
    personType: fiscal.personType || 'natural',
    businessName: fiscal.businessName || '',
    dv: fiscal.verificationDigit || fiscal.dv || '',
    municipalityCode: fiscal.municipalityCode || '',
    departmentCode: fiscal.departmentCode || '',
    tributeCode: fiscal.tributeCode || 'ZZ',
    taxRegime: fiscal.taxRegime || '',
    taxResponsibilities: Array.isArray(fiscal.taxResponsibilities)
      ? fiscal.taxResponsibilities.join(', ')
      : '',
    notes: customer.notes || '',
    crmStage: customer.crmStage || 'new',
    crmPriority: customer.crmPriority || 'normal',
    crmOwnerAdmin: customer.crmOwnerAdmin?.id || '',
    crmNextReviewAt: customer.crmNextReviewAt
      ? new Date(customer.crmNextReviewAt).toISOString().slice(0, 16)
      : '',
  };
}

function buildLocalSummary(customers = [], total = 0) {
  return customers.reduce((acc, customer) => {
    const stats = customer.stats || {};
    const ordersCount = Number(stats.ordersCount || 0);
    const totalSpent = Number(stats.totalSpent || 0);

    acc.totalCustomers = Number(total || customers.length);
    if (customer.source === 'pos') acc.posCustomers += 1;
    if (customer.source === 'web') acc.webCustomers += 1;
    if (ordersCount > 0) acc.withPurchases += 1;
    if (customer.email) acc.withEmail += 1;
    acc.totalOrders += ordersCount;
    acc.totalSpent += totalSpent;
    return acc;
  }, {
    totalCustomers: Number(total || customers.length),
    posCustomers: 0,
    webCustomers: 0,
    withPurchases: 0,
    withEmail: 0,
    totalOrders: 0,
    totalSpent: 0,
    newestCustomer: customers[0] || null,
  });
}

function Card({ children, className = '', style = {} }) {
  return (
    <section
      className={`rounded-[28px] border ${className}`}
      style={{
        borderColor: 'var(--admin-card-border)',
        background: 'linear-gradient(145deg, rgba(255,255,255,0.98), rgba(255,247,251,0.86))',
        boxShadow: '0 18px 48px rgba(190, 24, 93, 0.08)',
        ...style,
      }}
    >
      {children}
    </section>
  );
}

function IconBox({ icon: Icon }) {
  return (
    <span
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border"
      style={{
        borderColor: 'rgba(236, 72, 153, 0.22)',
        background: 'linear-gradient(135deg, #fff, #fdf2f8)',
        color: 'var(--admin-primary)',
        boxShadow: '0 10px 24px rgba(236, 72, 153, 0.12)',
      }}
    >
      <Icon className="h-5 w-5" />
    </span>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-2 block text-[11px] font-black uppercase tracking-[0.16em]" style={{ color: 'var(--admin-card-muted-text)' }}>{label}</span>
      {children}
    </label>
  );
}

function TextInput(props) {
  return (
    <input
      {...props}
      className={`w-full rounded-2xl border px-4 py-3 text-sm font-bold outline-none ${props.className || ''}`}
      style={{ borderColor: 'rgba(236, 72, 153, 0.26)', background: '#fff', color: 'var(--admin-card-text)', ...(props.style || {}) }}
    />
  );
}

function TextArea(props) {
  return (
    <textarea
      {...props}
      className={`min-h-[88px] w-full resize-none rounded-2xl border px-4 py-3 text-sm font-bold outline-none ${props.className || ''}`}
      style={{ borderColor: 'rgba(236, 72, 153, 0.26)', background: '#fff', color: 'var(--admin-card-text)', ...(props.style || {}) }}
    />
  );
}

function Badge({ children, tone = 'default' }) {
  const styles = {
    primary: { bg: '#fdf2f8', text: '#be185d', border: '#f9a8d4' },
    success: { bg: '#ecfdf5', text: '#047857', border: '#bbf7d0' },
    muted: { bg: '#f8fafc', text: '#64748b', border: '#e2e8f0' },
    warning: { bg: '#fff7ed', text: '#c2410c', border: '#fed7aa' },
    default: { bg: '#fff', text: '#475569', border: '#fbcfe8' },
  }[tone] || { bg: '#fff', text: '#475569', border: '#fbcfe8' };

  return <span className="inline-flex items-center rounded-xl border px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.08em]" style={{ background: styles.bg, color: styles.text, borderColor: styles.border }}>{children}</span>;
}

function MetricCard({ icon: Icon, label, value, helper, highlight = false }) {
  return (
    <div
      className="rounded-[24px] border p-4"
      style={{
        borderColor: highlight ? 'rgba(236,72,153,0.32)' : 'rgba(236,72,153,0.18)',
        background: highlight ? 'linear-gradient(135deg, rgba(236,72,153,0.12), #fff)' : '#fff',
        boxShadow: '0 12px 28px rgba(15, 23, 42, 0.05)',
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-black uppercase tracking-[0.14em]" style={{ color: 'var(--admin-card-muted-text)' }}>{label}</p>
          <p className="mt-2 text-xl font-black leading-tight" style={{ color: highlight ? 'var(--admin-primary)' : 'var(--admin-card-text)' }}>{value}</p>
          {helper ? <p className="mt-2 text-xs font-bold leading-relaxed" style={{ color: 'var(--admin-card-muted-text)' }}>{helper}</p> : null}
        </div>
        {Icon ? <Icon className="h-5 w-5 shrink-0" style={{ color: 'var(--admin-primary)' }} /> : null}
      </div>
    </div>
  );
}

function FilterPill({ active, children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-2xl border px-4 py-2.5 text-xs font-black transition hover:-translate-y-0.5"
      style={{
        borderColor: active ? 'var(--admin-primary)' : 'rgba(236,72,153,0.20)',
        background: active ? 'linear-gradient(135deg, var(--admin-primary), #be185d)' : 'rgba(255,255,255,0.78)',
        color: active ? '#fff' : 'var(--admin-card-text)',
      }}
    >
      {children}
    </button>
  );
}

function CustomerRow({ customer, onOpenDetail }) {
  const stats = customer.stats || {};
  const ordersCount = Number(stats.ordersCount || 0);
  const netSpent = Number(stats.netSpent ?? stats.totalSpent ?? 0);
  const tone = sourceTone(customer.source);

  return (
    <article className="rounded-[26px] border p-4 transition duration-200 hover:-translate-y-0.5" style={{ borderColor: 'rgba(236,72,153,0.18)', background: '#fff', boxShadow: '0 12px 28px rgba(190, 24, 93, 0.06)' }}>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(240px,.85fr)_minmax(260px,.8fr)_110px] xl:items-center">
        <div className="min-w-0">
          <div className="flex items-start gap-4">
            <IconBox icon={UserRound} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-lg font-black leading-tight" style={{ color: 'var(--admin-card-text)' }}>{customerName(customer)}</p>
              <p className="mt-1 truncate text-xs font-bold" style={{ color: 'var(--admin-card-muted-text)' }}>{customer.customerCode || 'Sin código'} · creado {formatDate(customer.createdAt)}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {customer.documentNumber ? <Badge tone="primary">{customer.documentType || 'DOC'} {customer.documentNumber}</Badge> : <Badge tone="muted">Sin documento</Badge>}
                <span className="inline-flex items-center rounded-xl border px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.08em]" style={{ background: tone.bg, color: tone.text, borderColor: tone.border }}>{sourceLabel(customer.source)}</span>
                {ordersCount > 0 ? <Badge tone="success">Comprador</Badge> : <Badge tone="muted">Sin compras</Badge>}
                <Badge tone={customer.crmPriority === 'vip' ? 'primary' : 'default'}>{customer.crmPriority === 'vip' ? 'VIP' : `Prioridad ${customer.crmPriority || 'normal'}`}</Badge>
                <Badge tone={customer.crmStage === 'at_risk' ? 'warning' : 'default'}>{CRM_STAGES.find(([key]) => key === customer.crmStage)?.[1] || 'Nuevo'}</Badge>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border p-4" style={{ borderColor: 'rgba(236,72,153,0.14)', background: 'rgba(255,247,251,0.60)' }}>
          <p className="mb-3 text-xs font-black uppercase tracking-[0.16em]" style={{ color: 'var(--admin-card-muted-text)' }}>Contacto</p>
          <div className="space-y-2 text-xs font-bold" style={{ color: 'var(--admin-card-muted-text)' }}>
            <p className="flex items-center gap-2"><Phone className="h-4 w-4" /><span className="truncate">{customer.phone || 'Sin celular'}</span></p>
            <p className="flex items-center gap-2"><Mail className="h-4 w-4" /><span className="truncate">{customer.email || 'Sin correo'}</span></p>
            <p className="flex items-center gap-2"><CalendarClock className="h-4 w-4" /><span className="truncate">Última compra: {stats.lastPurchaseAt ? formatDate(stats.lastPurchaseAt) : 'sin registro'}</span></p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-3xl border p-4 text-center" style={{ borderColor: 'rgba(236,72,153,0.14)', background: '#fff' }}><p className="text-[11px] font-black uppercase tracking-[0.12em]" style={{ color: 'var(--admin-card-muted-text)' }}>Compras</p><p className="mt-2 text-2xl font-black" style={{ color: 'var(--admin-card-text)' }}>{ordersCount}</p></div>
          <div className="rounded-3xl border p-4 text-center" style={{ borderColor: 'rgba(236,72,153,0.14)', background: '#fff' }}><p className="text-[11px] font-black uppercase tracking-[0.12em]" style={{ color: 'var(--admin-card-muted-text)' }}>POS</p><p className="mt-2 text-2xl font-black" style={{ color: 'var(--admin-card-text)' }}>{Number(stats.posOrdersCount || 0)}</p></div>
          <div className="rounded-3xl border p-4 text-center" style={{ borderColor: 'rgba(236,72,153,0.22)', background: '#fff7fb' }}><p className="text-[11px] font-black uppercase tracking-[0.12em]" style={{ color: 'var(--admin-card-muted-text)' }}>Venta neta</p><p className="mt-2 break-words text-sm font-black leading-tight" style={{ color: 'var(--admin-primary)' }}>{money(netSpent)}</p></div>
        </div>

        <button type="button" onClick={() => onOpenDetail(customer)} className="inline-flex items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-xs font-black transition hover:-translate-y-0.5" style={{ borderColor: 'rgba(236,72,153,0.24)', background: '#fff', color: 'var(--admin-primary)' }}>
          <Eye className="h-4 w-4" /> Detalle
        </button>
      </div>
    </article>
  );
}

function TabButton({ active, icon: Icon, children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap border-b-2 px-4 py-3 text-sm font-black transition lg:w-full lg:justify-start lg:rounded-xl lg:border-b-0 lg:border-l-2"
      style={{
        borderColor: active ? 'var(--admin-primary)' : 'transparent',
        color: active ? 'var(--admin-primary)' : 'var(--admin-card-muted-text)',
        background: active ? 'rgba(253,242,248,0.78)' : 'transparent',
      }}
    >
      <Icon className="h-4 w-4" /> {children}
    </button>
  );
}

function InfoLine({ icon: Icon, label, value }) {
  return (
    <div className="rounded-2xl border p-4" style={{ borderColor: 'rgba(236,72,153,0.14)', background: '#fff' }}>
      <p className="mb-2 flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.14em]" style={{ color: 'var(--admin-card-muted-text)' }}><Icon className="h-4 w-4" /> {label}</p>
      <p className="break-words text-sm font-black" style={{ color: 'var(--admin-card-text)' }}>{value || 'Sin registro'}</p>
    </div>
  );
}

function OrderList({ orders }) {
  if (!orders.length) {
    return <p className="rounded-2xl border p-6 text-sm font-bold" style={{ borderColor: 'rgba(236,72,153,0.16)', color: 'var(--admin-card-muted-text)', background: '#fff' }}>No se encontraron compras asociadas a este cliente.</p>;
  }

  return (
    <div className="space-y-3">
      {orders.map((order) => (
        <article key={order.id} className="grid gap-3 rounded-2xl border p-4 lg:grid-cols-[170px_1fr_140px_120px] lg:items-center" style={{ borderColor: 'rgba(236,72,153,0.16)', background: '#fff' }}>
          <div>
            <p className="font-black" style={{ color: 'var(--admin-card-text)' }}>Orden {order.orderNumber}</p>
            <p className="mt-1 text-xs font-bold" style={{ color: 'var(--admin-card-muted-text)' }}>{formatDate(order.createdAt)} · {sourceLabel(order.source)}</p>
          </div>
          <div className="space-y-1">
            {(order.items || []).slice(0, 3).map((item, index) => (
              <p key={`${order.id}-${index}`} className="text-xs font-bold" style={{ color: 'var(--admin-card-muted-text)' }}>{item.title} · {item.quantity} und. {item.size || item.color ? `· ${item.size || ''} ${item.color || ''}` : ''}</p>
            ))}
          </div>
          <p className="text-sm font-black" style={{ color: 'var(--admin-primary)' }}>{money(order.total)}</p>
          <Badge tone={order.status === 'paid' ? 'success' : 'warning'}>{order.status || 'orden'}</Badge>
        </article>
      ))}
    </div>
  );
}

function FollowUpList({ followUps, onResolve, onDelete }) {
  if (!followUps.length) {
    return <p className="rounded-2xl border p-5 text-sm font-bold" style={{ borderColor: 'rgba(236,72,153,0.16)', color: 'var(--admin-card-muted-text)', background: '#fff' }}>Sin gestiones registradas.</p>;
  }

  return (
    <div className="space-y-3">
      {followUps.map((item) => {
        const tone = statusTone(item.status);
        return (
          <article key={item.id} className="rounded-2xl border p-4" style={{ borderColor: 'rgba(236,72,153,0.16)', background: '#fff' }}>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap gap-2">
                  <span className="rounded-xl border px-3 py-1 text-[11px] font-black uppercase" style={{ borderColor: '#f9a8d4', background: '#fdf2f8', color: '#be185d' }}>{item.typeLabel || item.type || 'Nota'}</span>
                  <span className="rounded-xl border px-3 py-1 text-[11px] font-black uppercase" style={{ borderColor: tone.border, background: tone.bg, color: tone.text }}>{item.statusLabel || item.status || 'Pendiente'}</span>
                  <span className="rounded-xl border border-orange-200 bg-orange-50 px-3 py-1 text-[11px] font-black uppercase text-orange-700">{item.priorityLabel || item.priority || 'Normal'}</span>
                </div>
                <p className="mt-3 text-sm font-black leading-relaxed" style={{ color: 'var(--admin-card-text)' }}>{item.note}</p>
                {item.nextAction ? <p className="mt-2 text-xs font-bold" style={{ color: 'var(--admin-card-muted-text)' }}>Próxima acción: {item.nextAction}</p> : null}
                <p className="mt-2 text-[11px] font-bold" style={{ color: 'var(--admin-card-muted-text)' }}>Responsable: {item.assignedToAdmin?.name || item.createdByAdmin?.name || 'Administrador no identificado'}</p>
                <p className="mt-1 text-[11px] font-bold" style={{ color: 'var(--admin-card-muted-text)' }}>Creado: {formatDate(item.createdAt)}{item.dueAt ? ` · Programado: ${formatDate(item.dueAt)}` : ''}</p>
                {item.outcomeLabel ? <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3"><p className="text-[10px] font-black uppercase text-emerald-700">Resultado: {item.outcomeLabel}</p>{item.outcomeNote ? <p className="mt-1 text-xs font-bold text-emerald-900">{item.outcomeNote}</p> : null}{item.outcomeAt ? <p className="mt-1 text-[10px] font-bold text-emerald-700">{formatDate(item.outcomeAt)} · {item.outcomeByAdmin?.name || 'Administrador'}</p> : null}</div> : null}
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                {item.status === 'pending' ? <button type="button" onClick={() => onResolve(item)} className="rounded-xl border px-3 py-2 text-[11px] font-black" style={{ borderColor: '#bbf7d0', background: '#ecfdf5', color: '#047857' }}>Registrar resultado</button> : null}
                <button type="button" onClick={() => onDelete(item)} className="rounded-xl border px-3 py-2 text-[11px] font-black" style={{ borderColor: '#fecaca', background: '#fef2f2', color: '#b91c1c' }}>Eliminar</button>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}

function CustomerDetailModal({ data, loading, error, onClose, onRefresh, onUpdated }) {
  const customer = data?.customer || null;
  const orders = Array.isArray(data?.recentOrders) ? data.recentOrders : [];
  const stats = customer?.stats || {};
  const [activeTab, setActiveTab] = useState('summary');
  const [editForm, setEditForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState('');
  const [editSuccess, setEditSuccess] = useState('');
  const [followUps, setFollowUps] = useState([]);
  const [followLoading, setFollowLoading] = useState(false);
  const [followError, setFollowError] = useState('');
  const [followForm, setFollowForm] = useState(EMPTY_FOLLOW_UP);
  const [followSaving, setFollowSaving] = useState(false);
  const [resultItem, setResultItem] = useState(null);
  const [crmAssignees, setCrmAssignees] = useState([]);
  const [customer360, setCustomer360] = useState(null);
  const [customer360Loading, setCustomer360Loading] = useState(false);
  const [customer360Error, setCustomer360Error] = useState('');

  const pendingFollowUps = followUps.filter((item) => item.status !== 'done' && item.status !== 'cancelled').length;

  useEffect(() => {
    if (customer?.id) {
      setEditError('');
      setEditSuccess('');
      setActiveTab('summary');
      setCustomer360(null);
      setCustomer360Error('');
      setFollowForm({
        ...EMPTY_FOLLOW_UP,
        assignedToAdmin: customer.crmOwnerAdmin?.id || '',
      });
    }
  }, [customer?.id]);

  useEffect(() => {
    if (customer?.id) setEditForm(toEditForm(customer));
  }, [customer]);

  useEffect(() => {
    if (typeof document === 'undefined') return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow || '';
    };
  }, []);

  useEffect(() => {
    if (!customer?.id) return;
    getAdminCustomerCrmAssignees()
      .then((response) => setCrmAssignees(
        Array.isArray(response?.assignees) ? response.assignees : []
      ))
      .catch(() => setCrmAssignees([]));
  }, [customer?.id]);

  const loadCustomer360Data = async () => {
    if (!customer?.id || customer360Loading) return;
    try {
      setCustomer360Loading(true);
      setCustomer360Error('');
      const response = await getAdminCustomer360(customer.id, {
        historyLimit: 100,
      });
      setCustomer360(response || null);
    } catch (err) {
      setCustomer360Error(
        err?.message || 'No fue posible cargar la ficha 360°.'
      );
      setCustomer360(null);
    } finally {
      setCustomer360Loading(false);
    }
  };

  const selectTab = (tab) => {
    setActiveTab(tab);
    if (CUSTOMER_360_TABS.has(tab) && !customer360 && !customer360Loading) {
      loadCustomer360Data();
    }
  };

  const refreshDetail = async () => {
    if (!customer?.id) return;
    await onRefresh(customer.id);
    if (customer360 || CUSTOMER_360_TABS.has(activeTab)) {
      await loadCustomer360Data();
    }
  };

  const loadFollowUps = async () => {
    if (!customer?.id) return;
    try {
      setFollowLoading(true);
      setFollowError('');
      const response = await getAdminCustomerFollowUps(customer.id, { status: 'all', limit: 30 });
      setFollowUps(Array.isArray(response?.followUps) ? response.followUps : []);
    } catch (err) {
      setFollowError(err?.message || 'No fue posible cargar el seguimiento.');
      setFollowUps([]);
    } finally {
      setFollowLoading(false);
    }
  };

  useEffect(() => {
    loadFollowUps();
  }, [customer?.id]);

  const updateField = (key, value) => setEditForm((prev) => ({ ...prev, [key]: value }));
  const updateFollowField = (key, value) => setFollowForm((prev) => ({ ...prev, [key]: value }));

  const saveChanges = async (event) => {
    event.preventDefault();
    if (!customer?.id) return;
    if (cleanText(editForm.fullName).length < 3) {
      setEditError('El nombre del cliente debe tener al menos 3 caracteres.');
      return;
    }

    try {
      setSaving(true);
      setEditError('');
      setEditSuccess('');
      const fullPayload = {
        ...customer,
        ...editForm,
        displayName: editForm.fullName,
        source: customer.source || 'admin',
        status: customer.status || 'active',
      };
      const response = await updateAdminCustomer(
        customer.id,
        data?.access?.sensitive
          ? fullPayload
          : {
              status: customer.status || 'active',
              tags: customer.tags || [],
              crmStage: editForm.crmStage,
              crmPriority: editForm.crmPriority,
              crmOwnerAdmin: editForm.crmOwnerAdmin,
              crmNextReviewAt: editForm.crmNextReviewAt || null,
            }
      );
      const updatedCustomer = response?.customer || null;
      setEditSuccess('Cliente actualizado correctamente.');
      if (updatedCustomer) onUpdated(updatedCustomer);
      await onRefresh(customer.id);
    } catch (err) {
      setEditError(err?.message || 'No fue posible actualizar el cliente.');
    } finally {
      setSaving(false);
    }
  };

  const saveFollowUp = async (event) => {
    event.preventDefault();
    if (!customer?.id) return;
    if (!cleanText(followForm.note)) {
      setFollowError('Debes escribir una nota de seguimiento.');
      return;
    }

    try {
      setFollowSaving(true);
      setFollowError('');
      await createAdminCustomerFollowUp(customer.id, followForm);
      setFollowForm({
        ...EMPTY_FOLLOW_UP,
        assignedToAdmin: customer.crmOwnerAdmin?.id || '',
      });
      await loadFollowUps();
    } catch (err) {
      setFollowError(err?.message || 'No fue posible guardar el seguimiento.');
    } finally {
      setFollowSaving(false);
    }
  };

  const recordFollowUpResult = async (payload) => {
    if (!customer?.id || !resultItem?.id) return;
    try {
      setFollowSaving(true);
      await recordAdminCustomerFollowUpResult(
        customer.id,
        resultItem.id,
        payload
      );
      setResultItem(null);
      await loadFollowUps();
    } finally {
      setFollowSaving(false);
    }
  };

  const removeFollowUp = async (item) => {
    if (!customer?.id || !item?.id) return;
    await deleteAdminCustomerFollowUp(customer.id, item.id);
    await loadFollowUps();
  };

  const modal = (
    <div className="fixed left-0 top-0 z-[99999] flex h-screen w-screen items-center justify-center bg-slate-950/60 p-2 backdrop-blur-sm md:p-4" role="dialog" aria-modal="true" aria-labelledby="customer-detail-title">
      <section className="relative flex h-[calc(100vh-16px)] w-[calc(100vw-16px)] max-w-[1480px] flex-col overflow-hidden rounded-[24px] border md:h-[calc(100vh-34px)] md:w-[calc(100vw-34px)] md:rounded-[30px]" style={{ borderColor: 'rgba(236,72,153,0.28)', background: '#fff', boxShadow: '0 34px 110px rgba(15,23,42,0.34)' }}>
        <header className="shrink-0 border-b px-5 py-4" style={{ borderColor: 'rgba(236,72,153,0.16)', background: 'linear-gradient(135deg, #fff, #fff7fb)' }}>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 items-start gap-4">
              <IconBox icon={UserRound} />
              <div className="min-w-0">
                <p className="text-xs font-black uppercase tracking-[0.18em]" style={{ color: 'var(--admin-primary)' }}>Ficha comercial del cliente</p>
                <h2 id="customer-detail-title" className="mt-1 truncate text-2xl font-black" style={{ color: 'var(--admin-card-text)' }}>{customer ? customerName(customer) : 'Cliente'}</h2>
                <p className="mt-1 truncate text-sm font-bold" style={{ color: 'var(--admin-card-muted-text)' }}>{customer?.customerCode || 'Consultando información...'}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {customer?.id ? <button type="button" onClick={refreshDetail} className="inline-flex items-center gap-2 rounded-2xl border px-4 py-3 text-xs font-black" style={{ borderColor: 'rgba(236,72,153,0.22)', color: 'var(--admin-primary)', background: '#fff' }}><RefreshCw className="h-4 w-4" /> Actualizar</button> : null}
              <button type="button" onClick={onClose} className="inline-flex items-center gap-2 rounded-2xl border px-4 py-3 text-xs font-black" style={{ borderColor: 'rgba(236,72,153,0.22)', color: 'var(--admin-card-text)', background: '#fff' }}><X className="h-4 w-4" /> Cerrar</button>
            </div>
          </div>
        </header>

        <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <nav aria-label="Secciones de la ficha del cliente" className="shrink-0 overflow-x-auto border-b px-3 lg:w-[230px] lg:overflow-y-auto lg:border-b-0 lg:border-r lg:px-3 lg:py-4" style={{ borderColor: 'rgba(236,72,153,0.14)', background: 'linear-gradient(180deg, #fff, #fff7fb)' }}>
          <div className="flex min-w-max gap-1 py-1 lg:min-w-0 lg:flex-col lg:py-0">
            <p className="hidden px-4 pb-2 pt-1 text-[10px] font-black uppercase tracking-[0.18em] lg:block" style={{ color: 'var(--admin-card-muted-text)' }}>Ficha del cliente</p>
            <TabButton active={activeTab === 'summary'} icon={UsersRound} onClick={() => selectTab('summary')}>Resumen</TabButton>
            <TabButton active={activeTab === 'edit'} icon={Edit3} onClick={() => selectTab('edit')}>Datos</TabButton>
            <p className="hidden px-4 pb-2 pt-5 text-[10px] font-black uppercase tracking-[0.18em] lg:block" style={{ color: 'var(--admin-card-muted-text)' }}>Historial comercial</p>
            <TabButton active={activeTab === 'orders'} icon={ShoppingBag} onClick={() => selectTab('orders')}>Compras</TabButton>
            <TabButton active={activeTab === 'payments'} icon={CreditCard} onClick={() => selectTab('payments')}>Pagos</TabButton>
            <TabButton active={activeTab === 'billing'} icon={ReceiptText} onClick={() => selectTab('billing')}>Facturas</TabButton>
            <TabButton active={activeTab === 'returns'} icon={RotateCcw} onClick={() => selectTab('returns')}>Devoluciones</TabButton>
            <TabButton active={activeTab === 'shipping'} icon={Truck} onClick={() => selectTab('shipping')}>Envíos</TabButton>
            <TabButton active={activeTab === 'carts'} icon={ShoppingCart} onClick={() => selectTab('carts')}>Carritos</TabButton>
            <TabButton active={activeTab === 'credit'} icon={WalletCards} onClick={() => selectTab('credit')}>Saldos</TabButton>
            <p className="hidden px-4 pb-2 pt-5 text-[10px] font-black uppercase tracking-[0.18em] lg:block" style={{ color: 'var(--admin-card-muted-text)' }}>Relación y control</p>
            <TabButton active={activeTab === 'follow'} icon={MessageSquareText} onClick={() => selectTab('follow')}>Seguimiento {pendingFollowUps ? `(${pendingFollowUps})` : ''}</TabButton>
            <TabButton active={activeTab === 'activity'} icon={Activity} onClick={() => selectTab('activity')}>Actividad</TabButton>
            <TabButton active={activeTab === 'privacy'} icon={ShieldCheck} onClick={() => selectTab('privacy')}>Privacidad</TabButton>
          </div>
        </nav>

        <main className="min-h-0 min-w-0 flex-1 overflow-hidden bg-[#fff7fb]/40 p-4 lg:p-5">
          {loading ? <div className="flex h-full items-center justify-center rounded-3xl border bg-white" style={{ borderColor: 'rgba(236,72,153,0.18)' }}><div className="text-center"><Loader2 className="mx-auto h-8 w-8 animate-spin" style={{ color: 'var(--admin-primary)' }} /><p className="mt-3 font-black">Cargando detalle...</p></div></div> : null}
          {error ? <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">{error}</div> : null}

          {customer && !loading ? (
            <div className="h-full overflow-hidden">
              {activeTab === 'summary' ? (
                <div className="h-full overflow-y-auto pr-1">
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <MetricCard icon={ShoppingBag} label="Compras" value={Number(stats.ordersCount || 0)} helper={`POS: ${Number(stats.posOrdersCount || 0)} · Web: ${Number(stats.webOrdersCount || 0)}`} />
                    <MetricCard icon={DollarSign} label="Venta bruta" value={money(stats.grossSales ?? stats.totalSpent)} helper={`Reembolsado: ${money(stats.refundedAmount)}`} highlight />
                    <MetricCard icon={CalendarClock} label="Primera compra" value={stats.firstPurchaseAt ? formatDate(stats.firstPurchaseAt) : 'Sin registro'} />
                    <MetricCard icon={History} label="Última compra" value={stats.lastPurchaseAt ? formatDate(stats.lastPurchaseAt) : 'Sin registro'} />
                  </div>
                  <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <MetricCard icon={WalletCards} label="Venta neta" value={money(stats.netSpent ?? stats.totalSpent)} helper={`LTV: ${money(stats.lifetimeValue ?? stats.netSpent ?? stats.totalSpent)}`} highlight />
                    <MetricCard icon={ReceiptText} label="Ticket promedio" value={money(stats.averageTicket)} />
                    <MetricCard icon={RefreshCw} label="Frecuencia" value={stats.purchaseFrequencyDays ? `${stats.purchaseFrequencyDays} días` : 'Sin cálculo'} helper={`${Number(stats.purchasesPerYear || 0)} compra(s) / año`} />
                    <MetricCard icon={RotateCcw} label="Tasa devolución" value={`${Number(stats.returnRate || 0)}%`} helper={`${Number(stats.returnOrdersCount || 0)} orden(es) con devolución`} />
                  </div>

                  <div className="mt-4 grid gap-4 lg:grid-cols-[0.92fr_1.08fr]">
                    <section className="rounded-[26px] border bg-white p-5" style={{ borderColor: 'rgba(236,72,153,0.16)' }}>
                      <h3 className="mb-4 text-sm font-black uppercase tracking-[0.16em]" style={{ color: 'var(--admin-card-muted-text)' }}>Datos principales</h3>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <InfoLine icon={Phone} label="Celular" value={customer.phone} />
                        <InfoLine icon={Mail} label="Correo" value={customer.email} />
                        <InfoLine icon={FileText} label="Documento" value={`${customer.documentType || 'DOC'} ${customer.documentNumber || ''}`} />
                        <InfoLine icon={MapPin} label="Ubicación" value={`${customer.address || 'Sin dirección'}${customer.city ? ` · ${customer.city}` : ''}`} />
                      </div>
                    </section>

                    <section className="rounded-[26px] border bg-white p-5" style={{ borderColor: 'rgba(236,72,153,0.16)' }}>
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <h3 className="text-sm font-black uppercase tracking-[0.16em]" style={{ color: 'var(--admin-card-muted-text)' }}>Estado comercial</h3>
                        <div className="flex flex-wrap gap-2">
                          <Badge tone="primary">{sourceLabel(customer.source)}</Badge>
                          <Badge tone={customer.status === 'active' ? 'success' : 'muted'}>{customer.status || 'active'}</Badge>
                          <Badge tone="primary">{CRM_STAGES.find(([key]) => key === customer.crmStage)?.[1] || 'Nuevo'}</Badge>
                          <Badge tone={customer.crmPriority === 'vip' ? 'primary' : 'default'}>{customer.crmPriority === 'vip' ? 'VIP' : `Prioridad ${customer.crmPriority || 'normal'}`}</Badge>
                          {customer.acceptsMarketing ? <Badge tone="success">Acepta marketing</Badge> : <Badge tone="muted">Sin marketing</Badge>}
                        </div>
                      </div>
                      <p className="mt-3 text-xs font-bold" style={{ color: 'var(--admin-card-muted-text)' }}>Responsable CRM: {customer.crmOwnerAdmin?.name || 'Sin responsable'}{customer.crmNextReviewAt ? ` · Próxima revisión: ${formatDate(customer.crmNextReviewAt)}` : ''}</p>
                      <div className="mt-4 rounded-2xl border p-4" style={{ borderColor: 'rgba(236,72,153,0.14)', background: '#fff7fb' }}>
                        <p className="text-[11px] font-black uppercase tracking-[0.14em]" style={{ color: 'var(--admin-card-muted-text)' }}>Notas internas</p>
                        <p className="mt-2 text-sm font-bold leading-relaxed" style={{ color: 'var(--admin-card-text)' }}>{customer.notes || 'Sin notas internas.'}</p>
                      </div>
                      <button type="button" onClick={() => setActiveTab('follow')} className="mt-4 rounded-2xl px-4 py-3 text-sm font-black text-white" style={{ background: 'var(--admin-primary)' }}>Gestionar seguimiento</button>
                    </section>
                  </div>
                </div>
              ) : null}

              {activeTab === 'edit' ? (
                <form onSubmit={saveChanges} className="h-full overflow-y-auto rounded-[26px] border bg-white p-5" style={{ borderColor: 'rgba(236,72,153,0.16)' }}>
                  <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <h3 className="text-lg font-black" style={{ color: 'var(--admin-card-text)' }}>Editar datos del cliente</h3>
                      <p className="mt-1 text-sm font-bold" style={{ color: 'var(--admin-card-muted-text)' }}>Actualiza información básica sin mezclarla con compras ni seguimiento.</p>
                    </div>
                    <button type="submit" disabled={saving} className="inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-black text-white disabled:opacity-60" style={{ background: 'var(--admin-primary)' }}>
                      {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Guardar cambios
                    </button>
                  </div>
                  {editError ? <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">{editError}</div> : null}
                  {editSuccess ? <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-700">{editSuccess}</div> : null}
                  {!data?.access?.sensitive ? <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-800">Los datos personales y fiscales están enmascarados. Tu perfil puede actualizar la gestión CRM, pero necesita `customers:sensitive` para modificar esos datos.</div> : null}
                  <fieldset disabled={!data?.access?.sensitive} className={!data?.access?.sensitive ? 'opacity-60' : ''}>
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <Field label="Nombre"><TextInput value={editForm.fullName} onChange={(event) => updateField('fullName', event.target.value)} /></Field>
                    <Field label="Celular"><TextInput value={editForm.phone} onChange={(event) => updateField('phone', event.target.value)} /></Field>
                    <Field label="Documento"><TextInput value={editForm.documentNumber} onChange={(event) => updateField('documentNumber', event.target.value)} /></Field>
                    <Field label="Correo"><TextInput value={editForm.email} onChange={(event) => updateField('email', event.target.value)} /></Field>
                    <Field label="Dirección"><TextInput value={editForm.address} onChange={(event) => updateField('address', event.target.value)} /></Field>
                    <Field label="Ciudad"><TextInput value={editForm.city} onChange={(event) => updateField('city', event.target.value)} /></Field>
                    <Field label="Departamento"><TextInput value={editForm.department} onChange={(event) => updateField('department', event.target.value)} /></Field>
                    <Field label="Tipo doc."><select value={editForm.documentType} onChange={(event) => updateField('documentType', event.target.value)} className="w-full rounded-2xl border px-4 py-3 text-sm font-bold outline-none" style={{ borderColor: 'rgba(236,72,153,0.26)', background: '#fff', color: 'var(--admin-card-text)' }}><option value="CC">CC</option><option value="CE">CE</option><option value="TI">TI</option><option value="NIT">NIT</option><option value="PP">Pasaporte</option><option value="PPT">PPT</option><option value="RC">Registro civil</option><option value="OTHER">Otro</option></select></Field>
                  </div>
                  </fieldset>
                  <fieldset disabled={!data?.access?.sensitive} className={`mt-5 rounded-3xl border p-4 ${!data?.access?.sensitive ? 'opacity-60' : ''}`} style={{ borderColor: 'rgba(236,72,153,0.16)', background: '#fff7fb' }}>
                    <h4 className="text-xs font-black uppercase tracking-[0.16em]" style={{ color: 'var(--admin-card-muted-text)' }}>Datos fiscales reutilizables</h4>
                    <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                      <Field label="Tipo de persona"><select value={editForm.personType} onChange={(event) => updateField('personType', event.target.value)} className="w-full rounded-2xl border px-4 py-3 text-sm font-bold outline-none" style={{ borderColor: 'rgba(236,72,153,0.26)', background: '#fff', color: 'var(--admin-card-text)' }}><option value="natural">Natural</option><option value="juridica">Jurídica</option></select></Field>
                      <Field label="Razón social"><TextInput value={editForm.businessName} onChange={(event) => updateField('businessName', event.target.value)} /></Field>
                      <Field label="Dígito verificación"><TextInput value={editForm.dv} maxLength={1} onChange={(event) => updateField('dv', event.target.value.replace(/\D/g, '').slice(0, 1))} /></Field>
                      <Field label="Código municipio"><TextInput value={editForm.municipalityCode} onChange={(event) => updateField('municipalityCode', event.target.value)} /></Field>
                      <Field label="Código departamento"><TextInput value={editForm.departmentCode} onChange={(event) => updateField('departmentCode', event.target.value)} /></Field>
                      <Field label="Código tributo"><TextInput value={editForm.tributeCode} onChange={(event) => updateField('tributeCode', event.target.value)} /></Field>
                      <Field label="Régimen fiscal"><TextInput value={editForm.taxRegime} onChange={(event) => updateField('taxRegime', event.target.value)} /></Field>
                      <Field label="Responsabilidades tributarias"><TextInput value={editForm.taxResponsibilities} onChange={(event) => updateField('taxResponsibilities', event.target.value)} placeholder="R-99-PN, O-13" /></Field>
                    </div>
                  </fieldset>
                  <div className="mt-5 rounded-3xl border p-4" style={{ borderColor: 'rgba(236,72,153,0.16)', background: '#fff' }}>
                    <h4 className="text-xs font-black uppercase tracking-[0.16em]" style={{ color: 'var(--admin-card-muted-text)' }}>Gestión CRM</h4>
                    <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                      <Field label="Etapa"><select value={editForm.crmStage} onChange={(event) => updateField('crmStage', event.target.value)} className="w-full rounded-2xl border px-4 py-3 text-sm font-bold" style={{ borderColor: 'rgba(236,72,153,0.26)', background: '#fff' }}>{CRM_STAGES.filter(([value]) => value !== 'all').map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
                      <Field label="Prioridad"><select value={editForm.crmPriority} onChange={(event) => updateField('crmPriority', event.target.value)} className="w-full rounded-2xl border px-4 py-3 text-sm font-bold" style={{ borderColor: 'rgba(236,72,153,0.26)', background: '#fff' }}>{CRM_PRIORITIES.filter(([value]) => value !== 'all').map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
                      <Field label="Responsable"><select value={editForm.crmOwnerAdmin} onChange={(event) => updateField('crmOwnerAdmin', event.target.value)} className="w-full rounded-2xl border px-4 py-3 text-sm font-bold" style={{ borderColor: 'rgba(236,72,153,0.26)', background: '#fff' }}><option value="">Sin responsable</option>{crmAssignees.map((admin) => <option key={admin.id} value={admin.id}>{admin.name}</option>)}</select></Field>
                      <Field label="Próxima revisión"><TextInput type="datetime-local" value={editForm.crmNextReviewAt} onChange={(event) => updateField('crmNextReviewAt', event.target.value)} /></Field>
                    </div>
                  </div>
                  <div className={!data?.access?.sensitive ? 'mt-4 opacity-60' : 'mt-4'}><Field label="Notas internas"><TextArea disabled={!data?.access?.sensitive} value={editForm.notes} onChange={(event) => updateField('notes', event.target.value)} /></Field></div>
                </form>
              ) : null}

              {activeTab === 'orders' ? (
                <section className="h-full overflow-y-auto rounded-[26px] border bg-white p-5" style={{ borderColor: 'rgba(236,72,153,0.16)' }}>
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-black" style={{ color: 'var(--admin-card-text)' }}>Compras del cliente</h3>
                      <p className="mt-1 text-sm font-bold" style={{ color: 'var(--admin-card-muted-text)' }}>Historial reciente de órdenes POS y web.</p>
                      {orders.length < Number(stats.ordersCount || 0) ? (
                        <p className="mt-1 text-xs font-bold" style={{ color: 'var(--admin-card-muted-text)' }}>
                          Mostrando {orders.length} de {Number(stats.ordersCount || 0)} compras confirmadas.
                        </p>
                      ) : null}
                    </div>
                    <Badge tone="primary">{Number(stats.ordersCount || orders.length)} compra(s)</Badge>
                  </div>
                  <OrderList orders={orders} />
                </section>
              ) : null}

              {activeTab === 'follow' ? (
                <section className="grid h-full gap-4 overflow-hidden lg:grid-cols-[0.82fr_1.18fr]">
                  <form onSubmit={saveFollowUp} className="overflow-y-auto rounded-[26px] border bg-white p-5" style={{ borderColor: 'rgba(236,72,153,0.16)' }}>
                    <h3 className="text-lg font-black" style={{ color: 'var(--admin-card-text)' }}>Nueva gestión</h3>
                    <p className="mt-1 text-sm font-bold" style={{ color: 'var(--admin-card-muted-text)' }}>Registra una acción concreta: WhatsApp, llamada, pago, talla o tarea.</p>
                    {followError ? <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">{followError}</div> : null}
                    <div className="mt-5 grid gap-4 sm:grid-cols-3">
                      <Field label="Tipo"><select value={followForm.type} onChange={(event) => updateFollowField('type', event.target.value)} className="w-full rounded-2xl border px-4 py-3 text-sm font-bold outline-none" style={{ borderColor: 'rgba(236,72,153,0.26)', background: '#fff', color: 'var(--admin-card-text)' }}>{FOLLOW_UP_TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
                      <Field label="Prioridad"><select value={followForm.priority} onChange={(event) => updateFollowField('priority', event.target.value)} className="w-full rounded-2xl border px-4 py-3 text-sm font-bold outline-none" style={{ borderColor: 'rgba(236,72,153,0.26)', background: '#fff', color: 'var(--admin-card-text)' }}>{FOLLOW_UP_PRIORITIES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
                      <Field label="Responsable"><select value={followForm.assignedToAdmin} onChange={(event) => updateFollowField('assignedToAdmin', event.target.value)} className="w-full rounded-2xl border px-4 py-3 text-sm font-bold outline-none" style={{ borderColor: 'rgba(236,72,153,0.26)', background: '#fff', color: 'var(--admin-card-text)' }}><option value="">Sin responsable</option>{crmAssignees.map((admin) => <option key={admin.id} value={admin.id}>{admin.name}</option>)}</select></Field>
                    </div>
                    <div className="mt-4"><Field label="Nota"><TextArea value={followForm.note} onChange={(event) => updateFollowField('note', event.target.value)} placeholder="Ej: Cliente pidió talla 6. Confirmar disponibilidad mañana." /></Field></div>
                    <div className="mt-4 grid gap-4 sm:grid-cols-2">
                      <Field label="Próxima acción"><TextInput value={followForm.nextAction} onChange={(event) => updateFollowField('nextAction', event.target.value)} placeholder="Ej: escribir por WhatsApp" /></Field>
                      <Field label="Fecha"><TextInput type="datetime-local" value={followForm.dueAt} onChange={(event) => updateFollowField('dueAt', event.target.value)} /></Field>
                    </div>
                    <button type="submit" disabled={followSaving} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-black text-white disabled:opacity-60" style={{ background: 'var(--admin-primary)' }}>
                      {followSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Guardar gestión
                    </button>
                  </form>

                  <div className="overflow-y-auto rounded-[26px] border bg-white p-5" style={{ borderColor: 'rgba(236,72,153,0.16)' }}>
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <div>
                        <h3 className="text-lg font-black" style={{ color: 'var(--admin-card-text)' }}>Historial de seguimiento</h3>
                        <p className="mt-1 text-sm font-bold" style={{ color: 'var(--admin-card-muted-text)' }}>{pendingFollowUps} pendiente(s) · {followUps.length} gestión(es)</p>
                      </div>
                      <button type="button" onClick={loadFollowUps} className="rounded-2xl border px-4 py-3 text-xs font-black" style={{ borderColor: 'rgba(236,72,153,0.22)', color: 'var(--admin-primary)', background: '#fff' }}>Actualizar</button>
                    </div>
                    {followLoading ? <div className="rounded-2xl border p-5 text-center text-sm font-black" style={{ borderColor: 'rgba(236,72,153,0.16)', color: 'var(--admin-card-muted-text)' }}>Cargando seguimiento...</div> : <FollowUpList followUps={followUps} onResolve={(item) => setResultItem({ ...item, customerName: customerName(customer) })} onDelete={removeFollowUp} />}
                  </div>
                </section>
              ) : null}

              {activeTab === 'privacy' ? (
                <CustomerPrivacyPanel
                  customer={customer}
                  access={data?.access || {}}
                  onUpdated={onUpdated}
                />
              ) : null}

              <Customer360TabContent
                activeTab={activeTab}
                data={customer360}
                loading={customer360Loading}
                error={customer360Error}
                onRetry={loadCustomer360Data}
              />
              <CustomerFollowUpResultModal item={resultItem} saving={followSaving} onClose={() => setResultItem(null)} onSubmit={recordFollowUpResult} />
            </div>
          ) : null}
        </main>
        </div>
      </section>
    </div>
  );

  return typeof document === 'undefined'
    ? modal
    : createPortal(modal, document.body);
}

export default function AdminCustomersPageTabbed() {
  const [customers, setCustomers] = useState([]);
  const [summary, setSummary] = useState(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const pageLimit = 25;
  const [searchTerm, setSearchTermState] = useState('');
  const [sourceFilter, setSourceFilterState] = useState('all');
  const [segmentFilter, setSegmentFilterState] = useState('all');
  const [crmStageFilter, setCrmStageFilterState] = useState('all');
  const [crmPriorityFilter, setCrmPriorityFilterState] = useState('all');
  const [crmOwnerFilter, setCrmOwnerFilterState] = useState('all');
  const [showCrmWorkspace, setShowCrmWorkspace] = useState(true);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [detailData, setDetailData] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');

  const safeSummary = summary || buildLocalSummary(customers, total);
  const canSave = cleanText(form.fullName).length >= 3;
  const activeSourceLabel = SOURCE_FILTERS.find((item) => item.key === sourceFilter)?.label || 'Todos';
  const activeSegmentLabel = SEGMENT_FILTERS.find((item) => item.key === segmentFilter)?.label || 'Todos';
  const currentSavedFilters = useMemo(() => ({
    status: 'active',
    source: sourceFilter,
    segment: segmentFilter,
    crmStage: crmStageFilter,
    crmPriority: crmPriorityFilter,
    crmOwner: crmOwnerFilter,
  }), [sourceFilter, segmentFilter, crmStageFilter, crmPriorityFilter, crmOwnerFilter]);

  const updateForm = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const setSearchTerm = (value) => {
    setPage(1);
    setSearchTermState(value);
  };
  const setSourceFilter = (value) => {
    setPage(1);
    setSourceFilterState(value);
  };
  const setSegmentFilter = (value) => {
    setPage(1);
    setSegmentFilterState(value);
  };
  const setCrmStageFilter = (value) => {
    setPage(1);
    setCrmStageFilterState(value);
  };
  const setCrmPriorityFilter = (value) => {
    setPage(1);
    setCrmPriorityFilterState(value);
  };
  const setCrmOwnerFilter = (value) => {
    setPage(1);
    setCrmOwnerFilterState(value);
  };

  const loadCustomers = async (
    requestedPage = page,
    q = searchTerm,
    source = sourceFilter,
    segment = segmentFilter,
    crmStage = crmStageFilter,
    crmPriority = crmPriorityFilter,
    crmOwner = crmOwnerFilter
  ) => {
    try {
      setLoading(true);
      setError('');
      const data = await getAdminCustomers({
        q,
        status: 'active',
        source,
        segment,
        crmStage,
        crmPriority,
        crmOwner,
        page: requestedPage,
        limit: pageLimit,
      });
      setCustomers(Array.isArray(data?.customers) ? data.customers : []);
      setSummary(data?.summary || null);
      setTotal(Number(data?.total || 0));
      setPage(Number(data?.page || requestedPage));
      setPages(Math.max(1, Number(data?.pages || 1)));
    } catch (err) {
      setError(err?.message || 'No fue posible cargar los clientes.');
      setCustomers([]);
      setSummary(null);
      setTotal(0);
      setPages(1);
    } finally {
      setLoading(false);
    }
  };

  const openCustomerDetail = async (customer) => {
    if (!customer?.id) return;
    setDetailData({ customer, recentOrders: [] });
    setDetailError('');
    setDetailLoading(true);
    try {
      const data = await getAdminCustomer(customer.id, { ordersLimit: 30 });
      setDetailData(data || { customer, recentOrders: [] });
    } catch (err) {
      setDetailError(err?.message || 'No fue posible cargar el detalle del cliente.');
    } finally {
      setDetailLoading(false);
    }
  };

  const handleCustomerUpdated = (updatedCustomer) => {
    setCustomers((prev) => prev.map((customer) => customer.id === updatedCustomer.id ? { ...customer, ...updatedCustomer } : customer));
    setDetailData((prev) => prev ? { ...prev, customer: { ...prev.customer, ...updatedCustomer } } : prev);
    setSuccess('Cliente actualizado correctamente.');
    loadCustomers(page, searchTerm, sourceFilter, segmentFilter);
  };

  const handleCreateCustomer = async (event) => {
    event.preventDefault();
    if (!canSave) return;

    try {
      setSaving(true);
      setError('');
      setSuccess('');
      const data = await createAdminCustomer({ ...form, source: 'admin', status: 'active' });
      setCustomers((prev) => [data.customer, ...prev.filter((customer) => customer.id !== data.customer.id)]);
      setTotal((prev) => prev + 1);
      setForm(EMPTY_FORM);
      setShowForm(false);
      setSuccess('Cliente creado correctamente.');
      setPage(1);
      await loadCustomers(1, searchTerm, sourceFilter, segmentFilter);
    } catch (err) {
      setError(err?.message || 'No fue posible crear el cliente.');
    } finally {
      setSaving(false);
    }
  };

  const resetFilters = () => {
    setPage(1);
    setSourceFilter('all');
    setSegmentFilter('all');
    setCrmStageFilter('all');
    setCrmPriorityFilter('all');
    setCrmOwnerFilter('all');
    setSearchTerm('');
  };

  const applySavedSegment = (filters = {}) => {
    setPage(1);
    setSourceFilterState(filters.source || 'all');
    setSegmentFilterState(filters.segment || 'all');
    setCrmStageFilterState(filters.crmStage || 'all');
    setCrmPriorityFilterState(filters.crmPriority || 'all');
    setCrmOwnerFilterState(filters.crmOwner || 'all');
  };

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      loadCustomers(
        page,
        searchTerm,
        sourceFilter,
        segmentFilter,
        crmStageFilter,
        crmPriorityFilter,
        crmOwnerFilter
      );
    }, 350);
    return () => window.clearTimeout(timeout);
  }, [
    page,
    searchTerm,
    sourceFilter,
    segmentFilter,
    crmStageFilter,
    crmPriorityFilter,
    crmOwnerFilter,
  ]);

  return (
    <div className="min-h-full space-y-5">
      {detailData ? <CustomerDetailModal data={detailData} loading={detailLoading} error={detailError} onClose={() => setDetailData(null)} onRefresh={(customerId) => openCustomerDetail({ id: customerId })} onUpdated={handleCustomerUpdated} /> : null}

      <Card className="overflow-hidden p-5 lg:p-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex items-start gap-4"><IconBox icon={UserRound} /><div><div className="mb-2 inline-flex items-center gap-2 rounded-2xl border px-3 py-1.5 text-xs font-black uppercase tracking-[0.14em]" style={{ borderColor: 'rgba(236,72,153,0.22)', background: 'rgba(255,255,255,0.78)', color: 'var(--admin-primary)' }}><UsersRound className="h-3.5 w-3.5" /> CRM de clientes</div><h1 className="text-2xl font-black tracking-tight lg:text-3xl" style={{ color: 'var(--admin-card-text)' }}>Clientes</h1><p className="mt-1 max-w-2xl text-sm leading-relaxed" style={{ color: 'var(--admin-card-muted-text)' }}>Administra clientes de POS y tienda web con una ficha comercial clara por pestañas.</p></div></div>
          <div className="flex flex-wrap gap-2"><button type="button" onClick={() => setShowCrmWorkspace((current) => !current)} className="inline-flex items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm font-black" style={{ borderColor: 'rgba(236,72,153,0.24)', background: showCrmWorkspace ? '#fdf2f8' : '#fff', color: 'var(--admin-primary)' }}><BriefcaseBusiness className="h-4 w-4" /> {showCrmWorkspace ? 'Ocultar bandeja CRM' : 'Bandeja CRM'}</button><button type="button" onClick={() => loadCustomers(page, searchTerm, sourceFilter, segmentFilter)} disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-60" style={{ borderColor: 'rgba(236,72,153,0.24)', background: '#fff', color: 'var(--admin-primary)' }}>{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Actualizar</button><button type="button" onClick={() => setShowForm((prev) => !prev)} className="inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-black text-white shadow-lg transition hover:-translate-y-0.5" style={{ background: 'linear-gradient(135deg, var(--admin-primary), #be185d)', boxShadow: '0 18px 36px rgba(236,72,153,0.28)' }}><Plus className="h-4 w-4" /> Nuevo cliente</button></div>
        </div>
      </Card>

      {pages > 1 ? (
        <div className="flex flex-wrap items-center justify-end gap-3 rounded-2xl border bg-white px-4 py-3" style={{ borderColor: 'rgba(236,72,153,0.18)' }}>
          <button type="button" disabled={page <= 1 || loading} onClick={() => setPage((current) => Math.max(1, current - 1))} className="rounded-xl border px-4 py-2 text-xs font-black disabled:cursor-not-allowed disabled:opacity-40" style={{ borderColor: 'rgba(236,72,153,0.22)', color: 'var(--admin-primary)' }}>Anterior</button>
          <span className="text-xs font-black" style={{ color: 'var(--admin-card-muted-text)' }}>Página {page} de {pages}</span>
          <button type="button" disabled={page >= pages || loading} onClick={() => setPage((current) => Math.min(pages, current + 1))} className="rounded-xl border px-4 py-2 text-xs font-black disabled:cursor-not-allowed disabled:opacity-40" style={{ borderColor: 'rgba(236,72,153,0.22)', color: 'var(--admin-primary)' }}>Siguiente</button>
        </div>
      ) : null}

      {error ? <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"><AlertCircle className="mt-0.5 h-5 w-5 shrink-0" /><div><p className="font-black">Error</p><p className="mt-1">{error}</p></div></div> : null}
      {success ? <div className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700"><BadgeCheck className="mt-0.5 h-5 w-5 shrink-0" /><div><p className="font-black">Listo</p><p className="mt-1">{success}</p></div></div> : null}

      <div className="grid gap-3 xl:grid-cols-[1.3fr_repeat(4,minmax(0,1fr))]"><MetricCard icon={DollarSign} label="Ventas clientes" value={money(safeSummary.totalSpent)} helper={safeSummary.newestCustomer ? `Último cliente: ${customerName(safeSummary.newestCustomer)}` : 'Sin cliente reciente'} highlight /><MetricCard icon={UsersRound} label="Total clientes" value={safeSummary.totalCustomers || 0} helper={`${safeSummary.withEmail || 0} con correo`} /><MetricCard icon={ShoppingBag} label="Clientes POS" value={safeSummary.posCustomers || 0} helper="Creados desde punto de venta" /><MetricCard icon={ShoppingBag} label="Clientes web" value={safeSummary.webCustomers || 0} helper="Pedidos tienda virtual" /><MetricCard icon={BadgeCheck} label="Con compras" value={safeSummary.withPurchases || 0} helper={`${safeSummary.totalOrders || 0} compras acumuladas`} /></div>

      {showCrmWorkspace ? <CustomerCrmWorkspace onOpenCustomer={openCustomerDetail} /> : null}

      {showForm ? <Card className="p-5"><form className="space-y-4" onSubmit={handleCreateCustomer}><div className="flex items-start justify-between gap-3"><div><h2 className="text-lg font-black" style={{ color: 'var(--admin-card-text)' }}>Crear cliente</h2><p className="mt-1 text-sm" style={{ color: 'var(--admin-card-muted-text)' }}>Este cliente quedará disponible para seleccionarlo en el POS.</p></div><button type="submit" disabled={!canSave} className="inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-60" style={{ background: 'var(--admin-primary)' }}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Guardar</button></div><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"><Field label="Nombre completo"><TextInput value={form.fullName} onChange={(event) => updateForm('fullName', event.target.value)} placeholder="Nombre del cliente" /></Field><Field label="Celular"><TextInput value={form.phone} onChange={(event) => updateForm('phone', event.target.value)} placeholder="3000000000" /></Field><Field label="Tipo documento"><select value={form.documentType} onChange={(event) => updateForm('documentType', event.target.value)} className="w-full rounded-2xl border px-4 py-3 text-sm font-bold outline-none" style={{ borderColor: 'rgba(236,72,153,0.26)', background: '#fff', color: 'var(--admin-card-text)' }}><option value="CC">CC</option><option value="CE">CE</option><option value="TI">TI</option><option value="NIT">NIT</option><option value="PP">Pasaporte</option><option value="OTHER">Otro</option></select></Field><Field label="Documento"><TextInput value={form.documentNumber} onChange={(event) => updateForm('documentNumber', event.target.value)} placeholder="Número" /></Field><Field label="Correo"><TextInput value={form.email} onChange={(event) => updateForm('email', event.target.value)} placeholder="correo@ejemplo.com" /></Field><Field label="Dirección"><TextInput value={form.address} onChange={(event) => updateForm('address', event.target.value)} placeholder="Dirección" /></Field><Field label="Ciudad"><TextInput value={form.city} onChange={(event) => updateForm('city', event.target.value)} placeholder="Ciudad" /></Field><Field label="Departamento"><TextInput value={form.department} onChange={(event) => updateForm('department', event.target.value)} placeholder="Departamento" /></Field></div><Field label="Notas"><TextArea value={form.notes} onChange={(event) => updateForm('notes', event.target.value)} placeholder="Observaciones internas del cliente" /></Field></form></Card> : null}

      <Card className="p-4">
        <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-[1fr_1fr_1fr_auto] xl:items-end">
          <Field label="Etapa CRM"><select value={crmStageFilter} onChange={(event) => setCrmStageFilter(event.target.value)} className="w-full rounded-2xl border bg-white px-4 py-3 text-sm font-bold" style={{ borderColor: 'rgba(236,72,153,0.20)' }}>{CRM_STAGES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
          <Field label="Prioridad CRM"><select value={crmPriorityFilter} onChange={(event) => setCrmPriorityFilter(event.target.value)} className="w-full rounded-2xl border bg-white px-4 py-3 text-sm font-bold" style={{ borderColor: 'rgba(236,72,153,0.20)' }}>{CRM_PRIORITIES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
          <Field label="Responsable"><select value={crmOwnerFilter} onChange={(event) => setCrmOwnerFilter(event.target.value)} className="w-full rounded-2xl border bg-white px-4 py-3 text-sm font-bold" style={{ borderColor: 'rgba(236,72,153,0.20)' }}><option value="all">Todos</option><option value="me">Mis clientes</option></select></Field>
          <button type="button" onClick={resetFilters} className="rounded-2xl border bg-white px-4 py-3 text-xs font-black" style={{ borderColor: 'rgba(236,72,153,0.20)', color: 'var(--admin-primary)' }}>Limpiar filtros</button>
        </div>
      </Card>

      <CustomerSavedSegments
        filters={currentSavedFilters}
        onApply={applySavedSegment}
      />

      <Card className="overflow-hidden"><div className="border-b p-5 lg:p-6" style={{ borderColor: 'rgba(236,72,153,0.18)' }}><div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.7fr)] xl:items-start"><div><p className="text-xs font-black uppercase tracking-[0.18em]" style={{ color: 'var(--admin-card-muted-text)' }}>Segmentación</p><h2 className="mt-1 text-xl font-black" style={{ color: 'var(--admin-card-text)' }}>Listado de clientes</h2><p className="mt-1 text-sm" style={{ color: 'var(--admin-card-muted-text)' }}>{total} cliente(s) encontrado(s) · Origen: {activeSourceLabel} · Segmento: {activeSegmentLabel}</p></div><div className="flex items-center gap-3 rounded-[22px] border px-4 py-3" style={{ borderColor: 'rgba(236,72,153,0.22)', background: 'rgba(255,255,255,0.78)' }}><Search className="h-5 w-5 shrink-0" style={{ color: 'var(--admin-primary)' }} /><input type="text" value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Buscar por nombre, celular, correo o documento" className="w-full bg-transparent text-sm font-bold outline-none" style={{ color: 'var(--admin-card-text)' }} />{loading ? <Loader2 className="h-5 w-5 animate-spin" style={{ color: 'var(--admin-primary)' }} /> : null}</div></div><div className="mt-5 grid gap-3 xl:grid-cols-2"><div className="rounded-[24px] border p-4" style={{ borderColor: 'rgba(236,72,153,0.16)', background: 'rgba(255,255,255,0.66)' }}><p className="mb-3 text-xs font-black uppercase tracking-[0.18em]" style={{ color: 'var(--admin-card-muted-text)' }}>Origen del cliente</p><div className="flex flex-wrap gap-2">{SOURCE_FILTERS.map((filter) => <FilterPill key={filter.key} active={sourceFilter === filter.key} onClick={() => setSourceFilter(filter.key)}>{filter.label}</FilterPill>)}</div></div><div className="rounded-[24px] border p-4" style={{ borderColor: 'rgba(236,72,153,0.16)', background: 'rgba(255,255,255,0.66)' }}><p className="mb-3 text-xs font-black uppercase tracking-[0.18em]" style={{ color: 'var(--admin-card-muted-text)' }}>Segmento comercial</p><div className="flex flex-wrap gap-2">{SEGMENT_FILTERS.map((filter) => <FilterPill key={filter.key} active={segmentFilter === filter.key} onClick={() => setSegmentFilter(filter.key)}>{filter.label}</FilterPill>)}</div></div></div></div><div className="p-5 lg:p-6">{loading ? <div className="rounded-[28px] border p-10 text-center" style={{ borderColor: 'rgba(236,72,153,0.18)', background: 'rgba(255,255,255,0.68)' }}><Loader2 className="mx-auto h-8 w-8 animate-spin" style={{ color: 'var(--admin-primary)' }} /><p className="mt-3 text-sm font-black" style={{ color: 'var(--admin-card-text)' }}>Cargando clientes...</p></div> : customers.length === 0 ? <div className="rounded-[28px] border p-10 text-center" style={{ borderColor: 'rgba(236,72,153,0.18)', background: 'rgba(255,255,255,0.68)' }}><UserRound className="mx-auto h-9 w-9" style={{ color: 'var(--admin-primary)' }} /><p className="mt-3 text-sm font-black" style={{ color: 'var(--admin-card-text)' }}>No hay clientes para este filtro</p><p className="mx-auto mt-2 max-w-md text-sm" style={{ color: 'var(--admin-card-muted-text)' }}>Cambia el filtro o crea un cliente nuevo.</p></div> : <div className="space-y-4">{customers.map((customer) => <CustomerRow key={customer.id} customer={customer} onOpenDetail={openCustomerDetail} />)}</div>}</div></Card>
    </div>
  );
}
