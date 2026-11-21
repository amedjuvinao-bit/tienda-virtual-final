import { useCallback, useEffect, useState } from "react";
import api from "../../lib/api";

export default function useNewsletterPolicy(enabled = true) {
  const [policy, setPolicy] = useState(null),
    [error, setError] = useState(""),
    [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => setAttempt((value) => value + 1), []);
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    setPolicy(null);
    setError("");
    api
      .get("/api/newsletter/policy")
      .then(({ data }) => {
        if (active) {
          if (
            !data?.policy?.version ||
            typeof data.policy.text !== "string" ||
            !data.policy.seller ||
            typeof data.policy.seller !== "object"
          )
            throw new Error("Invalid policy");
          setPolicy({ ...data.policy, ready: data.policy.ready === true });
        }
      })
      .catch(() => {
        if (active)
          setError("No pudimos cargar la información de suscripción.");
      });
    return () => {
      active = false;
    };
  }, [enabled, attempt]);
  return { policy, error, retry };
}
