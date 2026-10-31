import { useEffect, useRef } from "react";
export default function ConsumerPolicyDialog({ visible, onClose, slug }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!visible) return;
    const el = ref.current;
    const previous = document.activeElement;
    const overflow = document.body.style.overflow;
    el?.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      el?.close();
      document.body.style.overflow = overflow;
      previous?.focus?.({ preventScroll: true });
    };
  }, [visible]);
  if (!visible) return null;
  return (
    <dialog
      ref={ref}
      className="consumer-policy-dialog"
      aria-label="Condiciones vigentes"
      onCancel={onClose}
    >
      <p>
        Consulta la información vigente de la tienda y conserva tu compra
        abierta.
      </p>
      <a href={`/${slug}`} target="_blank" rel="noopener noreferrer">
        Abrir información vigente
      </a>
      <button type="button" onClick={onClose}>
        Cerrar
      </button>
    </dialog>
  );
}
