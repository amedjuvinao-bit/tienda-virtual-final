import { useState } from "react";
import { Input, Select, Textarea, Toggle } from "./ProductDetailEditorFields";
import AdminImageUploadField from "../../media/AdminImageUploadField";
import EditorSection from "./EditorSection";
import { CLAIMS_FIELDS } from "../../../components/consumer/claimsPageConfig";
export default function ClaimsAppearanceControls({
  form,
  onChange,
  topic,
  saving,
  onUploadingChange,
}) {
  const c = form.informationPageConfig.claimsPage;
  const [selected, setSelected] = useState("name");
  const [selectedStep, setSelectedStep] = useState(0);
  const patch = (key, value) =>
    onChange((page) => ({
      ...page,
      informationPageConfig: {
        ...page.informationPageConfig,
        claimsPage: { ...page.informationPageConfig.claimsPage, [key]: value },
      },
    }));
  const field = (key, label, type = "text", limits = {}) =>
    type === "toggle" ? (
      <Toggle
        key={key}
        label={label}
        checked={c[key]}
        onChange={(value) => patch(key, value)}
      />
    ) : type === "textarea" ? (
      <div key={key} className="sm:col-span-2">
        <Textarea
          label={label}
          aria-label={label}
          rows={3}
          value={c[key]}
          onChange={(event) => patch(key, event.target.value)}
        />
      </div>
    ) : (
      <Input
        key={key}
        label={label}
        type={type}
        {...limits}
        value={c[key]}
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
  if (topic === "claims-fields")
    return (
      <>
        {section(
          "Campo seleccionado",
          <>
            <Select
              label="Campo del formulario"
              value={selected}
              onChange={(event) => setSelected(event.target.value)}
            >
              {Object.entries(CLAIMS_FIELDS).map(([key, value]) => (
                <option key={key} value={key}>
                  {value.label}
                </option>
              ))}
            </Select>
            <Input
              label="Etiqueta del campo"
              value={c.fields[selected].label}
              onChange={(event) =>
                patch("fields", {
                  ...c.fields,
                  [selected]: {
                    ...c.fields[selected],
                    label: event.target.value,
                  },
                })
              }
            />
            {selected !== "type" && (
              <Input
                label="Ayuda dentro del campo"
                value={c.fields[selected].placeholder}
                onChange={(event) =>
                  patch("fields", {
                    ...c.fields,
                    [selected]: {
                      ...c.fields[selected],
                      placeholder: event.target.value,
                    },
                  })
                }
              />
            )}
          </>,
          "Selecciona un solo campo para editar su etiqueta y ayuda. Los requisitos, límites y tipos de solicitud conservan sus reglas. La autorización de datos sigue siendo expresa y no está preseleccionada.",
        )}
        {section(
          "Datos opcionales",
          <>
            {field("optionalText", "Título de datos opcionales")}
            {field("submitHint", "Explicación al enviar", "textarea")}
          </>,
          "El correo de recuperación y la preferencia de devolución se conservan dentro del desplegable. No se eliminan datos ni se cambia su tratamiento.",
        )}
      </>
    );
  if (topic === "claims-actions")
    return (
      <>
        {section(
          "Nueva solicitud",
          <>
            {field("createTabText", "Texto de la pestaña nueva solicitud")}
            {field("createTitle", "Título del formulario de solicitud")}
            {field("createHint", "Introducción de nueva solicitud", "textarea")}
            {field("submitText", "Texto del botón de radicar")}
            {field("submittingText", "Mensaje mientras se radica")}
            {field("retrySubmissionText", "Texto de reintentar radicación")}
          </>,
        )}
        {section(
          "Consulta de solicitudes",
          <>
            {field("trackTabText", "Texto de la pestaña de consulta")}
            {field("trackTitle", "Título de consulta")}
            {field("trackHint", "Instrucciones de consulta", "textarea")}
            {field("trackSubmitText", "Texto del botón de consultar")}
            {field("trackPendingText", "Mensaje mientras se consulta")}
          </>,
          "El seguimiento exige radicado y clave privada. La consulta no muestra listados públicos.",
        )}
        {section(
          "Recuperación de acceso",
          <>
            {field("recoverTabText", "Texto de la pestaña de recuperación")}
            {field("recoverTitle", "Título de recuperación")}
            {field("recoverySendText", "Texto de enviar código")}
            {field("recoveryConfirmText", "Texto de verificar código")}
            {field("recoveryPendingText", "Mensaje mientras se recupera")}
            {field("recoveryAgainText", "Texto de solicitar otro código")}
          </>,
          "Se conservan el correo registrado, código de verificación, caducidad y rotación de la clave. La asistencia sin correo se realiza por Contacto.",
        )}
        {section(
          "Información del vendedor",
          <>
            {field("sellerText", "Texto de consultar datos del vendedor")}
            {field("downloadText", "Texto de descargar información")}
            {field("loadingText", "Mensaje al cargar información")}
            {field("retryText", "Texto de reintentar carga")}
          </>,
          "La identidad, la política de datos, su descarga y el enlace a la SIC permanecen disponibles. Los datos empresariales se administran en sus módulos existentes.",
        )}
      </>
    );
  if (topic === "claims-guide")
    return (
      <>
        {section(
          "Guía de atención",
          <>
            {field("showGuide", "Mostrar guía lateral", "toggle")}
            {field("guideTitle", "Título de la guía")}
            {field("showSteps", "Mostrar pasos de atención", "toggle")}
            {c.steps.length > 0 && (
              <>
                <Select
                  label="Paso de la guía"
                  value={Math.min(selectedStep, c.steps.length - 1)}
                  onChange={(event) =>
                    setSelectedStep(Number(event.target.value))
                  }
                >
                  {c.steps.map((step, index) => (
                    <option key={index} value={index}>
                      {index + 1}. {step.title || "Paso sin título"}
                    </option>
                  ))}
                </Select>
                <Input
                  label="Título del paso"
                  value={
                    c.steps[Math.min(selectedStep, c.steps.length - 1)].title
                  }
                  onChange={(event) =>
                    patch(
                      "steps",
                      c.steps.map((step, index) =>
                        index === Math.min(selectedStep, c.steps.length - 1)
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
                    value={
                      c.steps[Math.min(selectedStep, c.steps.length - 1)].body
                    }
                    onChange={(event) =>
                      patch(
                        "steps",
                        c.steps.map((step, index) =>
                          index === Math.min(selectedStep, c.steps.length - 1)
                            ? { ...step, body: event.target.value }
                            : step,
                        ),
                      )
                    }
                  />
                </div>
              </>
            )}
            {field("guideText", "Recordatorio de seguimiento", "textarea")}
          </>,
          "La guía explica el proceso existente. Evita prometer reembolsos, aprobaciones o respuestas automáticas.",
        )}
        {section(
          "Seguridad y contacto",
          <>
            {field("securityTitle", "Título de protección de información")}
            {field("securityText", "Consejo de seguridad", "textarea")}
            {field("contactText", "Texto del botón de contacto")}
            {field("contactHref", "Destino del botón de contacto")}
          </>,
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
              label="Ilustración de peticiones y reclamos"
              value={c.heroArtwork}
              disabled={saving}
              onChange={(value) => patch("heroArtwork", value)}
              onBusyChange={(busy) => onUploadingChange("claims-artwork", busy)}
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
            max: 380,
          })}
        </>,
        "El sobre es decorativo. Puedes reemplazarlo cargando una imagen desde tu equipo mediante la integración existente con Cloudinary.",
      )}
      {section(
        "Campos de vidrio y distribución",
        <>
          {field(
            "sidebarWidthPx",
            "Ancho de la guía en escritorio (px)",
            "number",
            { min: 260, max: 440 },
          )}
          {field(
            "textareaHeightPx",
            "Alto inicial del mensaje (px)",
            "number",
            { min: 80, max: 260 },
          )}
          {field("fieldRadiusPx", "Radio de los campos (px)", "number", {
            min: 0,
            max: 40,
          })}
          {field("fieldBorderWidth", "Grosor del borde de campos", "number", {
            min: 0,
            max: 3,
            step: 0.1,
          })}
          {field("fieldOpacity", "Intensidad del tinte de campos", "number", {
            min: 0,
            max: 0.5,
            step: 0.01,
          })}
          {field("fieldBlur", "Difuminado de campos (px)", "number", {
            min: 0,
            max: 16,
          })}
          {field("editorialHeading", "Usar tipografía editorial", "toggle")}
          {field("motion", "Animar controles", "toggle")}
          {field("showSections", "Mostrar secciones adicionales", "toggle")}
          {field("showFooterAction", "Mostrar botón de regreso", "toggle")}
        </>,
        "Los colores del formulario se encuentran en Colores. Fondo, brillo y vidrio general conservan sus controles comunes. En móvil la guía se coloca después del formulario y se respeta movimiento reducido.",
      )}
    </>
  );
}
