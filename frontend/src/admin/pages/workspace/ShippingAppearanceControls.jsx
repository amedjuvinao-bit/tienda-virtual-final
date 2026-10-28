import { useState } from "react";
import { Input, Select, Textarea, Toggle } from "./ProductDetailEditorFields";
import AdminImageUploadField from "../../media/AdminImageUploadField";
import EditorSection from "./EditorSection";
import { SHIPPING_ICONS } from "../../../components/shipping/shippingPageConfig";
const iconNames = {
  cart: "Carrito",
  package: "Paquete",
  truck: "Entrega",
  home: "Destino",
  pin: "Ubicación",
  clock: "Tiempo",
  check: "Confirmación",
};
export default function ShippingAppearanceControls({
  form,
  onChange,
  topic,
  saving,
  onUploadingChange,
}) {
  const s = form.informationPageConfig.shipping;
  const [selected, setSelected] = useState(s.steps[0]?.id || "");
  const step = s.steps.find((item) => item.id === selected) || s.steps[0];
  const patch = (key, value) =>
    onChange((page) => ({
      ...page,
      informationPageConfig: {
        ...page.informationPageConfig,
        shipping: { ...page.informationPageConfig.shipping, [key]: value },
      },
    }));
  const patchStep = (key, value) =>
    patch(
      "steps",
      s.steps.map((item) =>
        item.id === step.id ? { ...item, [key]: value } : item,
      ),
    );
  const field = (key, label, type = "text", limits = {}) =>
    type === "toggle" ? (
      <Toggle
        key={key}
        label={label}
        checked={s[key]}
        onChange={(value) => patch(key, value)}
      />
    ) : type === "textarea" ? (
      <div className="sm:col-span-2" key={key}>
        <Textarea
          label={label}
          aria-label={label}
          rows={3}
          value={s[key]}
          onChange={(event) => patch(key, event.target.value)}
        />
      </div>
    ) : (
      <Input
        key={key}
        label={label}
        type={type}
        {...limits}
        value={s[key]}
        onChange={(event) =>
          patch(
            key,
            type === "number" && event.target.value !== ""
              ? Number(event.target.value)
              : event.target.value,
          )
        }
      />
    );
  const section = (title, children, text) => (
    <EditorSection key={title} title={title} text={text}>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </EditorSection>
  );
  if (topic === "shipping-journey")
    return (
      <>
        <p className="text-sm text-gray-600">
          Edita un paso a la vez. Este recorrido describe el proceso de entrega.
        </p>
        <nav
          className="flex flex-wrap gap-2"
          aria-label="Pasos del proceso de entrega"
        >
          {s.steps.map((item, index) => (
            <button
              type="button"
              key={item.id}
              aria-pressed={item.id === step?.id}
              className="rounded-xl border px-3 py-2 text-sm"
              onClick={() => setSelected(item.id)}
            >
              {index + 1}. {item.title || "Paso sin título"}
            </button>
          ))}
        </nav>
        {step &&
          section(
            "Paso seleccionado",
            <>
              <Input
                label="Título del paso"
                value={step.title}
                onChange={(event) => patchStep("title", event.target.value)}
              />
              <Select
                label="Icono del paso"
                value={step.icon}
                onChange={(event) => patchStep("icon", event.target.value)}
              >
                {SHIPPING_ICONS.map((icon) => (
                  <option key={icon} value={icon}>
                    {iconNames[icon]}
                  </option>
                ))}
              </Select>
              <div className="sm:col-span-2">
                <Textarea
                  label="Descripción del paso"
                  aria-label="Descripción del paso"
                  rows={3}
                  value={step.body}
                  onChange={(event) => patchStep("body", event.target.value)}
                />
              </div>
              {field("showJourney", "Mostrar proceso de entrega", "toggle")}
              {field("journeyLabel", "Nombre accesible del proceso")}
              <Toggle
                label="Mostrar este paso"
                checked={step.enabled}
                onChange={(value) => patchStep("enabled", value)}
              />
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={s.steps.indexOf(step) === 0}
                  onClick={() => {
                    const next = [...s.steps],
                      i = next.indexOf(step);
                    [next[i - 1], next[i]] = [next[i], next[i - 1]];
                    patch("steps", next);
                  }}
                >
                  Subir paso
                </button>
                <button
                  type="button"
                  disabled={s.steps.indexOf(step) === s.steps.length - 1}
                  onClick={() => {
                    const next = [...s.steps],
                      i = next.indexOf(step);
                    [next[i + 1], next[i]] = [next[i], next[i + 1]];
                    patch("steps", next);
                  }}
                >
                  Bajar paso
                </button>
                <button
                  type="button"
                  onClick={() =>
                    patch(
                      "steps",
                      s.steps.filter((item) => item.id !== step.id),
                    )
                  }
                >
                  Eliminar paso
                </button>
              </div>
            </>,
          )}
        <button
          type="button"
          disabled={s.steps.length >= 6}
          className="rounded-xl border px-4 py-2 text-sm"
          onClick={() => {
            const id = crypto.randomUUID();
            patch("steps", [
              ...s.steps,
              { id, title: "", body: "", icon: "package", enabled: false },
            ]);
            setSelected(id);
          }}
        >
          Añadir paso
        </button>
      </>
    );
  if (topic === "shipping-details")
    return (
      <>
        {section(
          "Costo y plazo",
          <>
            {field("showDetails", "Mostrar bloque de costo y plazo", "toggle")}
            {field("detailsTitle", "Título del bloque de entrega")}
            {field("costTitle", "Etiqueta del costo")}
            {field("costText", "Explicación del costo", "textarea")}
            {field("deliveryTitle", "Etiqueta del plazo")}
            {field("deliveryText", "Explicación del plazo", "textarea")}
            {field("pickupTitle", "Etiqueta de recogida")}
          </>,
          "El checkout informa el costo final. Los plazos y la recogida se administran en Configuración → Envíos y se conservan en las condiciones completas. La recogida aparece cuando está habilitada y tiene instrucciones.",
        )}
        {section(
          "Cobertura",
          <>
            {field("showCoverage", "Mostrar bloque de cobertura", "toggle")}
            {field("coverageTitle", "Título de cobertura")}
            {field("coverageText", "Explicación de la cobertura", "textarea")}
          </>,
          "Describe dónde consultar la disponibilidad. Los países y destinos reales siguen siendo los configurados en Envíos.",
        )}
      </>
    );
  if (topic === "shipping-support")
    return (
      <>
        {section(
          "Atención al cliente",
          <>
            {field("showSupport", "Mostrar franja de ayuda", "toggle")}
            {field("supportTitle", "Título de ayuda")}
            {field("supportText", "Descripción de ayuda", "textarea")}
            {field("contactText", "Texto del botón de contacto")}
            {field("contactHref", "Destino del botón de contacto")}
            {field("claimsText", "Texto del botón de reclamos")}
            {field("claimsHref", "Destino del botón de reclamos")}
          </>,
          "Los destinos predeterminados abren Contacto y PQR. Los enlaces de la vista previa no realizan operaciones.",
        )}
        {section(
          "Consulta de condiciones",
          <>
            {field("conditionsText", "Texto de consultar condiciones")}
            {field("downloadText", "Texto de descargar información")}
            {field("loadingText", "Mensaje durante la carga")}
            {field("retryText", "Texto de reintentar")}
          </>,
          "Las condiciones completas y la identidad se obtienen de la configuración vigente y permanecen accesibles desde la página.",
        )}
      </>
    );
  return (
    <>
      {section(
        "Ilustración de cabecera",
        <>
          {field("showArtwork", "Mostrar ilustración", "toggle")}
          <div className="sm:col-span-2">
            <AdminImageUploadField
              label="Ilustración de la entrega"
              value={s.heroArtwork}
              disabled={saving}
              onChange={(value) => patch("heroArtwork", value)}
              onBusyChange={(busy) =>
                onUploadingChange("shipping-artwork", busy)
              }
            />
          </div>
          {field(
            "heroArtworkAlt",
            "Descripción de la ilustración (vacío si es decorativa)",
          )}
          {field(
            "heroArtworkWidthPx",
            "Ancho de la ilustración (px)",
            "number",
            { min: 120, max: 460 },
          )}
          {field("heroMinHeightPx", "Alto mínimo de cabecera (px)", "number", {
            min: 140,
            max: 420,
          })}
        </>,
        "La ilustración de cristal es decorativa. Puedes sustituirla cargando una imagen desde tu equipo; se utiliza la carga existente a Cloudinary.",
      )}
      {section(
        "Composición y movimiento",
        <>
          {field("iconSizePx", "Tamaño de iconos del proceso (px)", "number", {
            min: 38,
            max: 100,
          })}
          {field("editorialHeading", "Usar tipografía editorial", "toggle")}
          {field("motion", "Animar los controles", "toggle")}
          {field("showSections", "Mostrar secciones adicionales", "toggle")}
          {field("showFooterAction", "Mostrar botón de regreso", "toggle")}
        </>,
        "Fondo, colores, vidrio y medidas generales se agrupan en los demás temas de Diseño. Se respeta la preferencia de movimiento reducido del dispositivo.",
      )}
      {section(
        "Ilustración de cobertura",
        <>
          {field(
            "showCoverageArtwork",
            "Mostrar ilustración de cobertura",
            "toggle",
          )}
          <div className="sm:col-span-2">
            <AdminImageUploadField
              label="Ilustración de cobertura"
              value={s.coverageArtwork}
              disabled={saving}
              onChange={(value) => patch("coverageArtwork", value)}
              onBusyChange={(busy) =>
                onUploadingChange("shipping-coverage-artwork", busy)
              }
            />
          </div>
        </>,
        "El marcador es decorativo; no representa una dirección ni un mapa real.",
      )}
    </>
  );
}
