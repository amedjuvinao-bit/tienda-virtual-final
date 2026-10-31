export function downloadText(name, text) {
  const url = URL.createObjectURL(
    new Blob([text], { type: "text/plain;charset=utf-8" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function contractText(contract, orderNumber = "") {
  const s = contract.seller || {},
    p = contract.pricing || {};
  const money = (value) =>
    new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: contract.currency || "COP",
    }).format(Number(value || 0));
  return [
    `CONSTANCIA DEL PEDIDO ${orderNumber}`,
    "Esta constancia acredita la recepción del pedido; el pago se verifica por separado.",
    `Aceptado: ${contract.acceptedAt || ""}`,
    `Vendedor: ${s.legalName || ""} · NIT ${s.nit || ""}`,
    s.notificationAddress,
    s.email,
    s.phone,
    `Medio de pago: ${contract.paymentMethod || ""}`,
    contract.delivery?.text,
    ...(contract.items || []).map(
      (i) =>
        `${i.title} · ${i.variantLabel || i.variantId || ""} · ${i.quantity} × ${money(i.price)}`,
    ),
    ...(contract.items || [])
      .flatMap((i) => [i.description, ...(i.features || [])])
      .filter(Boolean),
    `Subtotal: ${money(p.subtotal)}`,
    `Descuentos: ${money(p.totalDiscount)}`,
    `Impuestos incluidos en el total: ${money(p.taxAmount)}`,
    `Envío: ${money(p.shipping)}`,
    `TOTAL: ${money(p.total)}`,
    `Referencia de las condiciones aceptadas: ${contract.version}`,
    "Este código identifica las condiciones guardadas con tu pedido. Los cambios posteriores de la página no modifican esta constancia.",
    `Referencia de integridad: ${contract.fingerprint}`,
    ...(contract.policies || []).flatMap((s) => [`\n${s.title}`, s.body]),
  ]
    .filter(Boolean)
    .join("\n");
}
export default function ConsumerReceipt({ contract, orderNumber }) {
  if (!contract) return null;
  return (
    <div className="consumer-receipt">
      <p>
        <strong>Plazo aceptado:</strong> {contract.delivery?.text}
      </p>
      <button
        type="button"
        className="co-policy-link"
        onClick={() =>
          downloadText(
            `pedido-${orderNumber || "recibido"}.txt`,
            contractText(contract, orderNumber),
          )
        }
      >
        Descargar constancia y condiciones
      </button>
      <p>
        <a href="/pqr">Solicitar atención sobre este pedido</a>
      </p>
    </div>
  );
}
