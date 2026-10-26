import { useEffect, useState } from "react";
import { API_BASE_URL } from "../config/apiBaseUrl";
export default function useDynamicPage(slug) {
  const [version, setVersion] = useState(0);
  const [state, setState] = useState({ slug: "", page: null, loading: true });
  useEffect(() => {
    const controller = new AbortController();
    setState({ slug, page: null, loading: true });
    fetch(`${API_BASE_URL}/api/pages/${encodeURIComponent(slug)}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        if (response.status === 404) return { notFound: true, page: null };
        if (!response.ok)
          throw new Error("No pudimos cargar esta página. Intenta de nuevo.");
        return { page: await response.json() };
      })
      .then((result) => {
        if (!controller.signal.aborted)
          setState({ slug, ...result, loading: false });
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setState({ slug, page: null, error: error.message, loading: false });
      });
    return () => controller.abort();
  }, [slug, version]);
  return {
    ...(state.slug === slug ? state : { page: null, loading: true }),
    retry: () => setVersion((v) => v + 1),
  };
}
