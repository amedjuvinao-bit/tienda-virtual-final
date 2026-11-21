import { useState } from "react";
import { API_BASE_URL } from "../../config/apiBaseUrl";
import { buildOrderReturnAccessHeaders } from "../../utils/orderReturnAccess";
import { CartGlass } from "../../components/cart/CartMaterial";
import { ServiceButton } from "../../components/service-pages/ServicePageFrame";
import { formatDate, resolutionLabel, STATUS_LABELS } from "./returnsModel";
export default function ReturnCaseCard({
  returnCase,
  access,
  orderId,
  onChanged,
  onError,
  config,
  preview = false,
}) {
  const [busy, setBusy] = useState(false);
  const canCancel =
    returnCase.requestSource === "customer" &&
    ["requested", "authorized"].includes(returnCase.status);
  const canDownloadLabel = [
    "authorized",
    "in_transit",
    "received",
    "resolution_required",
    "resolved",
  ].includes(returnCase.status);

  const cancel = async () => {
    if (preview) {
      onError?.("Vista previa: no se modifican solicitudes reales.");
      return;
    }
    if (!canCancel || busy) return;
    setBusy(true);
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/orders/${orderId}/returns/self-service/${returnCase._id}/cancel`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            ...buildOrderReturnAccessHeaders(access),
          },
          body: JSON.stringify({
            expectedRevision: returnCase.revision,
            reason: "Cancelado por solicitud del cliente.",
          }),
        },
      );
      if (!response.ok)
        throw new Error("No fue posible cancelar la solicitud.");
      await onChanged?.();
    } catch (requestError) {
      onError?.(
        requestError.message || "No fue posible cancelar la solicitud.",
      );
    } finally {
      setBusy(false);
    }
  };

  const labelUrl = `${API_BASE_URL}/api/orders/${orderId}/returns/self-service/${returnCase._id}/label`;
  const openLabel = async () => {
    if (preview) {
      onError?.("Vista previa: no se descargan etiquetas reales.");
      return;
    }
    const carrierLabelUrl = String(returnCase.shipping?.labelUrl || "").trim();
    if (/^https:\/\//i.test(carrierLabelUrl)) {
      window.open(carrierLabelUrl, "_blank", "noopener,noreferrer");
      return;
    }
    setBusy(true);
    try {
      const response = await fetch(labelUrl, {
        headers: buildOrderReturnAccessHeaders(access),
      });
      if (!response.ok)
        throw new Error("La etiqueta todavía no está disponible.");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener,noreferrer");
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (requestError) {
      onError?.(
        requestError.message || "La etiqueta todavía no está disponible.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <CartGlass config={config} className="orp-case">
      <div className="orp-case-head">
        <div>
          <strong>{returnCase.returnNumber}</strong>
          <span>
            {resolutionLabel(returnCase.requestedResolution, config)} ·{" "}
            {formatDate(returnCase.requestedAt)}
          </span>
        </div>
        <span className={`orp-status is-${returnCase.status}`}>
          {STATUS_LABELS[returnCase.status] || returnCase.status}
        </span>
      </div>
      <div className="orp-case-items">
        {(returnCase.items || []).map((item) => (
          <div key={String(item.orderItemId || item._id)}>
            <strong>{item.title}</strong>
            <span>
              {item.requestedQuantity} unidad(es) ·{" "}
              {config[`reason_${item.reasonCode}`] || config.reason_other}
            </span>
            {item.policyRuleName &&
            item.policyRuleName !== "Política general" ? (
              <span>
                Política aplicada: {item.policyRuleName} ·{" "}
                {item.policyWindowDays || 30} días
              </span>
            ) : null}
          </div>
        ))}
      </div>
      {returnCase.shipping?.instructions ? (
        <p className="orp-note">{returnCase.shipping.instructions}</p>
      ) : null}
      {returnCase.resolution?.state === "completed" ? (
        <p className="orp-result">
          Resolución:{" "}
          <strong>{resolutionLabel(returnCase.resolution.type, config)}</strong>
          {returnCase.resolution.storeCreditNumber
            ? ` · ${returnCase.resolution.storeCreditNumber}`
            : ""}
          {returnCase.resolution.replacementOrderNumber
            ? ` · orden #${returnCase.resolution.replacementOrderNumber}`
            : ""}
        </p>
      ) : null}
      <div className="orp-actions">
        {canDownloadLabel ? (
          <ServiceButton config={config} disabled={busy} onClick={openLabel}>
            {config.downloadText}
          </ServiceButton>
        ) : null}
        {canCancel ? (
          <ServiceButton config={config} disabled={busy} onClick={cancel}>
            {config.cancelText}
          </ServiceButton>
        ) : null}
      </div>
    </CartGlass>
  );
}
