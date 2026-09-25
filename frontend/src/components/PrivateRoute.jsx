import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AdminLoadingScreen from '../admin/loading/AdminLoadingScreen';

export default function PrivateRoute({ children, loaderModel }) {
  const { isAuthenticated, authLoading } = useAuth();

  // 🔄 Mientras valida el token, NO redirige
  if (authLoading) {
    return <AdminLoadingScreen model={loaderModel} message="Comprobando sesión…" />;
  }

  // 🔐 Si ya validó y no está autenticado → login
  return isAuthenticated ? children : <Navigate to="/admin/login" replace />;
}
