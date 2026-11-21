import { createContext, useContext, useEffect, useState } from "react";
import { API_BASE_URL } from "../../config/apiBaseUrl";
export const CartPageConfigurationContext = createContext(undefined);
let inFlight;
function fetchPage() {
  if (!inFlight)
    inFlight = fetch(`${API_BASE_URL}/api/pages/carrito`)
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok)
          throw new Error(
            data.message || "No se pudo cargar la presentación del carrito.",
          );
        return data;
      })
      .finally(() => {
        inFlight = null;
      });
  return inFlight;
}
export default function useCartPageConfiguration(provided) {
  const inherited = useContext(CartPageConfigurationContext);
  provided = provided || inherited;
  const [state, setState] = useState({
    page: provided || null,
    loading: !provided,
    error: "",
  });
  useEffect(() => {
    if (provided) return;
    let active = true;
    const load = () =>
      fetchPage()
        .then((page) => {
          if (active) setState({ page, loading: false, error: "" });
        })
        .catch((error) => {
          if (active)
            setState((current) => ({
              ...current,
              loading: false,
              error: error.message,
            }));
        });
    load();
    window.addEventListener("focus", load);
    return () => {
      active = false;
      window.removeEventListener("focus", load);
    };
  }, [provided]);
  return provided ? { page: provided, loading: false, error: "" } : state;
}
