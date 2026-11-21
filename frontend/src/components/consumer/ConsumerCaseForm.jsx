import { cloneElement, useId, useRef, useState } from "react";
import api from "../../lib/api";
import {
  ContactGlass,
  ContactButton,
} from "../information-page/ContactMaterial";
import { downloadText } from "./ConsumerReceipt";
import { CASE_STATUS, caseDate } from "./consumerCaseModel";
import ConsumerRecoveryForm from "./ConsumerRecoveryForm";
import {
  newCaseKey,
  caseOrderContext,
  caseNavigation,
} from "./consumerCaseAccess";
import {
  ArrowRight,
  FileText,
  Hash,
  LockKeyhole,
  Mail,
  MessageSquare,
  Package,
  Search,
  UserRound,
} from "lucide-react";
import ConsumerCaseField from "./ConsumerCaseField";
import ConsumerCaseGuide from "./ConsumerCaseGuide";
import { buildClaimsPage } from "./claimsPageConfig";
export { CASE_STATUS, caseDate } from "./consumerCaseModel";
export function caseReceiptText(receipt, key) {
  return [
    `CONSTANCIA DE RADICACIÓN`,
    `Radicado: ${receipt.reference}`,
    `Fecha y hora (Colombia): ${caseDate(receipt.createdAt)}`,
    `Asunto: ${receipt.subject}`,
    `Tipo: ${receipt.type}`,
    `Pedido: ${receipt.orderNumber || "No informado"}`,
    receipt.message,
    `Medio de devolución solicitado: ${receipt.preferredRefundMethod || "No informado"}`,
    `Política de datos: ${receipt.policyVersion}`,
    `Clave privada: ${key}`,
    "Guarda esta clave. No la publiques ni la compartas. Consulta el seguimiento en /pqr.",
    ...(receipt.history || []).flatMap((h) => [
      `${caseDate(h.at)} · ${CASE_STATUS[h.status] || h.status}`,
      h.message,
    ]),
  ].join("\n\n");
}
export default function ConsumerCaseForm({ config, document, preview }) {
  const [tab, setTab] = useState(() => caseNavigation(document.types).tab),
    [receipt, setReceipt] = useState(null),
    [tracked, setTracked] = useState(null),
    [pending, setPending] = useState(false),
    [error, setError] = useState(""),
    [attempted, setAttempted] = useState(false),
    [recovered, setRecovered] = useState(null),
    [orderContext, setOrderContext] = useState(caseOrderContext);
  const request = useRef(null),
    requestHeaders = useRef({}),
    key = useRef(""),
    trackForm = useRef(null),
    createForm = useRef(null),
    inFlight = useRef(false);
  async function submit(event) {
    event.preventDefault();
    if (preview || inFlight.current) return;
    if (!request.current) {
      try {
        key.current = newCaseKey();
      } catch {
        setError(
          "Este navegador no permite generar un acceso seguro. Utiliza un navegador actualizado o los canales de contacto.",
        );
        return;
      }
      const fields = new FormData(event.currentTarget);
      request.current = {
        ...Object.fromEntries(fields),
        privacyAuthorized: fields.get("privacyAuthorized") === "on",
        privacyVersion: document.version,
        accessKey: key.current,
        ...(orderContext ? { orderId: orderContext.orderId } : {}),
      };
      requestHeaders.current = orderContext?.headers || {};
    }
    inFlight.current = true;
    setPending(true);
    setError("");
    setAttempted(true);
    try {
      const { data } = await api.post("/api/consumer/cases", request.current, {
        headers: requestHeaders.current,
      });
      setReceipt(data);
    } catch (e) {
      setError(
        e.response?.data?.message ||
          "No pudimos confirmar la radicación. Reintenta con el mismo formulario: conservamos la clave para evitar duplicados.",
      );
      if (e.response?.data?.error === "CONSUMER_POLICY_CHANGED") {
        if (createForm.current?.elements.privacyAuthorized)
          createForm.current.elements.privacyAuthorized.checked = false;
        window.dispatchEvent(new Event("consumer-policy-refresh"));
      }
      if (
        e.response?.status === 400 ||
        e.response?.data?.error === "CONSUMER_ORDER_ACCESS_INVALID" ||
        e.response?.data?.error === "CONSUMER_POLICY_CHANGED"
      ) {
        request.current = null;
        setAttempted(false);
        if (e.response?.data?.error === "CONSUMER_ORDER_ACCESS_INVALID")
          setOrderContext(null);
      }
    } finally {
      setPending(false);
      inFlight.current = false;
    }
  }
  async function track(event) {
    event.preventDefault();
    if (preview || inFlight.current) return;
    inFlight.current = true;
    setPending(true);
    setError("");
    setTracked(null);
    try {
      const { data } = await api.post(
        "/api/consumer/cases/track",
        Object.fromEntries(new FormData(event.currentTarget)),
      );
      setTracked(data);
    } catch (e) {
      setError(
        e.response?.data?.message ||
          "No pudimos consultar el radicado. Intenta de nuevo.",
      );
    } finally {
      setPending(false);
      inFlight.current = false;
    }
  }
  const result =
    tab === "create"
      ? receipt
      : tab === "recover"
        ? recovered?.receipt
        : tracked;
  const resultKey = tab === "recover" ? recovered?.key : key.current;
  const c = config.claimsPage || buildClaimsPage();
  const panelId = useId();
  const field = (name, input, Icon, wide = false) => (
    <ConsumerCaseField
      config={config}
      label={c.fields[name].label}
      icon={Icon}
      wide={wide}
    >
      {cloneElement(input, { placeholder: c.fields[name].placeholder })}
    </ConsumerCaseField>
  );
  const tabs = [
    ["create", c.createTabText || "Nueva solicitud", FileText],
    ["track", c.trackTabText || "Consultar solicitud", Search],
    ["recover", c.recoverTabText || "Recuperar acceso", LockKeyhole],
  ];
  return (
    <div className="claims-case-workspace">
      <ContactGlass
        config={config}
        className="consumer-case-tabs claims-tabs"
        aria-label="Acciones de atención"
      >
        {tabs.map(([id, label, Icon]) => (
          <ContactButton
            key={id}
            config={config}
            aria-pressed={tab === id}
            aria-controls={panelId}
            disabled={pending}
            onClick={() => {
              setTab(id);
              setError("");
            }}
          >
            <Icon size={24} strokeWidth={1.5} aria-hidden="true" />
            <span>{label}</span>
            <ArrowRight size={16} aria-hidden="true" />
          </ContactButton>
        ))}
      </ContactGlass>
      <div className="claims-case-grid" data-guide={c.showGuide}>
        <ContactGlass
          config={config}
          className="consumer-case-panel"
          id={panelId}
        >
          <header className="claims-form-heading">
            <h2>
              {tab === "create"
                ? c.createTitle
                : tab === "track"
                  ? c.trackTitle
                  : c.recoverTitle}
            </h2>
            {tab === "create" && c.createHint && <p>{c.createHint}</p>}
            {tab === "track" && c.trackHint && <p>{c.trackHint}</p>}
          </header>
          {preview && (
            <p role="status">
              Vista previa: la radicación y la consulta están desactivadas.
            </p>
          )}
          {error && (
            <p className="claims-notice" role="alert">
              {error}
            </p>
          )}
          {tab === "create" && !receipt && (
            <form
              className="consumer-form"
              onSubmit={submit}
              ref={createForm}
              onInvalidCapture={(event) =>
                event.target.closest("details")?.setAttribute("open", "")
              }
            >
              <fieldset
                className="consumer-fields"
                disabled={pending || attempted || preview}
              >
                {field(
                  "name",
                  <input
                    name="name"
                    required
                    maxLength={180}
                    autoComplete="name"
                  />,
                  UserRound,
                )}
                {field(
                  "contact",
                  <input name="contact" required maxLength={180} />,
                  Mail,
                )}
                {field(
                  "type",
                  <select
                    name="type"
                    aria-label={c.fields.type.label}
                    defaultValue={caseNavigation(document.types).type}
                  >
                    {Object.entries(document.types || {}).map(
                      ([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ),
                    )}
                  </select>,
                  FileText,
                )}
                {field(
                  "orderNumber",
                  <input name="orderNumber" maxLength={80} />,
                  Package,
                )}
                {orderContext && (
                  <p className="consumer-wide">
                    Abriste esta solicitud desde una compra. Verificaremos su
                    acceso y la vincularemos al radicar.{" "}
                    <button type="button" onClick={() => setOrderContext(null)}>
                      Radicar sin vincular una compra
                    </button>
                  </p>
                )}
                {field(
                  "subject",
                  <input name="subject" required maxLength={180} />,
                  MessageSquare,
                  true,
                )}
                {field(
                  "message",
                  <textarea
                    name="message"
                    required
                    minLength={10}
                    maxLength={6000}
                  />,
                  FileText,
                  true,
                )}
                <details className="claims-optional consumer-wide">
                  <summary>{c.optionalText || "Datos opcionales"}</summary>
                  <div className="consumer-fields">
                    <div className="consumer-wide">
                      {field(
                        "recoveryEmail",
                        <input
                          name="recoveryEmail"
                          type="email"
                          maxLength={180}
                          autoComplete="email"
                        />,
                        Mail,
                      )}
                      <small>
                        Si el contacto anterior es un correo, puedes dejar este
                        campo vacío.
                      </small>
                    </div>
                    {field(
                      "preferredRefundMethod",
                      <input name="preferredRefundMethod" maxLength={300} />,
                      FileText,
                      true,
                    )}
                  </div>
                </details>
                <label className="consumer-wide claims-consent">
                  <input type="checkbox" name="privacyAuthorized" required />
                  <span>
                    Autorizo el tratamiento de mis datos para gestionar y
                    responder esta solicitud conforme a la{" "}
                    <a
                      href="/privacidad"
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={
                        preview ? (event) => event.preventDefault() : undefined
                      }
                    >
                      política de datos personales
                    </a>
                    .
                  </span>
                </label>
              </fieldset>
              <ContactButton
                config={config}
                type="submit"
                disabled={pending || preview}
              >
                {pending
                  ? c.submittingText || "Radicando…"
                  : attempted
                    ? c.retrySubmissionText || "Reintentar la misma solicitud"
                    : c.submitText || "Enviar y obtener radicado"}
                <ArrowRight size={16} aria-hidden="true" />
              </ContactButton>
              {c.submitHint && (
                <p className="claims-submit-hint">{c.submitHint}</p>
              )}
            </form>
          )}
          {tab === "track" && (
            <form className="consumer-track" onSubmit={track} ref={trackForm}>
              {field(
                "reference",
                <input
                  name="reference"
                  required
                  maxLength={60}
                  autoComplete="off"
                />,
                Hash,
              )}
              {field(
                "accessKey",
                <input
                  type="password"
                  name="accessKey"
                  required
                  pattern="[a-f0-9]{64}"
                  maxLength={64}
                  autoComplete="off"
                />,
                LockKeyhole,
              )}
              <ContactButton
                config={config}
                type="submit"
                disabled={pending || preview}
              >
                {pending
                  ? c.trackPendingText || "Consultando…"
                  : c.trackSubmitText || "Consultar estado y respuesta"}
                <ArrowRight size={16} aria-hidden="true" />
              </ContactButton>
            </form>
          )}
          {tab === "recover" && !recovered && (
            <ConsumerRecoveryForm
              config={config}
              preview={preview}
              onRecovered={setRecovered}
              onPending={setPending}
            />
          )}
          {result && (
            <div
              className="consumer-case-result"
              role="status"
              aria-live="polite"
            >
              <h2>Radicado {result.reference}</h2>
              <p>
                {caseDate(result.createdAt)} · {CASE_STATUS[result.status]}
              </p>
              <p>{result.subject}</p>
              <p>{result.message}</p>
              {result.orderLinked && (
                <p>Solicitud vinculada a la compra #{result.orderNumber}.</p>
              )}
              {tab === "create" && receipt.emailStatus === "sent" && (
                <p>
                  También enviamos la constancia y la clave al correo
                  registrado.
                </p>
              )}
              {tab === "create" && receipt.emailStatus === "failed" && (
                <p>
                  No pudimos enviar el correo. Tu solicitud está guardada:
                  descarga la constancia y la clave.
                </p>
              )}
              {(tab === "create" || tab === "recover") && (
                <>
                  <p>
                    Guarda la constancia y esta clave privada; la necesitarás
                    para ver la respuesta. Por seguridad no se incluye en
                    enlaces públicos.
                  </p>
                  {tab === "recover" && (
                    <p>
                      Acceso recuperado. La clave anterior dejó de funcionar.
                    </p>
                  )}
                  <code>{resultKey}</code>
                  <ContactButton
                    config={config}
                    onClick={() =>
                      downloadText(
                        `${result.reference}.txt`,
                        caseReceiptText(result, resultKey),
                      )
                    }
                  >
                    Descargar constancia y clave
                  </ContactButton>
                </>
              )}
              <ol>
                {result.history.map((h, i) => (
                  <li key={i}>
                    <time>{caseDate(h.at)}</time>
                    <strong>{CASE_STATUS[h.status]}</strong>
                    <p>{h.message}</p>
                  </li>
                ))}
              </ol>
            </div>
          )}
          <p className="claims-operation-note">
            Puedes solicitar atención aunque no tengas un pedido. El envío del
            formulario no ejecuta pagos ni devoluciones.
          </p>
        </ContactGlass>
        {c.showGuide && (
          <ConsumerCaseGuide config={config} c={c} preview={preview} />
        )}
      </div>
    </div>
  );
}
