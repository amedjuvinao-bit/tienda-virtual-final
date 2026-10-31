import { useEffect, useState } from "react";
import api from "../../lib/api";
import { catalogScopeParams, hasEmptyCatalogScope } from "./catalogQuery";
import { normalizeFilterCategories } from "../filterSidebarMeta";
const ALL = { sourceMode: "all" };
export default function useCatalogFacets(config = ALL) {
  const scope = catalogScopeParams(config).toString(),
    empty = hasEmptyCatalogScope(config);
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState({
    scope: "",
    categories: [],
    colors: [],
    loading: true,
    error: "",
  });
  useEffect(() => {
    if (empty) {
      setResult({
        scope,
        categories: [],
        colors: [],
        loading: false,
        error: "",
      });
      return;
    }
    const controller = new AbortController();
    setResult({ scope, categories: [], colors: [], loading: true, error: "" });
    api
      .get(`/api/products/meta${scope ? `?${scope}` : ""}`, {
        signal: controller.signal,
      })
      .then(({ data }) => {
        if (controller.signal.aborted) return;
        setResult({
          scope,
          categories: normalizeFilterCategories(data?.categories),
          colors: Array.isArray(data?.colors) ? data.colors : [],
          loading: false,
          error: "",
        });
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setResult({
            scope,
            categories: [],
            colors: [],
            loading: false,
            error: "No pudimos cargar las opciones de filtro.",
          });
      });
    return () => controller.abort();
  }, [scope, empty, attempt]);
  return {
    ...(result.scope === scope
      ? result
      : { categories: [], colors: [], loading: true, error: "" }),
    retry: () => setAttempt((a) => a + 1),
  };
}
