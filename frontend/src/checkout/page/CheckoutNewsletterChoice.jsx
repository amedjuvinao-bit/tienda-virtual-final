import { useEffect } from "react";
import "../../components/newsletter/newsletter.css";
import useNewsletterPolicy from "../../components/newsletter/useNewsletterPolicy";

export default function CheckoutNewsletterChoice({ state }) {
  const { policy, error, retry } = useNewsletterPolicy(!state.preview);
  const { setWantsNewsletter, setNewsletterConsentVersion } = state;
  useEffect(() => {
    setWantsNewsletter(false);
    setNewsletterConsentVersion?.(policy?.version || "");
  }, [policy?.version, setWantsNewsletter, setNewsletterConsentVersion]);
  if (state.preview)
    return (
      <label className="co-newsletter">
        <input type="checkbox" disabled />
        {state.checkoutConfig.newsletterText} · Autorización opcional de vista
        previa.
      </label>
    );
  return (
    <div className="newsletter-authorization">
      <p>{state.checkoutConfig.newsletterText}</p>
      {policy?.ready ? (
        <>
          <label className="co-newsletter">
            <input
              type="checkbox"
              checked={state.wantsNewsletter}
              onChange={(event) =>
                state.setWantsNewsletter(event.target.checked)
              }
            />
            <span>{policy.text}</span>
          </label>
          <p>
            Responsable: {policy.seller.legalName}.{" "}
            {policy.seller.notificationAddress}. {policy.seller.email}.{" "}
            {policy.seller.phone}.
          </p>
          <p>
            Consulta{" "}
            <a href="/privacidad" target="_blank" rel="noopener noreferrer">
              Datos personales
            </a>
            . Si solicitas la suscripción, recibirás un código para confirmarla.
            Puedes comprar sin suscribirte.
          </p>
        </>
      ) : (
        <p>
          {error ||
            (policy
              ? "La suscripción no está disponible. Puedes continuar con tu compra."
              : "Cargando autorización opcional…")}
          {error && (
            <button type="button" onClick={retry}>
              Reintentar
            </button>
          )}
        </p>
      )}
    </div>
  );
}
