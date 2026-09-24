// src/admin/ConfiguracionPage.jsx
import React, { useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { Store, CreditCard, Truck, Mail, ShieldCheck, LayoutPanelTop, Users, IdCard, FileSearch, Building2, Fingerprint } from 'lucide-react';

// 🔹 IMPORTS MODULARES
import EmpresaSection from './configuracion/sections/EmpresaSection';
import PagosSection from './configuracion/sections/PagosSection';
import EnviosSection from './configuracion/sections/EnviosSection';
import CorreoSection from './configuracion/sections/CorreoSection';
import LoginAdminSection from './configuracion/sections/LoginAdminSection';
import PanelAdminSection from './configuracion/sections/PanelAdminSection';
import UsuariosSection from './configuracion/sections/UsuariosSection';
import PerfilesSection from './configuracion/sections/PerfilesSection';
import LogsSection from './configuracion/sections/LogsSection';
import SedesSection from './configuracion/sections/SedesSection';
import SeguridadSection from './configuracion/sections/SeguridadSection';

// 🔹 CONFIG CENTRAL DE TABS
const TABS = [
  {
    id: 'empresa',
    label: 'Tienda',
    icon: Store,
    description: 'Identidad comercial, contacto y operación principal de la tienda.',
  },
  {
    id: 'sedes',
    label: 'Sedes',
    icon: Building2,
    description: 'Gestión de sedes, bodegas, puntos de venta y puntos de recogida.',
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
    id: 'seguridad',
    label: 'Seguridad',
    icon: Fingerprint,
    description: '2FA, sesiones, dispositivos, alertas e historial de acceso.',
  },
  {
    id: 'logs',
    label: 'Logs',
    icon: FileSearch,
    description: 'Registro de accesos y operaciones protegidas del panel administrativo.',
  },
];

export default function ConfiguracionPage() {
  const location = useLocation();

  const activeTab = useMemo(() => {
    const parts = location.pathname.split('/').filter(Boolean);
    const last = parts[parts.length - 1];
    return TABS.some((t) => t.id === last) ? last : 'empresa';
  }, [location.pathname]);

  const renderContent = () => {
    switch (activeTab) {
      case 'empresa':
        return <EmpresaSection />;
      case 'sedes':
        return <SedesSection />;
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
      case 'seguridad':
        return <SeguridadSection />;
      case 'logs':
        return <LogsSection />;
      default:
        return <EmpresaSection />;
    }
  };

  return (
    <div className="configuration-admin-page mx-auto max-w-7xl p-3 md:p-5">
      <section className="configuration-module-content">{renderContent()}</section>
    </div>
  );
}
