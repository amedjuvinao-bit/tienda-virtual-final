// src/admin/configuracion/sections/UsuariosSection.jsx
import React from 'react';
import InfoCard from '../components/InfoCard';
import EmptyHint from '../components/EmptyHint';

export default function UsuariosSection() {
  return (
    <div className="grid gap-4">
      <InfoCard
        title="Gestión de usuarios"
        description="Administra los usuarios que tienen acceso al panel administrativo."
      >
        <div className="grid gap-4">
          <button className="w-fit rounded-xl bg-pink-500 px-4 py-2 text-white hover:bg-pink-600 transition">
            + Crear usuario
          </button>

          <div className="rounded-xl border border-gray-200 p-4 text-sm text-gray-600">
            Aquí se mostrará la lista de usuarios con sus roles, estado y opciones de edición o eliminación.
          </div>
        </div>
      </InfoCard>

      <EmptyHint
        title="Próximo paso"
        text="Luego conectaremos esta sección con el backend para crear, editar y eliminar usuarios reales."
      />
    </div>
  );
}