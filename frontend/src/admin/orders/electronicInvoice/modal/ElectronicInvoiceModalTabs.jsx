import { ELECTRONIC_INVOICE_TABS } from './electronicInvoiceModalUtils';

export default function ElectronicInvoiceModalTabs({
  activeTab,
  onTabChange,
}) {
  return (
    <div
      className="border-b px-6"
      style={{
        borderColor: 'var(--admin-card-border)',
        background: 'var(--admin-modal-bg)',
      }}
    >
      <div className="flex gap-2 overflow-x-auto py-3">
        {ELECTRONIC_INVOICE_TABS.map((tab) => {
          const active = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onTabChange(tab.id)}
              className="whitespace-nowrap rounded-full border px-4 py-2 text-sm font-semibold transition"
              style={{
                background: active
                  ? 'var(--admin-button-bg)'
                  : 'var(--admin-button-soft-bg)',
                color: active
                  ? 'var(--admin-button-text)'
                  : 'var(--admin-button-soft-text)',
                borderColor: active
                  ? 'var(--admin-button-bg)'
                  : 'var(--admin-button-soft-border)',
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
