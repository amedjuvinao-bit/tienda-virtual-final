import { useEffect, useRef, useState } from "react";
import api from "../../lib/api";
import usePageDraft from "../pages/workspace/usePageDraft";
import {
  CASE_STATUS,
  caseDate,
} from "../../components/consumer/consumerCaseModel";
import "../components/consumerAdmin.css";
export default function ConsumerCasesPanel() {
  const [cases, setCases] = useState([]),
    [next, setNext] = useState(""),
    [selected, setSelected] = useState(""),
    [reply, setReply] = useState(""),
    [status, setStatus] = useState("in_review"),
    [error, setError] = useState(""),
    [pending, setPending] = useState(false);
  const mounted = useRef(true),
    version = useRef(0),
    lock = useRef(false);
  const draft = usePageDraft({ reply });
  async function load(cursor = "") {
    const request = ++version.current;
    setPending(true);
    setError("");
    try {
      const { data } = await api.get("/api/consumer/admin/cases", {
        params: { before: cursor },
      });
      if (mounted.current && request === version.current) {
        setCases(data.cases);
        setNext(data.next);
        setSelected("");
        setReply("");
        draft.initialize({ reply: "" });
      }
    } catch (e) {
      if (mounted.current)
        setError(
          e.response?.data?.message || "No pudimos cargar las solicitudes.",
        );
    } finally {
      if (mounted.current && request === version.current) setPending(false);
    }
  }
  useEffect(() => {
    mounted.current = true;
    load();
    return () => {
      mounted.current = false;
      version.current++;
    };
  }, []);
  async function respond(e) {
    e.preventDefault();
    if (lock.current || !item) return;
    lock.current = true;
    setPending(true);
    setError("");
    try {
      await api.post(`/api/consumer/admin/cases/${item.id}/replies`, {
        revision: item.revision,
        status,
        message: reply,
      });
      if (mounted.current) {
        setReply("");
        draft.markSaved({ reply: "" });
        await load();
      }
    } catch (err) {
      if (mounted.current)
        setError(
          err.response?.data?.message ||
            "No fue posible registrar la respuesta.",
        );
    } finally {
      lock.current = false;
      if (mounted.current) setPending(false);
    }
  }
  const item = cases.find((c) => c.id === selected);
  return (
    <section className="consumer-admin">
      <header>
        <span>Órdenes · Atención al cliente</span>
        <h2>Peticiones y reclamos</h2>
        <p>
          Aquí llegan las solicitudes enviadas por los clientes. Responde el
          radicado y abre la compra para gestionar su entrega, cambio o
          devolución.
        </p>
      </header>
      {error && <p role="alert">{error}</p>}
      <button
        type="button"
        disabled={pending}
        onClick={() => draft.leave(() => load())}
      >
        Actualizar solicitudes
      </button>
      <div className="consumer-admin-layout">
        <div>
          {!cases.length && <p>No hay solicitudes en esta página.</p>}
          {cases.map((c) => (
            <button
              className="consumer-case-item"
              type="button"
              key={c.id}
              disabled={pending}
              aria-pressed={selected === c.id}
              onClick={() =>
                draft.leave(() => {
                  setSelected(c.id);
                  setStatus(c.status === "received" ? "in_review" : c.status);
                  setReply("");
                  draft.initialize({ reply: "" });
                })
              }
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
              onClick={() => draft.leave(() => load(next))}
            >
              Solicitudes anteriores
            </button>
          )}
        </div>
        {item && (
          <article>
            <h3>{item.subject}</h3>
            <p>
              {item.name} · {item.contact}
            </p>
            <p>{item.message}</p>
            {item.orderNumber ? (
              <p>
                <a
                  href={`/admin/ordenes?q=${encodeURIComponent(item.orderNumber)}`}
                >
                  Buscar la compra #{item.orderNumber} en Órdenes
                </a>
              </p>
            ) : (
              <p>Esta solicitud no tiene número de compra informado.</p>
            )}
            {item.preferredRefundMethod && (
              <p>
                Medio de devolución solicitado: {item.preferredRefundMethod}
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
              <fieldset disabled={pending}>
                <legend>Respuesta para el cliente</legend>
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
                <p>
                  El cliente verá esta respuesta al consultar su radicado. Los
                  cambios, devoluciones y reembolsos se ejecutan en la compra
                  correspondiente.
                </p>
                <button type="submit" disabled={pending}>
                  {pending ? "Guardando…" : "Publicar respuesta en el radicado"}
                </button>
              </fieldset>
            </form>
          </article>
        )}
      </div>
    </section>
  );
}
