import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { CartGlass } from "../../components/cart/CartMaterial";
import ConfettiDots from "./ConfettiDots";
import GraciasSummaryRows from "./GraciasSummaryRows";
import ThanksStatusIcon from "./ThanksStatusIcon";
import ThanksGlassButton from "./ThanksGlassButton";
export default function GraciasSummaryPanel({
  config,
  material,
  model,
  accessError,
  retryVerification,
  returnAccessEnabled,
  openReturnsPortal,
  continueShopping,
}) {
  const style = config.style,
    [failedTitle, setFailedTitle] = useState("");
  const showImage =
    config.titleMode === "image" &&
    config.titleImage &&
    failedTitle !== config.titleImage &&
    !model.hasPaymentResult;
  return (
    <CartGlass
      config={material}
      className="gp-panel"
      style={{ minHeight: style.panelMinHeightPx }}
    >
      {model.verified && model.paymentMeta.showSuccessCheck && (
        <ConfettiDots
          accent={style.accentColor}
          accent2={style.panelBorderColor}
        />
      )}
      <div className="gp-panel-content">
        {model.hasPaymentResult && (
          <div
            className="gp-status-badge"
            role="status"
            style={{
              color: model.paymentMeta.badgeText,
              backgroundColor: `color-mix(in srgb, ${model.paymentMeta.badgeBg} 45%, transparent)`,
            }}
          >
            {model.paymentMeta.badge}
          </div>
        )}
        <ThanksStatusIcon
          meta={model.paymentMeta}
          status={model.paymentStatus}
          loading={model.verificationLoading}
          accent={style.accentColor}
        />
        <h1 className="gp-title">
          {showImage ? (
            <img
              src={config.titleImage}
              alt={config.titleImageAlt || config.titleText}
              style={{ maxHeight: style.titleImageHeightPx }}
              onError={() => setFailedTitle(config.titleImage)}
            />
          ) : (
            <>
              {model.dynamicTitleText}
              {model.verified && config.showCustomerName && model.customerName
                ? `, ${model.customerName}`
                : ""}
            </>
          )}
        </h1>
        <p className="gp-message">
          {model.hasPaymentResult || model.hasOrderInfo
            ? model.dynamicMainMessage
            : config.entryMessage}
        </p>
        {model.verificationLoading && (
          <p
            className="gp-verifying"
            role="status"
            data-testid="thanks-verification-loading"
          >
            Consultando el resultado seguro…
          </p>
        )}
        {accessError && (
          <div
            role="alert"
            data-testid="thanks-access-error"
            className="gp-error"
          >
            <p>{accessError}</p>
            <ThanksGlassButton
              config={config}
              secondary
              onClick={retryVerification}
            >
              Reintentar verificación
            </ThanksGlassButton>
          </div>
        )}
        {model.hasOrderInfo && (
          <>
            <h2 className="gp-summary-title">{model.summaryTitle}</h2>
            <GraciasSummaryRows config={config} model={model} />
          </>
        )}
        <div className="gp-actions">
          {model.verified &&
            !model.verificationLoading &&
            ["pending", "unknown"].includes(model.paymentStatus) && (
              <ThanksGlassButton
                config={config}
                secondary
                onClick={retryVerification}
              >
                Actualizar estado
              </ThanksGlassButton>
            )}
          {returnAccessEnabled && (
            <ThanksGlassButton
              config={config}
              secondary
              onClick={openReturnsPortal}
            >
              {config.returnsButtonText}
            </ThanksGlassButton>
          )}
          {config.showContinueButton && (
            <ThanksGlassButton config={config} onClick={continueShopping}>
              <span>{config.continueButtonText}</span>
              <ArrowRight size={17} aria-hidden="true" />
            </ThanksGlassButton>
          )}
        </div>
        {config.showHelpText && (
          <p className="gp-help" style={{ color: style.textSecondaryColor }}>
            {config.helpText}
          </p>
        )}
      </div>
    </CartGlass>
  );
}
