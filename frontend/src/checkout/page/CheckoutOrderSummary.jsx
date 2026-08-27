import React from 'react';
import {
  getItemLineTotal,
  getItemQuantity,
  getVariantDisplay,
} from './checkoutPageModel';

export default function CheckoutOrderSummary({ state, derived, onApplyCoupon }) {
  const { checkoutConfig, paymentsConfig } = state;

  if (!checkoutConfig.showOrderSummary) return null;

  return (
    <div className="co-summary-col">
      <div className="co-summary-sticky">
        <div className="co-summary-card">
          <h2
            style={{
              fontFamily: "'DM Serif Display', serif",
              fontSize: '18px',
              fontWeight: 400,
              margin: '0 0 16px 0',
              color: checkoutConfig.style.textPrimaryColor,
            }}
          >
            {checkoutConfig.orderSummaryTitle}
          </h2>

          <div>
            {(derived.currentCart || []).map((item, index) => {
              const itemQty = getItemQuantity(item);
              const itemTotal = getItemLineTotal(item);
              return (
                <div key={index} className="co-summary-item">
                  <div style={{ position: 'relative', flexShrink: 0 }}>
                    <img src={item.image} alt={item.title} className="co-product-img" />
                    <span className="co-qty-badge">{itemQty}</span>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: '13px', fontWeight: 500, margin: '0 0 4px', lineHeight: 1.3, color: checkoutConfig.style.textPrimaryColor }}>
                      {item.title}
                    </p>
                    <p style={{ fontSize: '12px', color: checkoutConfig.style.textSecondaryColor, margin: 0 }}>
                      {getVariantDisplay(item)}
                    </p>
                  </div>
                  <div style={{ fontSize: '14px', fontWeight: 600, flexShrink: 0, color: checkoutConfig.style.textPrimaryColor }}>
                    ${itemTotal.toLocaleString('es-CO')}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="co-discount-row">
            <input
              type="text"
              className="co-input"
              placeholder="Código de descuento"
              value={state.discountCode}
              onChange={(event) => {
                const nextValue = event.target.value;
                state.setDiscountCode(nextValue);
                state.setCouponError('');
                if (
                  state.appliedCoupon?.code &&
                  String(nextValue || '').trim().toUpperCase().replace(/\s+/g, '') !== state.appliedCoupon.code
                ) {
                  state.setAppliedCoupon(null);
                  state.setCouponMessage('');
                }
              }}
              autoComplete="off"
              name="discountCode"
            />
            <button
              className="co-btn-secondary"
              type="button"
              onClick={onApplyCoupon}
              disabled={state.quoteLoading}
            >
              {state.quoteLoading && state.appliedCoupon?.code ? 'Validando...' : 'Aplicar'}
            </button>
          </div>

          {(state.couponMessage || state.couponError) && (
            <div
              role={state.couponError ? 'alert' : 'status'}
              style={{
                marginTop: '8px',
                fontSize: '12px',
                fontWeight: 600,
                color: state.couponError ? '#be123c' : '#047857',
              }}
            >
              {state.couponError || state.couponMessage}
            </div>
          )}

          <hr className="co-totals-divider" style={{ marginTop: '20px' }} />
          <div className="co-totals">
            <div className="co-totals-row">
              <span style={{ color: checkoutConfig.style.subtotalTextColor }}>
                {checkoutConfig.subtotalLabelText}
              </span>
              <span style={{ color: checkoutConfig.style.subtotalValueColor, fontWeight: 500 }}>
                ${derived.quotedSubtotal.toLocaleString('es-CO')}
              </span>
            </div>
            {derived.productDiscount > 0 && (
              <div className="co-totals-row">
                <span style={{ color: '#047857' }}>
                  Descuento{state.appliedCoupon?.code ? ` · ${state.appliedCoupon.code}` : ''}
                </span>
                <span style={{ fontWeight: 600, color: '#047857' }}>
                  -${derived.productDiscount.toLocaleString('es-CO')}
                </span>
              </div>
            )}
            {(derived.taxPercent > 0 || derived.taxAmount > 0) && (
              <div className="co-totals-row">
                <span style={{ color: '#6b7280' }}>IVA ({derived.taxPercent}%)</span>
                <span style={{ fontWeight: 500 }}>
                  ${derived.taxAmount.toLocaleString('es-CO')}
                </span>
              </div>
            )}
            <div className="co-totals-row">
              <span style={{ color: '#6b7280' }}>Envío</span>
              <span style={{ fontWeight: 500 }}>
                {derived.shipping === 0 ? 'Gratis' : `$${derived.shipping.toLocaleString('es-CO')}`}
              </span>
            </div>
            {derived.shippingDiscount > 0 && (
              <div className="co-totals-row">
                <span style={{ color: '#047857' }}>Descuento de envío</span>
                <span style={{ fontWeight: 600, color: '#047857' }}>
                  -${derived.shippingDiscount.toLocaleString('es-CO')}
                </span>
              </div>
            )}
            <hr className="co-totals-divider" />
            <div className="co-totals-row co-totals-total">
              <span style={{ color: checkoutConfig.style.totalTextColor }}>
                {checkoutConfig.totalLabelText}
              </span>
              <span style={{ color: checkoutConfig.style.accentColor }}>
                {paymentsConfig.currency} ${derived.total.toLocaleString('es-CO')}
              </span>
            </div>
            {derived.appliedStoreCreditAmount > 0 && (
              <>
                <div className="co-totals-row">
                  <span style={{ color: '#047857' }}>Saldo a favor</span>
                  <span style={{ fontWeight: 600, color: '#047857' }}>
                    -${derived.appliedStoreCreditAmount.toLocaleString('es-CO')}
                  </span>
                </div>
                <div className="co-totals-row co-totals-total">
                  <span style={{ color: checkoutConfig.style.totalTextColor }}>A pagar ahora</span>
                  <span style={{ color: checkoutConfig.style.accentColor }}>
                    {paymentsConfig.currency} ${derived.amountDue.toLocaleString('es-CO')}
                  </span>
                </div>
              </>
            )}
          </div>

          {checkoutConfig.shippingMessageText && (
            <p style={{ fontSize: '11px', color: checkoutConfig.style.textSecondaryColor, marginTop: '12px', lineHeight: 1.5 }}>
              {checkoutConfig.shippingMessageText}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
