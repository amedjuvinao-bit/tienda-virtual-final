// frontend/src/admin/orders/components/orderDetail/OrderDetailHeader.jsx

import { ORDER_DETAIL_THEME, getOrderStatusMeta } from './orderDetailTheme';
import {
  fmtDate,
  getOrderBranchInfo,
  getOrderSourceLabel,
  getOrderSummary,
  toCOP,
} from './orderDetailUtils';
import { OrderDetailIcons, IconBadge } from './OrderDetailIcons';
import { GhostButton, PrimaryButton, SoftBadge } from './OrderDetailPrimitives';

export default function OrderDetailHeader({
  order,
  onClose,
  onDownloadPdf,
  onOpenInvoice,
  downloadingPdf = false,
  invoiceLoading = false,
}) {
  const status = getOrderStatusMeta(order?.status);
  const branchInfo = getOrderBranchInfo(order);
  const sourceLabel = getOrderSourceLabel(order?.source);
  const summary = getOrderSummary(order);

  return (
    <header
      style={{
        position: 'relative',
        overflow: 'hidden',
        borderBottom: `1px solid ${ORDER_DETAIL_THEME.cardBorder}`,
        background: `
          radial-gradient(circle at top left, color-mix(in srgb, var(--admin-primary) 22%, transparent), transparent 34%),
          linear-gradient(135deg, var(--admin-card-bg), var(--admin-primary-soft-bg), var(--admin-card-bg))
        `,
        color: ORDER_DETAIL_THEME.cardText,
        padding: '24px 26px 22px',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          opacity: 0.42,
          background:
            'linear-gradient(120deg, transparent 0%, color-mix(in srgb, var(--admin-primary) 12%, transparent) 45%, transparent 100%)',
        }}
      />

      <div
        style={{
          position: 'relative',
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) auto',
          gap: 18,
          alignItems: 'start',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 16,
            minWidth: 0,
          }}
        >
          <IconBadge
            icon={OrderDetailIcons.ShoppingBag}
            size={54}
            iconSize={23}
            variant="primary"
          />

          <div style={{ minWidth: 0 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                flexWrap: 'wrap',
              }}
            >
              <h2
                style={{
                  margin: 0,
                  color: ORDER_DETAIL_THEME.cardText,
                  fontSize: 28,
                  fontWeight: 950,
                  letterSpacing: '-0.045em',
                  lineHeight: 1.05,
                }}
              >
                Orden #{order?.orderNumber || '—'}
              </h2>

              <span
                className={status.className}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 7,
                  borderRadius: 999,
                  border: '1px solid',
                  padding: '7px 11px',
                  fontSize: 11,
                  fontWeight: 950,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  lineHeight: 1,
                }}
              >
                <span
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: 999,
                    background: 'currentColor',
                  }}
                />
                {status.label}
              </span>
            </div>

            <div
              style={{
                marginTop: 9,
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                gap: 8,
                color: ORDER_DETAIL_THEME.mutedText,
                fontSize: 12,
                fontWeight: 700,
              }}
            >
              <span>Creada el {fmtDate(order?.createdAt)}</span>
              <span>•</span>
              <span>Canal: {sourceLabel}</span>
              <span>•</span>
              <span>Sede: {branchInfo.name}</span>
            </div>

            <div
              style={{
                marginTop: 14,
                display: 'flex',
                flexWrap: 'wrap',
                gap: 8,
              }}
            >
              <SoftBadge>
                Total {toCOP(summary.total)}
              </SoftBadge>

              <SoftBadge variant={branchInfo.hasBranch ? 'primary' : 'warning'}>
                {branchInfo.code || 'Sin sede'}
              </SoftBadge>

              <SoftBadge variant="neutral">
                {summary.totalItems} unidad(es)
              </SoftBadge>

              <SoftBadge variant="neutral">
                {summary.itemsCount} producto(s)
              </SoftBadge>
            </div>
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: 9,
            flexWrap: 'wrap',
          }}
        >
          <GhostButton
            onClick={onDownloadPdf}
            disabled={downloadingPdf}
            icon={<OrderDetailIcons.Download size={15} strokeWidth={2.4} />}
          >
            {downloadingPdf ? 'Generando...' : 'PDF'}
          </GhostButton>

          <PrimaryButton
            onClick={onOpenInvoice}
            disabled={invoiceLoading}
            icon={<OrderDetailIcons.FileText size={15} strokeWidth={2.4} />}
          >
            {invoiceLoading ? 'Cargando...' : 'Factura'}
          </PrimaryButton>

          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar modal"
            style={{
              width: 40,
              height: 40,
              borderRadius: 15,
              border: `1px solid ${ORDER_DETAIL_THEME.cardBorder}`,
              background: ORDER_DETAIL_THEME.inputBg,
              color: ORDER_DETAIL_THEME.cardText,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'transform 0.16s ease, filter 0.16s ease',
            }}
            onMouseEnter={(event) => {
              event.currentTarget.style.transform = 'translateY(-1px)';
              event.currentTarget.style.filter = 'brightness(1.05)';
            }}
            onMouseLeave={(event) => {
              event.currentTarget.style.transform = 'translateY(0)';
              event.currentTarget.style.filter = 'brightness(1)';
            }}
          >
            <OrderDetailIcons.X size={18} strokeWidth={2.5} />
          </button>
        </div>
      </div>
    </header>
  );
}