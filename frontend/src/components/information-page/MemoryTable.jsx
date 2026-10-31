import { useRef, useState } from "react";
import { useSearchParams, useLocation } from "react-router-dom";
import { List, LayoutGrid, Plus, Minus, Images } from "lucide-react";
import { visibleMemories, memoryWindow } from "./memoryJournalConfig";
import { MEMORY_DEMO } from "./memoryDemo";
import { memoryStyle } from "./memoryStyle";
import MemoryPhoto from "./MemoryPhoto";
import MemoryTimeline from "./MemoryTimeline";
import MemoryDialog from "./MemoryDialog";
import useMemoryMotion from "./useMemoryMotion";
import "./memoryTable.css";
function MemoryTitle({ config, name }) {
  const [failed, setFailed] = useState("");
  return (
    <div className="memory-intro">
      {config.showEyebrow && config.eyebrowText && (
        <p className="memory-eyebrow">{config.eyebrowText}</p>
      )}
      <h1 className={config.showTitle ? "" : "sr-only"}>
        {config.titleMode === "image" &&
        config.titleImage &&
        config.titleImage !== failed ? (
          <img
            src={config.titleImage}
            alt={config.titleImageAlt || config.titleText}
            style={{ maxHeight: config.titleImageHeightPx }}
            onError={() => setFailed(config.titleImage)}
          />
        ) : (
          config.titleText || name
        )}
      </h1>
      {config.showSubtitle && config.subtitleText && (
        <p>{config.subtitleText}</p>
      )}
    </div>
  );
}
export default function MemoryTable({ config, name, preview = false }) {
  const j = config.journal,
    saved = visibleMemories(j),
    examples = preview && saved.length === 0;
  const moments = examples ? MEMORY_DEMO : saved;
  const [category, setCategory] = useState(""),
    [selectedId, setSelected] = useState(""),
    [list, setList] = useState(false),
    [zoom, setZoom] = useState(1),
    [previewMoment, setPreviewMoment] = useState("");
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const navigationState = { ...location.state, preserveStorefrontScroll: true };
  const categories = [
    ...new Set(moments.map((m) => m.category).filter(Boolean)),
  ];
  const activeCategory = categories.includes(category) ? category : "";
  const filtered = moments.filter(
    (m) => !activeCategory || m.category === activeCategory,
  );
  const selected =
    filtered.find((m) => m.id === selectedId) ||
    filtered.find((m) => m.id === j.featuredId) ||
    filtered[Math.floor(filtered.length / 2)];
  const nearby = selected ? memoryWindow(filtered, selected.id) : [];
  const displayed = selected
    ? [selected, ...nearby.filter((m) => m.id !== selected.id)]
    : [];
  const plane = useRef(null);
  useMemoryMotion(
    plane,
    displayed.map((m) => m.id).join(":") + list,
    j.motion && !list,
  );
  const opened = preview ? previewMoment : params.get("momento");
  const detail = moments.find((m) => m.id === opened);
  const open = (id) => {
    setSelected(id);
    if (preview) setPreviewMoment(id);
    else
      setParams(
        (current) => {
          const next = new URLSearchParams(current);
          next.set("momento", id);
          return next;
        },
        { preventScrollReset: true, state: navigationState },
      );
  };
  const close = () => {
    if (preview) setPreviewMoment("");
    else
      setParams(
        (current) => {
          const next = new URLSearchParams(current);
          next.delete("momento");
          return next;
        },
        { replace: true, preventScrollReset: true, state: navigationState },
      );
  };
  return (
    <section
      className="memory-explorer"
      style={memoryStyle(config)}
      data-motion={j.motion}
      data-long-intro={
        config.titleText.length > 48 || config.subtitleText.length > 85
      }
    >
      {examples && (
        <p className="memory-preview-note" role="status">
          Vista previa con fotografías, fechas y relatos de muestra. Estos
          ejemplos no se guardan ni aparecen en la página pública.
        </p>
      )}
      <div className="memory-masthead">
        <MemoryTitle config={config} name={name} />
        {j.showFilters && categories.length > 0 && (
          <div className="memory-filters" role="group" aria-label={j.allText}>
            {["", ...categories].map((value) => (
              <button
                type="button"
                key={value}
                aria-pressed={value === activeCategory}
                onClick={() => {
                  setCategory(value);
                  setZoom(1);
                }}
              >
                {value || j.allText}
              </button>
            ))}
          </div>
        )}
      </div>
      {moments.length === 0 ? (
        <div className="memory-empty">
          <Images size={38} strokeWidth={1} aria-hidden="true" />
          <h2>{j.emptyTitle}</h2>
          <p>{j.emptyText}</p>
        </div>
      ) : (
        <>
          <div className="memory-stage" data-view={list ? "list" : "table"}>
            {list ? (
              <div className="memory-list">
                {filtered.map((moment) => (
                  <MemoryPhoto
                    key={moment.id}
                    moment={moment}
                    config={config}
                    illustrative={examples}
                    active={moment.id === selected?.id}
                    list
                    onSelect={setSelected}
                    onOpen={open}
                  />
                ))}
              </div>
            ) : (
              <div className="memory-canvas" data-count={displayed.length}>
                <div
                  ref={plane}
                  className="memory-canvas__plane"
                  style={{ "--memory-zoom": zoom }}
                >
                  {displayed.map((moment, slot) => (
                    <MemoryPhoto
                      key={moment.id}
                      moment={moment}
                      config={config}
                      illustrative={examples}
                      active={slot === 0}
                      slot={slot}
                      onSelect={setSelected}
                      onOpen={open}
                    />
                  ))}
                </div>
              </div>
            )}
            {j.showTimeline && filtered.length > 0 && (
              <MemoryTimeline
                moments={filtered}
                selected={selected.id}
                onSelect={setSelected}
                config={config}
                illustrative={examples}
              />
            )}
          </div>
          <div className="memory-tools">
            {j.showZoom && !list && (
              <div className="memory-zoom-tools">
                <button
                  type="button"
                  disabled={zoom >= 1.15}
                  onClick={() =>
                    setZoom((v) =>
                      Math.min(1.15, Math.round((v + 0.05) * 100) / 100),
                    )
                  }
                >
                  {j.zoomInText}
                  <Plus size={15} />
                </button>
                <button
                  type="button"
                  disabled={zoom <= 0.85}
                  onClick={() =>
                    setZoom((v) =>
                      Math.max(0.85, Math.round((v - 0.05) * 100) / 100),
                    )
                  }
                >
                  {j.zoomOutText}
                  <Minus size={15} />
                </button>
              </div>
            )}
            <button
              type="button"
              onClick={() => setList((v) => !v)}
              aria-pressed={list}
            >
              {list ? <LayoutGrid size={17} /> : <List size={17} />}
              {list ? j.tableText : j.listText}
            </button>
          </div>
        </>
      )}
      {detail && (
        <MemoryDialog
          key={detail.id}
          moment={detail}
          config={config}
          onClose={close}
          illustrative={examples}
        />
      )}
    </section>
  );
}
