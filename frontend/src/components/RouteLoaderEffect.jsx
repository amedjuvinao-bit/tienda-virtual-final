import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

export default function RouteLoaderEffect({ setLoadingPage, readyForRouteLoader }) {
  const { pathname } = useLocation();

  useEffect(() => {
    if (!readyForRouteLoader) return undefined;

    // El panel conserva su navegación mientras carga los datos del módulo.
    // La superposición global imponía 400 ms en cada cambio de ruta admin.
    if (pathname.startsWith('/admin')) {
      setLoadingPage(false);
      return undefined;
    }

    setLoadingPage(true);
    const timer = window.setTimeout(() => setLoadingPage(false), 400);
    return () => window.clearTimeout(timer);
  }, [pathname, setLoadingPage, readyForRouteLoader]);

  return null;
}
