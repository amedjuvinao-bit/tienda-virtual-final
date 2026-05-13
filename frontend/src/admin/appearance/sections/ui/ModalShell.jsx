// src/admin/appearance/sections/ui/ModalShell.jsx
import React, { useEffect, useRef } from "react";
import { Button } from "./UiComponents";

// ============================================
// ✅ Modal reusable (overlay + panel)
// (idéntico al que tienes en SectionsPanel.jsx)
// ============================================
export default function ModalShell({ open, title, onClose, children }) {
  const contentRef = useRef(null);
  const scrollTopRef = useRef(0);

  // ESC para cerrar
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Bloquear scroll del fondo cuando el modal está abierto
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Restaurar scroll del modal después de cada render cuando está abierto
  useEffect(() => {
    if (!open) return;
    const el = contentRef.current;
    if (!el) return;

    // restaurar en el próximo frame (evita “salto”)
    requestAnimationFrame(() => {
      el.scrollTop = scrollTopRef.current || 0;
    });
  });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[9999]">
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
        aria-label="Cerrar"
      />
      <div className="absolute inset-0 p-3 sm:p-6 flex items-center justify-center">
        <div className="w-full max-w-6xl max-h-[90vh] rounded-2xl bg-white shadow-xl border border-neutral-200 overflow-hidden relative">
          <div className="p-4 border-b border-neutral-200 flex items-center justify-between">
            <div className="text-base sm:text-lg font-extrabold text-neutral-900">
              {title}
            </div>
            <Button type="button" variant="ghost" onClick={onClose}>
              Cerrar
            </Button>
          </div>

          <div
            ref={contentRef}
            onScroll={() => {
              const el = contentRef.current;
              if (el) scrollTopRef.current = el.scrollTop;
            }}
            className="p-4 overflow-y-auto max-h-[calc(90vh-70px)]"
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}