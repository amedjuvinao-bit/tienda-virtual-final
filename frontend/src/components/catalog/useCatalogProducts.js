import { useEffect, useState } from "react";
import { API_BASE_URL } from "../../config/apiBaseUrl";
import {
  EMPTY_PRODUCT_PAGE,
  normalizeProductPageResponse,
} from "../../utils/productPagination";
import { buildCatalogProductQuery, hasEmptyCatalogScope } from "./catalogQuery";

export default function useCatalogProducts(config, query, setPage) {
  const key = buildCatalogProductQuery(config, query).toString();
  const emptyScope = hasEmptyCatalogScope(config);
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState({
    key: "",
    ...EMPTY_PRODUCT_PAGE,
    loading: true,
    error: "",
  });
  useEffect(() => {
    if (emptyScope) {
      setResult({ key, ...EMPTY_PRODUCT_PAGE, loading: false, error: "" });
      return;
    }
    const controller = new AbortController();
    setResult({ key, ...EMPTY_PRODUCT_PAGE, loading: true, error: "" });
    (async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/products?${key}`, {
          signal: controller.signal,
        });
        if (!response.ok)
          throw new Error(
            "No pudimos cargar los productos. Comprueba tu conexión e inténtalo de nuevo.",
          );
        const payload = await response.json();
        if (controller.signal.aborted) return;
        if (!Array.isArray(payload?.products) || !payload?.pagination)
          throw new Error(
            "La respuesta del catálogo no está completa. Vuelve a intentarlo.",
          );
        const data = normalizeProductPageResponse(payload, config.limit || 24);
        const lastPage = Math.max(1, data.pagination.totalPages);
        if (query.page > lastPage) {
          setPage(lastPage, { replace: true });
          return;
        }
        setResult({ key, ...data, loading: false, error: "" });
      } catch (error) {
        if (controller.signal.aborted) return;
        setResult({
          key,
          ...EMPTY_PRODUCT_PAGE,
          loading: false,
          error:
            error.message?.startsWith("No pudimos") ||
            error.message?.startsWith("La respuesta")
              ? error.message
              : "No pudimos conectar con el catálogo. Comprueba tu conexión y vuelve a intentarlo.",
        });
      }
    })();
    return () => controller.abort();
    // The serialized query includes every server filter; callback identity is UI-only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, emptyScope, attempt]);
  return {
    ...(result.key === key
      ? result
      : { ...EMPTY_PRODUCT_PAGE, loading: true, error: "" }),
    retry: () => setAttempt((a) => a + 1),
  };
}
