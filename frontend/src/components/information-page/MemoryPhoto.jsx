import { ArrowRight } from "lucide-react";
import PolishedGlassRim from "../PolishedGlassRim";
import MemoryImage from "./MemoryImage";
import { formatMemoryDate } from "./memoryJournalConfig";
export default function MemoryPhoto({
  moment,
  config,
  active,
  slot,
  onSelect,
  onOpen,
  list = false,
  illustrative = false,
}) {
  const j = config.journal;
  return (
    <article
      className="memory-photo"
      data-slot={slot}
      data-active={active}
      data-memory-id={moment.id}
    >
      <button
        type="button"
        className="memory-photo__select"
        aria-label={`${active || list ? j.openText : j.selectText}: ${moment.title}`}
        aria-pressed={active}
        onClick={() =>
          active || list ? onOpen(moment.id) : onSelect(moment.id)
        }
      >
        <span className="memory-photo__frame">
          <MemoryImage
            moment={moment}
            loading={active ? "eager" : "lazy"}
            illustrative={illustrative}
          />
          <PolishedGlassRim
            radius={j.photoRadiusPx}
            width={config.presentation.borderWidth}
            reflection={config.presentation.reflection}
          />
        </span>
      </button>
      {active && !list ? (
        <div className="memory-caption">
          <div>
            {j.showDates && moment.date && (
              <time dateTime={moment.date}>
                {formatMemoryDate(moment.date)}
              </time>
            )}
            <h2>{moment.title}</h2>
            {moment.summary && <p>{moment.summary}</p>}
          </div>
          <button
            type="button"
            className="memory-caption__open"
            onClick={() => onOpen(moment.id)}
          >
            {j.openText}
            <ArrowRight size={16} aria-hidden="true" />
          </button>
          <PolishedGlassRim
            radius={j.photoRadiusPx}
            width={config.presentation.borderWidth}
            reflection={config.presentation.reflection}
          />
        </div>
      ) : (
        <div className="memory-photo__label">
          {j.showDates && moment.date && (
            <time dateTime={moment.date}>{formatMemoryDate(moment.date)}</time>
          )}
          <h2>{moment.title}</h2>
          {list && moment.summary && <p>{moment.summary}</p>}
        </div>
      )}
    </article>
  );
}
