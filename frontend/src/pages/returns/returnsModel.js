export const REASONS = [
  ["wrong_size", "Medida o presentación incorrecta"],
  ["wrong_item", "Producto equivocado"],
  ["damaged", "Llegó averiado"],
  ["defective", "Defecto de fabricación"],
  ["not_as_described", "No coincide con la descripción"],
  ["changed_mind", "Cambio de decisión"],
  ["warranty", "Garantía"],
  ["other", "Otro motivo"],
];

export const STATUS_LABELS = {
  requested: "Solicitud recibida",
  authorized: "Devolución autorizada",
  rejected: "Solicitud rechazada",
  in_transit: "Paquete en camino",
  received: "Paquete recibido",
  resolution_required: "Inspección completada",
  resolved: "Caso resuelto",
  cancelled: "Solicitud cancelada",
};

export function quantity(value) {
  const number = Math.floor(Number(value));
  return Number.isFinite(number) ? Math.max(0, number) : 0;
}

export function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleDateString("es-CO", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
}

export function resolutionLabel(value, config) {
  if (value === "exchange") return config.exchangeText;
  if (value === "store_credit") return config.creditText;
  return config.refundText;
}
