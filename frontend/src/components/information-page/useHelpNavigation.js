import { useEffect, useRef, useState } from "react";
import {
  useLocation,
  useNavigationType,
  useSearchParams,
} from "react-router-dom";

export default function useHelpNavigation(showSearch) {
  const [params, setParams] = useSearchParams(),
    location = useLocation(),
    navigation = useNavigationType();
  const urlQuery = (params.get("q") || "").slice(0, 160);
  // Router transitions may lag behind keystrokes. Keep the input immediate and
  // distinguish our own URL updates from Back/Forward or external navigation.
  const [draftQuery, setDraftQuery] = useState(urlQuery);
  const pending = useRef({ searches: new Set(), latest: "" });
  useEffect(() => {
    const search = location.search.replace(/^\?/, "");
    if (navigation !== "POP" && pending.current.searches.has(search)) {
      pending.current.searches.delete(search);
      if (search === pending.current.latest) pending.current.searches.clear();
    } else {
      pending.current.searches.clear();
      setDraftQuery(urlQuery);
    }
  }, [location.key, location.search, navigation, urlQuery]);
  const patch = (values, replace = false) =>
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        for (const [key, value] of Object.entries(values)) {
          if (value == null) next.delete(key);
          else next.set(key, value);
        }
        const search = next.toString();
        pending.current.searches.add(search);
        pending.current.latest = search;
        return next;
      },
      {
        replace,
        preventScrollReset: true,
        state: { ...location.state, preserveStorefrontScroll: true },
      },
    );
  const query = showSearch ? draftQuery : "";
  return {
    params,
    query,
    setSearch(value) {
      const next = value.slice(0, 160);
      setDraftQuery(next);
      patch({ q: next || null, pregunta: null }, true);
    },
    clearSearch() {
      setDraftQuery("");
      patch({ q: null, pregunta: null }, true);
    },
    selectTopic(id) {
      setDraftQuery("");
      patch({ tema: id, q: null, pregunta: null });
    },
    selectQuestion(id) {
      patch({ pregunta: id, q: query || null });
    },
  };
}
