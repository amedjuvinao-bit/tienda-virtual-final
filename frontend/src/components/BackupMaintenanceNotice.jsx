import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { API_BASE_URL } from '../config/apiBaseUrl';
import api from '../lib/api';

export default function BackupMaintenanceNotice({ adminPanelReady = false }) {
  const { pathname } = useLocation();
  const [status, setStatus] = useState(null);
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [reopening, setReopening] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    const check = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/backup-maintenance/status`, { cache: 'no-store' });
        if (!response.ok) return;
        const result = await response.json();
        if (mounted) setStatus(result);
      } catch { /* Conservar el último estado conocido mientras no responde la API. */ }
    };
    check();
    const timer = window.setInterval(check, 5000);
    return () => { mounted = false; window.clearInterval(timer); };
  }, []);

  async function reopen(event) {
    event.preventDefault();
    setReopening(true);
    setError('');
    try {
      const { data } = await api.post('/api/admin/backup-preferences/recover', {
        currentPassword: password, twoFactorCode: code,
      }, { skipAdminRefresh: true });
      setStatus(data);
    } catch (failure) {
      setError(failure?.response?.data?.message || 'No se pudo reabrir. Verifica tu sesión y pide revisar el servidor.');
    } finally {
      setPassword(''); setCode(''); setReopening(false);
    }
  }

  if (!status?.maintenance || (pathname === '/admin/configuracion/respaldos' && adminPanelReady)) return null;

  return <div role="status" className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-950 p-6 text-center text-white">
    <div className="max-w-md rounded-3xl border border-white/20 bg-white/10 p-8 shadow-2xl">
      <h1 className="text-2xl font-bold">Tienda en mantenimiento</h1>
      <p className="mt-4 text-base text-white/80">Estamos protegiendo y comprobando una copia de los datos. La tienda volverá a estar disponible al terminar.</p>
      {status.phase === 'requiere_revision' && <p className="mt-4 text-sm text-amber-200">El servidor se interrumpió. La tienda seguirá pausada hasta revisar el resultado.</p>}
      {pathname.startsWith('/admin') && status.recoverable && <form onSubmit={reopen} className="mt-5 space-y-3 text-left">
        <p>Si ya revisaste el resultado, confirma la reapertura con tu sesión de propietario.</p>
        <label className="block">Contraseña del propietario<input type="password" required autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} className="mt-1 w-full rounded-lg p-2 text-slate-950" /></label>
        <label className="block">Código de 6 dígitos<input inputMode="numeric" pattern="[0-9]{6}" required value={code} onChange={(event) => setCode(event.target.value)} className="mt-1 w-full rounded-lg p-2 text-slate-950" /></label>
        {error && <p role="alert" className="text-red-200">{error}</p>}
        <button type="submit" disabled={reopening} className="rounded-lg bg-white px-4 py-2 font-semibold text-slate-950 disabled:opacity-50">{reopening ? 'Reabriendo…' : 'Reabrir tienda'}</button>
      </form>}
      <p className="mt-4 text-sm text-white/60">Esta página se actualizará automáticamente.</p>
    </div>
  </div>;
}
