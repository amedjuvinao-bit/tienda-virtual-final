// src/admin/configuracion/sections/PerfilesSection.jsx
import React from 'react';
import InfoCard from '../components/InfoCard';
import EmptyHint from '../components/EmptyHint';

export default function PerfilesSection() {
  return (
    <div className="grid gap-4">
      <InfoCard
        title="Roles y permisos"
        description="Define qué puede hacer cada tipo de usuario dentro del panel administrativo."
      >
        <div className="grid gap-4">
          <button className="w-fit rounded-xl bg-pink-500 px-4 py-2 text-white hover:bg-pink-600 transition">
            + Crear perfil
          </button>

          <div className="rounded-xl border border-gray-200 p-4 text-sm text-gray-600">
            Aquí se configurarán los permisos por perfil (ej: admin, editor, vendedor).
          </div>
        </div>
      </InfoCard>

      <EmptyHint
        title="Escalabilidad"
        text="Este módulo permitirá controlar accesos y permisos a nivel profesional en el sistema."
      />
    </div>
  );
}