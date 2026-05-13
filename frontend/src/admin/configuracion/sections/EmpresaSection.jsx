// src/admin/configuracion/sections/EmpresaSection.jsx
import React, { useEffect, useState } from 'react';
import InfoCard from '../components/InfoCard';
import EmptyHint from '../components/EmptyHint';
import api from '../../../lib/api';

export default function EmpresaSection() {
  const [store, setStore] = useState({
    name: '',
    businessName: '',
    email: '',
    phone: '',
    address: '',
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // 🔹 CARGAR DESDE BACKEND
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const { data } = await api.get('/api/site-settings');

        if (data?.store) {
          setStore({
            name: data.store.name || '',
            businessName: data.store.businessName || '',
            email: data.store.email || '',
            phone: data.store.phone || '',
            address: data.store.address || '',
          });
        }
      } catch (error) {
        console.error('Error cargando empresa:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
  }, []);

  // 🔹 GUARDAR EN BACKEND
  const handleSave = async () => {
    try {
      setSaving(true);

      await api.put('/api/site-settings', {
        store,
      });

      alert('Datos de la tienda guardados correctamente');
    } catch (error) {
      console.error('Error guardando empresa:', error);
      alert('Error al guardar los datos de la tienda');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="text-sm text-gray-500">Cargando...</div>;
  }

  return (
    <div className="grid gap-4">
      <InfoCard
        title="Datos generales de la tienda"
        description="Aquí irán los datos principales del negocio para identificar la tienda dentro del sistema."
      >
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-gray-700">
              Nombre comercial
            </span>
            <input
              value={store.name}
              onChange={(e) =>
                setStore({ ...store, name: e.target.value })
              }
              className="w-full rounded-xl border border-gray-300 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-pink-400"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-gray-700">
              Razón social
            </span>
            <input
              value={store.businessName}
              onChange={(e) =>
                setStore({ ...store, businessName: e.target.value })
              }
              className="w-full rounded-xl border border-gray-300 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-pink-400"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-gray-700">
              Correo principal
            </span>
            <input
              type="email"
              value={store.email}
              onChange={(e) =>
                setStore({ ...store, email: e.target.value })
              }
              className="w-full rounded-xl border border-gray-300 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-pink-400"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-gray-700">
              Teléfono principal
            </span>
            <input
              value={store.phone}
              onChange={(e) =>
                setStore({ ...store, phone: e.target.value })
              }
              className="w-full rounded-xl border border-gray-300 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-pink-400"
            />
          </label>

          <label className="block md:col-span-2">
            <span className="mb-1 block text-sm font-medium text-gray-700">
              Dirección principal
            </span>
            <input
              value={store.address}
              onChange={(e) =>
                setStore({ ...store, address: e.target.value })
              }
              className="w-full rounded-xl border border-gray-300 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-pink-400"
            />
          </label>
        </div>

        {/* 🔥 BOTÓN GUARDAR */}
        <div className="pt-4">
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-xl bg-pink-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-pink-600 disabled:opacity-50"
          >
            {saving ? 'Guardando...' : 'Guardar datos'}
          </button>
        </div>
      </InfoCard>

      <EmptyHint
        title="Siguiente mejora"
        text="Ahora estos datos ya se guardan en base de datos y podrán ser usados en el sistema (facturación, DIAN, PDF, etc)."
      />
    </div>
  );
}