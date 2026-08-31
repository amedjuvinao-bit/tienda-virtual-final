import ConfettiDots from './ConfettiDots';
import GraciasSummaryRows from './GraciasSummaryRows';
import ThanksStatusIcon from './ThanksStatusIcon';

export default function GraciasSummaryPanel({
  config, model, accessError, returnAccessEnabled, openReturnsPortal,
  continueShopping, shadowClass, buttonRadius,
}) {
  const style = config.style;
  const showConfiguredImage = config.titleMode === 'image' && config.titleImage && !model.hasPaymentResult;

  return <div className="flex justify-center md:justify-start">
    <div className={`gp-panel gp-panel-inner border ${shadowClass} relative overflow-hidden`} style={{
      backgroundColor: style.panelBg,
      borderColor: style.panelBorderColor,
      borderRadius: `${style.panelRadiusPx}px`,
      padding: `${style.panelPaddingPx}px`,
      minHeight: `${style.panelMinHeightPx}px`,
    }}>
      {model.verified && model.paymentMeta.showSuccessCheck && <ConfettiDots accent={style.accentColor} accent2="#d4af37" />}
      <div style={{ position: 'relative', zIndex: 1 }}>
        {model.hasPaymentResult && <div className="gp-status-badge" style={{
          backgroundColor: model.paymentMeta.badgeBg,
          color: model.paymentMeta.badgeText,
        }}>{model.paymentMeta.badge}</div>}

        <ThanksStatusIcon meta={model.paymentMeta} accent={style.accentColor} />

        <div style={{ marginBottom: 4 }}>
          {showConfiguredImage ? <img
            src={config.titleImage}
            alt={config.titleImageAlt || 'Gracias'}
            style={{ height: `${style.titleImageHeightPx}px`, objectFit: 'contain' }}
          /> : <h1 className="gp-title" style={{
            color: model.hasPaymentResult ? model.paymentMeta.badgeText : style.titleTextColor,
            fontSize: `clamp(20px, 4vw, ${style.titleFontSizePx}px)`,
          }}>
            {model.dynamicTitleText}
            {model.verified && config.showCustomerName && model.customerName ? `, ${model.customerName}` : ''}
          </h1>}
        </div>

        <p className="gp-message" style={{ color: style.textPrimaryColor }}>
          {model.hasPaymentResult || model.hasOrderInfo
            ? model.dynamicMainMessage
            : 'Si realizaste una compra, te enviaremos los detalles por correo. Puedes volver al inicio para seguir navegando.'}
        </p>
        {model.verificationLoading && <div className="gp-verifying" role="status" data-testid="thanks-verification-loading" style={{ color: model.paymentMeta.badgeText }}>
          Consultando el resultado seguro…
        </div>}
        {accessError && <div role="alert" data-testid="thanks-access-error" className="gp-message" style={{ color: '#991b1b' }}>{accessError}</div>}

        {model.hasOrderInfo && <>
          <p className="gp-summary-title" style={{ color: style.titleTextColor }}>{model.summaryTitle}</p>
          <GraciasSummaryRows config={config} model={model} />
        </>}
        {!model.hasOrderInfo && !model.hasPaymentResult && <div className="gp-fallback-msg" style={{ borderColor: style.panelBorderColor, color: style.textSecondaryColor }}>
          Si realizaste una compra, te enviaremos los detalles por correo.
        </div>}

        {returnAccessEnabled && <button type="button" className="gp-cta-btn" onClick={openReturnsPortal} style={{
          marginBottom: 10, backgroundColor: style.panelBg, color: style.buttonBg,
          border: `1px solid ${style.buttonBg}`, borderRadius: `${buttonRadius}px`,
        }}>Gestionar cambios o devoluciones</button>}

        {config.showContinueButton && <button type="button" className="gp-cta-btn" onClick={continueShopping} style={{
          backgroundColor: style.buttonBg, color: style.buttonTextColor,
          borderRadius: `${buttonRadius}px`, boxShadow: `0 10px 28px ${style.buttonBg}44`,
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <polyline points="9 22 9 12 15 12 15 22" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {config.continueButtonText}
        </button>}
        {config.showHelpText && <p className="gp-help" style={{ color: style.textSecondaryColor }}>{config.helpText}</p>}
      </div>
    </div>
  </div>;
}
