// frontend/src/admin/billing/AdminBillingPage.jsx
import React, { useMemo } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { ReceiptText } from 'lucide-react';

import FacturacionSection from '../configuracion/sections/FacturacionSection';
import useAdminPermissions from '../security/useAdminPermissions';
import { BASE_PATH, BILLING_TABS } from './billingConstants';
import BillingCreditNotesPanel from './panels/BillingCreditNotesPanel';
import BillingDocumentsPanel from './panels/BillingDocumentsPanel';
import BillingPendingOrdersPanel from './panels/BillingPendingOrdersPanel';
import BillingReportsPanel from './panels/BillingReportsPanel';
import BillingSummaryPanel from './panels/BillingSummaryPanel';

export default function AdminBillingPage() {
  const location = useLocation();
  const { can } = useAdminPermissions();
  const canView = can('billing:view');
  const canConfigure = can('billing:settings');

  const visibleTabs = useMemo(
    () =>
      BILLING_TABS.filter((tab) =>
        tab.permission === 'billing:settings' ? canConfigure : canView
      ),
    [canConfigure, canView]
  );

  const activeTab = useMemo(() => {
    const parts = location.pathname.split('/').filter(Boolean);
    const last = parts[parts.length - 1];
    return visibleTabs.some((tab) => tab.id === last)
      ? last
      : visibleTabs[0]?.id || 'resumen';
  }, [location.pathname, visibleTabs]);

  const activeData = visibleTabs.find((tab) => tab.id === activeTab) || visibleTabs[0] || BILLING_TABS[0];
  const ActiveIcon = activeData.icon || ReceiptText;

  const renderContent = () => {
    if (activeTab === 'configuracion') {
      return <FacturacionSection />;
    }

    if (activeTab === 'documentos') {
      return <BillingDocumentsPanel />;
    }

    if (activeTab === 'notas-credito') {
      return <BillingCreditNotesPanel />;
    }

    if (activeTab === 'ordenes') {
      return <BillingPendingOrdersPanel />;
    }

    if (activeTab === 'reportes') {
      return <BillingReportsPanel />;
    }

    return <BillingSummaryPanel />;
  };

  return (
    <div className="mx-auto grid max-w-7xl gap-5 p-3 md:p-5">
      <section className="overflow-hidden rounded-[32px] border shadow-sm" style={{ background: 'var(--admin-card-bg)', borderColor: 'var(--admin-card-border)', color: 'var(--admin-card-text)' }}>
        <div className="flex flex-col gap-4 border-b p-5 md:flex-row md:items-center md:justify-between md:p-6" style={{ borderColor: 'var(--admin-card-border)' }}>
          <div className="flex items-start gap-4">
            <span className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-3xl border" style={{ borderColor: 'var(--admin-card-border)', background: 'var(--admin-soft-bg)' }}>
              <ActiveIcon className="h-6 w-6" />
            </span>
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.2em]" style={{ color: 'var(--admin-accent, #ec4899)' }}>Facturación</p>
              <h1 className="mt-1 text-3xl font-black">{activeData.label}</h1>
              <p className="mt-1 max-w-3xl text-sm font-semibold leading-6" style={{ color: 'var(--admin-card-muted-text)' }}>{activeData.description}</p>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto border-b px-4 py-3 md:px-5" style={{ borderColor: 'var(--admin-card-border)' }}>
          <nav className="flex min-w-max items-center gap-1.5" aria-label="Secciones de facturación">
            {visibleTabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <NavLink
                  key={tab.id}
                  to={`${BASE_PATH}/${tab.id}`}
                  className="inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-2xl border px-3 py-2 text-xs font-black transition"
                  style={({ isActive }) => ({
                    borderColor: isActive ? 'var(--admin-accent, #ec4899)' : 'var(--admin-card-border)',
                    background: isActive ? 'var(--admin-active-nav-bg)' : 'var(--admin-soft-bg)',
                    color: isActive ? 'var(--admin-active-nav-text)' : 'var(--admin-card-text)',
                  })}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span>{tab.label}</span>
                </NavLink>
              );
            })}
          </nav>
        </div>

        <div className="p-5 md:p-6">{renderContent()}</div>
      </section>
    </div>
  );
}
