import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  FileText,
  LayoutTemplate,
  ShoppingBag,
  X,
} from "lucide-react";
import { PAGE_TYPES, newPageForm, slugify } from "./pageModel";

export default function PageCreateDialog({ onClose, onCreate }) {
  const [step, setStep] = useState(1),
    [form, setForm] = useState(newPageForm),
    [addressEdited, setAddressEdited] = useState(false);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const dialog = useRef(null),
    heading = useRef(null),
    saving = useRef(false);
  useEffect(() => {
    const previous = document.activeElement,
      overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    heading.current?.focus();
    const keydown = (event) => {
      if (event.key === "Escape" && !saving.current) onClose();
      if (event.key !== "Tab") return;
      const nodes = [
        ...dialog.current.querySelectorAll(
          "button:not(:disabled), input:not(:disabled), select:not(:disabled)",
        ),
      ].filter((el) => el.getClientRects().length);
      const first = nodes[0],
        last = nodes.at(-1);
      if (
        event.shiftKey &&
        (document.activeElement === first ||
          !nodes.includes(document.activeElement))
      ) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", keydown);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener("keydown", keydown);
      previous?.focus?.();
    };
  }, [onClose]);
  useEffect(() => {
    heading.current?.focus();
  }, [step]);
  const patch = (value) => {
    setError("");
    setForm((current) => ({ ...current, ...value }));
  };
  const submit = async (event) => {
    event.preventDefault();
    if (step === 1) {
      setStep(2);
      return;
    }
    if (!form.name.trim() || !slugify(form.slug)) {
      setError("Escribe el nombre y una dirección válida para continuar.");
      return;
    }
    if (saving.current) return;
    saving.current = true;
    setBusy(true);
    setError("");
    try {
      await onCreate({
        ...form,
        name: form.name.trim(),
        slug: slugify(form.slug),
      });
    } catch (err) {
      setError(
        err.message ||
          "No se pudo crear la página. Revisa los datos e inténtalo otra vez.",
      );
    } finally {
      saving.current = false;
      setBusy(false);
    }
  };
  return createPortal(
    <div className="pages-dialog-layer">
      <button
        className="pages-dialog-veil"
        aria-label="Cerrar creación"
        disabled={busy}
        onClick={onClose}
      />
      <section
        ref={dialog}
        className="pages-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="page-create-title"
      >
        <header>
          <div>
            <span className="pages-eyebrow">Paso {step} de 2</span>
            <h2 id="page-create-title" ref={heading} tabIndex={-1}>
              {step === 1
                ? "¿Qué quieres crear?"
                : "Dale identidad a tu página"}
            </h2>
          </div>
          <button
            className="pages-icon-button"
            aria-label="Cerrar"
            disabled={busy}
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </header>
        <form onSubmit={submit}>
          {step === 1 ? (
            <div className="pages-create-types">
              {[
                ["custom", FileText],
                ["information", FileText],
                ["catalog", ShoppingBag],
                ["product-detail", LayoutTemplate],
              ].map(([type, Icon]) => (
                <label key={type} data-selected={form.pageType === type}>
                  <input
                    type="radio"
                    name="new-page-type"
                    value={type}
                    checked={form.pageType === type}
                    onChange={() => patch({ pageType: type })}
                  />
                  <Icon size={24} />
                  <span>
                    <strong>{PAGE_TYPES[type].label}</strong>
                    <small>{PAGE_TYPES[type].description}</small>
                  </span>
                  {form.pageType === type && <Check size={18} />}
                </label>
              ))}
            </div>
          ) : (
            <div className="pages-create-fields">
              <label>
                Nombre de la página
                <input
                  autoComplete="off"
                  value={form.name}
                  maxLength={120}
                  onChange={(event) => {
                    const name = event.target.value;
                    patch({
                      name,
                      ...(!addressEdited ? { slug: slugify(name) } : {}),
                    });
                  }}
                  placeholder="Ej. Novedades"
                />
              </label>
              <label>
                Dirección de la página
                <div className="pages-address-input">
                  <span>/pagina/</span>
                  <input
                    value={form.slug}
                    maxLength={160}
                    onChange={(event) => {
                      setAddressEdited(true);
                      patch({ slug: slugify(event.target.value) });
                    }}
                    placeholder="novedades"
                  />
                </div>
                <small>Se completa con el nombre. Puedes personalizarla.</small>
              </label>
              <details className="pages-create-options">
                <summary>Opciones de publicación</summary>
                {[
                  ["enabled", "Página activa"],
                  ["useHeader", "Mostrar encabezado"],
                  ["useFooter", "Mostrar pie de página"],
                ].map(([key, text]) => (
                  <label className="pages-check" key={key}>
                    <input
                      type="checkbox"
                      checked={form[key]}
                      onChange={(event) =>
                        patch({ [key]: event.target.checked })
                      }
                    />
                    {text}
                  </label>
                ))}
              </details>
            </div>
          )}
          {error && (
            <p role="alert" className="pages-feedback" data-tone="error">
              {error}
            </p>
          )}
          <footer>
            {step === 2 ? (
              <button
                type="button"
                className="pages-button"
                disabled={busy}
                onClick={() => setStep(1)}
              >
                <ArrowLeft size={16} /> Atrás
              </button>
            ) : (
              <button type="button" className="pages-button" onClick={onClose}>
                Cancelar
              </button>
            )}
            <button
              className="pages-button pages-button--primary"
              disabled={busy}
            >
              {busy ? "Creando…" : step === 1 ? "Continuar" : "Crear y editar"}
              <ArrowRight size={16} />
            </button>
          </footer>
        </form>
      </section>
    </div>,
    document.body,
  );
}
