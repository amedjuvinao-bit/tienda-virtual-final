import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";
import PolishedGlassRim from "../PolishedGlassRim";
import MemoryImage from "./MemoryImage";
import { formatMemoryDate, memoryWindow } from "./memoryJournalConfig";
export default function MemoryTimeline({
  moments,
  selected,
  onSelect,
  config,
  illustrative = false,
}) {
  const [compact, setCompact] = useState(
    () => window.matchMedia?.("(max-width: 767px)")?.matches || false,
  );
  useEffect(() => {
    const media = window.matchMedia?.("(max-width: 767px)");
    const change = (event) => setCompact(event.matches);
    media?.addEventListener?.("change", change);
    return () => media?.removeEventListener?.("change", change);
  }, []);
  const j = config.journal,
    index = moments.findIndex((m) => m.id === selected);
  const nearby = memoryWindow(moments, selected, compact ? 5 : 9);
  const step = (delta) => {
    const next = moments[index + delta];
    if (next) onSelect(next.id);
  };
  return (
    <nav className="memory-timeline" aria-label={j.timelineText}>
      <button
        type="button"
        aria-label={j.previousText}
        onClick={() => step(-1)}
        disabled={index <= 0}
      >
        <ChevronLeft size={20} />
      </button>
      <div
        className="memory-timeline__rail"
        onKeyDown={(event) => {
          if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key))
            return;
          event.preventDefault();
          const rail = event.currentTarget;
          const target =
            event.key === "Home"
              ? moments[0]
              : event.key === "End"
                ? moments.at(-1)
                : moments[index + (event.key === "ArrowLeft" ? -1 : 1)];
          if (target) {
            onSelect(target.id);
            requestAnimationFrame(() =>
              rail
                ?.querySelector(`[data-timeline-id="${target.id}"]`)
                ?.focus({ preventScroll: true }),
            );
          }
        }}
      >
        {nearby.map((moment) => (
          <button
            type="button"
            key={moment.id}
            data-timeline-id={moment.id}
            aria-label={`${j.timelineText}: ${moment.title}`}
            aria-current={selected === moment.id ? "true" : undefined}
            onClick={() => onSelect(moment.id)}
          >
            <span className="memory-timeline__thumb">
              <MemoryImage moment={moment} illustrative={illustrative} />
            </span>
            <i aria-hidden="true" />
            <span>
              {j.showDates
                ? formatMemoryDate(moment.date, true) || j.noDateText
                : moment.title}
            </span>
          </button>
        ))}
      </div>
      <button
        type="button"
        aria-label={j.nextText}
        onClick={() => step(1)}
        disabled={index >= moments.length - 1}
      >
        <ChevronRight size={20} />
      </button>
      <PolishedGlassRim
        radius={40}
        width={config.presentation.borderWidth}
        reflection={config.presentation.reflection}
      />
    </nav>
  );
}
