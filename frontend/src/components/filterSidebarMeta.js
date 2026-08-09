export function normalizeFilterCategories(value) {
  const seen = new Set();
  const normalized = [];

  for (const entry of Array.isArray(value) ? value : []) {
    const source = entry && typeof entry === "object" ? entry : {};
    const name = String(
      typeof entry === "string"
        ? entry
        : source.name ?? source.label ?? source.value ?? ""
    ).trim();
    if (!name) continue;

    const key = name.toLocaleLowerCase("es-CO");
    if (seen.has(key)) continue;
    seen.add(key);

    const parsedCount = Number(source.count);
    normalized.push({
      name,
      count: Number.isFinite(parsedCount) && parsedCount >= 0 ? parsedCount : 0,
    });
  }

  return normalized;
}
