import { useEffect, useState } from "react";
import api from "../../lib/api";
export default function useConsumerInformation() {
  const [data, setData] = useState(null),
    [error, setError] = useState(""),
    [attempt, retry] = useState(0);
  useEffect(() => {
    const update = () => retry((v) => v + 1);
    window.addEventListener("consumer-policy-refresh", update);
    return () => window.removeEventListener("consumer-policy-refresh", update);
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    setError("");
    api
      .get("/api/consumer/information", { signal: controller.signal })
      .then((r) => {
        if (!controller.signal.aborted) setData(r.data);
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setError("No pudimos cargar la información. Intenta de nuevo.");
      });
    return () => controller.abort();
  }, [attempt]);
  return { data, error, retry: () => retry((v) => v + 1) };
}
