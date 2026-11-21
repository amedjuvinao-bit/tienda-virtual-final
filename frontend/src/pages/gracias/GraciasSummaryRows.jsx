import { formatMoneyCop } from "./thanksPageViewModel";

function Row({ children, style, total = false }) {
  return (
    <div className={`gp-summary-row${total ? " total" : ""}`} style={style}>
      {children}
    </div>
  );
}

export default function GraciasSummaryRows({ config, model, detailsOnly = false }) {
  const style = config.style;
  const rowStyle = {
    borderBottomColor: style.panelBorderColor,
    color: style.textPrimaryColor,
  };

  return (
    <div
      className="gp-summary-rows"
      style={{ borderColor: style.panelBorderColor }}
    >
      {!detailsOnly && config.showOrderNumber && (
        <Row
          style={{
            ...rowStyle,
            backgroundColor: `color-mix(in srgb, ${style.accentColor} 3%, transparent)`,
          }}
        >
          <span className="gp-summary-row-label">
            {config.orderNumberLabel}
          </span>
          <span
            className="gp-summary-row-value"
            style={{ color: style.accentColor }}
          >
            #{model.orderNumber || model.orderId || "—"}
          </span>
        </Row>
      )}
      {config.showPaymentStatus && (
        <Row style={rowStyle}>
          <span className="gp-summary-row-label">
            {model.paymentStatusLabel}
          </span>
          <span className="gp-summary-row-value">
            {model.paymentStatusValue}
          </span>
        </Row>
      )}
      {config.showCustomerName && model.customerName && (
        <Row style={rowStyle}>
          <span className="gp-summary-row-label">{config.customerLabel}</span>
          <span className="gp-summary-row-value">{model.customerName}</span>
        </Row>
      )}
      {!detailsOnly && config.showItemCount && model.itemCount > 0 && (
        <Row style={rowStyle}>
          <span className="gp-summary-row-label">{config.itemCountLabel}</span>
          <span className="gp-summary-row-value">
            {model.itemCount} {model.itemCount === 1 ? "producto" : "productos"}
          </span>
        </Row>
      )}
      {config.showSubtotal && model.subtotal > 0 && (
        <Row style={rowStyle}>
          <span className="gp-summary-row-label">{config.subtotalLabel}</span>
          <span className="gp-summary-row-value">
            {formatMoneyCop(model.subtotal)}
          </span>
        </Row>
      )}
      {config.showShipping && model.hasOrderDetails && (
        <Row style={rowStyle}>
          <span className="gp-summary-row-label">{config.shippingLabel}</span>
          <span className="gp-summary-row-value">
            {model.shipping > 0 ? formatMoneyCop(model.shipping) : "Gratis"}
          </span>
        </Row>
      )}
      {model.storeCreditAmount > 0 && (
        <Row style={rowStyle}>
          <span className="gp-summary-row-label">Saldo a favor aplicado:</span>
          <span className="gp-summary-row-value">
            {formatMoneyCop(model.storeCreditAmount)}
          </span>
        </Row>
      )}
      {model.storeCreditAmount > 0 && model.amountDue > 0 && (
        <Row style={rowStyle}>
          <span className="gp-summary-row-label">Pagado con Wompi:</span>
          <span className="gp-summary-row-value">
            {formatMoneyCop(model.amountDue)}
          </span>
        </Row>
      )}
      {!detailsOnly && config.showTotal && (
        <Row
          total
          style={{
            ...rowStyle,
            backgroundColor: `color-mix(in srgb, ${style.accentColor} 5%, transparent)`,
          }}
        >
          <span
            className="gp-summary-row-label"
            style={{ fontWeight: 700, opacity: 1 }}
          >
            {model.totalLabel}
          </span>
          <span
            className="gp-summary-row-value"
            style={{ color: style.accentColor }}
          >
            {formatMoneyCop(model.total)}
          </span>
        </Row>
      )}
    </div>
  );
}
