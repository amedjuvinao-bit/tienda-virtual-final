import { Input, Select, Toggle } from "./ProductDetailEditorFields";
import EditorSection from "./EditorSection";
import { CONTACT_TEXTS } from "../../../components/information-page/contactPageConfig";

const TEXT_LABELS = {
  whatsappTitle: "Título de WhatsApp",
  whatsappDescription: "Descripción de WhatsApp",
  whatsappAction: "Botón de WhatsApp",
  emailTitle: "Título del correo",
  emailAction: "Acción del correo",
  phoneTitle: "Título del teléfono",
  phoneAction: "Acción de llamar",
  hoursTitle: "Título del horario",
  hoursAction: "Acción de consultar horario",
  timezoneLabel: "Etiqueta de zona horaria",
  closedText: "Día cerrado",
  unavailableText: "Día sin horario",
  closeText: "Cerrar el detalle de horarios",
  locationTitle: "Título de la ubicación",
  locationLabel: "Etiqueta de dirección",
  directionsText: "Botón de indicaciones",
  mapText: "Acción de abrir mapa",
  interactiveMapText: "Acción de explorar mapa",
  closeMapText: "Acción de cerrar mapa interactivo",
  schematicText: "Aviso del mapa ilustrativo",
  copyText: "Acción de copiar dirección",
  copiedText: "Confirmación al copiar",
  copyErrorText: "Mensaje si no se puede copiar",
  emptyText: "Mensaje sin canales publicados",
};
export default function ContactAppearanceControls({ form, onChange, topic }) {
  const c = form.informationPageConfig.contact;
  const patch = (key, value) =>
    onChange((current) => ({
      ...current,
      informationPageConfig: {
        ...current.informationPageConfig,
        contact: { ...current.informationPageConfig.contact, [key]: value },
      },
    }));
  const field = (key, label, type = "text", extra = {}) =>
    type === "toggle" ? (
      <Toggle
        key={key}
        label={label}
        checked={c[key]}
        onChange={(value) => patch(key, value)}
      />
    ) : type === "textarea" ? (
      <label key={key} className="block sm:col-span-2">
        <span className="mb-1 block text-sm font-medium text-gray-700">
          {label}
        </span>
        <textarea
          aria-label={label}
          rows={4}
          className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-800"
          value={c[key]}
          onChange={(event) => patch(key, event.target.value)}
        />
      </label>
    ) : (
      <Input
        key={key}
        label={label}
        type={type}
        value={c[key]}
        {...extra}
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
  const source = (key, label) => (
    <Select
      label={label}
      value={c[key]}
      onChange={(event) => patch(key, event.target.value)}
    >
      <option value="store">Usar datos de Tienda</option>
      <option value="custom">Personalizar en esta página</option>
    </Select>
  );
  const grid = (children) => (
    <div className="grid gap-4 sm:grid-cols-2">{children}</div>
  );
  const section = (title, children, text) => (
    <EditorSection key={title} title={title} text={text}>
      {grid(children)}
    </EditorSection>
  );
  if (topic === "contact-channels")
    return (
      <>
        {section(
          "WhatsApp",
          <>
            {source("whatsappSource", "Datos de WhatsApp")}
            {field("showWhatsapp", "Mostrar canal de WhatsApp", "toggle")}
            {c.whatsappSource === "custom" &&
              field("whatsappPhone", "Número de WhatsApp con indicativo")}
            {field(
              "whatsappMessage",
              "Mensaje inicial de WhatsApp",
              "textarea",
            )}
          </>,
          "El número usa indicativo internacional. No se envían mensajes automáticamente: el visitante los confirma en WhatsApp.",
        )}
        {section(
          "Correo y teléfono",
          <>
            {source("emailSource", "Datos del correo")}
            {field("showEmail", "Mostrar correo", "toggle")}
            {c.emailSource === "custom" &&
              field("email", "Correo de contacto", "email")}
            {field("emailSubject", "Asunto inicial del correo")}
            {field("showPhone", "Mostrar llamada telefónica", "toggle")}
            {c.showPhone &&
              field("phone", "Teléfono con indicativo (vacío usa Tienda)")}
          </>,
          "Al usar Tienda, el correo de atención tiene prioridad sobre el correo general. Los canales sin datos válidos se ocultan en público.",
        )}
        <p className="text-sm text-gray-600">
          Los datos comerciales se administran en Configuración → Tienda. Aquí
          puedes conservar esa conexión o publicar datos propios de esta página.
        </p>
      </>
    );
  if (topic === "contact-hours")
    return section(
      "Horarios de atención",
      <>
        {source("hoursSource", "Datos de los horarios")}
        {field("showHours", "Mostrar horarios", "toggle")}
        {c.hoursSource === "custom" ? (
          field("hours", "Horario publicado", "textarea")
        ) : (
          <p className="text-sm text-gray-600 sm:col-span-2">
            Usa el horario semanal y la zona horaria guardados en Configuración
            → Tienda. El visitante puede consultar cada día y sus turnos.
          </p>
        )}
      </>,
    );
  if (topic === "contact-location")
    return (
      <>
        {section(
          "Dirección del negocio",
          <>
            {source("locationSource", "Datos de la ubicación")}
            {field("showLocation", "Mostrar ubicación", "toggle")}
            {c.locationSource === "custom" && (
              <>
                {field("address", "Dirección publicada")}
                {field("city", "Ciudad o localidad")}
                {field("country", "País")}
              </>
            )}
            {field("showCopyAddress", "Permitir copiar dirección", "toggle")}
          </>,
          "La dirección completa abre la búsqueda y las indicaciones en Google Maps. No se publica una ubicación a partir de la ciudad solamente.",
        )}
        {section(
          "Punto exacto en el mapa",
          <>
            {field("latitude", "Latitud del negocio")}
            {field("longitude", "Longitud del negocio")}
          </>,
          "Opcional. Introduce ambas coordenadas para mostrar el punto exacto y permitir explorar OpenStreetMap dentro de la página. Sin coordenadas se muestra una vista ilustrativa enlazada al mapa real por dirección. Actualiza este punto si cambia la dirección.",
        )}
      </>
    );
  if (topic === "contact-design")
    return section(
      "Composición y movimiento",
      <>
        {field("mapHeightPx", "Alto del mapa (px)", "number", {
          min: 240,
          max: 620,
        })}
        {field("editorialHeading", "Usar tipografía editorial", "toggle")}
        {field("motion", "Animar los controles", "toggle")}
        {field("showSections", "Mostrar secciones adicionales", "toggle")}
        {field("showFooterAction", "Mostrar botón de regreso", "toggle")}
      </>,
      "Los colores, bordes, transparencia, profundidad y medidas generales se agrupan en los temas de Diseño. El fondo puede continuar el de Inicio.",
    );
  const groups = [
    [
      "Canales y acciones",
      [
        "whatsappTitle",
        "whatsappDescription",
        "whatsappAction",
        "emailTitle",
        "emailAction",
        "phoneTitle",
        "phoneAction",
      ],
    ],
    [
      "Horario y detalle",
      [
        "hoursTitle",
        "hoursAction",
        "timezoneLabel",
        "closedText",
        "unavailableText",
        "closeText",
      ],
    ],
    [
      "Ubicación y mapa",
      [
        "locationTitle",
        "locationLabel",
        "directionsText",
        "mapText",
        "interactiveMapText",
        "closeMapText",
        "schematicText",
      ],
    ],
    [
      "Confirmaciones y estado vacío",
      ["copyText", "copiedText", "copyErrorText", "emptyText"],
    ],
  ];
  return groups.map(([title, keys]) =>
    section(
      title,
      keys
        .filter((key) => key in CONTACT_TEXTS)
        .map((key) => field(key, TEXT_LABELS[key])),
    ),
  );
}
