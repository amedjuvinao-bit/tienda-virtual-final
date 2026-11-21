import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import MemoryImage from "./MemoryImage";
import { formatMemoryDate } from "./memoryJournalConfig";
import { memoryStyle } from "./memoryStyle";
export default function MemoryDialog({
  moment,
  config,
  onClose,
  illustrative = false,
}) {
  const [index, setIndex] = useState(0),
    dialog = useRef(null),
    close = useRef(onClose),
    id = useId();
  close.current = onClose;
  const photos = [
    {
      image: moment.image,
      alt: moment.imageAlt,
      previewCrop: moment.previewCrop,
    },
    ...moment.gallery.filter((p) => p.image),
  ];
  const photo = photos[Math.min(index, photos.length - 1)],
    j = config.journal;
  useEffect(() => {
    const previous = document.activeElement,
      overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.current?.querySelector("button")?.focus();
    const key = (event) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        close.current();
      }
      if (event.key !== "Tab") return;
      const nodes = [
        ...dialog.current.querySelectorAll("button:not(:disabled),a[href]"),
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
    document.addEventListener("keydown", key);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener("keydown", key);
      if (previous?.isConnected) previous.focus?.({ preventScroll: true });
    };
  }, []);
  return createPortal(
    <div
      className="service-storefront memory-dialog-backdrop"
      style={memoryStyle(config)}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="memory-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={id}
        ref={dialog}
      >
        <button
          type="button"
          className="memory-dialog__close"
          aria-label={j.closeText}
          onClick={onClose}
        >
          <X size={22} />
        </button>
        <figure>
          <MemoryImage
            moment={{
              ...moment,
              ...photo,
              imageAlt: photo.alt || moment.imageAlt,
            }}
            loading="eager"
            illustrative={illustrative}
          />
          {photo.caption && <figcaption>{photo.caption}</figcaption>}
        </figure>
        {photos.length > 1 && (
          <div
            className="memory-dialog__gallery"
            role="group"
            aria-label={j.galleryText}
          >
            {photos.map((p, i) => (
              <button
                type="button"
                key={i}
                aria-label={`${j.galleryText} ${i + 1}`}
                aria-pressed={index === i}
                onClick={() => setIndex(i)}
              >
                <MemoryImage
                  moment={{
                    ...moment,
                    ...p,
                    imageAlt: p.alt || moment.imageAlt,
                  }}
                />
              </button>
            ))}
          </div>
        )}
        <div className="memory-dialog__story">
          {moment.category && <span>{moment.category}</span>}
          {j.showDates && moment.date && (
            <time dateTime={moment.date}>{formatMemoryDate(moment.date)}</time>
          )}
          <h2 id={id}>{moment.title}</h2>
          {moment.story || moment.summary ? (
            <p>{moment.story || moment.summary}</p>
          ) : null}
        </div>
      </section>
    </div>,
    document.body,
  );
}
