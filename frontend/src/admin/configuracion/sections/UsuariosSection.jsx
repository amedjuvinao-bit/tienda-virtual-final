// src/admin/configuracion/sections/UsuariosSection.jsx
import React from 'react';
import AdminUsersPage from '../../users/AdminUsersPage';

export default function UsuariosSection({ initialRole = 'all' }) {
  return <AdminUsersPage initialRole={initialRole} />;
}
