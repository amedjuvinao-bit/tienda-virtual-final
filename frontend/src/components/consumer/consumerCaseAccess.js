import {
  getOrderPaymentAccess,
  buildOrderPaymentAccessHeaders,
} from "../../utils/orderPaymentAccess";
import {
  getOrderReturnAccess,
  buildOrderReturnAccessHeaders,
} from "../../utils/orderReturnAccess";
export function newCaseKey() {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}
export function caseOrderContext() {
  const id = new URLSearchParams(window.location.search).get("pedido");
  if (!/^[a-f0-9]{24}$/i.test(id || "")) return null;
  const returns = getOrderReturnAccess(id);
  const payment = getOrderPaymentAccess(id);
  const headers = returns
    ? buildOrderReturnAccessHeaders(returns)
    : buildOrderPaymentAccessHeaders(payment);
  return Object.keys(headers).length ? { orderId: id, headers } : null;
}
