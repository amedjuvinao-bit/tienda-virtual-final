import { AlertCircle, CheckCircle2 } from 'lucide-react';

export default function ElectronicInvoiceModalFeedback({
  retryMessage,
  retryError,
}) {
  if (!retryMessage && !retryError) return null;

  return (
    <div
      className="border-b px-6 py-3"
      style={{
        borderColor: 'var(--admin-card-border)',
        background: retryError
          ? 'var(--admin-danger-soft-bg, rgba(239, 68, 68, 0.12))'
          : 'var(--admin-success-soft-bg, rgba(34, 197, 94, 0.12))',
        color: retryError
          ? 'var(--admin-danger-text, #dc2626)'
          : 'var(--admin-success-text, #16a34a)',
      }}
    >
      <div className="flex items-start gap-2 text-sm font-semibold">
        {retryError ? (
          <AlertCircle size={17} className="mt-0.5 shrink-0" />
        ) : (
          <CheckCircle2 size={17} className="mt-0.5 shrink-0" />
        )}

        <span>{retryError || retryMessage}</span>
      </div>
    </div>
  );
}
