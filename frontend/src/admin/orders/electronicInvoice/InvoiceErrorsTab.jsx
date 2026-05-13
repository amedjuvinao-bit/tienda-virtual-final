// src/admin/orders/electronicInvoice/InvoiceErrorsTab.jsx

import { AlertTriangle, CheckCircle2 } from 'lucide-react';

export default function InvoiceErrorsTab({ invoice }) {
  const errors = normalizeErrors(
    invoice?.errors ||
      invoice?.provider?.raw?.errors ||
      invoice?.provider?.errors ||
      invoice?.data?.errors ||
      invoice?.providerResponse?.data?.data?.errors ||
      invoice?.raw?.data?.errors ||
      invoice?.dianResponse?.raw?.data?.data?.errors ||
      invoice?.dianResponse?.raw?.data?.errors ||
      invoice?.dianResponse?.raw?.errors ||
      {}
  );

  if (!errors.length) {
    return (
      <div
        className="rounded-3xl border p-6"
        style={{
          background: 'var(--admin-success-soft-bg, rgba(34, 197, 94, 0.12))',
          borderColor: 'var(--admin-success-border, rgba(34, 197, 94, 0.25))',
          color: 'var(--admin-success-text, #16a34a)',
        }}
      >
        <div className="flex items-start gap-3">
          <CheckCircle2 size={22} />

          <div>
            <h3 className="font-bold">Sin errores registrados</h3>

            <p
              className="mt-1 text-sm"
              style={{
                color: 'var(--admin-success-text, #16a34a)',
                opacity: 0.85,
              }}
            >
              La factura no tiene errores DIAN/Factus guardados.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {errors.map((error, index) => (
        <div
          key={`${error.code}-${index}`}
          className="rounded-3xl border p-5"
          style={{
            background: 'var(--admin-warning-soft-bg, rgba(245, 158, 11, 0.12))',
            borderColor: 'var(--admin-warning-border, rgba(245, 158, 11, 0.28))',
            color: 'var(--admin-card-text)',
          }}
        >
          <div className="flex items-start gap-3">
            <AlertTriangle
              className="mt-0.5"
              size={22}
              style={{
                color: 'var(--admin-warning-text, #d97706)',
              }}
            />

            <div>
              <p
                className="text-sm font-bold"
                style={{
                  color: 'var(--admin-warning-text, #d97706)',
                }}
              >
                {error.code || `ERROR_${index + 1}`}
              </p>

              <p
                className="mt-2 text-sm"
                style={{
                  color: 'var(--admin-card-muted-text)',
                }}
              >
                {error.message}
              </p>

              {error.raw && (
                <pre
                  className="mt-3 max-h-48 overflow-auto rounded-xl border p-3 text-xs whitespace-pre-wrap"
                  style={{
                    background: 'var(--admin-card-bg)',
                    borderColor: 'var(--admin-card-border)',
                    color: 'var(--admin-card-muted-text)',
                  }}
                >
                  {error.raw}
                </pre>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function normalizeErrors(errors) {
  if (!errors) return [];

  if (Array.isArray(errors)) {
    return errors.flatMap((item, index) => normalizeSingleError(item, `ERROR_${index + 1}`));
  }

  if (typeof errors === 'object') {
    return Object.entries(errors).flatMap(([code, value]) =>
      normalizeSingleError(value, code)
    );
  }

  return [
    {
      code: 'ERROR',
      message: String(errors),
      raw: '',
    },
  ];
}

function normalizeSingleError(value, fallbackCode) {
  if (Array.isArray(value)) {
    return value.flatMap((item, index) =>
      normalizeSingleError(item, `${fallbackCode}_${index + 1}`)
    );
  }

  if (value && typeof value === 'object') {
    const code =
      value.code ||
      value.rule ||
      value.errorCode ||
      value.error_code ||
      value.field ||
      fallbackCode;

    const message =
      value.message ||
      value.detail ||
      value.description ||
      value.error ||
      value.notification ||
      value.value ||
      JSON.stringify(value, null, 2);

    return [
      {
        code: String(code || fallbackCode),
        message: String(message || 'Error reportado por el proveedor.'),
        raw: JSON.stringify(value, null, 2),
      },
    ];
  }

  return [
    {
      code: String(fallbackCode || 'ERROR'),
      message: String(value || 'Error reportado por el proveedor.'),
      raw: '',
    },
  ];
}