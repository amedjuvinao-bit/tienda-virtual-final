import { PRIVACY_TOPICS } from "./privacyPageConfig";

// A mixed-version response must never remove part of the canonical policy.
export function privacyPolicySections(data) {
  const policy = data?.sections?.find((section) => section.id === "privacidad");
  if (!policy || typeof policy.body !== "string") return [];
  const fallback = [
    { id: "privacidad", title: policy.title, paragraphs: [policy.body] },
  ];
  const sections = data?.privacySections;
  if (!Array.isArray(sections) || sections.length !== 4) return fallback;
  let remaining = policy.body;
  const seen = new Set();
  for (const section of sections) {
    if (
      !Object.hasOwn(PRIVACY_TOPICS, section?.id) ||
      seen.has(section.id) ||
      typeof section.title !== "string" ||
      !Array.isArray(section.paragraphs) ||
      !section.paragraphs.length
    )
      return fallback;
    seen.add(section.id);
    for (const fragment of [
      ...section.paragraphs,
      ...(section.note ? [section.note] : []),
    ]) {
      if (typeof fragment !== "string" || !fragment.trim()) return fallback;
      const index = remaining.indexOf(fragment);
      if (index < 0) return fallback;
      remaining =
        remaining.slice(0, index) + remaining.slice(index + fragment.length);
    }
  }
  return remaining.trim() ? fallback : sections;
}
