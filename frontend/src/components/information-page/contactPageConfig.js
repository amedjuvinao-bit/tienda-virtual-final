const object = (value) =>
  value && typeof value === "object" && !Array.isArray(value) ? value : {};
const text = (value, fallback = "", max = 2000) =>
  typeof value === "string" ? value.slice(0, max) : fallback;
export const CONTACT_TEXTS = {
  whatsappTitle: "WhatsApp",
  whatsappDescription: "Conversemos directamente",
  whatsappAction: "Abrir conversación",
  emailTitle: "Correo electrónico",
  emailAction: "Escríbenos",
  phoneTitle: "Teléfono",
  phoneAction: "Llamar",
  hoursTitle: "Horario de atención",
  hoursAction: "Consulta nuestros horarios",
  timezoneLabel: "Zona horaria",
  closedText: "Cerrado",
  unavailableText: "Sin horario publicado",
  locationTitle: "Ven a conocernos",
  locationLabel: "Nuestra ubicación",
  directionsText: "Cómo llegar",
  mapText: "Ver ubicación en el mapa",
  interactiveMapText: "Explorar mapa",
  closeMapText: "Cerrar mapa interactivo",
  schematicText: "Vista ilustrativa · abre la ubicación real",
  copyText: "Copiar dirección",
  copiedText: "Dirección copiada",
  copyErrorText: "No se pudo copiar. Selecciona la dirección para copiarla.",
  closeText: "Cerrar horarios",
  emptyText: "Pronto encontrarás aquí nuestros canales de atención.",
};
export function buildContactConfig(raw) {
  const source = object(raw);
  return {
    ...source,
    ...Object.fromEntries(
      Object.entries(CONTACT_TEXTS).map(([key, fallback]) => [
        key,
        text(source[key], fallback, 1000),
      ]),
    ),
    ...Object.fromEntries(
      ["whatsapp", "email", "hours", "location"].map((key) => [
        key + "Source",
        source[key + "Source"] === "custom" ? "custom" : "store",
      ]),
    ),
    whatsappPhone: text(source.whatsappPhone, "", 80),
    whatsappMessage: text(source.whatsappMessage, "", 1500),
    email: text(source.email, "", 254),
    emailSubject: text(source.emailSubject, "", 180).replace(/[\r\n]/g, " "),
    phone: text(source.phone, "", 80),
    hours: text(source.hours, "", 4000),
    address: text(source.address, "", 500),
    city: text(source.city, "", 180),
    country: text(source.country, "", 180),
    latitude: text(source.latitude, "", 30),
    longitude: text(source.longitude, "", 30),
    showWhatsapp: source.showWhatsapp !== false,
    showEmail: source.showEmail !== false,
    showHours: source.showHours !== false,
    showLocation: source.showLocation !== false,
    showPhone: source.showPhone === true,
    showCopyAddress: source.showCopyAddress !== false,
    showSections: source.showSections === true,
    showFooterAction: source.showFooterAction === true,
    editorialHeading: source.editorialHeading !== false,
    motion: source.motion !== false,
    mapHeightPx: Math.min(
      620,
      Math.max(240, Number(source.mapHeightPx) || 420),
    ),
  };
}
export function contactPhone(value) {
  const input = String(value || "").trim();
  if (!/^\+?[\d\s().-]+$/.test(input)) return "";
  const phone = input.replace(/\D/g, "");
  return /^\d{7,15}$/.test(phone) ? phone : "";
}
export function contactEmail(value) {
  const email = String(value || "").trim();
  return /^[^\s@<>?&#%,;:\\"()\[\]\u0000-\u001f]+@[^\s@<>?&#%,;:\\"()\[\]\u0000-\u001f]+\.[^\s@<>?&#%,;:\\"()\[\]\u0000-\u001f]+$/.test(
    email,
  )
    ? email
    : "";
}
export function contactCoordinates(latitude, longitude) {
  if (
    String(latitude ?? "").trim() === "" ||
    String(longitude ?? "").trim() === ""
  )
    return null;
  const lat = Number(latitude),
    lon = Number(longitude);
  return Number.isFinite(lat) &&
    Number.isFinite(lon) &&
    Math.abs(lat) <= 85 &&
    Math.abs(lon) <= 180
    ? { lat, lon }
    : null;
}
const DAYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];
const validInterval = (interval) =>
  /^([01]\d|2[0-3]):[0-5]\d$/.test(interval?.open) &&
  /^([01]\d|2[0-3]):[0-5]\d$/.test(interval?.close) &&
  interval.open < interval.close;
export function contactSchedule(store = {}) {
  if (
    !Array.isArray(store.weeklySchedule?.days) ||
    !store.weeklySchedule.days.length
  )
    return [];
  return DAYS.flatMap((day, index) => {
    const entry = store.weeklySchedule.days.find((value) => value?.day === day);
    if (!entry) return [];
    return [
      {
        day,
        label: new Intl.DateTimeFormat("es", {
          weekday: "long",
          timeZone: "UTC",
        }).format(new Date(Date.UTC(2026, 0, 5 + index))),
        closed: entry.enabled === false,
        intervals:
          entry.enabled === true && Array.isArray(entry.intervals)
            ? entry.intervals.filter(validInterval).slice(0, 2)
            : [],
      },
    ];
  });
}
export function resolveContact(config, settings = {}, theme) {
  const c = buildContactConfig(config),
    store = object(settings?.store);
  const global = theme?.global?.whatsapp || settings?.theme?.global?.whatsapp;
  const phone = contactPhone(
    c.whatsappSource === "custom"
      ? c.whatsappPhone
      : store.whatsapp || (global?.enabled !== false ? global?.phone : ""),
  );
  const email = contactEmail(
    c.emailSource === "custom" ? c.email : store.supportEmail || store.email,
  );
  const address =
    c.locationSource === "custom"
      ? [c.address, c.city, c.country]
          .map((v) => v.trim())
          .filter(Boolean)
          .join(", ")
      : [
          store.address,
          store.city,
          store.department,
          store.country === "CO" ? "Colombia" : store.country,
        ]
          .filter(Boolean)
          .join(", ");
  // City/country alone must not publish a fictional business location.
  const hasAddress = !!String(
    c.locationSource === "custom" ? c.address : store.address || "",
  ).trim();
  const coordinates = contactCoordinates(c.latitude, c.longitude);
  const destination = coordinates
    ? `${coordinates.lat},${coordinates.lon}`
    : hasAddress
      ? address
      : "";
  const schedule = c.hoursSource === "store" ? contactSchedule(store) : [];
  const hours = String(
    c.hoursSource === "custom" ? c.hours : store.customerServiceHours || "",
  ).trim();
  const phoneNumber = contactPhone(c.phone || store.phone);
  let timezone = "";
  if (c.hoursSource === "store" && store.timezone) {
    try {
      new Intl.DateTimeFormat("es", { timeZone: store.timezone });
      timezone = store.timezone;
    } catch {
      /* Never invent a timezone. */
    }
  }
  return {
    whatsapp: phone
      ? `https://wa.me/${phone}${c.whatsappMessage ? `?text=${encodeURIComponent(c.whatsappMessage)}` : ""}`
      : "",
    email: email
      ? `mailto:${email}${c.emailSubject ? `?subject=${encodeURIComponent(c.emailSubject)}` : ""}`
      : "",
    emailAddress: email,
    phone: phoneNumber ? `tel:+${phoneNumber}` : "",
    phoneNumber: c.phone || store.phone || "",
    hours,
    schedule,
    timezone,
    address: hasAddress ? address : "",
    coordinates,
    directions: destination
      ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`
      : "",
    map: destination
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(destination)}`
      : "",
  };
}
export function contactEmbedUrl({ lat, lon }) {
  const bound = (v, min, max) => Math.min(max, Math.max(min, v));
  const bbox = [
    bound(lon - 0.006, -180, 180),
    bound(lat - 0.004, -85, 85),
    bound(lon + 0.006, -180, 180),
    bound(lat + 0.004, -85, 85),
  ].join(",");
  return `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(bbox)}&layer=mapnik&marker=${encodeURIComponent(`${lat},${lon}`)}`;
}
export function validateContactConfig(raw) {
  const c = buildContactConfig(raw);
  if (c.whatsappPhone.trim() && !contactPhone(c.whatsappPhone))
    return "Revisa el número de WhatsApp e incluye el indicativo del país.";
  if (c.phone.trim() && !contactPhone(c.phone))
    return "Revisa el teléfono e incluye el indicativo del país.";
  if (c.email.trim() && !contactEmail(c.email))
    return "Escribe un correo de contacto válido.";
  if (
    (c.latitude.trim() || c.longitude.trim()) &&
    !contactCoordinates(c.latitude, c.longitude)
  )
    return "Escribe ambas coordenadas: latitud entre −85 y 85 y longitud entre −180 y 180.";
  return "";
}
