// src/admin/ConfiguracionPage.jsx
import React, { useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Store,
  Receipt,
  CreditCard,
  Truck,
  Mail,
  ShieldCheck,
  LayoutPanelTop,
  Settings2,
  Users,
  IdCard,
  FileSearch,
  Building2,
} from 'lucide-react';

// 🔹 IMPORTS MODULARES
import EmpresaSection from './configuracion/sections/EmpresaSection';
import FacturacionSection from './configuracion/sections/FacturacionSection';
import PagosSection from './configuracion/sections/PagosSection';
import EnviosSection from './configuracion/sections/EnviosSection';
import CorreoSection from './configuracion/sections/CorreoSection';
import LoginAdminSection from './configuracion/sections/LoginAdminSection';
import PanelAdminSection from './configuracion/sections/PanelAdminSection';
import UsuariosSection from './configuracion/sections/UsuariosSection';
import PerfilesSection from './configuracion/sections/PerfilesSection';
import LogsSection from './configuracion/sections/LogsSection';
import SedesSection from './configuracion/sections/SedesSection';

// 🔹 CONFIG CENTRAL DE TABS
const TABS = [
  {
    id: 'empresa',
    label: 'Tienda',
    icon: Store,
    description: 'Datos generales de la tienda y contacto principal.',
  },
  {
    id: 'sedes',
    label: 'Sedes',
    icon: Building2,
    description: 'Gestión de sedes, bodegas, puntos de venta y puntos de recogida.',
  },
  {
    id: 'facturacion',
    label: 'Facturación',
    icon: Receipt,
    description: 'Información legal y tributaria para documentos y cobros.',
  },
  {
    id: 'pagos',
    label: 'Pagos',
    icon: CreditCard,
    description: 'Configuración de pasarelas de pago y credenciales.',
  },
  {
    id: 'envios',
    label: 'Envíos',
    icon: Truck,
    description: 'Reglas, costos y configuración del sistema de envíos.',
  },
  {
    id: 'correo',
    label: 'Correo',
    icon: Mail,
    description: 'Configuración SMTP para recuperación de contraseña y notificaciones.',
  },
  {
    id: 'login-admin',
    label: 'Login admin',
    icon: ShieldCheck,
    description: 'Diseño y experiencia visual de acceso al panel.',
  },
  {
    id: 'panel-admin',
    label: 'Panel admin',
    icon: LayoutPanelTop,
    description: 'Configuración visual y comportamiento del panel.',
  },
  {
    id: 'usuarios',
    label: 'Usuarios',
    icon: Users,
    description: 'Gestión de usuarios del sistema.',
  },
  {
    id: 'perfiles',
    label: 'Perfiles',
    icon: IdCard,
    description: 'Roles y permisos del sistema.',
  },
  {
    id: 'logs',
    label: 'Logs',
    icon: FileSearch,
    description: 'Registro de accesos e intentos de ingreso al panel administrativo.',
  },
];

export default function ConfiguracionPage() {
  const location = useLocation();

  const activeTab = useMemo(() => {
    const parts = location.pathname.split('/').filter(Boolean);
    const last = parts[parts.length - 1];
    return TABS.some((t) => t.id === last) ? last : 'empresa';
  }, [location.pathname]);

  const activeTabData = useMemo(() => {
    return TABS.find((t) => t.id === activeTab) || TABS[0];
  }, [activeTab]);

  const renderContent = () => {
    switch (activeTab) {
      case 'empresa':
        return <EmpresaSection />;
      case 'sedes':
        return <SedesSection />;
      case 'facturacion':
        return <FacturacionSection />;
      case 'pagos':
        return <PagosSection />;
      case 'envios':
        return <EnviosSection />;
      case 'correo':
        return <CorreoSection />;
      case 'login-admin':
        return <LoginAdminSection />;
      case 'panel-admin':
        return <PanelAdminSection />;
      case 'usuarios':
        return <UsuariosSection />;
      case 'perfiles':
        return <PerfilesSection />;
      case 'logs':
        return <LogsSection />;
      default:
        return <EmpresaSection />;
    }
  };

  const ActiveIcon = activeTabData.icon || Settings2;

  return (
    <div className="mx-auto max-w-7xl p-3 md:p-5">

      {/* 🔥 HERO MEJORADO */}
      <div
        className="mb-5 overflow-hidden rounded-[32px] border p-5 shadow-sm backdrop-blur-2xl md:p-6 relative"
        style={{
          background: 'linear-gradient(135deg, rgba(255,255,255,0.25), rgba(255,255,255,0.05))',
          borderColor: 'var(--admin-glass-border)',
          backdropFilter: 'blur(28px)',
          boxShadow: '0 25px 70px rgba(0,0,0,0.08)',
        }}
      >

        {/* ✨ capa de profundidad */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'radial-gradient(circle at 20% 30%, rgba(255,255,255,0.35), transparent 60%)',
            opacity: 0.4,
            pointerEvents: 'none',
          }}
        />

        <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between relative z-10">
          <div>
            <div
              className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold"
              style={{
                backgroundColor: 'var(--admin-primary-soft-bg)',
                color: 'var(--admin-primary-soft-text)',
                border: '1px solid var(--admin-primary-soft-border)',
              }}
            >
              <Settings2 className="h-4 w-4" />
              Configuración
            </div>

            <h1
              className="mt-3 text-2xl font-bold tracking-tight md:text-3xl"
              style={{ color: 'var(--admin-card-text)' }}
            >
              Centro de configuración interna
            </h1>

            <p
              className="mt-2 max-w-3xl text-sm leading-6"
              style={{ color: 'var(--admin-card-muted-text)' }}
            >
              Configura tienda, sedes, facturación, pagos, envíos, correo,
              usuarios, perfiles, seguridad, logs y comportamiento del sistema.
            </p>
          </div>

          <div
            className="rounded-[22px] border px-4 py-3 backdrop-blur-xl"
            style={{
              backgroundColor: 'rgba(255,255,255,0.15)',
              borderColor: 'var(--admin-primary-soft-border)',
            }}
          >
            <div className="flex items-center gap-3">
              <div
                className="flex h-11 w-11 items-center justify-center rounded-2xl shadow-sm"
                style={{
                  backgroundColor: 'var(--admin-card-bg)',
                  color: 'var(--admin-primary)',
                }}
              >
                <ActiveIcon className="h-5 w-5" />
              </div>

              <div>
                <p
                  className="text-xs font-semibold uppercase tracking-wide"
                  style={{ color: 'var(--admin-primary)' }}
                >
                  Sección activa
                </p>
                <p
                  className="text-sm font-semibold"
                  style={{ color: 'var(--admin-card-text)' }}
                >
                  {activeTabData.label}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <section>

        {/* 🔥 BARRA (YA NO TARJETA REPETIDA) */}
        <div
          className="mb-4 rounded-[20px] border px-5 py-3 backdrop-blur-xl flex items-center gap-4"
          style={{
            background: 'rgba(255,255,255,0.12)',
            borderColor: 'var(--admin-glass-border)',
          }}
        >
          <div className="w-1 h-10 bg-pink-500 rounded-full" />

          <div>
            <h2
              className="text-lg font-semibold"
              style={{ color: 'var(--admin-card-text)' }}
            >
              {activeTabData.label}
            </h2>

            <p
              className="text-sm"
              style={{ color: 'var(--admin-card-muted-text)' }}
            >
              {activeTabData.description}
            </p>
          </div>
        </div>

        {renderContent()}
      </section>
    </div>
  );
}