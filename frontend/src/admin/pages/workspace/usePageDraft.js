import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export default function usePageDraft(form) {
  const [baseline, setBaseline] = useState(null),
    [notice, setNotice] = useState(null),
    [previewOpen, setPreviewOpen] = useState(false);
  const currentEntry = useRef(null),
    restoring = useRef(false);
  const serialized = useMemo(() => (form ? JSON.stringify(form) : ""), [form]);
  const dirty = !!form && baseline !== null && serialized !== baseline;
  const initialize = useCallback((value) => {
    setBaseline(JSON.stringify(value));
    setNotice(null);
    currentEntry.current = {
      href: window.location.href,
      state: window.history.state,
    };
  }, []);
  useEffect(() => {
    if (!dirty) return;
    const beforeUnload = (event) => {
      event.preventDefault();
      event.returnValue = "";
    };
    document.documentElement.dataset.pageDraftDirty = "true";
    const onPopState = (event) => {
      if (restoring.current) {
        restoring.current = false;
        // The router stayed on this editor; replaying the restored entry would remount it.
        event.stopImmediatePropagation();
        return;
      }
      if (
        window.confirm(
          "Tienes cambios sin guardar. ¿Quieres salir y descartarlos?",
        )
      )
        return;
      event.stopImmediatePropagation();
      const previous = currentEntry.current;
      const delta = previous?.state?.idx - event.state?.idx;
      if (Number.isFinite(delta) && delta !== 0) {
        restoring.current = true;
        window.history.go(delta);
      } else if (previous)
        window.history.pushState(previous.state, "", previous.href);
    };
    window.addEventListener("popstate", onPopState, true);
    window.addEventListener("beforeunload", beforeUnload);
    return () => {
      delete document.documentElement.dataset.pageDraftDirty;
      window.removeEventListener("beforeunload", beforeUnload);
      window.removeEventListener("popstate", onPopState, true);
    };
  }, [dirty]);
  const markSaved = useCallback((value) => {
    setBaseline(JSON.stringify(value));
    setNotice({
      tone: "success",
      text: "Cambios guardados. La página pública ya usa esta configuración.",
    });
  }, []);
  const notify = useCallback((text) => setNotice({ tone: "error", text }), []);
  const inform = useCallback(
    (text) => setNotice({ tone: "success", text }),
    [],
  );
  const leave = useCallback(
    (callback) => {
      if (
        !dirty ||
        window.confirm(
          "Tienes cambios sin guardar. ¿Quieres salir y descartarlos?",
        )
      )
        callback();
    },
    [dirty],
  );
  return {
    dirty,
    initialize,
    notice,
    notify,
    inform,
    markSaved,
    leave,
    previewOpen,
    setPreviewOpen,
  };
}
