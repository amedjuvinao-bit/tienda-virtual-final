import { useState } from "react";
import {
  ArrowRight,
  Headphones,
  Clock3,
  Check,
  CircleAlert,
  ChevronDown,
  RefreshCw,
} from "lucide-react";
import ThanksGlassRim from "./ThanksGlassRim";
import GraciasSummaryRows from "./GraciasSummaryRows";
import ThanksStatusIcon from "./ThanksStatusIcon";
import ThanksGlassButton from "./ThanksGlassButton";
import ThanksOrderFacts from "./ThanksOrderFacts";
import ThanksNextSteps from "./ThanksNextSteps";
export default function GraciasSummaryPanel({
  config,
  model,
  accessError,
  retryVerification,
  returnAccessEnabled,
  openReturnsPortal,
  continueShopping,
}) {
  const style = config.style,
    [failedTitle, setFailedTitle] = useState("");
  const heading =
    model.verified &&
    !model.verificationLoading &&
    ["approved", "pending"].includes(model.paymentStatus)
      ? config.titleText
      : model.dynamicTitleText;
  const showImage =
    config.titleMode === "image" &&
    config.titleImage &&
    failedTitle !== config.titleImage;
  const refresh =
    model.verified &&
    !model.verificationLoading &&
    ["pending", "unknown"].includes(model.paymentStatus);
  const BadgeIcon = model.paymentMeta.showSuccessCheck
    ? Check
    : ["rejected", "expired", "error"].includes(model.paymentStatus)
      ? CircleAlert
      : Clock3;
  const hasDetails =
    config.showOrderDetails &&
    model.hasOrderInfo &&
    (config.showPaymentStatus ||
      (config.showCustomerName && model.customerName) ||
      (config.showSubtotal && model.subtotal > 0) ||
      (config.showShipping && model.hasOrderDetails) ||
      model.storeCreditAmount > 0);
  return (
    <section
      className="cart-glass gp-panel gp-central-panel"
      style={{ minHeight: style.panelMinHeightPx }}
    >
      <div className="gp-medallion">
        <ThanksStatusIcon
          meta={model.paymentMeta}
          status={model.paymentStatus}
          loading={model.verificationLoading}
          accent={style.iconColor}
        />
        <ThanksGlassRim config={config} radius={999} />
      </div>
      <div className="gp-panel-content">
        <h1 className="gp-title">
          {showImage ? (
            <img
              src={config.titleImage}
              alt={config.titleImageAlt || heading}
              style={{ maxHeight: style.titleImageHeightPx }}
              onError={() => setFailedTitle(config.titleImage)}
            />
          ) : (
            heading
          )}
        </h1>
        {model.hasPaymentResult && (
          <div className="gp-status-badge" role="status">
            <BadgeIcon size={14} aria-hidden="true" />
            {model.paymentMeta.badge}
          </div>
        )}
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
            <h2 className="sr-only">{model.summaryTitle}</h2>
            <ThanksOrderFacts config={config} model={model} />
          </>
        )}
        <ThanksNextSteps config={config} model={model} />
        <div className="gp-actions">
          {refresh && (
            <ThanksGlassButton config={config} onClick={retryVerification}>
              <RefreshCw size={17} aria-hidden="true" />
              {config.refreshButtonText}
              <ArrowRight size={17} aria-hidden="true" />
            </ThanksGlassButton>
          )}
          {config.showContinueButton && (
            <ThanksGlassButton
              config={config}
              secondary={refresh}
              onClick={continueShopping}
            >
              <span>{config.continueButtonText}</span>
              {!refresh && <ArrowRight size={17} aria-hidden="true" />}
            </ThanksGlassButton>
          )}
        </div>
        <div className="gp-support-actions">
          {hasDetails && (
            <details className="gp-order-details">
              <summary>
                {config.detailsToggleText}
                <ChevronDown size={14} aria-hidden="true" />
              </summary>
              <GraciasSummaryRows config={config} model={model} detailsOnly />
            </details>
          )}
          {returnAccessEnabled && (
            <button
              type="button"
              className="gp-returns-link"
              onClick={openReturnsPortal}
            >
              <Headphones size={17} aria-hidden="true" />
              {config.returnsButtonText}
              <ArrowRight size={14} aria-hidden="true" />
            </button>
          )}
        </div>
        {config.showHelpText && (
          <p className="gp-help" style={{ color: style.textSecondaryColor }}>
            {config.helpText}
          </p>
        )}
      </div>
      <ThanksGlassRim config={config} topGap={style.medallionSizePx} />
    </section>
  );
}
