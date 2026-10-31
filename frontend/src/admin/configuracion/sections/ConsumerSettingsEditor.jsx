import { useEffect, useRef, useState } from "react";
import api from "../../../lib/api";
import usePageDraft from "../../pages/workspace/usePageDraft";
import "../../components/consumerAdmin.css";
const PRIVACY_FIELDS = [
  ["privacyEffectiveDate", "¿Desde cuándo rige la política de datos?", "date"],
  [
    "retention",
    "¿Durante cuánto tiempo conservas los datos?",
    "textarea",
    "Indica los periodos y criterios reales de conservación.",
  ],
  [
    "processors",
    "¿Qué proveedores procesan los datos de tus clientes?",
    "textarea",
    "Identifica los servicios de pagos, envíos, alojamiento u otros que utilices y dónde se realiza el tratamiento.",
  ],
];
export default function ConsumerSettingsEditor({
  section = "privacy",
  countries = [],
  onDirtyChange,
}) {
  const delivery = section === "delivery",
    path = delivery
      ? "/api/consumer/admin/delivery-settings"
      : "/api/consumer/admin/settings";
  const [form, setForm] = useState(null),
    [document, setDocument] = useState(null),
    [error, setError] = useState(""),
    [pending, setPending] = useState(false),
    [attempt, setAttempt] = useState(0);
  const draft = usePageDraft(form),
    lock = useRef(false),
    mounted = useRef(true);
  function apply(data) {
    setForm(data.config);
    setDocument(data.document);
  }
  useEffect(() => {
    mounted.current = true;
    const controller = new AbortController();
    setError("");
    api
      .get(path, { signal: controller.signal })
      .then(({ data }) => {
        if (!controller.signal.aborted) {
          apply(data);
          draft.initialize(data.config);
        }
      })
      .catch((e) => {
        if (!controller.signal.aborted)
          setError(e.response?.data?.message || "No pudimos cargar los datos.");
      });
    return () => {
      mounted.current = false;
      controller.abort();
    };
  }, [path, attempt]);
  useEffect(() => {
    onDirtyChange?.(draft.dirty);
    return () => onDirtyChange?.(false);
  }, [draft.dirty, onDirtyChange]);
  async function save(e) {
    e.preventDefault();
    if (lock.current) return;
    lock.current = true;
    setPending(true);
    setError("");
    try {
      const { data } = await api.put(path, { config: form });
      if (mounted.current) {
        apply(data);
        draft.markSaved(data.config);
      }
    } catch (err) {
      if (mounted.current)
        setError(err.response?.data?.message || "No fue posible guardar.");
    } finally {
      lock.current = false;
      if (mounted.current) setPending(false);
    }
  }
  const update = (key, value) => setForm((c) => ({ ...c, [key]: value }));
  const selectedCountries = String(form?.shippingCountries || "")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
  return (
    <section className="consumer-admin">
      <header>
        <h3>
          {delivery
            ? "Condiciones de entrega de la tienda"
            : "Privacidad de tus clientes"}
        </h3>
        <p>
          {delivery
            ? "Define el compromiso que se muestra antes de comprar. La guía, el seguimiento y la entrega de cada pedido se gestionan en Órdenes."
            : "Completa la información que aparecerá en la política pública de datos personales."}
        </p>
      </header>
      {!delivery && document?.seller && (
        <p>
          Datos ya registrados:{" "}
          <strong>
            {document.seller.legalName || "Razón social pendiente"}
          </strong>{" "}
          · NIT {document.seller.nit || "pendiente"}.{" "}
          <a href="/admin/facturacion/configuracion">Editar datos fiscales</a> ·{" "}
          <a href="/admin/configuracion/empresa">
            Editar contactos de la tienda
          </a>
          .
        </p>
      )}
      {error && (
        <p role="alert">
          {error}{" "}
          <button
            type="button"
            onClick={() => draft.leave(() => setAttempt((v) => v + 1))}
          >
            Recargar
          </button>
        </p>
      )}
      {draft.notice && <p role="status">{draft.notice.text}</p>}
      {!form ? (
        !error && <p role="status">Cargando datos…</p>
      ) : (
        <form onSubmit={save}>
          <fieldset disabled={pending}>
            <legend>
              {delivery
                ? "Plazo, destinos y recogida"
                : "Política de datos personales"}
            </legend>
            {delivery ? (
              <>
                <label>
                  Países a los que haces envíos
                  <select
                    aria-label="Agregar país de envío"
                    value=""
                    onChange={(e) => {
                      if (e.target.value)
                        update(
                          "shippingCountries",
                          [
                            ...new Set([...selectedCountries, e.target.value]),
                          ].join(", "),
                        );
                    }}
                  >
                    <option value="">Agregar país…</option>
                    {countries
                      .filter((c) => !selectedCountries.includes(c.code))
                      .map((c) => (
                        <option key={c.code} value={c.code}>
                          {c.name}
                        </option>
                      ))}
                  </select>
                </label>
                <div className="consumer-country-list">
                  {selectedCountries.map((code) => (
                    <button
                      type="button"
                      key={code}
                      aria-label={`Quitar ${countries.find((c) => c.code === code)?.name || code}`}
                      disabled={selectedCountries.length < 2}
                      onClick={() =>
                        update(
                          "shippingCountries",
                          selectedCountries
                            .filter((c) => c !== code)
                            .join(", "),
                        )
                      }
                    >
                      {countries.find((c) => c.code === code)?.name || code} ×
                    </button>
                  ))}
                </div>
                <label>
                  Máximo de días calendario para entregar
                  <input
                    type="number"
                    min="1"
                    max="30"
                    step="1"
                    value={form.deliveryDays ?? ""}
                    onChange={(e) =>
                      update(
                        "deliveryDays",
                        e.target.value === "" ? null : Number(e.target.value),
                      )
                    }
                  />
                </label>
                <p>
                  Incluye preparación y transporte desde el día siguiente al
                  pedido. Si lo dejas vacío, se informa el plazo legal
                  supletorio de 30 días. Los tiempos estimados que ya
                  configuraste para las tarifas se conservan.
                </p>
                <label>
                  <span>
                    <input
                      type="checkbox"
                      checked={form.pickupEnabled}
                      onChange={(e) =>
                        update("pickupEnabled", e.target.checked)
                      }
                    />{" "}
                    Permitir recoger pedidos en la tienda
                  </span>
                </label>
                {form.pickupEnabled && (
                  <label>
                    ¿Dónde y cómo se recoge el pedido?
                    <textarea
                      required
                      maxLength={1000}
                      value={form.pickupInstructions || ""}
                      onChange={(e) =>
                        update("pickupInstructions", e.target.value)
                      }
                    />
                  </label>
                )}
              </>
            ) : (
              PRIVACY_FIELDS.map(([key, label, type, help]) => (
                <label key={key}>
                  {label}
                  {type === "date" ? (
                    <input
                      aria-label={label}
                      type="date"
                      value={form[key] || ""}
                      onChange={(e) => update(key, e.target.value)}
                    />
                  ) : (
                    <textarea
                      aria-label={label}
                      maxLength={key === "processors" ? 2000 : 1000}
                      value={form[key] || ""}
                      onChange={(e) => update(key, e.target.value)}
                    />
                  )}
                  {help && <small>{help}</small>}
                </label>
              ))
            )}
          </fieldset>
          <footer>
            <button type="submit" disabled={pending || !draft.dirty}>
              {pending
                ? "Guardando…"
                : delivery
                  ? "Guardar condiciones de entrega"
                  : "Guardar política de datos"}
            </button>
            <button
              type="button"
              disabled={pending || !draft.dirty}
              onClick={() => draft.leave(() => setAttempt((v) => v + 1))}
            >
              Descartar cambios
            </button>
            <a
              href={delivery ? "/envios" : "/privacidad"}
              target="_blank"
              rel="noopener noreferrer"
            >
              Ver página pública
            </a>
          </footer>
        </form>
      )}
    </section>
  );
}
