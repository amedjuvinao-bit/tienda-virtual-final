import { useState } from "react";
import { Input, Select, Textarea, Toggle } from "./ProductDetailEditorFields";
import AdminImageUploadField from "../../media/AdminImageUploadField";
import EditorSection from "./EditorSection";
const iconNames = {
  exchange: "Cambio",
  shield: "Garantía",
  return: "Devolución",
  help: "Atención",
  document: "Documento",
};
export default function ReturnsGuideAppearanceControls({
  form,
  onChange,
  topic,
  saving,
  onUploadingChange,
}) {
  const s = form.informationPageConfig.returnsGuide;
  const [selected, setSelected] = useState("change");
  const [stepIndex, setStepIndex] = useState(0);
  const choice = s.choices.find((item) => item.id === selected) || s.choices[0];
  const patch = (key, value) =>
    onChange((page) => ({
      ...page,
      informationPageConfig: {
        ...page.informationPageConfig,
        returnsGuide: {
          ...page.informationPageConfig.returnsGuide,
          [key]: value,
        },
      },
    }));
  const patchChoice = (key, value) =>
    patch(
      "choices",
      s.choices.map((item) =>
        item.id === choice.id ? { ...item, [key]: value } : item,
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
  if (topic === "returns-choices")
    return (
      <>
        <p className="text-sm text-gray-600">
          Edita una opción a la vez. Cada tarjeta abre sus condiciones reales;
          desde allí el cliente puede iniciar una solicitud. La política
          comercial sigue administrándose en Órdenes.
        </p>
        <nav className="flex flex-wrap gap-2" aria-label="Opciones de atención">
          {s.choices.map((item) => (
            <button
              type="button"
              key={item.id}
              aria-pressed={choice?.id === item.id}
              className="rounded-xl border px-3 py-2 text-sm"
              onClick={() => setSelected(item.id)}
            >
              {item.title || "Opción sin título"}
            </button>
          ))}
        </nav>
        {choice &&
          section(
            "Opción seleccionada",
            <>
              <Input
                label="Título de la opción"
                value={choice.title}
                onChange={(event) => patchChoice("title", event.target.value)}
              />
              <Select
                label="Icono de la opción"
                value={choice.icon}
                onChange={(event) => patchChoice("icon", event.target.value)}
              >
                {Object.entries(iconNames).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </Select>
              <div className="sm:col-span-2">
                <Textarea
                  label="Descripción de la opción"
                  aria-label="Descripción de la opción"
                  rows={3}
                  value={choice.body}
                  onChange={(event) => patchChoice("body", event.target.value)}
                />
              </div>
              <Input
                label="Texto del botón de la opción"
                value={choice.actionText}
                onChange={(event) =>
                  patchChoice("actionText", event.target.value)
                }
              />
              <Input
                label="Destino para iniciar esta solicitud"
                value={choice.requestHref}
                onChange={(event) =>
                  patchChoice("requestHref", event.target.value)
                }
              />
              <Toggle
                label="Mostrar esta opción"
                checked={choice.enabled}
                onChange={(value) => patchChoice("enabled", value)}
              />
              {field("showChoices", "Mostrar opciones de atención", "toggle")}
              {field("choicesTitle", "Título del grupo de opciones")}
              {field("requestText", "Texto de iniciar solicitud")}
              {field("closeText", "Texto accesible de cerrar")}
              {field(
                "orderHelpText",
                "Orientación para cambios desde el pedido",
                "textarea",
              )}
            </>,
            "Las tres opciones corresponden a cambio comercial, garantía y retracto. Sus condiciones se leen del servidor. Los enlaces predeterminados abren PQR con el tipo apropiado, sin radicar automáticamente.",
          )}
      </>
    );
  if (topic === "returns-journey")
    return (
      <>
        <nav
          className="flex flex-wrap gap-2"
          aria-label="Pasos de la solicitud"
        >
          {s.steps.map((step, index) => (
            <button
              type="button"
              key={index}
              aria-pressed={stepIndex === index}
              className="rounded-xl border px-3 py-2 text-sm"
              onClick={() => setStepIndex(index)}
            >
              {index + 1}. {step.title || "Paso sin título"}
            </button>
          ))}
        </nav>
        {s.steps[stepIndex] &&
          section(
            "Paso seleccionado",
            <>
              <Input
                label="Título del paso"
                value={s.steps[stepIndex].title}
                onChange={(event) =>
                  patch(
                    "steps",
                    s.steps.map((step, index) =>
                      index === stepIndex
                        ? { ...step, title: event.target.value }
                        : step,
                    ),
                  )
                }
              />
              <div className="sm:col-span-2">
                <Textarea
                  label="Descripción del paso"
                  aria-label="Descripción del paso"
                  rows={3}
                  value={s.steps[stepIndex].body}
                  onChange={(event) =>
                    patch(
                      "steps",
                      s.steps.map((step, index) =>
                        index === stepIndex
                          ? { ...step, body: event.target.value }
                          : step,
                      ),
                    )
                  }
                />
              </div>
              {field("showJourney", "Mostrar pasos de atención", "toggle")}
              {field("journeyLabel", "Nombre accesible del proceso")}
            </>,
            "El recorrido explica cómo enviar y consultar una solicitud. No promete aprobación, devolución de dinero ni notificaciones automáticas.",
          )}
      </>
    );
  if (topic === "returns-support")
    return (
      <>
        {section(
          "Atención y seguimiento",
          <>
            {field("showSupport", "Mostrar franja de atención", "toggle")}
            {field("supportTitle", "Título de atención")}
            {field("supportText", "Descripción de atención", "textarea")}
            {field("claimsText", "Texto del botón de reclamos")}
            {field("claimsHref", "Destino del botón de reclamos")}
            {field("trackText", "Texto del botón de seguimiento")}
            {field("trackHref", "Destino del botón de seguimiento")}
          </>,
          "Peticiones y reclamos abre el formulario existente. Consultar solicitud abre su pestaña de consulta; el cliente debe indicar su radicado y clave. No se publican datos de pedidos.",
        )}
        {section(
          "Condiciones completas",
          <>
            {field("conditionsText", "Título de condiciones completas")}
            {field("conditionsHint", "Indicación de consultar y descargar")}
            {field("downloadText", "Texto del botón de descarga")}
            {field("loadingText", "Mensaje durante la carga")}
            {field("retryText", "Texto de reintentar")}
          </>,
          "Los derechos, la identificación del vendedor, la descarga y el enlace a la SIC permanecen accesibles. Los textos de presentación no sustituyen las condiciones oficiales del servidor.",
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
              label="Ilustración de cambios y devoluciones"
              value={s.heroArtwork}
              disabled={saving}
              onChange={(value) => patch("heroArtwork", value)}
              onBusyChange={(busy) =>
                onUploadingChange("returns-guide-artwork", busy)
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
        "El paquete es una ilustración decorativa. Puedes reemplazarlo cargando una imagen desde tu equipo a Cloudinary.",
      )}
      {section(
        "Composición y movimiento",
        <>
          {field(
            "iconSizePx",
            "Tamaño de iconos de las opciones (px)",
            "number",
            { min: 38, max: 100 },
          )}
          {field("editorialHeading", "Usar tipografía editorial", "toggle")}
          {field("motion", "Animar los controles", "toggle")}
          {field("showSections", "Mostrar secciones adicionales", "toggle")}
          {field("showFooterAction", "Mostrar botón de regreso", "toggle")}
        </>,
        "Colores, bordes, brillo, transparencia, fondo continuo y medidas generales se agrupan en los demás temas de Diseño. Se respeta la preferencia de movimiento reducido.",
      )}
    </>
  );
}
