import { Link } from "react-router-dom";
import { PackageCheck } from "lucide-react";
import ServicePageFrame, {
  ServiceButton,
  ServiceHeading,
} from "../../components/service-pages/ServicePageFrame";
import { CartGlass } from "../../components/cart/CartMaterial";
import { buildServicePageConfig } from "../../components/service-pages/servicePageConfig";
import ReturnCaseCard from "./ReturnCaseCard";
import { quantity, formatDate, resolutionLabel, REASONS } from "./returnsModel";
import "./returnsPage.css";
export default function OrderReturnsView({
  page,
  config: suppliedConfig,
  preview = false,
  configError,
  onRetryConfig,
  data,
  loading,
  busy,
  error,
  success,
  resolution,
  setResolution,
  items,
  setItem,
  reasonSummary,
  setReasonSummary,
  eligibleItems = [],
  selectedItems = [],
  selectedRequiresReview,
  selectedResolutions = [],
  submit,
  load,
  access,
  orderId,
  setError,
}) {
  const config =
    suppliedConfig ||
    buildServicePageConfig(page?.returnsPageConfig, "returns-page");
  return (
    <ServicePageFrame
      page={page}
      config={config}
      preview={preview}
      className="orp-page"
    >
      <ServiceHeading config={config} icon={PackageCheck}>
        {data?.order?.orderNumber && (
          <p>
            {config.orderLabel} #{data.order.orderNumber}
          </p>
        )}
      </ServiceHeading>
      <p className="service-message">Las condiciones comerciales de este portal no limitan el retracto ni la garantía legal. Puedes <a href={access && orderId ? `/pqr?pedido=${encodeURIComponent(orderId)}` : "/pqr"}>radicar una solicitud de atención</a> aunque no haya productos disponibles aquí. <a href="/cambios-y-devoluciones">Consultar tus derechos</a>.</p>
      {configError && (
        <div role="alert" className="service-message">
          {configError}{" "}
          <ServiceButton config={config} onClick={onRetryConfig}>
            {config.retryText}
          </ServiceButton>
        </div>
      )}

      {error ? (
        <div role="alert" className="orp-alert error">
          {error}
        </div>
      ) : null}
      {success ? (
        <div role="status" className="orp-alert success">
          {success}
        </div>
      ) : null}

      {loading && (
        <div role="status" className="orp-empty">
          Consultando tu orden…
        </div>
      )}
      {error && !loading && (
        <ServiceButton config={config} onClick={load}>
          {config.retryText}
        </ServiceButton>
      )}
      {!loading && data ? (
        <div className="orp-grid">
          <CartGlass config={config} className="orp-panel">
            <h2>{config.createTitle}</h2>
            <p className="service-muted">{config.createDescription}</p>
            <div className="orp-policy">
              {data.policy?.policyText} {config.windowLabel}:{" "}
              {data.policy?.windowDays} {config.daysLabel}.
            </div>
            {eligibleItems.length ? (
              <form onSubmit={submit}>
                <fieldset disabled={busy} className="orp-form-fields">
                  <label>
                    <span className="service-muted">
                      {config.resolutionLabel}
                    </span>
                    <select
                      className="service-input"
                      value={resolution}
                      onChange={(event) => setResolution(event.target.value)}
                    >
                      {selectedResolutions.map((option) => (
                        <option key={option} value={option}>
                          {resolutionLabel(option, config)}
                        </option>
                      ))}
                    </select>
                  </label>
                  {eligibleItems.map((item) => {
                    const draft = items[item.orderItemId] || {};
                    return (
                      <div className="orp-line" key={item.orderItemId}>
                        <div>
                          <strong>{item.title}</strong>
                          <span>
                            {config.availableLabel} {item.availableQuantity} ·{" "}
                            {config.untilLabel} {formatDate(item.eligibleUntil)}
                          </span>
                          {item.policyRuleName &&
                          item.policyRuleName !== "Política general" ? (
                            <span>
                              {config.policyLabel}: {item.policyRuleName} ·{" "}
                              {item.policyWindowDays ||
                                data.policy?.windowDays ||
                                30}{" "}
                              días
                              {item.policyManualReview
                                ? ` · ${config.reviewLabel}`
                                : ""}
                            </span>
                          ) : null}
                        </div>
                        <input
                          className="service-input"
                          aria-label={`${config.quantityLabel} ${item.title}`}
                          type="number"
                          min="0"
                          max={item.availableQuantity}
                          value={draft.quantity || ""}
                          onChange={(event) =>
                            setItem(item.orderItemId, {
                              quantity: Math.min(
                                item.availableQuantity,
                                quantity(event.target.value),
                              ),
                            })
                          }
                        />
                        <select
                          className="service-input"
                          aria-label={`${config.reasonLabel} ${item.title}`}
                          value={draft.reasonCode || "other"}
                          onChange={(event) =>
                            setItem(item.orderItemId, {
                              reasonCode: event.target.value,
                            })
                          }
                        >
                          {REASONS.map(([code, label]) => (
                            <option key={code} value={code}>
                              {config[`reason_${code}`] || label}
                            </option>
                          ))}
                        </select>
                        {quantity(draft.quantity) > 0 ? (
                          <input
                            className="service-input orp-detail"
                            aria-label={`${config.detailLabel} ${item.title}`}
                            value={draft.reasonText || ""}
                            onChange={(event) =>
                              setItem(item.orderItemId, {
                                reasonText: event.target.value,
                              })
                            }
                            placeholder={
                              item.requireReasonText
                                ? config.requiredReasonPlaceholder
                                : config.optionalReasonPlaceholder
                            }
                          />
                        ) : null}
                      </div>
                    );
                  })}
                  {selectedRequiresReview ? (
                    <div className="orp-policy">{config.reviewText}</div>
                  ) : null}
                  {selectedItems.length && !selectedResolutions.length ? (
                    <div role="alert" className="orp-alert error">
                      {config.incompatibleText}
                    </div>
                  ) : null}
                  <textarea
                    className="service-input"
                    rows="3"
                    value={reasonSummary}
                    onChange={(event) => setReasonSummary(event.target.value)}
                    aria-label={config.commentPlaceholder}
                    placeholder={config.commentPlaceholder}
                  />
                  <div className="orp-actions">
                    <ServiceButton
                      config={config}
                      type="submit"
                      disabled={
                        !selectedItems.length ||
                        !selectedResolutions.length ||
                        busy
                      }
                    >
                      {busy ? config.sendingText : config.submitText}
                    </ServiceButton>
                  </div>
                </fieldset>
              </form>
            ) : (
              <div className="orp-empty">{config.emptyEligibleText}</div>
            )}
          </CartGlass>

          <CartGlass config={config} className="orp-panel">
            <h2>{config.historyTitle}</h2>
            <p className="service-muted">{config.historyDescription}</p>
            <div className="orp-cases">
              {(data.returns || []).length ? (
                (data.returns || []).map((returnCase) => (
                  <ReturnCaseCard
                    key={returnCase._id}
                    returnCase={returnCase}
                    access={access}
                    orderId={orderId}
                    onChanged={load}
                    onError={setError}
                    config={config}
                    preview={preview}
                  />
                ))
              ) : (
                <div className="orp-empty">{config.emptyHistoryText}</div>
              )}
            </div>
          </CartGlass>
        </div>
      ) : null}
      <div className="orp-actions">
        <ServiceButton config={config} as={Link} to={config.returnLink}>
          {config.returnText}
        </ServiceButton>
      </div>
    </ServicePageFrame>
  );
}
