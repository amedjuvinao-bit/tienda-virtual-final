import React, { useEffect, useRef } from "react";
import { X } from "lucide-react";
export default function CatalogFilterDrawer({ onClose, children }) {
  const surface = useRef(null);
  useEffect(() => {
    const previous = document.activeElement,
      overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    surface.current.querySelector("button")?.focus();
    const keydown = (event) => {
      if (event.key === "Escape") onClose();
      if (event.key !== "Tab") return;
      const nodes = [
        ...surface.current.querySelectorAll(
          'button:not(:disabled),input,select,[tabindex="0"]',
        ),
      ].filter((n) => n.getClientRects().length);
      const first = nodes[0],
        last = nodes.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      }
      if (!event.shiftKey && document.activeElement === last) {
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
  return (
    <>
      <div className="cpv-overlay" onClick={onClose} />
      <aside
        ref={surface}
        className="cpv-drawer"
        role="dialog"
        aria-modal="true"
        aria-label="Filtros"
      >
        <div className="cpv-drawer-header">
          <h3 className="cpv-drawer-title">Filtros</h3>
          <button
            className="cpv-drawer-close"
            onClick={onClose}
            aria-label="Cerrar filtros"
          >
            <X size={18} />
          </button>
        </div>
        {children}
        <button className="cpv-filter-chip cpv-drawer-apply" onClick={onClose}>
          Ver resultados
        </button>
      </aside>
    </>
  );
}
