import { useEffect, useRef, useState } from "react";
import api from "../../../lib/api";
import usePageDraft from "../../pages/workspace/usePageDraft";
import {
  CASE_STATUS,
  caseDate,
} from "../../../components/consumer/ConsumerCaseForm";
import "./ConsumerSection.css";
const GROUPS = [
  [
    "identity",
    "Identidad legal",
    [
      ["legalName", "Nombre o razón social (vacío: usa Tienda)"],
      ["nit", "NIT"],
      [
        "notificationAddress",
        "Dirección de notificación judicial (vacío: usa Tienda)",
      ],
      ["email", "Correo de atención (vacío: usa Tienda)", "email"],
      ["phone", "Teléfono (vacío: usa Tienda)"],
    ],
  ],
  [
    "delivery",
    "Entrega y cambios",
    [
      [
        "shippingCountries",
        "Países habilitados para envíos (códigos separados por coma, por ejemplo CO)",
      ],
      [
        "deliveryDays",
        "Plazo máximo total, en días calendario (1–30; vacío: plazo legal de 30)",
        "number",
      ],
      ["pickupInstructions", "Instrucciones y lugar de retiro", "textarea"],
      [
        "commercialChanges",
        "Beneficios de cambios comerciales adicionales",
        "textarea",
      ],
    ],
  ],
  [
    "privacy",
    "Datos personales",
    [
      [
        "privacyEffectiveDate",
        "Fecha de entrada en vigencia de la política",
        "date",
      ],
      [
        "retention",
        "Vigencia de las bases y criterios reales de conservación",
        "textarea",
      ],
      [
        "processors",
        "Encargados, ubicación del tratamiento y transmisiones o transferencias reales",
        "textarea",
      ],
    ],
  ],
];
export default function ConsumerSection() {
  const [tab, setTab] = useState("identity"),
    [form, setForm] = useState(null),
    [document, setDocument] = useState(null),
    [cases, setCases] = useState([]),
    [next, setNext] = useState(""),
    [selected, setSelected] = useState(""),
    [error, setError] = useState(""),
    [pending, setPending] = useState(false),
    [reply, setReply] = useState(""),
    [status, setStatus] = useState("in_review");
  const mounted = useRef(true),
    inFlight = useRef(false),
    savedSettings = useRef(null),
    caseRequest = useRef(0),
    draft = usePageDraft(form ? { config: form, response: reply } : null);
  async function load() {
    setError("");
    try {
      const { data } = await api.get("/api/consumer/admin/settings");
      if (!mounted.current) return;
      setForm(data.config);
      setDocument(data.document);
      savedSettings.current = data.config;
      draft.initialize({ config: data.config, response: "" });
    } catch (e) {
      if (mounted.current)
        setError(
          e.response?.data?.message || "No pudimos cargar la configuración.",
        );
    }
  }
  useEffect(() => {
    mounted.current = true;
    load();
    return () => {
      mounted.current = false;
    };
  }, []);
  async function loadCases(cursor = "") {
    const version = ++caseRequest.current;
    setError("");
    try {
      const { data } = await api.get("/api/consumer/admin/cases", {
        params: { before: cursor },
      });
      if (mounted.current && version === caseRequest.current) {
        setCases(data.cases);
        setNext(data.next);
        setSelected("");
        setReply("");
      }
    } catch (e) {
      if (mounted.current)
        setError(
          e.response?.data?.message || "No pudimos cargar los radicados.",
        );
    }
  }
  async function save(event) {
    event.preventDefault();
    if (inFlight.current) return;
    inFlight.current = true;
    setPending(true);
    setError("");
    try {
      const { data } = await api.put("/api/consumer/admin/settings", {
        config: form,
      });
      if (mounted.current) {
        setForm(data.config);
        setDocument(data.document);
        savedSettings.current = data.config;
        draft.markSaved({ config: data.config, response: "" });
      }
    } catch (e) {
      if (mounted.current)
        setError(
          e.response?.data?.message ||
            "No fue posible guardar las condiciones.",
        );
    } finally {
      inFlight.current = false;
      if (mounted.current) setPending(false);
    }
  }
  async function respond(event) {
    event.preventDefault();
    if (inFlight.current) return;
    inFlight.current = true;
    setPending(true);
    setError("");
    const item = cases.find((c) => c.id === selected);
    try {
      await api.post(`/api/consumer/admin/cases/${item.id}/replies`, {
        revision: item.revision,
        status,
        message: reply,
      });
      setReply("");
      draft.markSaved({ config: savedSettings.current, response: "" });
      await loadCases();
    } catch (e) {
      setError(
        e.response?.data?.message || "No fue posible registrar la respuesta.",
      );
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }
  const group = GROUPS.find((g) => g[0] === tab),
    item = cases.find((c) => c.id === selected);
  return (
    <section className="consumer-admin">
      <header>
        <span>Operación y protección al consumidor</span>
        <h2>Condiciones claras y atención con seguimiento</h2>
        <p>
          Identidad, entregas, datos personales y radicados en un solo lugar.
          Acceso reservado al propietario y administradores.
        </p>
      </header>
      <nav aria-label="Temas de protección al consumidor">
        {[
          ...GROUPS.map((g) => [g[0], g[1]]),
          ["cases", "Peticiones y reclamos"],
        ].map(([id, label]) => (
          <button
            type="button"
            aria-pressed={tab === id}
            key={id}
            disabled={pending}
            onClick={() => {
              setTab(id);
              if (id === "cases") loadCases();
            }}
          >
            {label}
          </button>
        ))}
      </nav>
      {error && (
        <div role="alert">
          {error}{" "}
          <button
            type="button"
            onClick={() => (tab === "cases" ? loadCases() : draft.leave(load))}
          >
            Recargar
          </button>
        </div>
      )}
      {draft.notice && <p role="status">{draft.notice.text}</p>}
      {!form ? (
        <p>Cargando condiciones…</p>
      ) : tab !== "cases" ? (
        <form onSubmit={save}>
          <div className="consumer-admin-layout">
            <fieldset disabled={pending}>
              <legend>{group[1]}</legend>
              {tab === "identity" && (
                <p>
                  Estos datos se publican y se conservan en cada pedido. No se
                  generan datos de empresa ficticios.
                </p>
              )}
              {tab === "delivery" && (
                <>
                  <p>
                    El plazo incluye preparación y transporte y se cuenta desde
                    el día siguiente al pedido. Las tarifas y los destinos se
                    configuran en{" "}
                    <a href="/admin/configuracion/envios">Envíos</a>. Un
                    estimado de transportadora no sustituye el plazo aceptado.
                  </p>
                  <label>
                    <span>
                      <input
                        type="checkbox"
                        checked={form.pickupEnabled}
                        onChange={(e) =>
                          setForm({ ...form, pickupEnabled: e.target.checked })
                        }
                      />{" "}
                      Habilitar retiro en tienda
                    </span>
                  </label>
                </>
              )}
              {group[2].map(([key, label, type = "text"]) => (
                <label key={key}>
                  {label}
                  {type === "textarea" ? (
                    <textarea
                      value={form[key] || ""}
                      maxLength={
                        key === "commercialChanges"
                          ? 3000
                          : key === "processors"
                            ? 2000
                            : 1000
                      }
                      onChange={(e) =>
                        setForm({ ...form, [key]: e.target.value })
                      }
                    />
                  ) : (
                    <input
                      type={type}
                      min={type === "number" ? 1 : undefined}
                      max={type === "number" ? 30 : undefined}
                      step={type === "number" ? 1 : undefined}
                      value={form[key] ?? ""}
                      maxLength={
                        key === "nit"
                          ? 30
                          : key === "phone"
                            ? 40
                            : key === "email"
                              ? 180
                              : 300
                      }
                      onChange={(e) =>
                        setForm({
                          ...form,
                          [key]:
                            type === "number"
                              ? e.target.value === ""
                                ? null
                                : Number(e.target.value)
                              : e.target.value,
                        })
                      }
                    />
                  )}
                </label>
              ))}
            </fieldset>
            <aside>
              <h3>Configuración guardada</h3>
              {document?.readiness.ready ? (
                <p>
                  Identidad, contacto, entrega y política de datos completos.
                  Cada compra también valida destino, tarifa y aceptación.
                </p>
              ) : (
                <>
                  <p>El checkout no permite confirmar hasta completar:</p>
                  <ul>
                    {document?.readiness.missing.map((m) => (
                      <li key={m}>{m}</li>
                    ))}
                  </ul>
                </>
              )}
              <p>
                Los derechos legales no se reducen mediante las condiciones
                comerciales.
              </p>
              <a href="/admin/paginas">Editar la apariencia de las páginas</a>
              <p>
                <a href="/terminos" target="_blank" rel="noopener noreferrer">
                  Ver condiciones públicas
                </a>
              </p>
            </aside>
          </div>
          <footer>
            <button type="submit" disabled={pending || !draft.dirty}>
              {pending ? "Guardando…" : "Guardar condiciones"}
            </button>
            <button
              type="button"
              disabled={pending || !draft.dirty}
              onClick={() => draft.leave(load)}
            >
              Descartar cambios
            </button>
            {draft.dirty && <span>Cambios sin guardar</span>}
          </footer>
        </form>
      ) : (
        <div className="consumer-admin-cases">
          <p>
            La respuesta registrada aquí es visible para el consumidor con su
            radicado y clave. No incluyas notas internas ni datos sensibles. La
            radicación no ejecuta un reembolso: gestiónalo en la orden y deja
            constancia de la solución.
          </p>
          <p>
            Reclamación directa: 15 días hábiles. Consultas de datos: 10 días
            hábiles; reclamos de datos completos: 15 días hábiles. Retracto:
            devolución en hasta 15 días calendario una vez satisfechos los
            requisitos legales. Incumplimiento de entrega: devolución íntegra en
            hasta 15 días calendario. No uses el plazo comercial de cambios para
            rechazar un derecho legal.
          </p>
          <button type="button" onClick={() => loadCases()} disabled={pending}>
            Actualizar radicados
          </button>
          <div className="consumer-admin-layout">
            <div>
              {cases.length === 0 && <p>No hay solicitudes en esta página.</p>}
              {cases.map((c) => (
                <button
                  className="consumer-case-item"
                  key={c.id}
                  type="button"
                  disabled={pending}
                  aria-pressed={selected === c.id}
                  onClick={() => {
                    if (
                      reply &&
                      !window.confirm("¿Descartar la respuesta sin guardar?")
                    )
                      return;
                    setSelected(c.id);
                    setReply("");
                  }}
                >
                  <strong>{c.reference}</strong>
                  <span>{c.subject}</span>
                  <small>
                    {CASE_STATUS[c.status]} · {caseDate(c.createdAt)}
                  </small>
                </button>
              ))}
              {next && (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => loadCases(next)}
                >
                  Radicados anteriores
                </button>
              )}
            </div>
            {item && (
              <article>
                <h3>{item.subject}</h3>
                <p>
                  {item.name} · {item.contact}
                </p>
                <p>
                  Pedido informado: {item.orderNumber || "Sin pedido asociado"}
                </p>
                <p>{item.message}</p>
                {item.preferredRefundMethod && (
                  <p>
                    Medio de devolución preferido: {item.preferredRefundMethod}
                  </p>
                )}
                <ol>
                  {item.history.map((h, i) => (
                    <li key={i}>
                      {caseDate(h.at)} · {CASE_STATUS[h.status]}
                      <p>{h.message}</p>
                    </li>
                  ))}
                </ol>
                <form onSubmit={respond}>
                  <label>
                    Estado
                    <select
                      aria-label="Estado"
                      value={status}
                      onChange={(e) => setStatus(e.target.value)}
                    >
                      {["in_review", "answered", "closed"].map((s) => (
                        <option key={s} value={s}>
                          {CASE_STATUS[s]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Respuesta pública
                    <textarea
                      required
                      minLength={10}
                      maxLength={4000}
                      value={reply}
                      onChange={(e) => setReply(e.target.value)}
                    />
                  </label>
                  <button type="submit" disabled={pending}>
                    {pending
                      ? "Registrando…"
                      : "Registrar respuesta para el consumidor"}
                  </button>
                </form>
              </article>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
