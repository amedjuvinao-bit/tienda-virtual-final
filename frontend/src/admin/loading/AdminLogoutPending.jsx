import React, { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import AdminLoadingScreen from './AdminLoadingScreen';
import { getRememberedAdminLoader } from './adminLoaderConfig';
import './AdminLogoutPending.css';

export function AdminLogoutGate({ children }) {
  const { pathname } = useLocation();
  const { logoutPending } = useAuth();
  if (pathname.startsWith('/admin') && (logoutPending || pathname === '/admin/logout-pending')) {
    return <AdminLogoutPending />;
  }
  return children;
}

function AdminLogoutPending() {
  const navigate = useNavigate();
  const { logoutPending, logoutInFlight, logoutError, retryPendingLogout } = useAuth();

  useEffect(() => {
    if (!logoutPending) navigate('/admin/login', { replace: true });
  }, [logoutPending, navigate]);

  return (
    <main className="admin-logout-pending">
      <section className="admin-logout-pending__content" aria-label="Cierre de sesión administrativa">
        {logoutInFlight || !logoutPending ? (
          <AdminLoadingScreen compact context="admin" model={getRememberedAdminLoader()}
            message="Confirmando cierre seguro…" />
        ) : (
          <>
            <h1>Cierre pendiente</h1>
            <p role="alert">{logoutError || 'El servidor todavía no ha confirmado el cierre de sesión.'}</p>
            <p>Este navegador mantendrá bloqueado el panel hasta confirmar la revocación de la sesión.</p>
            <button type="button" onClick={retryPendingLogout}>Reintentar cierre</button>
          </>
        )}
      </section>
    </main>
  );
}
