import React, { useEffect, useId, useRef, useState } from "react";
import { ImagePlus, Trash2 } from "lucide-react";
import { uploadAdminImage } from "./uploadAdminImage";
import "./adminImageUpload.css";
export default function AdminImageUploadField({
  label,
  value,
  onChange,
  onBusyChange,
  disabled = false,
}) {
  const id = useId(),
    callbacks = useRef({ onChange, onBusyChange }),
    request = useRef(null),
    mounted = useRef(false);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [success, setSuccess] = useState(false);
  callbacks.current = { onChange, onBusyChange };
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (request.current) {
        request.current.abort();
        callbacks.current.onBusyChange?.(false);
      }
    };
  }, []);
  async function choose(event) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file || busy || disabled) return;
    setError("");
    setSuccess(false);
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("Selecciona una imagen JPG, PNG o WebP.");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setError("La imagen debe pesar máximo 8 MB.");
      return;
    }
    const controller = new AbortController();
    request.current = controller;
    setBusy(true);
    callbacks.current.onBusyChange?.(true);
    try {
      const url = await uploadAdminImage(file, { signal: controller.signal });
      if (!mounted.current || controller.signal.aborted) return;
      callbacks.current.onChange(url);
      setSuccess(true);
    } catch (failure) {
      if (mounted.current && !controller.signal.aborted)
        setError(failure.message || "No se pudo cargar la imagen.");
    } finally {
      if (request.current === controller) {
        request.current = null;
        if (mounted.current) {
          setBusy(false);
          callbacks.current.onBusyChange?.(false);
        }
      }
    }
  }
  return (
    <section className="admin-image-upload" aria-label={label}>
      <div className="admin-image-upload__preview">
        {value ? (
          <img src={value} alt={label} />
        ) : (
          <ImagePlus size={28} aria-hidden="true" />
        )}
      </div>
      <div className="admin-image-upload__body">
        <strong>{label}</strong>
        <p>Selecciona una imagen de tu equipo. Se cargará a Cloudinary.</p>
        <div className="admin-image-upload__actions">
          <label htmlFor={id} className="admin-image-upload__pick">
            <ImagePlus size={16} aria-hidden="true" />
            {busy
              ? "Cargando…"
              : value
                ? "Cambiar imagen"
                : "Seleccionar imagen"}
            <input
              id={id}
              aria-label={`Seleccionar imagen de ${label}`}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              disabled={disabled || busy}
              onChange={choose}
            />
          </label>
          {value && (
            <button
              type="button"
              disabled={disabled || busy}
              onClick={() => {
                callbacks.current.onChange("");
                setError("");
                setSuccess(false);
              }}
            >
              <Trash2 size={16} aria-hidden="true" />
              Quitar imagen
            </button>
          )}
        </div>
        {busy && <p role="status">Cargando imagen…</p>}
        {error && <p role="alert">{error}</p>}
        {success && !busy && (
          <p role="status">
            Imagen cargada. Guarda los cambios para publicarla.
          </p>
        )}
        <small>JPG, PNG o WebP · máximo 8 MB</small>
      </div>
    </section>
  );
}
