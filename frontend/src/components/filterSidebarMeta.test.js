import { describe, expect, it } from "vitest";
import { normalizeFilterCategories } from "./filterSidebarMeta";

describe("normalizeFilterCategories", () => {
  it("acepta el contrato público de categorías como cadenas", () => {
    expect(normalizeFilterCategories(["Vestidos", "Tecnología"])).toEqual([
      { name: "Vestidos", count: 0 },
      { name: "Tecnología", count: 0 },
    ]);
  });

  it("conserva objetos válidos y descarta entradas vacías o repetidas", () => {
    expect(
      normalizeFilterCategories([
        { name: "Moda", count: 3 },
        { label: "Hogar" },
        " moda ",
        null,
        "",
      ])
    ).toEqual([
      { name: "Moda", count: 3 },
      { name: "Hogar", count: 0 },
    ]);
  });
});
