import { ArrowUpRight, MessageCircle } from "lucide-react";
import "./consumer.css";

export default function ConsumerClaimsLink({ footer = {}, preview = false }) {
  const configured = [1, 2, 3]
    .flatMap((column) =>
      Array.isArray(footer[`column${column}Links`])
        ? footer[`column${column}Links`]
        : [],
    )
    .find(
      (link) =>
        typeof link?.href === "string" &&
        link.href.trim() === "/pqr" &&
        typeof link?.label === "string" &&
        link.label.trim(),
    );

  return (
    <a
      className="consumer-claims-link"
      href="/pqr"
      onClick={preview ? (event) => event.preventDefault() : undefined}
    >
      <MessageCircle size={20} aria-hidden="true" />
      <span>{configured?.label || "Peticiones y reclamos · PQR"}</span>
      <ArrowUpRight size={18} aria-hidden="true" />
    </a>
  );
}
