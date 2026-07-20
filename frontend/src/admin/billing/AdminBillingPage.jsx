// frontend/src/admin/billing/AdminBillingPage.jsx
import React, { useMemo } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  AlertTriangle,
  ClipboardList,
  FileText,
  ReceiptText,
  Settings2,
  Send,
} from 'lucide-react';

import FacturacionSection from '../configuracion/sections/FacturacionSection';

const BILLING_TABS = [
  {
    id: 'resumen',
    label: 'Resumen',
    icon: ReceiptText,
    description: 'Estado general de facturación, pendientes y alertas.',
  },
  {
    id: 'documentos',
    label: 'Documentos',
    icon: FileText,
    description: 'Facturas, comprobantes y soportes generados.',
  },
  {
    id: 'ordenes',
    label: 'Órdenes por facturar',
    icon: ClipboardList,
    description: 'Ventas pagadas que aún requieren comprobante.',
  },
  {
    id: 'configuracion',
    label: 'Configuración',
    icon: Settings2,
    description: 'Datos fiscales, proveedor, resolución, impuestos y textos legales.',
  },
];

const BASE_PATH = '/admin/facturacion';

function formatNumber(value) {
  return Number(value || 0).toLocaleString('es-CO');
}

function BillingMetricCard({ label, value, helper, icon: Icon }) {
  return (
    <article
      className="rounded-[26px] border p-4 shadow-sm"
      style={{
        background: 'var(--admin-card-bg)',
        borderColor: 'var(--admin-card-border)',
        color: 'var(--admin-card-text)',
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p
            className="text-[10px] font-black uppercase tracking-[0.18em]"
            style={{ color: 'var(--admin-card-muted-text)' }}
          >
            {label}
          </p>
          <p className="mt-2 text-2xl font-black">{value}</p>
          <p className="mt-1 text-xs font-semibold" style={{ color: 'var(--admin-card-muted-text)' }}>
            {helper}
          </p>
        </div>
        <span
          className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border"
          style={{
            borderColor: 'var(--admin-card-border)',
            background: 'var(--admin-soft-bg)',
          }}
        >
          <Icon className="h-5 w-5" />
        </span>
      </div>
    </article>
  );
}

function EmptyWorkBlock({ title, text, icon: Icon }) {
  return (
    <section
      className="rounded-[28px] border p-6 text-center shadow-sm"
      style={{
        background: 'var(--admin-card-bg)',
        borderColor: 'var(--admin-card-border)',
        color: 'var(--admin-card-text)',
      }}
    >
      <span
        className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-3xl border"
        style={{
          borderColor: 'var(--admin-card-border)',
          background: 'var(--admin-soft-bg)',
        }}
      >
        <Icon className="h-6 w-6" />
      </span>
      <h3 className="mt-4 text-xl font-black">{title}</h3>
      <p className="mx-auto mt-2 max-w-2xl text-sm font-semibold leading-6" style={{ color: 'var(--admin-card-muted-text)' }}>
        {text}
      </p>
    </section>
  );
}

export default function AdminBillingPage() {
  const location = useLocation();

  const activeTab = useMemo(() => {
    const parts = location.pathname.split('/').filter(Boolean);
    const last = parts[parts.length - 1];
    return BILLING_TABS.some((tab) => tab.id === last) ? last : 'resumen';
  }, [location.pathname]);

  const activeData = BILLING_TABS.find((tab) => tab.id === activeTab) || BILLING_TABS[0];
  const ActiveIcon = activeData.icon || ReceiptText;

  const renderContent = () => {
    if (activeTab === 'configuracion') {
      return <FacturacionSection />;
    }

    if (activeTab === 'documentos') {
      return (
        <EmptyWorkBlock
          icon={FileText}
          title="Documentos de facturación"
          text="Aquí se listarán los comprobantes y facturas generadas desde las órdenes. La configuración ya queda dentro de este mismo módulo para que el administrador no tenga que buscarla en otra pantalla."
        />
      );
    }

    if (activeTab === 'ordenes') {
      return (
        <EmptyWorkBlock
          icon={ClipboardList}
          title="Órdenes por facturar"
          text="Aquí se mostrarán las órdenes pagadas que todavía no tienen comprobante interno o factura electrónica. Desde esta misma vista se generará el documento."
        />
      );
    }

    return (
      <div className="grid gap-5">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <BillingMetricCard
            icon={FileText}
            label="Emitidas"
            value={formatNumber(0)}
            helper="Documentos generados"
          />
          <BillingMetricCard
            icon={ClipboardList}
            label="Pendientes"
            value={formatNumber(0)}
            helper="Órdenes por facturar"
          />
          <BillingMetricCard
            icon={AlertTriangle}
            label="Errores"
            value={formatNumber(0)}
            helper="Emisiones fallidas"
          />
          <BillingMetricCard
            icon={Send}
            label="Proveedor"
            value="Interno"
            helper="Según configuración actual"
          />
        </div>

        <EmptyWorkBlock
          icon={ReceiptText}
          title="Módulo unificado de facturación"
          text="Esta pantalla centraliza la operación de facturación. Conserva la configuración existente y prepara el espacio para documentos, órdenes pendientes, comprobantes PDF y emisión electrónica sin separar al administrador en varios módulos."
        />
      </div>
    );
  };

  return (
    <div className="mx-auto grid max-w-7xl gap-5 p-3 md:p-5">
      <section
        className="overflow-hidden rounded-[32px] border shadow-sm"
        style={{
          background: 'var(--admin-card-bg)',
          borderColor: 'var(--admin-card-border)',
          color: 'var(--admin-card-text)',
        }}
      >
        <div className="flex flex-col gap-4 border-b p-5 md:flex-row md:items-center md:justify-between md:p-6" style={{ borderColor: 'var(--admin-card-border)' }}>
          <div className="flex items-start gap-4">
            <span
              className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-3xl border"
              style={{
                borderColor: 'var(--admin-card-border)',
                background: 'var(--admin-soft-bg)',
              }}
            >
              <ActiveIcon className="h-6 w-6" />
            </span>
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.2em]" style={{ color: 'var(--admin-accent, #ec4899)' }}>
                Facturación
              </p>
              <h1 className="mt-1 text-3xl font-black">{activeData.label}</h1>
              <p className="mt-1 max-w-3xl text-sm font-semibold leading-6" style={{ color: 'var(--admin-card-muted-text)' }}>
                {activeData.description}
              </p>
            </div>
          </div>
        </div>

        <div className="flex gap-2 overflow-x-auto border-b px-5 py-3 md:px-6" style={{ borderColor: 'var(--admin-card-border)' }}>
          {BILLING_TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <NavLink
                key={tab.id}
                to={`${BASE_PATH}/${tab.id}`}
                className="inline-flex items-center gap-2 rounded-2xl border px-4 py-2 text-sm font-black transition"
                style={({ isActive }) => ({
                  borderColor: isActive ? 'var(--admin-accent, #ec4899)' : 'var(--admin-card-border)',
                  background: isActive ? 'var(--admin-active-nav-bg)' : 'var(--admin-soft-bg)',
                  color: isActive ? 'var(--admin-active-nav-text)' : 'var(--admin-card-text)',
                })}
              >
                <Icon className="h-4 w-4" />
                <span className="whitespace-nowrap">{tab.label}</span>
              </NavLink>
            );
          })}
        </div>

        <div className="p-5 md:p-6">{renderContent()}</div>
      </section>
    </div>
  );
}
