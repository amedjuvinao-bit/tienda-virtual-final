import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function PrivateRoute({ children }) {
  const { isAuthenticated, authLoading } = useAuth();

  // 🔄 Mientras valida el token, NO redirige
  if (authLoading) {
    return (
      <div className="w-full h-screen flex items-center justify-center">
        <p>Cargando sesión...</p>
      </div>
    );
  }

  // 🔐 Si ya validó y no está autenticado → login
  return isAuthenticated ? children : <Navigate to="/admin/login" replace />;
}