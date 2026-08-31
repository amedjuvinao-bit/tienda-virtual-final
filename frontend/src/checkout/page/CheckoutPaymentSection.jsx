import React from 'react';

export default function CheckoutPaymentSection({
  state,
  derived,
  onPreviewStoreCredit,
}) {
  const { checkoutConfig, paymentsConfig, storeCreditPreview } = state;

  return (
    <div className="co-card">
      <h2 className="co-card-title">Pago</h2>
      <p style={{ fontSize: '13px', color: checkoutConfig.style.textSecondaryColor, marginBottom: '16px' }}>
        Todas las transacciones son seguras y están encriptadas.
      </p>

      {checkoutConfig.showPaymentMethodsImage && (
        <div style={{ marginBottom: '16px' }}>
          <span style={{ fontSize: '12px', fontWeight: 600, color: '#6b7280', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
            Métodos de pago aceptados
          </span>
          <div style={{ marginTop: '10px' }}>
            <img
              src={checkoutConfig.paymentMethodsImage || '/src/assets/LogosMetodosDePago.png'}
              alt={checkoutConfig.paymentMethodsImageAlt || 'Métodos de pago'}
              style={{ height: `${checkoutConfig.style.paymentMethodsImageHeightPx}px`, objectFit: 'contain' }}
            />
          </div>
        </div>
      )}

      <div className="co-payment-redirect">
        <div className="co-payment-provider-badge">
          {state.paymentsConfigLoading ? 'Cargando pago...' : derived.paymentBlockTitle}
        </div>

        <div className="co-payment-icon">
          <svg width="32" height="20" viewBox="0 0 32 20" fill="none">
            <rect width="32" height="20" rx="4" fill="#f3f4f6" />
            <rect x="0" y="5" width="32" height="5" fill="#e5e7eb" />
          </svg>
        </div>

        <div style={{ marginBottom: '8px', fontSize: '12px', color: '#9ca3af' }}>
          Ambiente: <strong>{derived.paymentEnvironmentLabel}</strong> · Moneda: <strong>{paymentsConfig.currency}</strong>
        </div>

        <div>{derived.paymentBlockMessage}</div>
      </div>

      {paymentsConfig.active !== false && paymentsConfig.provider === 'wompi' && (
        <div
          style={{
            marginTop: 14,
            border: `1px solid ${checkoutConfig.style.sectionCardBorderColor}`,
            borderRadius: 14,
            padding: 14,
            background: checkoutConfig.style.inputBg,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              flexWrap: 'wrap',
            }}
          >
            <div>
              <div style={{ fontSize: 14, fontWeight: 700 }}>
                ¿Tienes saldo a favor?
              </div>
              <div
                style={{
                  marginTop: 3,
                  fontSize: 12,
                  color: checkoutConfig.style.textSecondaryColor,
                }}
              >
                Compruébalo con la cédula y el contacto escritos arriba.
              </div>
            </div>
            <button
              type="button"
              className="co-btn-secondary"
              onClick={onPreviewStoreCredit}
              disabled={storeCreditPreview.status === 'checking'}
            >
              {storeCreditPreview.status === 'checking' ? 'Comprobando...' : 'Consultar saldo'}
            </button>
          </div>

          {storeCreditPreview.message && (
            <div
              role={storeCreditPreview.status === 'error' ? 'alert' : 'status'}
              style={{
                marginTop: 12,
                fontSize: 12,
                fontWeight: 600,
                color:
                  storeCreditPreview.eligible === true
                    ? '#047857'
                    : storeCreditPreview.status === 'error'
                      ? '#be123c'
                      : checkoutConfig.style.textSecondaryColor,
              }}
            >
              {storeCreditPreview.message}
            </div>
          )}

          {storeCreditPreview.eligible === true && (
            <div style={{ marginTop: 12 }}>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: 13,
                  fontWeight: 650,
                  cursor: 'pointer',
                }}
              >
                <input
                  type="checkbox"
                  checked={state.useStoreCredit}
                  onChange={(event) => state.setUseStoreCredit(event.target.checked)}
                />
                Usar saldo disponible: {storeCreditPreview.currency}{' '}
                ${Number(storeCreditPreview.balance || 0).toLocaleString('es-CO')}
              </label>

              {state.useStoreCredit && (
                <div style={{ marginTop: 10 }}>
                  <label className="co-field-label">Saldo que quieres usar</label>
                  <input
                    type="number"
                    className="co-input"
                    min="1"
                    max={Math.min(Number(storeCreditPreview.balance || 0), derived.total)}
                    step="1"
                    value={state.storeCreditAmount}
                    onChange={(event) => state.setStoreCreditAmount(event.target.value)}
                  />
                  <div
                    style={{
                      marginTop: 8,
                      fontSize: 12,
                      color: checkoutConfig.style.textSecondaryColor,
                    }}
                  >
                    Saldo aplicado: ${derived.appliedStoreCreditAmount.toLocaleString('es-CO')} · A pagar ahora: ${derived.amountDue.toLocaleString('es-CO')}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
