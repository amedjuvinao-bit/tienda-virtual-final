// Illustrative generated photos are used only by the admin iframe, never seeded
// into the saved draft or shown as the public business's people or events.
export const MEMORY_DEMO = [
  ["bienvenida", "Siempre bienvenidos", "Personas", "2026-01-12", 0, 0],
  ["inicio", "Un nuevo día comienza", "Día a día", "2026-02-02", 0, 1],
  ["ideas", "Ordenando para crecer", "Día a día", "2026-03-18", 2, 0],
  ["equipo", "Un gran equipo, desde el inicio", "Personas", "2026-06-03", 1, 0],
  [
    "celebracion",
    "Pequeños grandes logros",
    "Celebraciones",
    "2026-08-10",
    1,
    1,
  ],
  ["juntos", "Día a día, juntos", "Personas", "2026-11-15", 2, 1],
].map(([id, title, category, date, col, row]) => ({
  id: `demo-${id}`,
  title,
  category,
  date,
  enabled: true,
  image: "/diary/preview-atlas.webp",
  imageAlt: "Fotografía ilustrativa de muestra",
  previewCrop: { col, row },
  summary: "Un recuerdo de ejemplo para explorar el diseño.",
  story:
    "Esta es una historia de muestra. Los recuerdos de tu negocio se crean desde el panel con tus propias fotos, fechas y relatos.",
  gallery: [],
  focalX: 50,
  focalY: 50,
}));
