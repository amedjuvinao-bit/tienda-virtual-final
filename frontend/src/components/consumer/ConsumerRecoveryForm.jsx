import { useRef, useState } from "react";
import api from "../../lib/api";
import { ContactButton } from "../information-page/ContactMaterial";
import { newCaseKey } from "./consumerCaseAccess";
export default function ConsumerRecoveryForm({
  config,
  preview,
  onRecovered,
  onPending,
}) {
  const [sent, setSent] = useState(false),
    [pending, setPending] = useState(false),
    [notice, setNotice] = useState(""),
    [error, setError] = useState("");
  const lock = useRef(false),
    key = useRef("");
  async function submit(event) {
    event.preventDefault();
    if (preview || lock.current) return;
    const fields = Object.fromEntries(new FormData(event.currentTarget));
    lock.current = true;
    setPending(true);
    onPending?.(true);
    setError("");
    try {
      if (!sent) {
        const { data } = await api.post(
          "/api/consumer/cases/recovery/request",
          fields,
        );
        setNotice(data.message);
        setSent(true);
      } else {
        key.current ||= newCaseKey();
        const { data } = await api.post(
          "/api/consumer/cases/recovery/confirm",
          { ...fields, accessKey: key.current },
        );
        onRecovered({ receipt: data, key: key.current });
      }
    } catch (e) {
      setError(
        e.response?.data?.message ||
          "No pudimos recuperar el acceso. Intenta de nuevo o contacta con la tienda.",
      );
    } finally {
      lock.current = false;
      setPending(false);
      onPending?.(false);
    }
  }
  return (
    <form className="consumer-track" onSubmit={submit}>
      <p>
        Recibe un código en el correo que registraste al radicar. Después podrás
        descargar una nueva clave. Si solo registraste un teléfono,{" "}
        <a href="/contacto">contacta con la tienda</a> para verificar tu
        identidad y recibir asistencia.
      </p>
      <fieldset className="consumer-fields" disabled={pending || preview}>
        <label>
          Radicado a recuperar
          <input
            name="reference"
            required
            maxLength={60}
            autoComplete="off"
            readOnly={sent}
          />
        </label>
        <label>
          Correo registrado
          <input
            name="email"
            type="email"
            required
            maxLength={180}
            autoComplete="email"
            readOnly={sent}
          />
        </label>
        {sent && (
          <label>
            Código recibido por correo
            <input
              name="code"
              required
              inputMode="numeric"
              pattern="[0-9]{6}"
              minLength={6}
              maxLength={6}
              autoComplete="one-time-code"
            />
          </label>
        )}
      </fieldset>
      {notice && <p role="status">{notice}</p>}
      {error && <p role="alert">{error}</p>}
      <ContactButton
        config={config}
        type="submit"
        disabled={pending || preview}
      >
        {pending
          ? "Procesando…"
          : sent
            ? "Verificar código y recuperar acceso"
            : "Enviar código de recuperación"}
      </ContactButton>
      {sent && (
        <ContactButton
          config={config}
          type="button"
          disabled={pending || preview}
          onClick={() => {
            setSent(false);
            setNotice("");
            setError("");
          }}
        >
          Solicitar otro código
        </ContactButton>
      )}
    </form>
  );
}
