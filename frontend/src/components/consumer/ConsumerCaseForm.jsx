import { useRef, useState } from "react";
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
  return (
    <ContactGlass config={config} className="consumer-case-panel">
      <div className="consumer-case-tabs" aria-label="Acciones de atención">
        <ContactButton
          config={config}
          aria-pressed={tab === "create"}
          disabled={pending}
          onClick={() => {
            setTab("create");
            setError("");
          }}
        >
          Radicar solicitud
        </ContactButton>
        <ContactButton
          config={config}
          aria-pressed={tab === "track"}
          disabled={pending}
          onClick={() => {
            setTab("track");
            setError("");
          }}
        >
          Consultar radicado
        </ContactButton>
        <ContactButton
          config={config}
          aria-pressed={tab === "recover"}
          disabled={pending}
          onClick={() => {
            setTab("recover");
            setError("");
          }}
        >
          Recuperar acceso
        </ContactButton>
      </div>
      <p>
        El número de pedido es opcional. Puedes presentar solicitudes sobre
        entrega, retracto, garantía o datos personales aunque el portal de
        cambios comerciales no esté disponible. No se tramitan pagos ni
        devoluciones automáticamente al enviar este formulario.
      </p>
      {preview && (
        <p role="status">
          Vista previa: la radicación y la consulta están desactivadas.
        </p>
      )}
      {error && <p role="alert">{error}</p>}
      {tab === "create" && !receipt && (
        <form className="consumer-form" onSubmit={submit} ref={createForm}>
          <fieldset
            className="consumer-fields"
            disabled={pending || attempted || preview}
          >
            <label>
              Nombre
              <input name="name" required maxLength={180} autoComplete="name" />
            </label>
            <label>
              Correo o teléfono de contacto
              <input name="contact" required maxLength={180} />
            </label>
            <label>
              Correo para constancia y recuperación (opcional)
              <input
                name="recoveryEmail"
                type="email"
                maxLength={180}
                autoComplete="email"
              />
              <small>
                Si el contacto anterior es un correo, puedes dejar este campo
                vacío.
              </small>
            </label>
            <label>
              Tipo de solicitud
              <select
                name="type"
                aria-label="Tipo de solicitud"
                defaultValue={caseNavigation(document.types).type}
              >
                {Object.entries(document.types || {}).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Número de pedido (opcional)
              <input name="orderNumber" maxLength={80} />
            </label>
            {orderContext && (
              <p className="consumer-wide">
                Abriste esta solicitud desde una compra. Verificaremos su acceso
                y la vincularemos al radicar.{" "}
                <button type="button" onClick={() => setOrderContext(null)}>
                  Radicar sin vincular una compra
                </button>
              </p>
            )}
            <label className="consumer-wide">
              Asunto
              <input name="subject" required maxLength={180} />
            </label>
            <label className="consumer-wide">
              Describe tu solicitud
              <textarea
                name="message"
                required
                minLength={10}
                maxLength={6000}
              />
            </label>
            <label className="consumer-wide">
              Si solicitas devolución, ¿qué medio de pago prefieres? (opcional)
              <input
                name="preferredRefundMethod"
                maxLength={300}
                placeholder="Describe el medio; no escribas números de tarjetas ni contraseñas"
              />
            </label>
            <label className="consumer-wide">
              <span>
                <input
                  type="checkbox"
                  name="privacyAuthorized"
                  required
                  style={{ width: 18, minHeight: 18, marginRight: 8 }}
                />
                Autorizo el tratamiento de mis datos para gestionar y responder
                esta solicitud conforme a la{" "}
                <a href="/privacidad" target="_blank" rel="noopener noreferrer">
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
              ? "Radicando…"
              : attempted
                ? "Reintentar la misma solicitud"
                : "Enviar y obtener radicado"}
          </ContactButton>
        </form>
      )}
      {tab === "track" && (
        <form className="consumer-track" onSubmit={track} ref={trackForm}>
          <label>
            Radicado
            <input
              name="reference"
              required
              maxLength={60}
              autoComplete="off"
            />
          </label>
          <label>
            Clave privada de seguimiento
            <input
              type="password"
              name="accessKey"
              required
              pattern="[a-f0-9]{64}"
              maxLength={64}
              autoComplete="off"
            />
          </label>
          <ContactButton
            config={config}
            type="submit"
            disabled={pending || preview}
          >
            {pending ? "Consultando…" : "Consultar estado y respuesta"}
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
        <div className="consumer-case-result" role="status" aria-live="polite">
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
              También enviamos la constancia y la clave al correo registrado.
            </p>
          )}
          {tab === "create" && receipt.emailStatus === "failed" && (
            <p>
              No pudimos enviar el correo. Tu solicitud está guardada: descarga
              la constancia y la clave.
            </p>
          )}
          {(tab === "create" || tab === "recover") && (
            <>
              <p>
                Guarda la constancia y esta clave privada; la necesitarás para
                ver la respuesta. Por seguridad no se incluye en enlaces
                públicos.
              </p>
              {tab === "recover" && (
                <p>Acceso recuperado. La clave anterior dejó de funcionar.</p>
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
    </ContactGlass>
  );
}
