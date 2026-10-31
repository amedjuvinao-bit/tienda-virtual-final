import { useEffect, useRef, useState } from "react";
import api from "../../lib/api";
import usePageDraft from "../pages/workspace/usePageDraft";
import {
  CASE_STATUS,
  caseDate,
} from "../../components/consumer/consumerCaseModel";
import "../components/consumerAdmin.css";
import ConsumerAssistedRecovery from "./ConsumerAssistedRecovery";
export default function ConsumerCasesPanel({ order }) {
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
  const cursorRef = useRef(""),
    current = useRef({});
  current.current = { dirty: draft.dirty, pending, selected };
  const orderId = String(order?._id || "");
  async function load(cursor = "", background = false) {
    if (
      background &&
      (lock.current ||
        current.current.dirty ||
        current.current.pending ||
        cursorRef.current)
    )
      return;
    const request = ++version.current;
    if (!background) {
      current.current.pending = true;
      setPending(true);
    }
    setError("");
    try {
      const { data } = await api.get("/api/consumer/admin/cases", {
        params: { before: cursor, ...(orderId ? { orderId } : {}) },
      });
      if (
        mounted.current &&
        request === version.current &&
        (!background || !current.current.dirty)
      ) {
        setCases((previous) => {
          const selectedItem =
            background &&
            previous.find((c) => c.id === current.current.selected);
          return selectedItem &&
            !data.cases.some((c) => c.id === selectedItem.id)
            ? [...data.cases, selectedItem]
            : data.cases;
        });
        setNext(data.next);
        cursorRef.current = cursor;
        if (!background) {
          setSelected("");
          setReply("");
          draft.initialize({ reply: "" });
        }
      }
    } catch (e) {
      if (mounted.current && request === version.current)
        setError(
          e.response?.data?.message || "No pudimos cargar las solicitudes.",
        );
    } finally {
      if (!background && mounted.current && request === version.current) {
        current.current.pending = false;
        setPending(false);
      }
    }
  }
  useEffect(() => {
    mounted.current = true;
    load();
    const refresh = () => {
      if (document.visibilityState !== "hidden") load("", true);
    };
    const timer = window.setInterval(refresh, 20000);
    window.addEventListener("focus", refresh);
    return () => {
      mounted.current = false;
      version.current++;
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
    };
  }, [orderId]);
  async function linkOrder(event) {
    event.preventDefault();
    if (lock.current || !item) return;
    const fields = new FormData(event.currentTarget);
    lock.current = true;
    version.current++;
    setPending(true);
    setError("");
    try {
      await api.post(`/api/consumer/admin/cases/${item.id}/order`, {
        orderNumber: fields.get("orderNumber"),
        identityVerified: fields.get("identityVerified") === "on",
        revision: item.revision,
      });
      if (mounted.current) await load();
    } catch (e) {
      if (mounted.current)
        setError(e.response?.data?.message || "No pudimos vincular la compra.");
    } finally {
      lock.current = false;
      if (mounted.current) setPending(false);
    }
  }
  async function respond(e) {
    e.preventDefault();
    if (lock.current || !item) return;
    lock.current = true;
    version.current++;
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
        <h2>
          {orderId
            ? `Peticiones y reclamos de la compra #${order.orderNumber}`
            : "Peticiones y reclamos"}
        </h2>
        <p>
          Aquí llegan las solicitudes enviadas por los clientes. Responde el
          radicado y abre la compra para gestionar su entrega, cambio o
          devolución.
        </p>
        <p>
          El listado se actualiza cada 20 segundos y al volver a esta pestaña.
          Una respuesta en edición se conserva.
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
                {item.linkedOrderId
                  ? "Vínculo verificado. "
                  : "Número indicado por el cliente; vínculo pendiente de verificar. "}
                <a
                  href={`/admin/ordenes?q=${encodeURIComponent(item.orderNumber)}`}
                >
                  Buscar la compra #{item.orderNumber} en Órdenes
                </a>
              </p>
            ) : (
              <p>Esta solicitud no tiene número de compra informado.</p>
            )}
            {!item.linkedOrderId && (
              <form onSubmit={linkOrder} key={`${item.id}-${item.revision}`}>
                <fieldset disabled={pending || draft.dirty}>
                  <legend>Vincular con una compra</legend>
                  <label>
                    Número exacto de pedido
                    <input
                      name="orderNumber"
                      required
                      maxLength={80}
                      defaultValue={order?.orderNumber || item.orderNumber}
                    />
                  </label>
                  <label>
                    <input name="identityVerified" type="checkbox" required />
                    Verifiqué la identidad del solicitante y su relación con
                    esta compra.
                  </label>
                  <button type="submit">Vincular solicitud a la compra</button>
                </fieldset>
              </form>
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
            <ConsumerAssistedRecovery
              key={item.id}
              item={item}
              disabled={pending || draft.dirty}
              onRecovered={(revision) =>
                setCases((previous) =>
                  previous.map((c) =>
                    c.id === item.id ? { ...c, revision } : c,
                  ),
                )
              }
            />
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
