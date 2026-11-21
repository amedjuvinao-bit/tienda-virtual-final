import { useEffect, useMemo, useState } from "react";
import { API_BASE_URL } from "../../config/apiBaseUrl";
import {
  buildOrderPaymentAccessHeaders,
  getOrderPaymentAccess,
} from "../../utils/orderPaymentAccess";
const ACCESS_REQUIRED =
  "No fue posible verificar el acceso a esta orden. Abre esta página desde el mismo navegador donde realizaste la compra.";
const ACCESS_FAILED =
  "No pudimos consultar el resultado del pedido. Revisa tu conexión y vuelve a intentarlo.";
export default function useThanksVerification({
  orderId,
  transactionId,
  hasResponse,
}) {
  const [attempt, setAttempt] = useState(0);
  const access = useMemo(
    () => getOrderPaymentAccess(orderId),
    [orderId, attempt],
  );
  const key = JSON.stringify([orderId, transactionId, hasResponse, attempt]);
  const [result, setResult] = useState(null);
  useEffect(() => {
    const controller = new AbortController();
    const request = async (path) => {
      try {
        const response = await fetch(`${API_BASE_URL}${path}`, {
          headers: buildOrderPaymentAccessHeaders(access),
          signal: controller.signal,
        });
        if (!response.ok) return null;
        const data = await response.json();
        // The protected endpoint is authoritative; route state and query values never are.
        return data?.ok === true ? data : null;
      } catch {
        return null;
      }
    };
    if (!access || (!orderId && !transactionId)) {
      setResult({
        key,
        order: null,
        transaction: null,
        error: hasResponse || orderId || transactionId ? ACCESS_REQUIRED : "",
      });
      return () => controller.abort();
    }
    Promise.all([
      orderId
        ? request(`/api/orders/${encodeURIComponent(orderId)}/thanks`)
        : null,
      transactionId
        ? request(
            `/api/payments/wompi/transaction/${encodeURIComponent(transactionId)}`,
          )
        : null,
    ]).then(([order, transaction]) => {
      if (!controller.signal.aborted)
        setResult({
          key,
          order,
          transaction,
          error: order || transaction ? "" : ACCESS_FAILED,
        });
    });
    return () => controller.abort();
  }, [key, access, orderId, transactionId, hasResponse]);
  const current = result?.key === key ? result : null;
  return {
    thanksOrderData: current?.order || null,
    wompiTxData: current?.transaction || null,
    thanksAccessError: current?.error || "",
    verificationLoading:
      !current && Boolean(access && (orderId || transactionId)),
    retryVerification: () => setAttempt((value) => value + 1),
  };
}
