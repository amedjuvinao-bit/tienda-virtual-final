import { useRef, useState } from "react";
import api from "../../lib/api";
import { newCaseKey } from "../../components/consumer/consumerCaseAccess";
import { downloadText } from "../../components/consumer/ConsumerReceipt";
export default function ConsumerAssistedRecovery({
  item,
  disabled,
  onRecovered,
}) {
  const request = useRef(null),
    lock = useRef(false);
  const [pending, setPending] = useState(false),
    [result, setResult] = useState(null),
    [error, setError] = useState("");
  async function submit(event) {
    event.preventDefault();
    if (disabled || lock.current) return;
    lock.current = true;
    setPending(true);
    setError("");
    try {
      const fields = Object.fromEntries(new FormData(event.currentTarget));
      request.current ||= {
        ...fields,
        identityVerified: fields.identityVerified === "on",
        revision: item.revision,
        accessKey: newCaseKey(),
      };
      const { data } = await api.post(
        `/api/consumer/admin/cases/${item.id}/recovery`,
        request.current,
      );
      setResult({ ...data, key: request.current.accessKey });
      onRecovered(data.revision);
    } catch (e) {
      setError(
        e.response?.data?.message ||
          "No pudimos confirmar la recuperación. Reintenta con los mismos datos.",
      );
      if ([400, 409].includes(e.response?.status)) request.current = null;
    } finally {
      lock.current = false;
      setPending(false);
    }
  }
  return (
    <details className="consumer-assisted-recovery">
      <summary>Asistir a un cliente que perdió su clave</summary>
      <p>
        Usa este procedimiento después de verificar la identidad por un canal
        registrado. La nueva clave se entrega únicamente a esa persona. Quedan
        registrados el operador, la fecha y el motivo.
      </p>
      {error && <p role="alert">{error}</p>}
      {!result ? (
        <form onSubmit={submit}>
          <fieldset disabled={disabled || pending}>
            <label>
              Cómo verificaste la identidad
              <textarea
                name="reason"
                required
                minLength={10}
                maxLength={1000}
              />
            </label>
            <label>
              <input type="checkbox" name="identityVerified" required />
              Verifiqué la identidad mediante el contacto registrado.
            </label>
            <button type="submit">
              {pending ? "Recuperando…" : "Generar nueva clave para el cliente"}
            </button>
          </fieldset>
        </form>
      ) : (
        <div role="status">
          <p>
            Clave renovada. La anterior dejó de funcionar. Entrégala al cliente
            por el canal verificado.
          </p>
          <code style={{ overflowWrap: "anywhere" }}>{result.key}</code>
          <button
            type="button"
            onClick={() =>
              downloadText(
                `${result.reference}-acceso.txt`,
                `Radicado: ${result.reference}\nClave privada: ${result.key}\nConsulta en la página Peticiones y reclamos de la tienda. No compartas esta clave.`,
              )
            }
          >
            Descargar acceso para el cliente
          </button>
        </div>
      )}
    </details>
  );
}
