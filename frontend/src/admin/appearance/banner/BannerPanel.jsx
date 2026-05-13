// src/admin/appearance/banner/BannerPanel.jsx
import React, { useMemo, useState } from "react";

/* =======================
   UI Helpers
======================= */
const Input = ({ label, ...rest }) => (
  <label className="block mb-3 min-w-0">
    <span className="block text-sm font-medium text-gray-700 mb-1">{label}</span>
    <input
      className="w-full min-w-0 rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-pink-400"
      {...rest}
    />
  </label>
);

const Select = ({ label, children, ...rest }) => (
  <label className="block mb-3 min-w-0">
    <span className="block text-sm font-medium text-gray-700 mb-1">{label}</span>
    <select
      className="w-full min-w-0 rounded-lg border border-gray-300 px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-pink-400"
      {...rest}
    >
      {children}
    </select>
  </label>
);

const Badge = ({ children, tone = "gray" }) => {
  const map = {
    gray: "bg-gray-100 text-gray-700 border-gray-200",
    pink: "bg-pink-50 text-pink-700 border-pink-200",
    red: "bg-red-50 text-red-700 border-red-200",
    green: "bg-green-50 text-green-700 border-green-200",
    gold: "bg-yellow-50 text-yellow-800 border-yellow-200",
  };
  return (
    <span className={"inline-flex items-center px-2 py-0.5 text-xs rounded-full border " + (map[tone] || map.gray)}>
      {children}
    </span>
  );
};

const clamp01 = (n) => Math.max(0, Math.min(100, n));
const clampNum = (n, min, max, fallback) => {
  const x = Number(n);
  if (!Number.isFinite(x)) return fallback;
  return Math.max(min, Math.min(max, x));
};

const buildDefaultButton = () => ({
  enabled: true,
  kind: "image",
  imageUrl: "/ImgBotones/VerMas2.png",
  text: "",
  link: "",
  posX: 50,
  posY: 92,
  widthPx: 200,
  anim: "inherit",
  animDurationMs: 600,
  animDelayMs: 0,
});

/* =======================
   Drag Preview (image crop)
======================= */
const BannerDragPreview = ({ src, fit = "cover", posX = 50, posY = 50, height = 220, onChange }) => {
  const [dragging, setDragging] = useState(false);

  const computePos = (e) => {
    const el = e.currentTarget;
    const rect = el.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    return { posX: clamp01(x), posY: clamp01(y) };
  };

  const onDown = (e) => {
    if (!onChange) return;
    setDragging(true);
    onChange(computePos(e));
    try {
      e.currentTarget.setPointerCapture?.(e.pointerId);
    } catch (_) {}
  };

  const onMove = (e) => {
    if (!dragging || !onChange) return;
    onChange(computePos(e));
  };

  const onUp = () => setDragging(false);

  return (
    <div className="min-w-0">
      <div
        className={"rounded-xl border bg-gray-50 overflow-hidden select-none " + (onChange ? "cursor-grab active:cursor-grabbing" : "")}
        style={{ height }}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        title={onChange ? "Arrastra para encuadrar" : ""}
      >
        {src ? (
          <img
            src={src}
            alt="preview"
            className="h-full w-full"
            style={{
              objectFit: fit === "contain" ? "contain" : "cover",
              objectPosition: `${Number(posX) || 50}% ${Number(posY) || 50}%`,
            }}
            draggable={false}
          />
        ) : (
          <div className="h-full w-full flex items-center justify-center text-xs text-gray-400">Sin imagen</div>
        )}
      </div>

      {onChange && (
        <div className="mt-2 text-xs text-gray-600">
          Tip: <span className="font-medium">arrastra</span> para mover encuadre (X/Y).
        </div>
      )}
    </div>
  );
};

/* =======================
   Button Editor (overlay)
======================= */
const BannerButtonEditor = ({ title = "Botón", value, onChange, uploading, onUploadImage }) => {
  const b = value || buildDefaultButton();
  const [draggingBtn, setDraggingBtn] = useState(false);

  const boxRef = React.useRef(null);
  const btnRef = React.useRef(null);

  const set = (patch) => {
    if (!onChange) return;
    onChange({ ...(b || {}), ...patch });
  };

  const computeBtnPos = (e) => {
    const box = boxRef.current;
    const btn = btnRef.current;
    if (!box) return { posX: 50, posY: 92 };

    const rect = box.getBoundingClientRect();
    const x = e.clientX;
    const y = e.clientY;

    let px = ((x - rect.left) / rect.width) * 100;
    let py = ((y - rect.top) / rect.height) * 100;

    if (btn) {
      const bw = btn.offsetWidth || 0;
      const bh = btn.offsetHeight || 0;

      const halfX = rect.width > 0 ? (bw / 2 / rect.width) * 100 : 0;
      const halfY = rect.height > 0 ? (bh / 2 / rect.height) * 100 : 0;

      px = Math.max(halfX, Math.min(100 - halfX, px));
      py = Math.max(halfY, Math.min(100 - halfY, py));
    }

    return { posX: clamp01(px), posY: clamp01(py) };
  };

  const onDown = (e) => {
    if (!onChange || b.enabled === false) return;
    setDraggingBtn(true);
    set(computeBtnPos(e));
    try {
      boxRef.current?.setPointerCapture?.(e.pointerId);
    } catch (_) {}
  };

  const onMove = (e) => {
    if (!draggingBtn || !onChange || b.enabled === false) return;
    set(computeBtnPos(e));
  };

  const onUp = () => setDraggingBtn(false);

  return (
    <div className="rounded-2xl border bg-white p-3 min-w-0">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-semibold text-sm text-gray-800">{title}</div>
          <div className="text-xs text-gray-500">Arrastra el botón o usa X/Y.</div>
        </div>

        <label className="flex items-center gap-2 text-sm select-none">
          <input type="checkbox" checked={b.enabled !== false} onChange={(e) => set({ enabled: e.target.checked })} />
          Habilitado
        </label>
      </div>

      <div className="mt-3 rounded-2xl border bg-gray-50 p-3">
        <div className="text-xs text-gray-500 mb-2">Vista previa botón</div>

        <div
          ref={boxRef}
          className={"relative h-[120px] rounded-xl border bg-white overflow-hidden select-none " + (b.enabled !== false ? "cursor-grab active:cursor-grabbing" : "")}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
        >
          <div className="absolute inset-0 bg-gradient-to-b from-white to-pink-50" />
          <div
            className="absolute z-10"
            style={{
              left: `${clampNum(b.posX, 0, 100, 50)}%`,
              top: `${clampNum(b.posY, 0, 100, 92)}%`,
              transform: "translate(-50%, -50%)",
              pointerEvents: "none",
            }}
          >
            <div ref={btnRef} className="inline-block">
              {String(b.kind || "image") === "text" ? (
                <div className="px-4 py-2 rounded-full bg-white/80 backdrop-blur-sm border border-[#d4af37] shadow">
                  <span className="text-sm font-semibold text-[#7a4b00] whitespace-nowrap">{b.text || "Ver más"}</span>
                </div>
              ) : (
                <img
                  src={b.imageUrl || "/ImgBotones/VerMas2.png"}
                  alt="button"
                  style={{ width: `${clampNum(b.widthPx, 80, 420, 200)}px`, height: "auto" }}
                  className="drop-shadow"
                  draggable={false}
                />
              )}
            </div>
          </div>
        </div>

        <div className="mt-2 text-[11px] text-gray-500">
          Nota: el estilo final lo define el front (<span className="font-mono">CarouselBanner.jsx</span>).
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-3 mt-3">
        <Select label="Tipo de botón" value={b.kind || "image"} onChange={(e) => set({ kind: e.target.value })}>
          <option value="image">Imagen</option>
          <option value="text">Texto</option>
        </Select>

        <Input label="Link (opcional)" value={b.link || ""} onChange={(e) => set({ link: e.target.value })} placeholder="/lo-nuevo ó https://..." />
      </div>

      <div className="grid sm:grid-cols-2 gap-3 mt-1">
        <Select label="Animación del botón" value={String(b.anim || "inherit")} onChange={(e) => set({ anim: e.target.value })}>
          <option value="inherit">Heredar (global)</option>
          <option value="none">Sin animación</option>
          <option value="fade">Fade</option>
          <option value="slideup">Slide Up</option>
          <option value="pop">Pop</option>
          <option value="glow">Glow</option>
          <option value="cinematic">Cinematic (PRO)</option>
          <option value="luxpop">Lux Pop (PRO)</option>
          <option value="goldsweep">Gold Sweep (PRO)</option>
          <option value="floatin">Float In (PRO)</option>
        </Select>

        <div className="grid grid-cols-2 gap-3">
          <Input type="number" min={0} max={3000} step="50" label="Duración (ms)" value={clampNum(b.animDurationMs, 0, 3000, 600)} onChange={(e) => set({ animDurationMs: Number(e.target.value) })} />
          <Input type="number" min={0} max={3000} step="50" label="Delay (ms)" value={clampNum(b.animDelayMs, 0, 3000, 0)} onChange={(e) => set({ animDelayMs: Number(e.target.value) })} />
        </div>
      </div>

      {String(b.kind || "image") === "text" ? (
        <Input label="Texto del botón" value={b.text || ""} onChange={(e) => set({ text: e.target.value })} placeholder="Ej: Ver más" />
      ) : (
        <>
          <Input label="Imagen del botón (URL)" value={b.imageUrl || ""} onChange={(e) => set({ imageUrl: e.target.value })} placeholder="https://.../VerMas2.png" />

          <div className="rounded-2xl border bg-gray-50 p-3">
            <div className="text-sm font-medium mb-2">Subir imagen del botón</div>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={async (e) => {
                const f = e.target.files?.[0] || null;
                if (!f || !onUploadImage) return;
                try {
                  const url = await onUploadImage(f);
                  set({ imageUrl: url });
                } finally {
                  e.target.value = "";
                }
              }}
              className="block w-full text-sm"
            />
            <div className="text-xs text-gray-500 mt-2">{uploading ? "Subiendo..." : "Tip: también puedes pegar la URL arriba."}</div>
          </div>

          <div className="grid grid-cols-[1fr_96px] gap-3 items-center min-w-0">
            <input type="range" min="80" max="420" step="1" value={clampNum(b.widthPx, 80, 420, 200)} onChange={(e) => set({ widthPx: Number(e.target.value) })} className="w-full min-w-0" />
            <input type="number" min="80" max="420" step="1" value={clampNum(b.widthPx, 80, 420, 200)} onChange={(e) => set({ widthPx: Number(e.target.value) })} className="w-24 rounded-lg border border-gray-300 px-3 py-2" />
          </div>
        </>
      )}

      <div className="grid sm:grid-cols-2 gap-3 mt-3">
        <Input type="number" min={0} max={100} step="1" label="Posición X (0–100)" value={clampNum(b.posX, 0, 100, 50)} onChange={(e) => set({ posX: Number(e.target.value) })} />
        <Input type="number" min={0} max={100} step="1" label="Posición Y (0–100)" value={clampNum(b.posY, 0, 100, 92)} onChange={(e) => set({ posY: Number(e.target.value) })} />
      </div>

      <div className="mt-1 flex justify-end">
        <button type="button" onClick={() => set({ posX: 50, posY: 92 })} className="px-3 py-1.5 rounded-xl border border-gray-300 hover:bg-gray-50 text-sm">
          Centrar botón
        </button>
      </div>
    </div>
  );
};

/* =======================
   Modal
======================= */
const Modal = ({ open, title, onClose, children }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[9999]">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="w-full max-w-4xl rounded-2xl bg-white shadow-xl border overflow-hidden">
          <div className="flex items-center justify-between gap-3 px-4 py-3 border-b bg-white">
            <div className="font-semibold text-gray-900">{title}</div>
            <button onClick={onClose} className="px-3 py-1.5 rounded-xl border border-gray-300 hover:bg-gray-50 text-sm" type="button">
              Cerrar
            </button>
          </div>
          <div className="p-4 max-h-[75vh] overflow-auto">{children}</div>
        </div>
      </div>
    </div>
  );
};

/* =======================
   MAIN BannerPanel
======================= */
export default function BannerPanel({ theme, setPath, uploading, setUploading, uploadToCloudinaryViaBackend, onPreview }) {
  const b = theme?.banner || {};
  const slides = useMemo(() => (Array.isArray(b.slides) ? b.slides : []), [b.slides]);

  // Local files (solo banner)
  const [bannerImageFile, setBannerImageFile] = useState(null);
  const [bannerVideoFile, setBannerVideoFile] = useState(null);
  const [bannerSlideFiles, setBannerSlideFiles] = useState({}); // { [idx]: File }

  // UI states
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [editIdx, setEditIdx] = useState(null);
  const [showJson, setShowJson] = useState(false);

  const ensureSlides = () => {
    if (!Array.isArray(b.slides)) setPath("banner.slides", []);
  };

  const setSlides = (next) => setPath("banner.slides", next);

  const addSlide = () => {
    ensureSlides();
    const next = [...slides];
    next.push({
      image: "",
      link: "",
      posX: 50,
      posY: 50,
      fit: "cover",
      button: buildDefaultButton(),
    });
    setSlides(next);
    setSelectedIdx(next.length - 1);
  };

  const removeSlide = (idx) => {
    const next = [...slides];
    next.splice(idx, 1);
    setSlides(next);

    setBannerSlideFiles((prev) => {
      const copy = { ...prev };
      delete copy[idx];
      return copy;
    });

    setSelectedIdx((p) => {
      const n = Math.max(0, Math.min((next.length || 1) - 1, p));
      return n;
    });
    if (editIdx === idx) setEditIdx(null);
  };

  const setSlide = (idx, patch) => {
    const next = [...slides];
    if (!next[idx]) return;
    next[idx] = { ...next[idx], ...(patch || {}) };
    setSlides(next);
  };

  const setSlideButton = (idx, nextBtn) => {
    const next = [...slides];
    if (!next[idx]) return;
    const cur = next[idx] || {};
    const curBtn = cur.button || buildDefaultButton();
    next[idx] = { ...cur, button: { ...buildDefaultButton(), ...curBtn, ...(nextBtn || {}) } };
    setSlides(next);
  };

  const uploadButtonImage = async (file) => {
    if (!file) return "";
    setUploading(true);
    try {
      const url = await uploadToCloudinaryViaBackend(file, "image");
      alert("Imagen del botón subida ✅ (ahora dale Guardar para dejarlo fijo)");
      return url;
    } catch (e) {
      console.error(e);
      alert(e?.message || "Error subiendo imagen del botón");
      throw e;
    } finally {
      setUploading(false);
    }
  };

  const onUploadBannerImage = async () => {
    try {
      if (!bannerImageFile) return alert("Selecciona una imagen primero.");
      setUploading(true);
      const url = await uploadToCloudinaryViaBackend(bannerImageFile, "image");
      setPath("banner.imageUrl", url);
      setBannerImageFile(null);
      alert("Imagen del banner subida ✅ (ahora dale Guardar para dejarlo fijo)");
    } catch (e) {
      console.error(e);
      alert(e?.message || "Error subiendo imagen del banner");
    } finally {
      setUploading(false);
    }
  };

  const onUploadBannerSlideImage = async (idx) => {
    try {
      const file = bannerSlideFiles?.[idx] || null;
      if (!file) return alert("Selecciona una imagen primero.");
      setUploading(true);
      const url = await uploadToCloudinaryViaBackend(file, "image");
      setSlide(idx, { image: url });
      setBannerSlideFiles((prev) => ({ ...prev, [idx]: null }));
      alert("Slide subido ✅ (ahora dale Guardar para dejarlo fijo)");
    } catch (e) {
      console.error(e);
      alert(e?.message || "Error subiendo slide");
    } finally {
      setUploading(false);
    }
  };

  const onUploadBannerVideo = async () => {
    try {
      if (!bannerVideoFile) return alert("Selecciona un video primero.");
      setUploading(true);
      const url = await uploadToCloudinaryViaBackend(bannerVideoFile, "video");
      setPath("banner.videoUrl", url);
      setBannerVideoFile(null);
      alert("Video subido ✅ (ahora dale Guardar para dejarlo fijo)");
    } catch (e) {
      console.error(e);
      alert(e?.message || "Error subiendo video (si tu backend no soporta video, pega la URL manualmente).");
    } finally {
      setUploading(false);
    }
  };

  /* =======================
     Intuición: Checklist
  ======================= */
  const issues = useMemo(() => {
    const out = [];
    const type = String(b.type || "slider");

    if (type === "slider") {
      if (!slides.length) out.push({ tone: "red", text: "No tienes slides. Agrega al menos 1." });
      slides.forEach((s, i) => {
        if (!s?.image) out.push({ tone: "red", text: `Slide #${i + 1}: falta imagen.` });
      });
    }

    if (type === "image") {
      if (!b.imageUrl) out.push({ tone: "red", text: "Imagen única: falta imageUrl." });
    }

    if (type === "video") {
      if (!b.videoUrl) out.push({ tone: "red", text: "Video: falta videoUrl." });
    }

    return out;
  }, [b.type, b.imageUrl, b.videoUrl, slides]);

  const selectedSlide = slides?.[selectedIdx] || null;
  const previewSrc =
    String(b.type || "slider") === "slider"
      ? selectedSlide?.image || ""
      : String(b.type || "slider") === "image"
      ? b.imageUrl || ""
      : "";

  /* =======================
     Layout
  ======================= */
  return (
    <div className="grid lg:grid-cols-[1.25fr_0.75fr] gap-6 min-w-0">
      {/* =======================
          LEFT: Simple controls + compact list
      ======================= */}
      <section className="rounded-2xl border p-4 bg-white min-w-0">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div>
            <h2 className="font-semibold text-gray-900">Banner</h2>
            <div className="text-xs text-gray-500">Lo básico aquí. “Editar” abre el editor completo (modal).</div>
          </div>

          <button
            type="button"
            onClick={onPreview}
            className="px-3 py-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-sm"
            title="Aplica cambios en vista previa"
          >
            Ver cambios
          </button>
        </div>

        <div className="rounded-2xl border bg-gradient-to-br from-pink-50 via-white to-amber-50 p-3 mb-3">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <Badge tone="pink">Responsive automático</Badge>
            <Badge tone="gray">Móvil</Badge>
            <Badge tone="gray">Tablet</Badge>
            <Badge tone="gray">Desktop</Badge>
          </div>
          <div className="text-sm font-semibold text-gray-800 mb-1">Comportamiento responsive prediseñado</div>
          <div className="text-xs text-gray-600 leading-5">
            El sistema adapta automáticamente la altura visual, el tamaño del botón y la posición de los controles según el tamaño de pantalla.
            Aquí sigues configurando la base del banner, pero el ajuste fino para móvil y tablet lo resuelve el frontend para mantener un diseño más limpio y profesional.
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-3">
          <Select label="Tipo de Banner" value={b.type || "slider"} onChange={(e) => setPath("banner.type", e.target.value)}>
            <option value="slider">Slider</option>
            <option value="image">Imagen única</option>
            <option value="video">Video</option>
          </Select>

          <Select label="Altura" value={b.heightMode || "auto"} onChange={(e) => setPath("banner.heightMode", e.target.value)}>
            <option value="auto">Auto</option>
            <option value="fullscreen">Fullscreen (automático por dispositivo)</option>
          </Select>
        </div>

        {String(b.heightMode || "auto") === "auto" && (
          <div className="rounded-2xl border bg-gray-50 p-3 mb-3">
            <div className="font-semibold text-sm text-gray-800 mb-2">Altura base (px)</div>
            <div className="grid grid-cols-[1fr_96px] gap-3 items-center min-w-0">
              <input
                type="range"
                min="240"
                max="1200"
                step="1"
                value={b.heightPx ?? 520}
                onChange={(e) => setPath("banner.heightPx", Number(e.target.value))}
                className="w-full min-w-0"
              />
              <input
                type="number"
                min="240"
                max="1200"
                step="1"
                value={b.heightPx ?? 520}
                onChange={(e) => setPath("banner.heightPx", Number(e.target.value))}
                className="w-24 rounded-lg border border-gray-300 px-3 py-2"
              />
            </div>
            <div className="text-xs text-gray-500 mt-2">
              Recomendado: 360–700 px. En móvil y tablet el sistema ajusta esta altura automáticamente para que no se vea exagerada.
            </div>
          </div>
        )}

        {/* Slider options */}
        {String(b.type || "slider") === "slider" && (
          <div className="rounded-2xl border bg-gray-50 p-3 mb-3">
            <div className="font-semibold text-sm text-gray-800 mb-2">Slider (básico)</div>

            <div className="grid md:grid-cols-2 gap-3">
              <Input
                type="number"
                min={1000}
                max={15000}
                step="100"
                label="Duración por slide (ms)"
                value={b.sliderIntervalMs ?? 3500}
                onChange={(e) => setPath("banner.sliderIntervalMs", Number(e.target.value))}
              />
              <label className="flex items-center gap-2 text-sm mt-6">
                <input
                  type="checkbox"
                  checked={b.sliderShowProgress !== false}
                  onChange={(e) => setPath("banner.sliderShowProgress", e.target.checked)}
                />
                Mostrar anillo de progreso
              </label>
            </div>
          </div>
        )}

        {/* Compact editor by type */}
        {String(b.type || "slider") === "slider" && (
          <div className="rounded-2xl border bg-white p-3">
            <div className="flex items-center justify-between gap-3 mb-3">
              <div>
                <div className="font-semibold text-gray-900">Slides</div>
                <div className="text-xs text-gray-500">Lista compacta. Edita completo con “Editar”.</div>
              </div>

              <button type="button" onClick={addSlide} className="px-3 py-2 rounded-xl bg-pink-600 text-white hover:bg-pink-700 text-sm">
                + Agregar
              </button>
            </div>

            {slides.length === 0 ? (
              <div className="rounded-2xl border border-dashed p-4 text-gray-500 bg-gray-50">Aún no hay slides.</div>
            ) : (
              <div className="space-y-2">
                {slides.map((s, idx) => {
                  const ok = !!s?.image;
                  const isSel = idx === selectedIdx;
                  return (
                    <div
                      key={idx}
                      className={
                        "rounded-2xl border p-3 flex items-center gap-3 " +
                        (isSel ? "border-pink-300 bg-pink-50/40" : "bg-white")
                      }
                    >
                      <button
                        type="button"
                        onClick={() => setSelectedIdx(idx)}
                        className="h-14 w-14 rounded-xl border bg-white overflow-hidden shrink-0"
                        title="Seleccionar para previsualizar"
                      >
                        {s?.image ? <img src={s.image} alt="" className="h-full w-full object-cover" /> : <div className="h-full w-full grid place-items-center text-[10px] text-gray-400">Sin</div>}
                      </button>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <div className="font-semibold text-sm text-gray-900">Slide #{idx + 1}</div>
                          {ok ? <Badge tone="green">OK</Badge> : <Badge tone="red">Falta imagen</Badge>}
                          <Badge tone="gray">{(s?.fit || "cover") === "contain" ? "contain" : "cover"}</Badge>
                        </div>
                        <div className="text-xs text-gray-500 truncate">
                          {s?.link ? `Link: ${s.link}` : "Sin link"}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setEditIdx(idx)}
                          className="px-3 py-1.5 rounded-xl border border-gray-300 hover:bg-gray-50 text-sm"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => removeSlide(idx)}
                          className="px-3 py-1.5 rounded-xl border border-red-300 text-red-700 hover:bg-red-50 text-sm"
                        >
                          Eliminar
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {String(b.type || "slider") === "image" && (
          <div className="rounded-2xl border bg-white p-3">
            <div className="font-semibold text-gray-900 mb-2">Imagen única (simple)</div>

            <Input label="Imagen URL" value={b.imageUrl || ""} onChange={(e) => setPath("banner.imageUrl", e.target.value)} placeholder="https://.../banner.png" />
            <Input label="Link (opcional)" value={b.imageLink || ""} onChange={(e) => setPath("banner.imageLink", e.target.value)} placeholder="/lo-nuevo ó https://..." />

            <div className="rounded-2xl border bg-gray-50 p-3">
              <div className="text-sm font-medium mb-2">Subir imagen</div>
              <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => setBannerImageFile(e.target.files?.[0] || null)} className="block w-full text-sm" />
              <button
                type="button"
                disabled={uploading}
                onClick={onUploadBannerImage}
                className="mt-2 w-full px-3 py-2 rounded-xl bg-pink-600 text-white hover:bg-pink-700 text-sm disabled:opacity-60"
              >
                {uploading ? "Subiendo..." : "Subir a Cloudinary"}
              </button>
            </div>

            <div className="mt-3">
              <button
                type="button"
                onClick={() => setEditIdx("image")}
                className="w-full px-3 py-2 rounded-xl border border-gray-300 hover:bg-gray-50 text-sm"
              >
                Editar encuadre + botón (avanzado)
              </button>
            </div>
          </div>
        )}

        {String(b.type || "slider") === "video" && (
          <div className="rounded-2xl border bg-white p-3">
            <div className="font-semibold text-gray-900 mb-2">Video (simple)</div>

            <Input label="Video URL" value={b.videoUrl || ""} onChange={(e) => setPath("banner.videoUrl", e.target.value)} placeholder="https://.../video.mp4" />

            <div className="grid sm:grid-cols-3 gap-3 mb-2">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={!!b.videoAutoplay} onChange={(e) => setPath("banner.videoAutoplay", e.target.checked)} />
                Autoplay
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={!!b.videoMuted} onChange={(e) => setPath("banner.videoMuted", e.target.checked)} />
                Muted
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={!!b.videoLoop} onChange={(e) => setPath("banner.videoLoop", e.target.checked)} />
                Loop
              </label>
            </div>

            <div className="rounded-2xl border bg-gray-50 p-3">
              <div className="text-sm font-medium mb-2">Subir video</div>
              <input type="file" accept="video/mp4,video/webm,video/ogg" onChange={(e) => setBannerVideoFile(e.target.files?.[0] || null)} className="block w-full text-sm" />
              <button
                type="button"
                disabled={uploading}
                onClick={onUploadBannerVideo}
                className="mt-2 w-full px-3 py-2 rounded-xl bg-pink-600 text-white hover:bg-pink-700 text-sm disabled:opacity-60"
              >
                {uploading ? "Subiendo..." : "Subir a Cloudinary"}
              </button>
              <div className="text-xs text-gray-500 mt-2">Si falla el upload, pega la URL manualmente.</div>
            </div>

            <div className="mt-3">
              <button
                type="button"
                onClick={() => setEditIdx("video")}
                className="w-full px-3 py-2 rounded-xl border border-gray-300 hover:bg-gray-50 text-sm"
              >
                Editar botón del video (avanzado)
              </button>
            </div>
          </div>
        )}
      </section>

      {/* =======================
          RIGHT: Real preview + checklist + actions
      ======================= */}
      <section className="rounded-2xl border p-4 bg-white min-w-0">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="font-semibold text-gray-900">Vista previa</div>
            <div className="text-xs text-gray-500">Esto es lo que el usuario “entiende”.</div>
          </div>

          <button type="button" onClick={() => setShowJson((v) => !v)} className="px-3 py-1.5 rounded-xl border border-gray-300 hover:bg-gray-50 text-sm">
            {showJson ? "Ocultar JSON" : "Ver JSON"}
          </button>
        </div>

        {/* Preview box */}
        <div className="mt-3 rounded-2xl border bg-gray-50 p-3">
          {String(b.type || "slider") === "video" ? (
            <div className="rounded-xl border bg-white overflow-hidden">
              <div className="h-44 flex items-center justify-center text-sm text-gray-500">
                {b.videoUrl ? (
                  <div className="text-center px-4">
                    <div className="font-semibold text-gray-700">Video</div>
                    <div className="text-xs text-gray-500 break-words mt-1">{b.videoUrl}</div>
                  </div>
                ) : (
                  "Sin video"
                )}
              </div>
            </div>
          ) : (
            <BannerDragPreview
              src={previewSrc}
              fit={
                String(b.type || "slider") === "slider"
                  ? (selectedSlide?.fit || "cover")
                  : (b.imageFit || "cover")
              }
              posX={
                String(b.type || "slider") === "slider"
                  ? (Number.isFinite(Number(selectedSlide?.posX)) ? Number(selectedSlide?.posX) : 50)
                  : (Number.isFinite(Number(b.imagePosX)) ? Number(b.imagePosX) : 50)
              }
              posY={
                String(b.type || "slider") === "slider"
                  ? (Number.isFinite(Number(selectedSlide?.posY)) ? Number(selectedSlide?.posY) : 50)
                  : (Number.isFinite(Number(b.imagePosY)) ? Number(b.imagePosY) : 50)
              }
              height={220}
              onChange={null}
            />
          )}

          {String(b.type || "slider") === "slider" && slides.length > 0 && (
            <div className="mt-3">
              <div className="text-xs text-gray-500 mb-1">Previsualizando:</div>
              <select
                className="w-full rounded-xl border border-gray-300 px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-pink-400 text-sm"
                value={selectedIdx}
                onChange={(e) => setSelectedIdx(Number(e.target.value))}
              >
                {slides.map((_, i) => (
                  <option key={i} value={i}>
                    Slide #{i + 1} {slides[i]?.image ? "" : "(falta imagen)"}
                  </option>
                ))}
              </select>

              <div className="mt-2 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setEditIdx(selectedIdx)}
                  className="px-3 py-2 rounded-xl bg-pink-600 text-white hover:bg-pink-700 text-sm"
                >
                  Editar este slide
                </button>
                <button
                  type="button"
                  onClick={addSlide}
                  className="px-3 py-2 rounded-xl border border-gray-300 hover:bg-gray-50 text-sm"
                >
                  + Agregar slide
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Checklist */}
        <div className="mt-3 rounded-2xl border bg-white p-3">
          <div className="font-semibold text-gray-900 mb-2">Checklist</div>

          {issues.length === 0 ? (
            <div className="flex items-center justify-between gap-2">
              <Badge tone="green">Todo OK</Badge>
              <div className="text-xs text-gray-500">Solo recuerda presionar Guardar.</div>
            </div>
          ) : (
            <ul className="space-y-2">
              {issues.map((it, k) => (
                <li key={k} className="flex items-start gap-2">
                  <Badge tone={it.tone}>{it.tone === "red" ? "Error" : "Info"}</Badge>
                  <div className="text-sm text-gray-700">{it.text}</div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* JSON */}
        {showJson && (
          <div className="mt-3 rounded-2xl border bg-gray-50 p-3 text-xs overflow-auto">
            <pre className="whitespace-pre-wrap break-words">{JSON.stringify(theme.banner || {}, null, 2)}</pre>
          </div>
        )}
      </section>

      {/* =======================
          MODALS (Editor completo)
      ======================= */}
      <Modal
        open={editIdx !== null && editIdx !== "image" && editIdx !== "video"}
        title={typeof editIdx === "number" ? `Editar Slide #${editIdx + 1}` : "Editar"}
        onClose={() => setEditIdx(null)}
      >
        {typeof editIdx === "number" && slides[editIdx] && (
          <div className="grid lg:grid-cols-2 gap-6">
            <div>
              <div className="font-semibold text-gray-900 mb-2">Encuadre</div>
              <BannerDragPreview
                src={slides[editIdx]?.image || ""}
                fit={slides[editIdx]?.fit || "cover"}
                posX={Number.isFinite(Number(slides[editIdx]?.posX)) ? Number(slides[editIdx]?.posX) : 50}
                posY={Number.isFinite(Number(slides[editIdx]?.posY)) ? Number(slides[editIdx]?.posY) : 50}
                height={220}
                onChange={(p) => setSlide(editIdx, { posX: p.posX, posY: p.posY })}
              />

              <div className="grid sm:grid-cols-2 gap-3 mt-3">
                <Select label="Ajuste (fit)" value={slides[editIdx]?.fit || "cover"} onChange={(e) => setSlide(editIdx, { fit: e.target.value })}>
                  <option value="cover">Cover</option>
                  <option value="contain">Contain</option>
                </Select>

                <div className="grid grid-cols-2 gap-3">
                  <Input type="number" min={0} max={100} step="1" label="X" value={Number.isFinite(Number(slides[editIdx]?.posX)) ? Number(slides[editIdx]?.posX) : 50} onChange={(e) => setSlide(editIdx, { posX: Number(e.target.value) })} />
                  <Input type="number" min={0} max={100} step="1" label="Y" value={Number.isFinite(Number(slides[editIdx]?.posY)) ? Number(slides[editIdx]?.posY) : 50} onChange={(e) => setSlide(editIdx, { posY: Number(e.target.value) })} />
                </div>
              </div>

              <div className="mt-2 flex justify-end">
                <button type="button" onClick={() => setSlide(editIdx, { posX: 50, posY: 50 })} className="px-3 py-1.5 rounded-xl border border-gray-300 hover:bg-gray-50 text-sm">
                  Centrar encuadre
                </button>
              </div>

              <Input label="Imagen (URL)" value={slides[editIdx]?.image || ""} onChange={(e) => setSlide(editIdx, { image: e.target.value })} placeholder="https://.../slide.png" />
              <Input label="Link (opcional)" value={slides[editIdx]?.link || ""} onChange={(e) => setSlide(editIdx, { link: e.target.value })} placeholder="/lo-nuevo ó https://..." />

              <div className="rounded-2xl border bg-gray-50 p-3">
                <div className="text-sm font-medium mb-2">Subir imagen del slide</div>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(e) => setBannerSlideFiles((prev) => ({ ...prev, [editIdx]: e.target.files?.[0] || null }))}
                  className="block w-full text-sm"
                />
                <button
                  type="button"
                  disabled={uploading}
                  onClick={() => onUploadBannerSlideImage(editIdx)}
                  className="mt-2 w-full px-3 py-2 rounded-xl bg-pink-600 text-white hover:bg-pink-700 text-sm disabled:opacity-60"
                >
                  {uploading ? "Subiendo..." : "Subir a Cloudinary"}
                </button>
              </div>
            </div>

            <div>
              <BannerButtonEditor
                title="Botón del slide"
                value={slides[editIdx]?.button || buildDefaultButton()}
                uploading={uploading}
                onUploadImage={uploadButtonImage}
                onChange={(nextBtn) => setSlideButton(editIdx, nextBtn)}
              />
            </div>
          </div>
        )}
      </Modal>

      <Modal open={editIdx === "image"} title="Editar Imagen única (avanzado)" onClose={() => setEditIdx(null)}>
        <div className="grid lg:grid-cols-2 gap-6">
          <div>
            <div className="font-semibold text-gray-900 mb-2">Encuadre</div>
            <BannerDragPreview
              src={b.imageUrl || ""}
              fit={b.imageFit || "cover"}
              posX={Number.isFinite(Number(b.imagePosX)) ? Number(b.imagePosX) : 50}
              posY={Number.isFinite(Number(b.imagePosY)) ? Number(b.imagePosY) : 50}
              height={240}
              onChange={(p) => {
                setPath("banner.imagePosX", p.posX);
                setPath("banner.imagePosY", p.posY);
              }}
            />

            <div className="grid sm:grid-cols-2 gap-3 mt-3">
              <Select label="Ajuste (fit)" value={b.imageFit || "cover"} onChange={(e) => setPath("banner.imageFit", e.target.value)}>
                <option value="cover">Cover</option>
                <option value="contain">Contain</option>
              </Select>

              <div className="grid grid-cols-2 gap-3">
                <Input type="number" min={0} max={100} step="1" label="X" value={Number.isFinite(Number(b.imagePosX)) ? Number(b.imagePosX) : 50} onChange={(e) => setPath("banner.imagePosX", Number(e.target.value))} />
                <Input type="number" min={0} max={100} step="1" label="Y" value={Number.isFinite(Number(b.imagePosY)) ? Number(b.imagePosY) : 50} onChange={(e) => setPath("banner.imagePosY", Number(e.target.value))} />
              </div>
            </div>

            <div className="mt-2 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setPath("banner.imagePosX", 50);
                  setPath("banner.imagePosY", 50);
                }}
                className="px-3 py-1.5 rounded-xl border border-gray-300 hover:bg-gray-50 text-sm"
              >
                Centrar
              </button>
            </div>
          </div>

          <div>
            <BannerButtonEditor
              title="Botón de Imagen única"
              value={b.imageButton || buildDefaultButton()}
              uploading={uploading}
              onUploadImage={uploadButtonImage}
              onChange={(nextBtn) => setPath("banner.imageButton", nextBtn)}
            />
          </div>
        </div>
      </Modal>

      <Modal open={editIdx === "video"} title="Editar Video (botón avanzado)" onClose={() => setEditIdx(null)}>
        <BannerButtonEditor
          title="Botón del video"
          value={b.videoButton || buildDefaultButton()}
          uploading={uploading}
          onUploadImage={uploadButtonImage}
          onChange={(nextBtn) => setPath("banner.videoButton", nextBtn)}
        />
      </Modal>
    </div>
  );
}