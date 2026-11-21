import { useEffect, useId, useRef } from "react";
import { Clock3, X } from "lucide-react";
import { ContactButton as ServiceButton } from "./ContactMaterial";

export default function ContactHoursDialog({ config, data, onClose }) {
  const dialog = useRef(null),
    id = useId(),
    c = config.contact;
  useEffect(() => {
    const node = dialog.current,
      previous = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    node.showModal?.();
    if (!node.open) node.setAttribute("open", "");
    node.querySelector("button")?.focus({ preventScroll: true });
    return () => {
      document.body.style.overflow = overflow;
      if (previous?.isConnected) previous.focus?.({ preventScroll: true });
    };
  }, []);
  return (
    <dialog
      ref={dialog}
      className="contact-hours"
      aria-labelledby={id}
      aria-modal="true"
      onKeyDown={(event) => {
        if (event.key !== "Tab") return;
        const nodes = [
          ...event.currentTarget.querySelectorAll(
            "button:not(:disabled), a[href]",
          ),
        ].filter((node) => node.getClientRects().length);
        const first = nodes[0],
          last = nodes.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="contact-hours__inner">
        <header>
          <Clock3 size={24} aria-hidden="true" />
          <h2 id={id}>{c.hoursTitle || "Horario de atención"}</h2>
          <ServiceButton
            config={config}
            onClick={onClose}
            aria-label={c.closeText || "Cerrar horarios"}
          >
            <X size={20} aria-hidden="true" />
          </ServiceButton>
        </header>
        {data.schedule.length > 0 ? (
          <dl>
            {data.schedule.map((day) => (
              <div key={day.day}>
                <dt>{day.label}</dt>
                <dd>
                  {day.closed
                    ? c.closedText
                    : day.intervals.length
                      ? day.intervals
                          .map(
                            (interval) =>
                              `${interval.open} – ${interval.close}`,
                          )
                          .join(" / ")
                      : c.unavailableText}
                </dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="contact-hours__description">{data.hours}</p>
        )}
        {data.timezone && (
          <p className="contact-hours__timezone">
            {c.timezoneLabel}: {data.timezone}
          </p>
        )}
      </div>
    </dialog>
  );
}
