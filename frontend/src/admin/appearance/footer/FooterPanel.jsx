// src/admin/appearance/footer/FooterPanel.jsx
import React, { useMemo, useState } from "react";

function clampNumber(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function ColorInput({ value, onChange }) {
  const isHex = (v) =>
    typeof v === "string" && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v.trim());

  const safeColor = isHex(value) ? value : "#ffffff";

  return (
    <div className="grid grid-cols-[56px_1fr] gap-3 w-full min-w-0">
      <input
        type="color"
        className="h-10 w-14 rounded border"
        value={safeColor}
        onChange={onChange}
      />
      <input
        className="w-full min-w-0 rounded-xl border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-pink-400"
        value={value || ""}
        onChange={onChange}
        placeholder="#FFFFFF"
      />
    </div>
  );
}

function Input({ label, ...props }) {
  return (
    <label className="block min-w-0">
      <span className="block text-sm mb-1 text-gray-700">{label}</span>
      <input
        className="w-full min-w-0 rounded-xl border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-pink-400"
        {...props}
      />
    </label>
  );
}

function TextArea({ label, rows = 3, ...props }) {
  return (
    <label className="block min-w-0">
      <span className="block text-sm mb-1 text-gray-700">{label}</span>
      <textarea
        rows={rows}
        className="w-full min-w-0 rounded-xl border border-gray-300 px-3 py-2 resize-y focus:outline-none focus:ring-2 focus:ring-pink-400"
        {...props}
      />
    </label>
  );
}

function NumberInput({ label, value, onChange, min, max, step = 1 }) {
  return (
    <label className="block min-w-0">
      <span className="block text-sm mb-1 text-gray-700">{label}</span>
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={onChange}
        className="w-full min-w-0 rounded-xl border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-pink-400"
      />
    </label>
  );
}

function RangeInput({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  suffix = "px",
}) {
  const safeValue = clampNumber(value, min, max, min);

  const emitValue = (nextValue) => {
    const clamped = clampNumber(nextValue, min, max, safeValue);
    onChange?.({ target: { value: clamped } });
  };

  const decrement = () => emitValue(safeValue - step);
  const increment = () => emitValue(safeValue + step);

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm min-w-0">
      <div className="flex items-start justify-between gap-3 mb-3 min-w-0">
        <div className="min-w-0">
          <div className="text-sm font-medium text-neutral-800 leading-5 break-words">
            {label}
          </div>
        </div>

        <div className="shrink-0 inline-flex items-center justify-center rounded-xl border border-pink-200 bg-pink-50 px-3 py-1.5 text-sm font-semibold text-pink-700 whitespace-nowrap">
          {safeValue}
          {suffix}
        </div>
      </div>

      <div className="grid grid-cols-[44px_minmax(0,1fr)_44px] items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={decrement}
          className="h-11 w-11 rounded-xl border border-neutral-300 bg-neutral-50 text-lg font-semibold text-neutral-700 transition hover:bg-neutral-100 active:scale-[0.98] disabled:opacity-50"
          aria-label={`Disminuir ${label}`}
          disabled={safeValue <= min}
        >
          −
        </button>

        <div className="min-w-0">
          <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={safeValue}
            onChange={(e) => emitValue(e.target.value)}
            className="w-full min-w-0 accent-pink-500 cursor-pointer"
            aria-label={label}
          />
        </div>

        <button
          type="button"
          onClick={increment}
          className="h-11 w-11 rounded-xl border border-neutral-300 bg-neutral-50 text-lg font-semibold text-neutral-700 transition hover:bg-neutral-100 active:scale-[0.98] disabled:opacity-50"
          aria-label={`Aumentar ${label}`}
          disabled={safeValue >= max}
        >
          +
        </button>
      </div>
    </div>
  );
}

function PanelCard({ title, subtitle, children, right }) {
  return (
    <section className="rounded-3xl border border-neutral-200 bg-white shadow-sm overflow-hidden min-w-0">
      <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-neutral-100 bg-gradient-to-r from-white to-neutral-50">
        <div className="min-w-0">
          <h2 className="font-semibold text-neutral-900">{title}</h2>
          {subtitle ? <p className="text-sm text-neutral-500 mt-1">{subtitle}</p> : null}
        </div>
        {right}
      </div>
      <div className="p-5 min-w-0">{children}</div>
    </section>
  );
}

function SegmentedTabs({ value, onChange, items }) {
  return (
    <div className="max-w-full overflow-x-auto">
      <div className="inline-flex rounded-2xl border border-neutral-200 bg-white p-1 shadow-sm min-w-max">
        {items.map((item) => {
          const active = value === item.value;
          return (
            <button
              key={item.value}
              type="button"
              onClick={() => onChange(item.value)}
              className={[
                "px-4 py-2 rounded-xl text-sm font-medium transition whitespace-nowrap",
                active
                  ? "bg-neutral-900 text-white shadow-sm"
                  : "text-neutral-600 hover:bg-neutral-100",
              ].join(" ")}
            >
              {item.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function MiniStat({ label, value }) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white px-4 py-3 shadow-sm">
      <div className="text-[11px] uppercase tracking-wide text-neutral-500">{label}</div>
      <div className="text-sm font-semibold text-neutral-900 mt-1">{value}</div>
    </div>
  );
}

function FooterLinkEditor({ title, links = [], onChange }) {
  const safeLinks = Array.isArray(links) ? links : [];

  const updateLink = (index, field, value) => {
    const next = [...safeLinks];
    next[index] = {
      ...(next[index] || { label: "", href: "" }),
      [field]: value,
    };
    onChange(next);
  };

  const addLink = () => {
    onChange([...(safeLinks || []), { label: "Nuevo enlace", href: "/" }]);
  };

  const removeLink = (index) => {
    const next = [...safeLinks];
    next.splice(index, 1);
    onChange(next);
  };

  const moveLink = (from, to) => {
    if (to < 0 || to >= safeLinks.length) return;
    const next = [...safeLinks];
    const item = next.splice(from, 1)[0];
    next.splice(to, 0, item);
    onChange(next);
  };

  return (
    <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 min-w-0">
      <div className="flex items-center justify-between gap-3 mb-3 min-w-0">
        <h3 className="font-medium text-gray-800 truncate">{title}</h3>
        <button
          type="button"
          onClick={addLink}
          className="shrink-0 h-9 min-w-9 px-3 rounded-xl bg-pink-600 text-white hover:bg-pink-700 text-sm font-medium"
          title="Agregar enlace"
          aria-label="Agregar enlace"
        >
          +
        </button>
      </div>

      {safeLinks.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white p-4 text-sm text-gray-500">
          No hay enlaces todavía.
        </div>
      ) : (
        <div className="space-y-3">
          {safeLinks.map((link, index) => (
            <div
              key={`${title}-${index}`}
              className="rounded-xl border border-gray-200 bg-white p-3"
            >
              <div className="grid grid-cols-1 gap-3">
                <Input
                  label={`Texto #${index + 1}`}
                  value={link?.label || ""}
                  onChange={(e) => updateLink(index, "label", e.target.value)}
                  placeholder="Ej: Nuestra historia"
                />

                <Input
                  label={`Ruta #${index + 1}`}
                  value={link?.href || ""}
                  onChange={(e) => updateLink(index, "href", e.target.value)}
                  placeholder="Ej: /nuestra-historia"
                />

                <div className="flex flex-wrap gap-2 justify-end">
                  <button
                    type="button"
                    onClick={() => moveLink(index, index - 1)}
                    className="h-9 min-w-9 px-3 rounded-xl border border-gray-300 hover:bg-gray-50 text-sm shrink-0"
                    title="Subir"
                    aria-label="Subir"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => moveLink(index, index + 1)}
                    className="h-9 min-w-9 px-3 rounded-xl border border-gray-300 hover:bg-gray-50 text-sm shrink-0"
                    title="Bajar"
                    aria-label="Bajar"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    onClick={() => removeLink(index)}
                    className="h-9 min-w-9 px-3 rounded-xl border border-red-300 text-red-700 hover:bg-red-50 text-sm shrink-0"
                    title="Eliminar"
                    aria-label="Eliminar"
                  >
                    ✕
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function UploadField({
  label,
  value,
  onChange,
  onUpload,
  uploading,
  previewAlt,
  buttonText = "Subir imagen",
  accept = "image/*",
  previewSizeClass = "h-28",
  compact = false,
}) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4 min-w-0">
      <div className="text-sm font-medium text-neutral-800 mb-3">{label}</div>

      <div
        className={[
          "grid gap-4 items-start min-w-0",
          compact
            ? "grid-cols-[88px_minmax(0,1fr)]"
            : "grid-cols-1 md:grid-cols-[120px_minmax(0,1fr)]",
        ].join(" ")}
      >
        <div
          className={[
            "rounded-2xl border border-neutral-200 bg-white flex items-center justify-center overflow-hidden shrink-0",
            compact ? "h-20 w-[88px]" : `${previewSizeClass} w-full`,
          ].join(" ")}
        >
          {value ? (
            <img
              src={value}
              alt={previewAlt}
              className="max-h-full max-w-full object-contain"
            />
          ) : (
            <span className="text-xs text-neutral-400">Sin imagen</span>
          )}
        </div>

        <div className="min-w-0 flex flex-col gap-3">
          <label className="block min-w-0">
            <span className="block text-sm mb-1 text-gray-700">URL</span>
            <input
              className="w-full min-w-0 rounded-xl border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-pink-400"
              value={value || ""}
              onChange={(e) => onChange(e.target.value)}
              placeholder="https://..."
            />
          </label>

          <label
            className={[
              "inline-flex items-center justify-center h-10 px-4 rounded-2xl bg-neutral-900 text-white text-sm font-medium cursor-pointer hover:bg-neutral-800 transition",
              compact ? "w-full" : "w-full sm:w-auto",
            ].join(" ")}
          >
            <span>{uploading ? "Subiendo..." : buttonText}</span>
            <input
              type="file"
              accept={accept}
              className="hidden"
              disabled={uploading}
              onChange={(e) => onUpload?.(e.target.files?.[0] || null)}
            />
          </label>
        </div>
      </div>
    </div>
  );
}

function SocialCard({
  title,
  linkValue,
  onLinkChange,
  iconValue,
  onIconChange,
  onIconUpload,
  uploading,
  previewAlt,
}) {
  return (
    <div className="space-y-4 rounded-2xl border border-neutral-200 bg-neutral-50 p-4 min-w-0">
      <div className="font-medium text-neutral-800">{title}</div>

      <Input
        label={`Link ${title}`}
        value={linkValue || ""}
        onChange={(e) => onLinkChange(e.target.value)}
        placeholder="https://..."
      />

      <div className="rounded-2xl border border-neutral-200 bg-white p-4 min-w-0">
        <div className="text-sm font-medium text-neutral-800 mb-3">{`Ícono ${title}`}</div>

        <div className="grid grid-cols-1 sm:grid-cols-[112px,minmax(0,1fr)] gap-4 items-start min-w-0">
          <div className="h-24 rounded-2xl border border-neutral-200 bg-neutral-50 flex items-center justify-center overflow-hidden">
            {iconValue ? (
              <img
                src={iconValue}
                alt={previewAlt}
                className="max-h-full max-w-full object-contain"
              />
            ) : (
              <span className="text-xs text-neutral-400">Sin imagen</span>
            )}
          </div>

          <div className="min-w-0 space-y-3">
            <Input
              label="URL del ícono"
              value={iconValue || ""}
              onChange={(e) => onIconChange(e.target.value)}
              placeholder="https://..."
            />

            <label className="inline-flex w-full sm:w-auto items-center justify-center h-10 px-4 rounded-2xl bg-neutral-900 text-white text-sm font-medium cursor-pointer hover:bg-neutral-800 transition">
              <span>{uploading ? "Subiendo..." : "Subir ícono"}</span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                disabled={uploading}
                onChange={(e) => onIconUpload?.(e.target.files?.[0] || null)}
              />
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function FooterPanel({
  theme,
  setPath,
  uploadToCloudinaryViaBackend,
  uploading,
  setUploading,
}) {
  const footer = theme?.footer || {};
  const [activeTab, setActiveTab] = useState("general");

  const setFooterPath = (field, value) => {
    setPath(`footer.${field}`, value);
  };

  const socialCount = useMemo(() => {
    let count = 0;
    if (footer.facebook) count += 1;
    if (footer.instagram) count += 1;
    if (footer.tiktok) count += 1;
    if (footer.whatsapp) count += 1;
    return count;
  }, [footer.facebook, footer.instagram, footer.tiktok, footer.whatsapp]);

  async function uploadImageToFooter(field, file) {
    if (!file || !uploadToCloudinaryViaBackend) return;

    try {
      setUploading?.(true);
      const url = await uploadToCloudinaryViaBackend(file, "image");
      if (!url) return;
      setFooterPath(field, url);
    } catch (error) {
      console.error(error);
      alert(error?.message || "Error subiendo imagen");
    } finally {
      setUploading?.(false);
    }
  }

  const logoSizePx = clampNumber(footer.logoSizePx ?? 144, 60, 260, 144);
  const socialIconSizePx = clampNumber(footer.socialIconSizePx ?? 48, 24, 90, 48);
  const socialIconGapPx = clampNumber(footer.socialIconGapPx ?? 8, 0, 40, 8);
  const footerHeightPx = clampNumber(footer.footerHeightPx ?? 420, 260, 900, 420);
  const subscribeButtonWidthPx = clampNumber(
    footer.subscribeButtonWidthPx ?? 170,
    90,
    320,
    170
  );
  const subscribeButtonHeightPx = clampNumber(
    footer.subscribeButtonHeightPx ?? 44,
    32,
    80,
    44
  );
  const subscribeButtonFontSizePx = clampNumber(
    footer.subscribeButtonFontSizePx ?? 16,
    10,
    28,
    16
  );

  return (
    <div className="space-y-6 min-w-0">
      <div className="sticky top-0 z-20 -mx-1 px-1 py-1 bg-[linear-gradient(to_bottom,rgba(250,250,250,0.96),rgba(250,250,250,0.88),rgba(250,250,250,0))] backdrop-blur-sm">
        <div className="rounded-3xl border border-neutral-200 bg-white shadow-sm p-4">
          <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
            <div>
              <div className="text-xs uppercase tracking-[0.18em] text-neutral-500">Panel</div>
              <div className="text-lg font-semibold text-neutral-900 mt-1">
                Footer
              </div>
              <div className="text-xs text-neutral-500 mt-1">
                Configura logo, redes, columnas y barra inferior sin editar código.
              </div>
            </div>

            <SegmentedTabs
              value={activeTab}
              onChange={setActiveTab}
              items={[
                { value: "general", label: "General" },
                { value: "marca", label: "Marca y redes" },
                { value: "columnas", label: "Columnas" },
                { value: "legal", label: "Barra inferior" },
              ]}
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[320px,minmax(0,1fr)] gap-6 items-start">
        <div className="space-y-4 xl:sticky xl:top-28">
          <MiniStat label="Redes configuradas" value={`${socialCount}/4`} />
          <MiniStat
            label="Logo footer"
            value={footer.logoUrl ? "Configurado" : "Pendiente"}
          />
          <MiniStat
            label="Altura footer"
            value={`${footerHeightPx}px`}
          />
          <MiniStat
            label="Columna 1"
            value={`${Array.isArray(footer.column1Links) ? footer.column1Links.length : 0} enlaces`}
          />
          <MiniStat
            label="Columna 2"
            value={`${Array.isArray(footer.column2Links) ? footer.column2Links.length : 0} enlaces`}
          />
          <MiniStat
            label="Columna 3"
            value={`${Array.isArray(footer.column3Links) ? footer.column3Links.length : 0} enlaces`}
          />

          <PanelCard
            title="Vista rápida"
            subtitle="Resumen visual del footer actual"
          >
            <div
              className="rounded-3xl overflow-hidden border border-neutral-200"
              style={{ background: footer.bgColor || "rgb(255,207,223)" }}
            >
              <div
                className="p-4"
                style={{
                  minHeight: `${Math.max(220, Math.round(footerHeightPx * 0.6))}px`,
                }}
              >
                <div className="flex justify-center mb-4">
                  <div
                    className="rounded-xl bg-white/40 flex items-center justify-center overflow-hidden"
                    style={{
                      width: `${Math.max(70, Math.round(logoSizePx * 0.7))}px`,
                      height: `${Math.max(50, Math.round(logoSizePx * 0.5))}px`,
                    }}
                  >
                    {footer.logoUrl ? (
                      <img
                        src={footer.logoUrl}
                        alt="Logo footer"
                        className="max-h-full max-w-full object-contain"
                      />
                    ) : (
                      <span className="text-[10px] text-neutral-600">Logo</span>
                    )}
                  </div>
                </div>

                <div
                  className="text-xs font-semibold mb-3 line-clamp-3"
                  style={{ color: footer.headingColor || "#ffffff" }}
                >
                  {footer.subscribeText || "Texto de suscripción"}
                </div>

                <div className="flex items-center justify-center mb-3">
                  <div
                    className="flex items-center"
                    style={{ gap: `${Math.max(2, Math.round(socialIconGapPx * 0.5))}px` }}
                  >
                    <div className="h-3 w-3 rounded-full bg-white/80" />
                    <div className="h-3 w-3 rounded-full bg-white/80" />
                    <div className="h-3 w-3 rounded-full bg-white/80" />
                    <div className="h-3 w-3 rounded-full bg-white/80" />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 text-[10px]">
                  <div>
                    <div
                      className="font-semibold mb-1"
                      style={{ color: footer.headingColor || "#ffffff" }}
                    >
                      {footer.column1Title || "Columna 1"}
                    </div>
                  </div>
                  <div>
                    <div
                      className="font-semibold mb-1"
                      style={{ color: footer.headingColor || "#ffffff" }}
                    >
                      {footer.column2Title || "Columna 2"}
                    </div>
                  </div>
                  <div>
                    <div
                      className="font-semibold mb-1"
                      style={{ color: footer.headingColor || "#ffffff" }}
                    >
                      {footer.column3Title || "Columna 3"}
                    </div>
                  </div>
                </div>
              </div>

              <div
                className="px-4 py-3 text-[10px] text-center"
                style={{
                  background: footer.bottomBarBg || "#FCDCE1",
                  color: footer.bottomBarTextColor || "#D4AF37",
                }}
              >
                {footer.copyright || "Texto inferior"}
              </div>
            </div>
          </PanelCard>
        </div>

        <div className="space-y-6">
          {activeTab === "general" ? (
            <>
              <PanelCard
                title="Colores principales"
                subtitle="Controla fondo, textos, botón y barra inferior."
              >
                <div className="grid sm:grid-cols-2 gap-4">
                  <label className="block min-w-0">
                    <span className="block text-sm mb-1">Fondo principal</span>
                    <ColorInput
                      value={footer.bgColor || ""}
                      onChange={(e) => setFooterPath("bgColor", e.target.value)}
                    />
                  </label>

                  <label className="block min-w-0">
                    <span className="block text-sm mb-1">Texto general</span>
                    <ColorInput
                      value={footer.textColor || ""}
                      onChange={(e) => setFooterPath("textColor", e.target.value)}
                    />
                  </label>

                  <label className="block min-w-0">
                    <span className="block text-sm mb-1">Títulos</span>
                    <ColorInput
                      value={footer.headingColor || ""}
                      onChange={(e) => setFooterPath("headingColor", e.target.value)}
                    />
                  </label>

                  <label className="block min-w-0">
                    <span className="block text-sm mb-1">Botón</span>
                    <ColorInput
                      value={footer.buttonColor || ""}
                      onChange={(e) => setFooterPath("buttonColor", e.target.value)}
                    />
                  </label>

                  <label className="block min-w-0">
                    <span className="block text-sm mb-1">Texto botón</span>
                    <ColorInput
                      value={footer.buttonTextColor || ""}
                      onChange={(e) => setFooterPath("buttonTextColor", e.target.value)}
                    />
                  </label>

                  <label className="block min-w-0">
                    <span className="block text-sm mb-1">Barra inferior</span>
                    <ColorInput
                      value={footer.bottomBarBg || ""}
                      onChange={(e) => setFooterPath("bottomBarBg", e.target.value)}
                    />
                  </label>

                  <label className="block min-w-0 sm:col-span-2">
                    <span className="block text-sm mb-1">Texto barra inferior</span>
                    <ColorInput
                      value={footer.bottomBarTextColor || ""}
                      onChange={(e) => setFooterPath("bottomBarTextColor", e.target.value)}
                    />
                  </label>
                </div>
              </PanelCard>

              <PanelCard
                title="Dimensiones del footer"
                subtitle="Controla la altura general del footer."
              >
                <div className="grid lg:grid-cols-2 gap-4">
                  <RangeInput
                    label="Alto del footer"
                    value={footerHeightPx}
                    min={260}
                    max={900}
                    onChange={(e) =>
                      setFooterPath(
                        "footerHeightPx",
                        clampNumber(e.target.value, 260, 900, footerHeightPx)
                      )
                    }
                  />

                  <NumberInput
                    label="Alto del footer (número)"
                    value={footerHeightPx}
                    min={260}
                    max={900}
                    onChange={(e) =>
                      setFooterPath(
                        "footerHeightPx",
                        clampNumber(e.target.value, 260, 900, footerHeightPx)
                      )
                    }
                  />
                </div>
              </PanelCard>

              <PanelCard
                title="Suscripción"
                subtitle="Controla el mensaje principal, input y botón."
              >
                <div className="space-y-4">
                  <TextArea
                    label="Texto de suscripción"
                    rows={4}
                    value={footer.subscribeText || ""}
                    onChange={(e) => setFooterPath("subscribeText", e.target.value)}
                    placeholder="Suscríbete y sé la primera en recibir ofertas..."
                  />

                  <Input
                    label="Placeholder input"
                    value={footer.inputPlaceholder || ""}
                    onChange={(e) => setFooterPath("inputPlaceholder", e.target.value)}
                    placeholder="Ingresa aquí tu e-mail"
                  />

                  <Input
                    label="Texto del botón"
                    value={footer.buttonText || ""}
                    onChange={(e) => setFooterPath("buttonText", e.target.value)}
                    placeholder="Suscríbete ➔"
                  />

                  <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
                    <RangeInput
                      label="Ancho del botón"
                      value={subscribeButtonWidthPx}
                      min={90}
                      max={320}
                      onChange={(e) =>
                        setFooterPath(
                          "subscribeButtonWidthPx",
                          clampNumber(e.target.value, 90, 320, subscribeButtonWidthPx)
                        )
                      }
                    />

                    <RangeInput
                      label="Alto del botón"
                      value={subscribeButtonHeightPx}
                      min={32}
                      max={80}
                      onChange={(e) =>
                        setFooterPath(
                          "subscribeButtonHeightPx",
                          clampNumber(e.target.value, 32, 80, subscribeButtonHeightPx)
                        )
                      }
                    />

                    <RangeInput
                      label="Texto del botón"
                      value={subscribeButtonFontSizePx}
                      min={10}
                      max={28}
                      onChange={(e) =>
                        setFooterPath(
                          "subscribeButtonFontSizePx",
                          clampNumber(e.target.value, 10, 28, subscribeButtonFontSizePx)
                        )
                      }
                    />
                  </div>
                </div>
              </PanelCard>
            </>
          ) : null}

          {activeTab === "marca" ? (
            <>
              <PanelCard
                title="Logo del footer"
                subtitle="Puedes pegar una URL o subir la imagen desde el equipo del usuario."
              >
                <div className="space-y-4">
                  <UploadField
                    label="Logo principal"
                    value={footer.logoUrl || ""}
                    onChange={(value) => setFooterPath("logoUrl", value)}
                    onUpload={(file) => uploadImageToFooter("logoUrl", file)}
                    uploading={!!uploading}
                    previewAlt="Logo del footer"
                    buttonText="Subir logo"
                  />

                  <div className="grid lg:grid-cols-2 gap-4">
                    <RangeInput
                      label="Tamaño del logo"
                      value={logoSizePx}
                      min={60}
                      max={260}
                      onChange={(e) =>
                        setFooterPath(
                          "logoSizePx",
                          clampNumber(e.target.value, 60, 260, logoSizePx)
                        )
                      }
                    />

                    <NumberInput
                      label="Tamaño del logo (número)"
                      value={logoSizePx}
                      min={60}
                      max={260}
                      onChange={(e) =>
                        setFooterPath(
                          "logoSizePx",
                          clampNumber(e.target.value, 60, 260, logoSizePx)
                        )
                      }
                    />
                  </div>
                </div>
              </PanelCard>

              <PanelCard
                title="Redes sociales"
                subtitle="Cada red puede tener link e imagen personalizada."
              >
                <div className="space-y-4">
                  <div className="grid lg:grid-cols-2 gap-4">
                    <RangeInput
                      label="Tamaño de íconos de redes"
                      value={socialIconSizePx}
                      min={24}
                      max={90}
                      onChange={(e) =>
                        setFooterPath(
                          "socialIconSizePx",
                          clampNumber(e.target.value, 24, 90, socialIconSizePx)
                        )
                      }
                    />

                    <NumberInput
                      label="Tamaño íconos (número)"
                      value={socialIconSizePx}
                      min={24}
                      max={90}
                      onChange={(e) =>
                        setFooterPath(
                          "socialIconSizePx",
                          clampNumber(e.target.value, 24, 90, socialIconSizePx)
                        )
                      }
                    />
                  </div>

                  <div className="grid lg:grid-cols-2 gap-4">
                    <RangeInput
                      label="Separación entre íconos"
                      value={socialIconGapPx}
                      min={0}
                      max={40}
                      onChange={(e) =>
                        setFooterPath(
                          "socialIconGapPx",
                          clampNumber(e.target.value, 0, 40, socialIconGapPx)
                        )
                      }
                    />

                    <NumberInput
                      label="Separación íconos (número)"
                      value={socialIconGapPx}
                      min={0}
                      max={40}
                      onChange={(e) =>
                        setFooterPath(
                          "socialIconGapPx",
                          clampNumber(e.target.value, 0, 40, socialIconGapPx)
                        )
                      }
                    />
                  </div>

                  <div className="grid xl:grid-cols-2 gap-4">
                    <div className="space-y-4 rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                      <div className="font-medium text-neutral-800">Facebook</div>
                      <Input
                        label="Link Facebook"
                        value={footer.facebook || ""}
                        onChange={(e) => setFooterPath("facebook", e.target.value)}
                        placeholder="https://facebook.com/..."
                      />
                      <UploadField
                        label="Ícono Facebook"
                        value={footer.facebookIcon || ""}
                        onChange={(value) => setFooterPath("facebookIcon", value)}
                        onUpload={(file) => uploadImageToFooter("facebookIcon", file)}
                        uploading={!!uploading}
                        previewAlt="Icono Facebook"
                        buttonText="Subir ícono"
                        previewSizeClass="h-20"
                        compact
                      />
                    </div>

                    <div className="space-y-4 rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                      <div className="font-medium text-neutral-800">Instagram</div>
                      <Input
                        label="Link Instagram"
                        value={footer.instagram || ""}
                        onChange={(e) => setFooterPath("instagram", e.target.value)}
                        placeholder="https://instagram.com/..."
                      />
                      <UploadField
                        label="Ícono Instagram"
                        value={footer.instagramIcon || ""}
                        onChange={(value) => setFooterPath("instagramIcon", value)}
                        onUpload={(file) => uploadImageToFooter("instagramIcon", file)}
                        uploading={!!uploading}
                        previewAlt="Icono Instagram"
                        buttonText="Subir ícono"
                        previewSizeClass="h-20"
                        compact
                      />
                    </div>

                    <div className="space-y-4 rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                      <div className="font-medium text-neutral-800">TikTok</div>
                      <Input
                        label="Link TikTok"
                        value={footer.tiktok || ""}
                        onChange={(e) => setFooterPath("tiktok", e.target.value)}
                        placeholder="https://tiktok.com/@..."
                      />
                      <UploadField
                        label="Ícono TikTok"
                        value={footer.tiktokIcon || ""}
                        onChange={(value) => setFooterPath("tiktokIcon", value)}
                        onUpload={(file) => uploadImageToFooter("tiktokIcon", file)}
                        uploading={!!uploading}
                        previewAlt="Icono TikTok"
                        buttonText="Subir ícono"
                        previewSizeClass="h-20"
                        compact
                      />
                    </div>

                    <div className="space-y-4 rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                      <div className="font-medium text-neutral-800">WhatsApp</div>
                      <Input
                        label="Link WhatsApp"
                        value={footer.whatsapp || ""}
                        onChange={(e) => setFooterPath("whatsapp", e.target.value)}
                        placeholder="https://wa.me/..."
                      />
                      <UploadField
                        label="Ícono WhatsApp"
                        value={footer.whatsappIcon || ""}
                        onChange={(value) => setFooterPath("whatsappIcon", value)}
                        onUpload={(file) => uploadImageToFooter("whatsappIcon", file)}
                        uploading={!!uploading}
                        previewAlt="Icono WhatsApp"
                        buttonText="Subir ícono"
                        previewSizeClass="h-20"
                        compact
                      />
                    </div>
                  </div>
                </div>
              </PanelCard>
            </>
          ) : null}

          {activeTab === "columnas" ? (
            <div className="grid xl:grid-cols-2 2xl:grid-cols-3 gap-6 min-w-0">
              <PanelCard
                title="Columna 1"
                subtitle="Título y enlaces del primer bloque."
              >
                <div className="space-y-4">
                  <Input
                    label="Título columna 1"
                    value={footer.column1Title || ""}
                    onChange={(e) => setFooterPath("column1Title", e.target.value)}
                    placeholder="Rosa Boutique"
                  />
                  <FooterLinkEditor
                    title="Enlaces columna 1"
                    links={footer.column1Links || []}
                    onChange={(value) => setFooterPath("column1Links", value)}
                  />
                </div>
              </PanelCard>

              <PanelCard
                title="Columna 2"
                subtitle="Título y enlaces del segundo bloque."
              >
                <div className="space-y-4">
                  <Input
                    label="Título columna 2"
                    value={footer.column2Title || ""}
                    onChange={(e) => setFooterPath("column2Title", e.target.value)}
                    placeholder="Compra con nosotros"
                  />
                  <FooterLinkEditor
                    title="Enlaces columna 2"
                    links={footer.column2Links || []}
                    onChange={(value) => setFooterPath("column2Links", value)}
                  />
                </div>
              </PanelCard>

              <PanelCard
                title="Columna 3"
                subtitle="Título y enlaces del tercer bloque."
              >
                <div className="space-y-4">
                  <Input
                    label="Título columna 3"
                    value={footer.column3Title || ""}
                    onChange={(e) => setFooterPath("column3Title", e.target.value)}
                    placeholder="Otros"
                  />
                  <FooterLinkEditor
                    title="Enlaces columna 3"
                    links={footer.column3Links || []}
                    onChange={(value) => setFooterPath("column3Links", value)}
                  />
                </div>
              </PanelCard>
            </div>
          ) : null}

          {activeTab === "legal" ? (
            <PanelCard
              title="Barra inferior"
              subtitle="Texto legal o copyright del footer."
            >
              <TextArea
                label="Texto inferior"
                rows={3}
                value={footer.copyright || ""}
                onChange={(e) => setFooterPath("copyright", e.target.value)}
                placeholder="© Rosa Boutique 2025. Todos los derechos reservados..."
              />
            </PanelCard>
          ) : null}
        </div>
      </div>
    </div>
  );
}