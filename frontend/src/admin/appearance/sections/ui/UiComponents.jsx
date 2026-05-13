// src/admin/appearance/sections/ui/UiComponents.jsx
import React from "react";

// ============================================
// ✅ Botón básico reutilizable
// ============================================
const baseBtn =
  "inline-flex items-center justify-center rounded-lg border text-sm font-semibold px-3 py-2 transition focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed";

const variants = {
  solid: "bg-neutral-900 text-white border-neutral-900 hover:bg-neutral-800",
  outline: "bg-white text-neutral-900 border-neutral-300 hover:bg-neutral-50",
  ghost: "bg-transparent text-neutral-700 border-transparent hover:bg-neutral-100",
};

export function Button({
  type = "button",
  variant,
  kind,
  className = "",
  children,
  ...rest
}) {
  const resolvedVariant = variant || kind || "solid";
  const v = variants[resolvedVariant] || variants.solid;

  return (
    <button type={type} className={`${baseBtn} ${v} ${className}`} {...rest}>
      {children}
    </button>
  );
}

// ============================================
// ✅ Field: contenedor + etiqueta + hint
// ⚠️ CORREGIDO: ya NO usa <label>
// porque aquí dentro metes botones, selects,
// drag areas y labels anidados.
// ============================================
export function Field({ label, hint, children }) {
  return (
    <div className="block text-sm text-neutral-800">
      {label ? (
        <div className="mb-1 font-semibold text-[13px] text-neutral-900">
          {label}
        </div>
      ) : null}

      <div className="mt-0.5">{children}</div>

      {hint ? (
        <div className="mt-1 text-[11px] text-neutral-500 leading-snug">
          {hint}
        </div>
      ) : null}
    </div>
  );
}

// ============================================
// ✅ Input de texto básico
// ============================================
export function Input({ className = "", ...rest }) {
  return (
    <input
      className={
        "w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-400 focus:ring-1 focus:ring-neutral-300 " +
        className
      }
      {...rest}
    />
  );
}

// ============================================
// ✅ Toggle ON/OFF
// ============================================
export function Toggle({ checked, onChange, label }) {
  const onToggle = () => onChange?.(!checked);

  return (
    <button
      type="button"
      onClick={onToggle}
      className="inline-flex items-center gap-2"
    >
      <span
        className={[
          "relative inline-flex h-5 w-9 items-center rounded-full border transition",
          checked
            ? "bg-emerald-500 border-emerald-500"
            : "bg-neutral-200 border-neutral-300",
        ].join(" ")}
      >
        <span
          className={[
            "h-4 w-4 rounded-full bg-white shadow transition-transform",
            checked ? "translate-x-4" : "translate-x-0.5",
          ].join(" ")}
        />
      </span>
      {label ? (
        <span className="text-xs font-medium text-neutral-700">{label}</span>
      ) : null}
    </button>
  );
}