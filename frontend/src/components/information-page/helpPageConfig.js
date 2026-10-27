import { HELP_STARTER } from "./helpStarter";
import { safeFooterLink } from "../footer/footerEditorialConfig";
const object = (value) =>
  value && typeof value === "object" && !Array.isArray(value) ? value : {};
const text = (value, fallback = "", max = 1000) =>
  typeof value === "string" ? value.slice(0, max) : fallback;
export const HELP_ICONS = [
  "package",
  "credit-card",
  "truck",
  "refresh",
  "help",
  "heart",
  "shopping-bag",
  "tag",
];
export const HELP_TEXTS = {
  searchLabel: "Buscar en el centro de ayuda",
  searchPlaceholder: "Busca una pregunta o un tema",
  clearSearchText: "Limpiar búsqueda",
  topicsTitle: "Explora por tema",
  resultsTitle: "Resultados de búsqueda",
  resultSingular: "respuesta encontrada",
  resultPlural: "respuestas encontradas",
  emptyTitle: "No encontramos esa respuesta",
  emptyText:
    "Prueba con otras palabras o contacta a nuestro equipo para recibir orientación.",
  noContentText:
    "Puedes comunicarte con nuestro equipo para resolver tus preguntas.",
  supportTitle: "¿Necesitas atención personalizada?",
  supportText: "Estamos aquí para ayudarte.",
  supportAction: "Contactar al equipo",
};
export function helpLink(value) {
  const link = safeFooterLink(value);
  return /^\/(?:admin|probe-site-settings)(?:[/?#]|$)/i.test(link) ? "" : link;
}
function uniqueId(value, fallback, seen) {
  let id = text(value, fallback, 80).replace(/[^a-zA-Z0-9_-]/g, "") || fallback;
  while (seen.has(id)) id += "-2";
  seen.add(id);
  return id;
}
export function buildHelpConfig(raw, { starter = false } = {}) {
  const source = object(raw),
    categoryIds = new Set(),
    questionIds = new Set();
  const categories = Array.isArray(source.categories)
    ? source.categories
    : starter
      ? HELP_STARTER
      : [];
  return {
    ...source,
    ...Object.fromEntries(
      Object.entries(HELP_TEXTS).map(([key, fallback]) => [
        key,
        text(source[key], fallback),
      ]),
    ),
    supportHref: helpLink(source.supportHref ?? "/contacto"),
    showSearch: source.showSearch !== false,
    showSupport: source.showSupport !== false,
    openFirst: source.openFirst !== false,
    editorialHeading: source.editorialHeading !== false,
    motion: source.motion !== false,
    showSections: source.showSections === true,
    showFooterAction: source.showFooterAction === true,
    categories: categories.slice(0, 12).map((rawCategory, index) => {
      const category = object(rawCategory);
      return {
        ...category,
        id: uniqueId(category.id, `topic-${index + 1}`, categoryIds),
        title: text(category.title, "", 100),
        heading: text(category.heading, "", 180),
        icon: HELP_ICONS.includes(category.icon) ? category.icon : "help",
        enabled: category.enabled !== false,
        questions: (Array.isArray(category.questions) ? category.questions : [])
          .slice(0, 30)
          .map((rawQuestion, i) => {
            const q = object(rawQuestion);
            return {
              ...q,
              id: uniqueId(q.id, `question-${index + 1}-${i + 1}`, questionIds),
              question: text(q.question, "", 300),
              answer: text(q.answer, "", 6000),
              enabled: q.enabled !== false,
              actionText: text(q.actionText, "", 120),
              actionHref: helpLink(q.actionHref),
            };
          }),
      };
    }),
  };
}
export function visibleHelpTopics(config) {
  return config.categories
    .filter((c) => c.enabled && c.title.trim())
    .map((c) => ({
      ...c,
      questions: c.questions.filter(
        (q) => q.enabled && q.question.trim() && q.answer.trim(),
      ),
    }))
    .filter((c) => c.questions.length);
}
export const normalizeHelpSearch = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es")
    .trim();
export function searchHelpTopics(topics, query) {
  const terms = normalizeHelpSearch(query).split(/\s+/).filter(Boolean);
  return topics.flatMap((category) =>
    category.questions
      .filter((question) => {
        const haystack = normalizeHelpSearch(
          `${category.title} ${category.heading} ${question.question} ${question.answer}`,
        );
        return terms.every((term) => haystack.includes(term));
      })
      .map((question) => ({
        ...question,
        categoryId: category.id,
        categoryTitle: category.title,
      })),
  );
}
export function validateHelpConfig(config = {}) {
  if (config.supportHref?.trim() && !helpLink(config.supportHref))
    return "Revisa el destino del botón de atención: usa una página pública o un enlace seguro.";
  if (
    config.showSupport !== false &&
    config.supportAction?.trim() &&
    !config.supportHref?.trim()
  )
    return "El botón de atención necesita un destino. También puedes ocultar la franja de atención.";
  for (const category of config.categories || []) {
    if (category.enabled === false) continue;
    if (!category.title?.trim()) return "Cada tema visible necesita un nombre.";
    for (const q of category.questions || []) {
      if (q.enabled === false) continue;
      if (!q.question?.trim() || !q.answer?.trim())
        return "Cada pregunta visible necesita su pregunta y respuesta. Puedes ocultarla mientras la preparas.";
      if (q.actionHref?.trim() && !helpLink(q.actionHref))
        return "Revisa el destino de la acción de una respuesta: utiliza un enlace público seguro.";
      if (!!q.actionText?.trim() !== !!q.actionHref?.trim())
        return "La acción de una respuesta necesita texto y destino, o ambos campos vacíos.";
    }
  }
  return "";
}
