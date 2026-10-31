import { useState } from "react";
import { Input, Select, Toggle } from "./ProductDetailEditorFields";
import EditorSection from "./EditorSection";
import AdminImageUploadField from "../../media/AdminImageUploadField";
import { TERMS_TOPICS } from "../../../components/consumer/termsPageConfig";

export default function TermsAppearanceControls({
  form,
  onChange,
  topic,
  saving,
  onUploadingChange,
}) {
  const c = form.informationPageConfig.termsPage;
  const [selected, setSelected] = useState("terminos");
  const patch = (key, value) =>
    onChange((page) => ({
      ...page,
      informationPageConfig: {
        ...page.informationPageConfig,
        termsPage: { ...page.informationPageConfig.termsPage, [key]: value },
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
  if (topic === "terms-index")
    return (
      <>
        {section(
          "Índice de lectura",
          <>
            {field("indexTitle", "Título del índice")}
            <Select
              label="Tema del índice"
              value={selected}
              onChange={(event) => setSelected(event.target.value)}
            >
              {Object.entries(TERMS_TOPICS).map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </Select>
            <Input
              label="Nombre del tema en el índice"
              value={c.topics[selected].label}
              onChange={(event) =>
                patch("topics", {
                  ...c.topics,
                  [selected]: {
                    ...c.topics[selected],
                    label: event.target.value,
                  },
                })
              }
            />
            {field("firstEyebrow", "Antetítulo del primer tema")}
          </>,
          "Edita un tema a la vez. Los apartados conservan su conexión con las condiciones vigentes y no se ocultan al cambiar su nombre en el índice.",
        )}
        {section(
          "Descarga del documento",
          <>
            {field("downloadText", "Texto del botón de descarga")}
            {field("downloadHint", "Ayuda bajo la descarga")}
          </>,
          "La descarga incluye todos los apartados, la identidad del vendedor y la referencia exacta, aunque estén cerrados en pantalla. No modifica la constancia histórica de los pedidos.",
        )}
      </>
    );
  if (topic === "terms-support")
    return (
      <>
        {section(
          "Ayuda al comprador",
          <>
            {field("showHelp", "Mostrar ayuda junto al índice", "toggle")}
            {field("helpTitle", "Título de ayuda")}
            {field("helpText", "Texto del enlace de ayuda")}
            {field("helpHref", "Destino del enlace de ayuda")}
          </>,
        )}
        {section(
          "Identidad y mensajes",
          <>
            {field("sellerText", "Texto de consultar datos del vendedor")}
            {field("sellerTitle", "Título de identidad del vendedor")}
            {field("contactText", "Texto de los canales de contacto")}
            {field("loadingText", "Mensaje al cargar condiciones")}
            {field("retryText", "Texto de reintentar carga")}
          </>,
          "Los datos se administran en Tienda y Facturación; las entregas en Envíos y los cambios comerciales en Órdenes. La política de datos conserva su fuente en Tienda. Aquí se configura su presentación, sin duplicar formularios empresariales.",
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
              label="Ilustración de condiciones de compra"
              value={c.heroArtwork}
              disabled={saving}
              onChange={(value) => patch("heroArtwork", value)}
              onBusyChange={(busy) => onUploadingChange("terms-artwork", busy)}
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
        "El documento de cristal es decorativo. Puedes reemplazarlo cargando una imagen desde tu equipo mediante Cloudinary.",
      )}
      {section(
        "Lectura y comportamiento",
        <>
          {field(
            "stickyIndex",
            "Mantener el índice visible al desplazarse",
            "toggle",
          )}
          {field(
            "stickyOffsetPx",
            "Espacio superior del índice fijo (px)",
            "number",
            { min: 0, max: 240 },
          )}
          {field("editorialHeading", "Usar tipografía editorial", "toggle")}
          {field("motion", "Animar controles", "toggle")}
          {field("showSections", "Mostrar secciones adicionales", "toggle")}
          {field("showFooterAction", "Mostrar botón de regreso", "toggle")}
        </>,
        "En móvil el índice se coloca antes del documento. Si no cabe completo en la altura disponible, se desplaza con la página sin crear otra barra. Ancho, tipografía, colores, fondo y cristal están en sus temas de diseño.",
      )}
    </>
  );
}
