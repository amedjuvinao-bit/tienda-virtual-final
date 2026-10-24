import React, { useEffect, useRef, useState } from "react";
import { Maximize2, Monitor, Smartphone, X } from "lucide-react";
import { createPortal } from "react-dom";
export default function PageLivePreview({
  draft,
  expanded,
  onExpand,
  onClose,
}) {
  const frame = useRef(null),
    container = useRef(null),
    draftRef = useRef(draft),
    ready = useRef(false);
  const [device, setDevice] = useState(() =>
      window.matchMedia?.("(max-width: 767px)")?.matches ? "mobile" : "desktop",
    ),
    [available, setAvailable] = useState(0),
    [maxHeight, setMaxHeight] = useState(600),
    [loaded, setLoaded] = useState(false);
  draftRef.current = draft;
  const width = device === "mobile" ? 390 : 1280,
    height = device === "mobile" ? 844 : 960;
  const send = () => {
    if (ready.current)
      frame.current?.contentWindow?.postMessage(
        { type: "pages-preview:update", draft: draftRef.current },
        window.location.origin,
      );
  };
  useEffect(() => {
    const receive = (event) => {
      if (
        event.origin !== window.location.origin ||
        event.source !== frame.current?.contentWindow ||
        !["pages-preview:ready", "pages-preview:close"].includes(
          event.data?.type,
        )
      )
        return;
      if (event.data.type === "pages-preview:close") {
        onClose();
        return;
      }
      ready.current = true;
      setLoaded(true);
      send();
    };
    window.addEventListener("message", receive);
    return () => window.removeEventListener("message", receive);
  }, [onClose]);
  useEffect(() => {
    const timer = setTimeout(send, 180);
    return () => clearTimeout(timer);
  }, [draft]);
  useEffect(() => {
    const node = container.current,
      update = () => {
        setAvailable(node?.clientWidth || 0);
        const aside = node?.closest('.pages-workspace__preview');
        const top = aside ? parseFloat(getComputedStyle(aside).top) || 0 : 0;
        setMaxHeight(Math.max(140, window.innerHeight - top - (expanded ? 160 : 130)));
      };
    const observer =
      typeof ResizeObserver !== "undefined" ? new ResizeObserver(update) : null;
    if (node) observer?.observe(node);
    const workspace = node?.closest('.pages-workspace');
    if (workspace) observer?.observe(workspace.querySelector('.pages-workspace__bar'));
    const adminHeader = workspace?.closest('main')?.querySelector('.admin-header-panel');
    if (adminHeader) observer?.observe(adminHeader);
    window.addEventListener("resize", update);
    update();
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [expanded]);
  useEffect(() => {
    if (!expanded) return;
    const previous = document.activeElement,
      overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeButton = container.current
      ?.closest('[role="dialog"]')
      ?.querySelector('[aria-label="Cerrar vista previa"]');
    closeButton?.focus();
    const key = (event) => {
      if (event.key === "Escape") onClose();
      if (event.key === "Tab") {
        const nodes = [
          ...container.current
            .closest('[role="dialog"]')
            .querySelectorAll("button,iframe"),
        ];
        if (event.shiftKey && document.activeElement === nodes[0]) {
          event.preventDefault();
          nodes.at(-1)?.focus();
        } else if (!event.shiftKey && document.activeElement === nodes.at(-1)) {
          event.preventDefault();
          nodes[0]?.focus();
        }
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener("keydown", key);
      previous?.focus?.();
    };
  }, [expanded, onClose]);
  const scale = available ? Math.min(1, available / width) : 0;
  const frameHeight = scale ? Math.min(height, Math.max(200, maxHeight / scale)) : height;
  const content = (
    <section
      className="page-live-preview"
      aria-label="Vista previa del borrador"
    >
      <header>
        <div>
          <span className="pages-eyebrow">Vista previa en vivo</span>
          <strong>{device === "mobile" ? "Móvil" : "Escritorio"}</strong>
        </div>
        <div
          className="page-preview-tools"
          role="group"
          aria-label="Dispositivo de vista previa"
        >
          <button
            className="pages-icon-button"
            aria-label="Vista de escritorio"
            aria-pressed={device === "desktop"}
            onClick={() => setDevice("desktop")}
          >
            <Monitor size={17} />
          </button>
          <button
            className="pages-icon-button"
            aria-label="Vista móvil"
            aria-pressed={device === "mobile"}
            onClick={() => setDevice("mobile")}
          >
            <Smartphone size={17} />
          </button>
          <button
            className="pages-icon-button"
            aria-label={
              expanded ? "Cerrar vista previa" : "Ampliar vista previa"
            }
            onClick={expanded ? onClose : onExpand}
          >
            {expanded ? <X size={18} /> : <Maximize2 size={17} />}
          </button>
        </div>
      </header>
      <div
        ref={container}
        className="page-live-preview__viewport"
        data-admin-storefront-preview="true"
      >
        <div
          className="page-live-preview__stage"
          style={{ height: frameHeight * scale }}
        >
          <iframe
            ref={frame}
            src="/page-preview.html"
            title="Página en edición"
            sandbox="allow-scripts allow-same-origin"
            onLoad={() => {
              ready.current = false;
              frame.current?.contentWindow?.postMessage(
                { type: "pages-preview:connect" },
                window.location.origin,
              );
            }}
            style={{ width, height: frameHeight, transform: `scale(${scale})` }}
          />
        </div>
        {!loaded && (
          <p className="page-preview-loading" role="status">
            Preparando vista previa…
          </p>
        )}
      </div>
      <p className="page-live-preview__note">
        El borrador cambia aquí antes de guardar. Las acciones de compra y los
        formularios son demostrativos.
      </p>
    </section>
  );
  return expanded
    ? createPortal(
        <div
          className="pages-preview-expanded"
          role="dialog"
          aria-modal="true"
          aria-label="Vista previa ampliada"
        >
          {content}
        </div>,
        document.body,
      )
    : content;
}
