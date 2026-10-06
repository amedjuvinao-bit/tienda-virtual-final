// src/admin/appearance/banner/BannerPanel.jsx
import React, { useEffect, useMemo, useState } from "react";
import BannerDevicePreview, { BANNER_DEVICES } from './BannerDevicePreview';
import './bannerPanel.css';

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
        data-admin-storefront-preview="true"
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
              objectPosition: `${clampNum(posX, 0, 100, 50)}% ${clampNum(posY, 0, 100, 50)}%`,
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
                } catch (_) {
                  // El editor principal muestra el error; conserva la imagen anterior.
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
  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[9999]">
      <div className="absolute inset-0 bg-white/25 backdrop-blur-md" onClick={onClose} />
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="banner-editor-dialog w-full max-w-4xl rounded-2xl bg-white shadow-xl border overflow-hidden" role="dialog" aria-modal="true" aria-label={title}>
          <div className="banner-editor-dialog__head flex items-center justify-between gap-3 px-4 py-3 border-b">
            <div className="font-semibold">{title}</div>
            <button onClick={onClose} className="banner-btn" type="button">
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
export default function BannerPanel({ theme, setPath, uploading, setUploading, uploadToCloudinaryViaBackend }) {
  const b = theme?.banner || {};
  const slides = useMemo(() => (Array.isArray(b.slides) ? b.slides : []), [b.slides]);

  // Local files (solo banner)
  const [bannerImageFile, setBannerImageFile] = useState(null);
  const [bannerVideoFile, setBannerVideoFile] = useState(null);
  const [bannerSlideFiles, setBannerSlideFiles] = useState({}); // { [idx]: File }

  // UI states
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [editIdx, setEditIdx] = useState(null);
  const [activeButtonIdx, setActiveButtonIdx] = useState(0);
  const [activePanel, setActivePanel] = useState('content');
  const [previewDevice, setPreviewDevice] = useState('desktop');
  const [uploadStatus, setUploadStatus] = useState(null);

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

    setBannerSlideFiles((prev) => Object.fromEntries(Object.entries(prev)
      .filter(([key]) => Number(key) !== idx)
      .map(([key, file]) => [Number(key) > idx ? Number(key) - 1 : Number(key), file])));

    setSelectedIdx((p) => {
      const n = Math.max(0, Math.min((next.length || 1) - 1, p > idx ? p - 1 : p));
      return n;
    });
    setEditIdx((current) => typeof current === 'number' ? current === idx ? null : current > idx ? current - 1 : current : current);
  };

  const setSlide = (idx, patch) => {
    const next = [...slides];
    if (!next[idx]) return;
    next[idx] = { ...next[idx], ...(patch || {}) };
    setSlides(next);
  };

  const moveSlide = (idx, direction) => {
    const target = idx + direction;
    if (target < 0 || target >= slides.length) return;
    const next = [...slides];
    [next[idx], next[target]] = [next[target], next[idx]];
    setSlides(next);
    setBannerSlideFiles((previous) => {
      const files = { ...previous };
      const current = files[idx];
      const other = files[target];
      if (other) files[idx] = other; else delete files[idx];
      if (current) files[target] = current; else delete files[target];
      return files;
    });
    setSelectedIdx(target);
  };

  const setSlideButton = (idx, nextBtn) => {
    const next = [...slides];
    if (!next[idx]) return;
    const cur = next[idx] || {};
    if (Array.isArray(cur.buttons) && cur.buttons.length) {
      const buttons = [...cur.buttons];
      buttons[activeButtonIdx] = { ...buttons[activeButtonIdx], ...(nextBtn || {}) };
      next[idx] = { ...cur, buttons };
    } else {
      const curBtn = cur.button || buildDefaultButton();
      next[idx] = { ...cur, button: { ...buildDefaultButton(), ...curBtn, ...(nextBtn || {}) } };
    }
    setSlides(next);
  };

  const buttonFor = (item, manyKey, oneKey) => {
    const many = item?.[manyKey];
    return Array.isArray(many) && many.length ? many[activeButtonIdx] || many[0] : item?.[oneKey] || buildDefaultButton();
  };

  const setSingleOrMultipleButton = (manyKey, oneKey, nextBtn) => {
    const many = b[manyKey];
    if (Array.isArray(many) && many.length) {
      const next = [...many];
      next[activeButtonIdx] = { ...next[activeButtonIdx], ...nextBtn };
      setPath(`banner.${manyKey}`, next);
    } else setPath(`banner.${oneKey}`, nextBtn);
  };

  const uploadButtonImage = async (file) => {
    if (!file) return "";
    setUploading(true);
    try {
      const url = await uploadToCloudinaryViaBackend(file, "image");
      setUploadStatus({ type: 'success', text: 'Imagen del botón subida. Guarda los cambios para publicarla.' });
      return url;
    } catch (e) {
      console.error(e);
      setUploadStatus({ type: 'error', text: e?.message || 'No se pudo subir la imagen del botón.' });
      throw e;
    } finally {
      setUploading(false);
    }
  };

  const onUploadBannerImage = async () => {
    try {
      if (!bannerImageFile) return setUploadStatus({ type: 'error', text: 'Selecciona una imagen primero.' });
      setUploading(true);
      const url = await uploadToCloudinaryViaBackend(bannerImageFile, "image");
      setPath("banner.imageUrl", url);
      setBannerImageFile(null);
      setUploadStatus({ type: 'success', text: 'Imagen subida. Guarda los cambios para publicarla.' });
    } catch (e) {
      console.error(e);
      setUploadStatus({ type: 'error', text: e?.message || 'No se pudo subir la imagen.' });
    } finally {
      setUploading(false);
    }
  };

  const onUploadBannerSlideImage = async (idx) => {
    try {
      const file = bannerSlideFiles?.[idx] || null;
      if (!file) return setUploadStatus({ type: 'error', text: 'Selecciona una imagen primero.' });
      setUploading(true);
      const url = await uploadToCloudinaryViaBackend(file, "image");
      setSlide(idx, { image: url });
      setBannerSlideFiles((prev) => ({ ...prev, [idx]: null }));
      setUploadStatus({ type: 'success', text: 'Slide subido. Guarda los cambios para publicarlo.' });
    } catch (e) {
      console.error(e);
      setUploadStatus({ type: 'error', text: e?.message || 'No se pudo subir el slide.' });
    } finally {
      setUploading(false);
    }
  };

  const onUploadBannerVideo = async () => {
    try {
      if (!bannerVideoFile) return setUploadStatus({ type: 'error', text: 'Selecciona un video primero.' });
      setUploading(true);
      const url = await uploadToCloudinaryViaBackend(bannerVideoFile, "video");
      setPath("banner.videoUrl", url);
      setBannerVideoFile(null);
      setUploadStatus({ type: 'success', text: 'Video subido. Guarda los cambios para publicarlo.' });
    } catch (e) {
      console.error(e);
      setUploadStatus({ type: 'error', text: e?.message || 'No se pudo subir el video.' });
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
      if (!slides.length) out.push({ tone: "red", text: "Sin slides la tienda mostrará imágenes de ejemplo. Agrega al menos uno." });
      slides.forEach((s, i) => {
        if (!s?.image) out.push({ tone: "red", text: `Slide #${i + 1}: falta imagen.` });
      });
    }

    if (type === "image") {
      if (!b.imageUrl) out.push({ tone: "red", text: "Imagen única: falta imageUrl." });
    }

    if (type === "video") {
      if (!b.videoUrl) out.push({ tone: "red", text: "Agrega el video de portada." });
      if (b.videoAutoplay && !b.videoMuted) out.push({ tone: "red", text: "La reproducción automática con sonido puede ser bloqueada por el navegador. Activa Silenciar." });
    }

    return out;
  }, [b.type, b.imageUrl, b.videoUrl, b.videoAutoplay, b.videoMuted, slides]);

  const bannerType = String(b.type || "slider");
  const effectiveInterval = b.sliderIntervalMs ?? b.autoplayMs ?? 3500;
  const activeSlideIdx = Math.min(selectedIdx, Math.max(0, slides.length - 1));
  const editCurrent = (buttonIndex = 0) => {
    setActiveButtonIdx(Number.isInteger(buttonIndex) ? buttonIndex : 0);
    setEditIdx(bannerType === "slider" ? activeSlideIdx : bannerType);
  };
  const chooseSlide = (step) => setSelectedIdx((current) => (current + step + slides.length) % slides.length);

  return (
    <div className="banner-workspace">
      <section className="banner-panel banner-panel--editor" aria-label="Configurar portada">
        <div className="banner-panel__head">
          <div>
            <h2>Portada de la tienda</h2>
            <p>Elige el contenido y mira cómo queda antes de guardar.</p>
          </div>
          <div className="banner-panel-tabs" role="group" aria-label="Edición de portada">
            <button type="button" onClick={() => setActivePanel('content')} aria-pressed={activePanel === 'content'}>Contenido</button>
            <button type="button" onClick={() => setActivePanel('behavior')} aria-pressed={activePanel === 'behavior'}>Comportamiento</button>
          </div>
        </div>

        {uploadStatus && <div className="banner-upload-status" data-tone={uploadStatus.type} role={uploadStatus.type === 'error' ? 'alert' : 'status'}>{uploadStatus.text}<button type="button" onClick={() => setUploadStatus(null)} aria-label="Cerrar aviso de subida">×</button></div>}

        <div className="banner-core-controls">
          <Select label="Contenido de la portada" value={bannerType} onChange={(e) => { setPath('banner.type', e.target.value); setActivePanel('content'); }}>
            <option value="slider">Galería de imágenes</option>
            <option value="image">Imagen única</option>
            <option value="video">Video</option>
          </Select>
          <Select label="Altura en escritorio" value={b.heightMode || 'auto'} onChange={(e) => setPath('banner.heightMode', e.target.value)}>
            <option value="auto">Altura personalizada</option>
            <option value="fullscreen">Pantalla completa</option>
          </Select>
        </div>

        {activePanel === 'content' && bannerType === 'slider' && (
          <div className="banner-content-card">
            <div className="banner-content-card__head"><strong>Imágenes de la galería <span>{slides.length}</span></strong><button type="button" className="banner-btn banner-btn--primary" onClick={addSlide}>+ Agregar</button></div>
            {slides.length ? <>
              <div className="banner-slide-picker">
                <button type="button" onClick={() => chooseSlide(-1)} disabled={slides.length < 2} aria-label="Slide anterior">‹</button>
                <select aria-label="Slide para editar" value={activeSlideIdx} onChange={(e) => setSelectedIdx(Number(e.target.value))}>
                  {slides.map((slide, index) => <option key={index} value={index}>Slide {index + 1} de {slides.length}{slide?.image ? '' : ' · Falta imagen'}</option>)}
                </select>
                <button type="button" onClick={() => chooseSlide(1)} disabled={slides.length < 2} aria-label="Slide siguiente">›</button>
              </div>
              <div className="banner-slide-current">
                <div className="banner-slide-current__image">{slides[activeSlideIdx]?.image ? <img src={slides[activeSlideIdx].image} alt={`Miniatura del slide ${activeSlideIdx + 1}`} /> : <span>Sin imagen</span>}</div>
                <div className="banner-slide-current__details"><strong>Slide {activeSlideIdx + 1}</strong><small>{slides[activeSlideIdx]?.image ? 'Imagen lista' : 'Sube una imagen para mostrarlo en la tienda'}</small></div>
                <button type="button" className="banner-btn" onClick={() => moveSlide(activeSlideIdx, -1)} disabled={activeSlideIdx === 0} aria-label="Mover slide antes" title="Mover antes">↑</button>
                <button type="button" className="banner-btn" onClick={() => moveSlide(activeSlideIdx, 1)} disabled={activeSlideIdx === slides.length - 1} aria-label="Mover slide después" title="Mover después">↓</button>
                <button type="button" className="banner-btn" onClick={() => editCurrent()}>Editar</button>
                <button type="button" className="banner-btn banner-btn--danger" onClick={() => removeSlide(activeSlideIdx)} aria-label={`Eliminar slide ${activeSlideIdx + 1}`}>Eliminar</button>
              </div>
              <label className="banner-upload-field"><span>Imagen del slide</span><input type="file" accept="image/png,image/jpeg,image/webp" aria-label="Elegir imagen del slide" onChange={(e) => setBannerSlideFiles((prev) => ({ ...prev, [activeSlideIdx]: e.target.files?.[0] || null }))} /></label>
              {bannerSlideFiles[activeSlideIdx] && <button type="button" className="banner-btn banner-btn--primary" disabled={uploading} onClick={() => onUploadBannerSlideImage(activeSlideIdx)}>{uploading ? 'Subiendo…' : 'Subir imagen'}</button>}
            </> : <p className="banner-empty">Agrega un slide y sube su imagen para reemplazar las imágenes de ejemplo.</p>}
          </div>
        )}

        {activePanel === 'content' && bannerType === 'image' && (
          <div className="banner-content-card">
            <div className="banner-content-card__head"><strong>Imagen principal</strong><button type="button" className="banner-btn" onClick={() => editCurrent()}>Ajustar encuadre y botón</button></div>
            <label className="banner-upload-field"><span>Subir imagen</span><input type="file" accept="image/png,image/jpeg,image/webp" aria-label="Elegir imagen principal" onChange={(e) => setBannerImageFile(e.target.files?.[0] || null)} /></label>
            {bannerImageFile && <button type="button" className="banner-btn banner-btn--primary" disabled={uploading} onClick={onUploadBannerImage}>{uploading ? 'Subiendo…' : 'Subir imagen'}</button>}
            <details className="banner-inline-details"><summary>Usar una imagen ya alojada</summary><Input label="URL de la imagen" value={b.imageUrl || ''} onChange={(e) => setPath('banner.imageUrl', e.target.value)} placeholder="https://..." /></details>
            <Input label="Destino al pulsar (opcional)" value={b.imageLink || ''} onChange={(e) => setPath('banner.imageLink', e.target.value)} placeholder="/coleccion o https://..." />
          </div>
        )}

        {activePanel === 'content' && bannerType === 'video' && (
          <div className="banner-content-card">
            <div className="banner-content-card__head"><strong>Video principal</strong><button type="button" className="banner-btn" onClick={() => editCurrent()}>Editar botón</button></div>
            <label className="banner-upload-field"><span>Subir video</span><input type="file" accept="video/mp4,video/webm,video/ogg" aria-label="Elegir video de portada" onChange={(e) => setBannerVideoFile(e.target.files?.[0] || null)} /></label>
            {bannerVideoFile && <button type="button" className="banner-btn banner-btn--primary" disabled={uploading} onClick={onUploadBannerVideo}>{uploading ? 'Subiendo…' : 'Subir video'}</button>}
            <details className="banner-inline-details"><summary>Usar un video ya alojado</summary><Input label="URL del video" value={b.videoUrl || ''} onChange={(e) => setPath('banner.videoUrl', e.target.value)} placeholder="https://.../video.mp4" /></details>
          </div>
        )}

        {activePanel === 'behavior' && <div className="banner-content-card banner-behavior">
          <div><strong>Altura y adaptación</strong><p>En móvil y tableta la portada ocupa el alto de pantalla. En escritorio puedes ajustar su altura.</p></div>
          {(b.heightMode || 'auto') === 'auto' && <Input type="number" min="240" max="1200" label="Altura de escritorio (px)" value={b.heightPx ?? 520} onChange={(e) => setPath('banner.heightPx', Number(e.target.value))} />}
          {bannerType === 'slider' && <>
            <Input type="number" min="1.2" max="15" step="0.1" label="Segundos por imagen" value={Number(effectiveInterval) / 1000} onChange={(e) => setPath('banner.sliderIntervalMs', Math.round(Number(e.target.value) * 1000))} />
            <label className="banner-check"><input type="checkbox" checked={b.sliderShowProgress !== false} onChange={(e) => setPath('banner.sliderShowProgress', e.target.checked)} /> Mostrar progreso entre imágenes</label>
          </>}
          {bannerType === 'video' && <div className="banner-checks">
            <label className="banner-check"><input type="checkbox" checked={!!b.videoAutoplay} onChange={(e) => setPath('banner.videoAutoplay', e.target.checked)} /> Reproducir automáticamente</label>
            <label className="banner-check"><input type="checkbox" checked={!!b.videoMuted} onChange={(e) => setPath('banner.videoMuted', e.target.checked)} /> Silenciar</label>
            <label className="banner-check"><input type="checkbox" checked={!!b.videoLoop} onChange={(e) => setPath('banner.videoLoop', e.target.checked)} /> Repetir</label>
          </div>}
        </div>}
      </section>

      <section className="banner-panel banner-panel--preview" aria-label="Vista previa de portada">
        <div className="banner-preview-head"><div><h2>Vista previa en vivo</h2><p>Selecciona un tamaño para comprobar el encuadre.</p></div><div className="banner-device-tabs" role="group" aria-label="Tamaño de pantalla">{Object.entries(BANNER_DEVICES).map(([key, device]) => <button key={key} type="button" aria-pressed={previewDevice === key} onClick={() => setPreviewDevice(key)}>{device.label}</button>)}</div></div>
        <BannerDevicePreview banner={b} slides={slides} selectedIdx={activeSlideIdx} device={previewDevice} onEdit={editCurrent} />
        {bannerType === 'slider' && slides.length > 1 && <div className="banner-preview-navigation"><button type="button" onClick={() => chooseSlide(-1)}>‹ Anterior</button><span>{activeSlideIdx + 1} / {slides.length}</span><button type="button" onClick={() => chooseSlide(1)}>Siguiente ›</button></div>}
        <div className="banner-preview-actions"><button type="button" className="banner-btn banner-btn--primary" onClick={() => editCurrent()} disabled={bannerType === 'slider' && !slides.length}>Editar {bannerType === 'slider' ? 'este slide' : 'contenido'}</button></div>
        {issues.length > 0 && <div className="banner-issues" role="status"><strong>Antes de publicar</strong><ul>{issues.map((issue, index) => <li key={index}>{issue.text}</li>)}</ul></div>}
        <details className="banner-inline-details banner-json"><summary>Datos técnicos</summary><pre>{JSON.stringify(theme.banner || {}, null, 2)}</pre></details>
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
                title={`Botón ${activeButtonIdx + 1} del slide`}
                value={buttonFor(slides[editIdx], 'buttons', 'button')}
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
              value={buttonFor(b, 'imageButtons', 'imageButton')}
              uploading={uploading}
              onUploadImage={uploadButtonImage}
              onChange={(nextBtn) => setSingleOrMultipleButton('imageButtons', 'imageButton', nextBtn)}
            />
          </div>
        </div>
      </Modal>

      <Modal open={editIdx === "video"} title="Editar Video (botón avanzado)" onClose={() => setEditIdx(null)}>
        <BannerButtonEditor
          title="Botón del video"
          value={buttonFor(b, 'videoButtons', 'videoButton')}
          uploading={uploading}
          onUploadImage={uploadButtonImage}
          onChange={(nextBtn) => setSingleOrMultipleButton('videoButtons', 'videoButton', nextBtn)}
        />
      </Modal>
    </div>
  );
}
