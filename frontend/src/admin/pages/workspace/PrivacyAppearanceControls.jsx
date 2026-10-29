import { useState } from "react";
import { Input, Select, Textarea, Toggle } from "./ProductDetailEditorFields";
import EditorSection from "./EditorSection";
import AdminImageUploadField from "../../media/AdminImageUploadField";
import {
  PRIVACY_ICONS,
  PRIVACY_TOPICS,
} from "../../../components/consumer/privacyPageConfig";
export default function PrivacyAppearanceControls({
  form,
  onChange,
  topic,
  saving,
  onUploadingChange,
}) {
  const c = form.informationPageConfig.privacyPage;
  const [selected, setSelected] = useState(0),
    [selectedTopic, setSelectedTopic] = useState("datos");
  const patch = (key, value) =>
    onChange((page) => ({
      ...page,
      informationPageConfig: {
        ...page.informationPageConfig,
        privacyPage: {
          ...page.informationPageConfig.privacyPage,
          [key]: value,
        },
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
  const itemControls = (key) => {
    const list = c[key],
      index = Math.min(selected, Math.max(0, list.length - 1)),
      item = list[index];
    const update = (name, value) =>
      patch(
        key,
        list.map((entry, i) =>
          i === index ? { ...entry, [name]: value } : entry,
        ),
      );
    return (
      <>
        {item && (
          <>
            <Select
              label="Elemento seleccionado"
              value={index}
              onChange={(event) => setSelected(Number(event.target.value))}
            >
              {list.map((entry, i) => (
                <option key={entry.id} value={i}>
                  {i + 1}. {entry.title || "Elemento sin título"}
                </option>
              ))}
            </Select>
            <Toggle
              label="Mostrar elemento"
              checked={item.enabled}
              onChange={(value) => update("enabled", value)}
            />
            <Input
              label="Título del elemento"
              value={item.title}
              onChange={(event) => update("title", event.target.value)}
            />
            <Select
              label="Icono del elemento"
              value={item.icon}
              onChange={(event) => update("icon", event.target.value)}
            >
              {Object.entries(PRIVACY_ICONS).map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </Select>
            <div className="sm:col-span-2">
              <Textarea
                label="Descripción del elemento"
                aria-label="Descripción del elemento"
                rows={3}
                value={item.body}
                onChange={(event) => update("body", event.target.value)}
              />
            </div>
          </>
        )}
        <div className="flex flex-wrap gap-2 sm:col-span-2">
          <button
            type="button"
            className="pages-button"
            disabled={saving || list.length >= 6}
            onClick={() => {
              let n = 1;
              while (list.some((entry) => entry.id === `item-${n}`)) n++;
              patch(key, [
                ...list,
                {
                  id: `item-${n}`,
                  title: "",
                  body: "",
                  icon: "file",
                  enabled: true,
                },
              ]);
              setSelected(list.length);
            }}
          >
            Agregar elemento
          </button>
          {item && (
            <button
              type="button"
              className="pages-button"
              disabled={saving}
              onClick={() => {
                patch(
                  key,
                  list.filter((_, i) => i !== index),
                );
                setSelected(Math.max(0, index - 1));
              }}
            >
              Eliminar elemento
            </button>
          )}
        </div>
      </>
    );
  };
  if (topic === "privacy-summary")
    return section(
      "Resumen en una mirada",
      <>
        {field("showSummary", "Mostrar resumen de privacidad", "toggle")}
        {itemControls("summaries")}
      </>,
      "Edita un elemento a la vez, hasta seis. Son explicaciones breves: deben ser coherentes con la política. El texto completo conserva su fuente en la configuración de la tienda.",
    );
  if (topic === "privacy-reading")
    return (
      <>
        {section(
          "Temas de lectura",
          <>
            <Select
              label="Tema de privacidad"
              value={selectedTopic}
              onChange={(event) => setSelectedTopic(event.target.value)}
            >
              {Object.entries(PRIVACY_TOPICS).map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </Select>
            <Input
              label="Título del tema"
              value={c.topics[selectedTopic].label}
              onChange={(event) =>
                patch("topics", {
                  ...c.topics,
                  [selectedTopic]: {
                    ...c.topics[selectedTopic],
                    label: event.target.value,
                  },
                })
              }
            />
            {field("fullPolicyTitle", "Título de la política sin dividir")}
          </>,
          "Aquí cambias los títulos. Las finalidades, autorizaciones, derechos, plazos, conservación, proveedores y vigencia proceden del documento del servidor. Si el servidor entrega una versión anterior, se muestra la política completa en un apartado.",
        )}
        {section(
          "Descarga e identificación",
          <>
            {field("downloadTitle", "Título de descarga")}
            {field("downloadHint", "Ayuda de descarga", "textarea")}
            {field("downloadText", "Texto del botón de descarga")}
            {field("sellerText", "Texto de consultar al responsable")}
            {field("sellerTitle", "Título de identificación del responsable")}
            {field("sellerContactText", "Texto de los canales de contacto")}
            {field("loadingText", "Mensaje al cargar privacidad")}
            {field("retryText", "Texto de reintentar carga")}
          </>,
          "La descarga incluye la política íntegra, su referencia y el responsable. Tienda y Facturación siguen siendo las fuentes de la identidad; los criterios de conservación, proveedores y vigencia se administran en Tienda. No se duplican datos empresariales en esta página.",
        )}
      </>
    );
  if (topic === "privacy-rights")
    return (
      <>
        {section(
          "Guía de derechos",
          <>
            {field("showRights", "Mostrar guía de derechos", "toggle")}
            {field("rightsEyebrow", "Antetítulo de derechos")}
            {field("rightsTitle", "Título de derechos")}
            {itemControls("rights")}
          </>,
          "Los elementos explican los derechos; las solicitudes se gestionan mediante el canal existente. Evita prometer supresión inmediata o resultados automáticos.",
        )}
        {section(
          "Solicitudes y contacto",
          <>
            {field("rightsText", "Texto del botón de derechos")}
            {field("rightsHref", "Destino del botón de derechos")}
            {field("rightsHint", "Explicación de la solicitud", "textarea")}
            {field("contactText", "Texto del enlace de contacto")}
            {field("contactHref", "Destino del enlace de contacto")}
          </>,
          "El destino inicial abre PQR con Consulta de datos personales seleccionada. El usuario puede revisar el tipo y autorizar antes de enviar. Si ocultas la guía, el acceso a derechos se conserva junto a la descarga.",
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
              label="Ilustración de privacidad"
              value={c.heroArtwork}
              disabled={saving}
              onChange={(value) => patch("heroArtwork", value)}
              onBusyChange={(busy) =>
                onUploadingChange("privacy-artwork", busy)
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
            max: 380,
          })}
        </>,
        "El escudo de cristal es una ilustración decorativa. Puedes sustituirlo cargando una imagen desde tu equipo mediante Cloudinary.",
      )}
      {section(
        "Distribución y comportamiento",
        <>
          {field(
            "sidebarWidthPx",
            "Ancho de la guía de derechos (px)",
            "number",
            { min: 260, max: 480 },
          )}
          {field("editorialHeading", "Usar tipografía editorial", "toggle")}
          {field("motion", "Animar controles", "toggle")}
          {field("showSections", "Mostrar secciones adicionales", "toggle")}
          {field("showFooterAction", "Mostrar botón de regreso", "toggle")}
        </>,
        "En móvil la guía se coloca después de la política. Los colores, fondo, brillo y bordes se encuentran en sus temas comunes. Los apartados legales, la descarga y la identidad permanecen accesibles.",
      )}
    </>
  );
}
