import { contractText, downloadText } from "./ConsumerReceipt";
export default function CheckoutConsumerAcceptance({ state, derived }) {
  const offer = derived.consumerOffer;
  if (!offer)
    return <p role="status">Verificando las condiciones de compra…</p>;
  if (!offer.ready)
    return (
      <div className="cart-notice" role="alert">
        {offer.message ||
          "La tienda está completando su información y las condiciones para esta compra."}{" "}
        Puedes{" "}
        <a href="/contacto" target="_blank" rel="noopener noreferrer">
          contactarnos
        </a>
        .
      </div>
    );
  const fingerprint = offer.fingerprint;
  const money = (v) =>
    new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: offer.currency || "COP",
    }).format(Number(v || 0));
  return (
    <section
      className="consumer-acceptance"
      aria-label="Revisión y aceptación de la compra"
    >
      <p>
        <strong>Vendedor:</strong> {offer.seller.legalName} · NIT{" "}
        {offer.seller.nit}
      </p>
      <p>
        {offer.seller.notificationAddress} · {offer.seller.email} ·{" "}
        {offer.seller.phone}
      </p>
      {!state.checkoutConfig.showOrderSummary && (
        <div>
          <ul>
            {offer.items.map((i, n) => (
              <li key={n}>
                {i.title} · {i.quantity} × {money(i.price)}
              </li>
            ))}
          </ul>
          <p>
            Subtotal {money(offer.pricing.subtotal)} · Descuentos{" "}
            {money(offer.pricing.totalDiscount)} · Impuestos{" "}
            {money(offer.pricing.taxAmount)} · Envío{" "}
            {money(offer.pricing.shipping)} · Total {money(offer.pricing.total)}
          </p>
        </div>
      )}
      <p>
        <strong>Plazo de entrega:</strong> {offer.delivery.text}
      </p>
      <p>
        Puedes corregir los datos o volver al <a href="/carrito">carrito</a>{" "}
        antes de confirmar. Los impuestos y el envío están discriminados en el
        resumen.
      </p>
      <button
        type="button"
        className="co-policy-link"
        disabled={state.preview}
        onClick={() =>
          downloadText("condiciones-de-compra.txt", contractText(offer))
        }
      >
        Descargar las condiciones de esta compra
      </button>
      <label>
        <input
          type="checkbox"
          checked={state.acceptedTerms === fingerprint}
          onChange={(e) =>
            state.setAcceptedTerms(e.target.checked ? fingerprint : "")
          }
        />
        He revisado el resumen y acepto el total, el plazo y las{" "}
        <a href="/terminos" target="_blank" rel="noopener noreferrer">
          condiciones de compra
        </a>
        , incluido el{" "}
        <a
          href="/cambios-y-devoluciones"
          target="_blank"
          rel="noopener noreferrer"
        >
          retracto y la garantía
        </a>
        .
      </label>
      <label>
        <input
          type="checkbox"
          checked={state.authorizedPrivacy === fingerprint}
          onChange={(e) =>
            state.setAuthorizedPrivacy(e.target.checked ? fingerprint : "")
          }
        />
        Autorizo el tratamiento de mis datos para gestionar esta compra conforme
        a la{" "}
        <a href="/privacidad" target="_blank" rel="noopener noreferrer">
          política de datos personales
        </a>
        . Las promociones son opcionales y se autorizan por separado.
      </label>
    </section>
  );
}
