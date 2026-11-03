import { useId, useState } from "react";
import { ArrowRight, Mail } from "lucide-react";
import api from "../../lib/api";
import useNewsletterPolicy from "./useNewsletterPolicy";
import "./newsletter.css";

export default function NewsletterForm({
  preview = false,
  management = false,
  initialMode = "subscribe",
  label = "Suscribirme",
  placeholder = "Tu correo electrónico",
  successMessage = "",
  errorMessage = "",
}) {
  const id = useId(),
    [mode, setMode] = useState(initialMode),
    [step, setStep] = useState("request");
  const [email, setEmail] = useState(""),
    [code, setCode] = useState(""),
    [authorized, setAuthorized] = useState(false);
  const [confirmedMessage, setConfirmedMessage] = useState("");
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [failed, setFailed] = useState(false);
  const { policy, error, retry } = useNewsletterPolicy(
    !preview && mode === "subscribe",
  );
  const changeMode = () => {
    setConfirmedMessage("");
    setMode(mode === "subscribe" ? "withdraw" : "subscribe");
    setStep("request");
    setCode("");
    setAuthorized(false);
    setMessage("");
    setFailed(false);
  };
  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    if (preview) {
      setFailed(false);
      setMessage("Vista previa: no se guardan datos ni se envían correos.");
      return;
    }
    if (
      mode === "subscribe" &&
      step === "request" &&
      (!policy?.ready || !authorized)
    ) {
      setFailed(true);
      setMessage(
        "Lee y autoriza la información antes de solicitar la suscripción.",
      );
      return;
    }
    setBusy(true);
    setFailed(false);
    setMessage("");
    try {
      const body = { email: email.trim().toLowerCase() };
      const path =
        step === "confirm"
          ? "/confirm"
          : mode === "subscribe"
            ? "/subscribe"
            : "/request-withdrawal";
      if (step === "confirm") {
        body.code = code;
        body.intent = mode;
      } else if (mode === "subscribe") {
        body.consent = authorized;
        body.version = policy.version;
      }
      const { data } = await api.post(`/api/newsletter${path}`, body);
      if (data?.ok !== true || typeof data.message !== "string")
        throw new Error("Invalid response");
      setMessage(data.message);
      if (step === "request") setStep("confirm");
      else {
        setStep("done");
        setCode("");
        setAuthorized(false);
        if (mode === "subscribe")
          setConfirmedMessage(
            typeof successMessage === "string" ? successMessage : "",
          );
      }
    } catch (failure) {
      setFailed(true);
      setMessage(
        failure?.response?.data?.message ||
          (typeof errorMessage === "string" && errorMessage) ||
          "No pudimos tramitar la solicitud. Intenta de nuevo o utiliza Peticiones y reclamos.",
      );
      if (failure?.response?.data?.error === "NEWSLETTER_POLICY_CHANGED") {
        retry();
        setStep("request");
        setAuthorized(false);
        setCode("");
      }
    } finally {
      setBusy(false);
    }
  }
  return (
    <form
      className="newsletter-form"
      onSubmit={submit}
      aria-label={
        mode === "subscribe"
          ? "Suscripción a novedades"
          : "Retiro de comunicaciones"
      }
    >
      {management && (
        <div className="newsletter-options">
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setMode("subscribe");
              setStep("confirm");
              setCode("");
              setAuthorized(false);
              setMessage(
                "Introduce el correo y el código de tu solicitud de suscripción.",
              );
              setFailed(false);
              setConfirmedMessage("");
            }}
          >
            Confirmar suscripción pendiente
          </button>
        </div>
      )}
      {step !== "done" && (
        <>
          {mode === "withdraw" && (
            <p>
              Recibe un código para dejar de recibir novedades y ofertas por
              correo. Tus pedidos no cambian.
            </p>
          )}
          <div className="footer-ed__newsletter-fields newsletter-fields">
            <label className="footer-ed__email newsletter-email" htmlFor={id}>
              <Mail size={22} aria-hidden="true" />
              <input
                id={id}
                name="email"
                type="email"
                required
                maxLength={254}
                autoComplete="email"
                aria-label="Correo electrónico"
                placeholder={placeholder}
                value={email}
                disabled={busy}
                onChange={(event) => setEmail(event.target.value)}
              />
            </label>
            {step === "request" && (
              <button
                type="submit"
                className="footer-ed__subscribe newsletter-submit"
                disabled={
                  busy ||
                  (!preview &&
                    mode === "subscribe" &&
                    (!policy?.ready || !authorized))
                }
              >
                <span>
                  {busy
                    ? "Enviando…"
                    : mode === "subscribe"
                      ? label
                      : "Enviar código"}
                </span>
                <ArrowRight size={20} aria-hidden="true" />
              </button>
            )}
          </div>
          {step === "request" && mode === "subscribe" && (
            <div className="newsletter-authorization">
              {preview ? (
                <p>
                  La autorización y los datos del responsable se mostrarán desde
                  la configuración de privacidad de la tienda.
                </p>
              ) : policy?.ready ? (
                <>
                  <label>
                    <input
                      type="checkbox"
                      checked={authorized}
                      onChange={(event) => setAuthorized(event.target.checked)}
                      disabled={busy}
                    />
                    <span>{policy.text}</span>
                  </label>
                  <p>
                    Responsable: {policy.seller.legalName}.{" "}
                    {policy.seller.notificationAddress}. {policy.seller.email}.{" "}
                    {policy.seller.phone}.
                  </p>
                  <p>
                    Consulta finalidades, conservación, proveedores y derechos
                    en <a href="/privacidad">Datos personales</a>. Te enviaremos
                    un código para confirmar que el correo es tuyo.
                  </p>
                </>
              ) : (
                <p role={error ? "alert" : "status"}>
                  {error ||
                    (policy
                      ? "La suscripción estará disponible cuando la tienda complete su información de privacidad."
                      : "Cargando información de suscripción…")}
                  {error && (
                    <button type="button" onClick={retry}>
                      Reintentar
                    </button>
                  )}
                </p>
              )}
            </div>
          )}
          {step === "confirm" && (
            <div className="newsletter-code">
              <label htmlFor={`${id}-code`}>Código de confirmación</label>
              <input
                id={`${id}-code`}
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6}"
                required
                maxLength={6}
                value={code}
                disabled={busy}
                onChange={(event) =>
                  setCode(event.target.value.replace(/\D/g, "").slice(0, 6))
                }
              />
              <button
                className="newsletter-submit"
                type="submit"
                disabled={busy}
              >
                {busy
                  ? "Confirmando…"
                  : mode === "subscribe"
                    ? "Confirmar suscripción"
                    : "Confirmar retiro"}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setStep("request");
                  setCode("");
                  setMessage("");
                  setAuthorized(false);
                }}
              >
                Solicitar otro código
              </button>
            </div>
          )}
        </>
      )}
      {message && (
        <p className="newsletter-message" role={failed ? "alert" : "status"}>
          {message}
        </p>
      )}
      {confirmedMessage && (
        <p className="newsletter-message">{confirmedMessage}</p>
      )}
      <div className="newsletter-options">
        {step === "request" && (
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setStep("confirm");
              setMessage(
                "Introduce el correo y el código de la solicitud que deseas confirmar.",
              );
              setFailed(false);
            }}
          >
            Confirmar un código
          </button>
        )}
        <button type="button" disabled={busy} onClick={changeMode}>
          {mode === "subscribe"
            ? "Dejar de recibir novedades"
            : "Quiero suscribirme"}
        </button>
        <a href="/pqr?tipo=privacy_claim">Ayuda con mis datos</a>
      </div>
    </form>
  );
}
