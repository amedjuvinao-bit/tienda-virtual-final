import { useCallback, useMemo } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import { readCatalogQuery, writeCatalogQuery } from "./catalogQuery";

export default function useCatalogQuery(config, width) {
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const state = useMemo(
    () => readCatalogQuery(params, config, width),
    [params, config, width],
  );
  const update = useCallback(
    (patch, options = {}) => {
      setParams((current) => {
        const previous = readCatalogQuery(current, config, width);
        const changes = typeof patch === "function" ? patch(previous) : patch;
        return writeCatalogQuery(current, { ...previous, page: 1, ...changes });
      }, {
        ...options,
        preventScrollReset: true,
        state: { ...location.state, preserveStorefrontScroll: true },
      });
    },
    [setParams, config, width, location.state],
  );
  return {
    state,
    setCategories: (values) =>
      update((s) => ({
        categories:
          typeof values === "function" ? values(s.categories) : values,
      })),
    setColors: (values) =>
      update((s) => ({
        colors: typeof values === "function" ? values(s.colors) : values,
      })),
    setPriceRange: (values) =>
      update({ priceRange: values }, { replace: true }),
    setCols: (cols) => update((s) => ({ cols, page: s.page })),
    setPage: (page, options) =>
      update(
        (s) => ({ page: typeof page === "function" ? page(s.page) : page }),
        options,
      ),
    setSearch: (q) =>
      update({ q: q.trim().replace(/\s+/g, " ").slice(0, 160) }),
    setSort: (sort) => update({ sort }),
    clearFilters: () => update({ categories: [], colors: [], priceRange: [0, 10_000_000] }),
    clear: () =>
      update({
        q: "",
        categories: [],
        colors: [],
        priceRange: [0, 10_000_000],
        sort: config.defaultSort,
      }),
  };
}
