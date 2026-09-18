import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Check,
  Clipboard,
  Download,
  KeyRound,
  Loader2,
  RefreshCw,
  ShieldCheck,
  ShieldOff,
  Smartphone,
} from 'lucide-react';
import {
  confirmAdminTwoFactorSetup,
  disableAdminTwoFactor,
  getAdminTwoFactorStatus,
  regenerateAdminRecoveryCodes,
  startAdminTwoFactorSetup,
} from '../../api/adminAuthApi';

const EMPTY_STATUS = {
  enabled: false,
  enabledAt: null,
  lastUsedAt: null,
  recoveryCodesRemaining: 0,
  setupPending: false,
};

function formatDate(value) {
  if (!value) return 'Sin registro';
  return new Date(value).toLocaleString('es-CO');
}

function RecoveryCodes({ codes }) {
  const [copied, setCopied] = useState(false);
  if (!codes.length) return null;

  const copyCodes = async () => {
    await navigator.clipboard.writeText(codes.join('\n'));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  const downloadCodes = () => {
    const content = [
      'Códigos de recuperación del panel administrativo',
      'Cada código funciona una sola vez. Guárdalos en un lugar seguro.',
      '',
      ...codes,
    ].join('\n');
    const url = URL.createObjectURL(new Blob([content], { type: 'text/plain' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'codigos-recuperacion-admin.txt';
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="rounded-[24px] border border-amber-300 bg-amber-50 p-5 text-amber-950">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 shrink-0" size={20} />
        <div>
          <h3 className="font-black">Guarda estos códigos ahora</h3>
          <p className="mt-1 text-sm leading-6">
            Solo se muestran una vez. Cada código reemplaza temporalmente a la
            aplicación de autenticación y se invalida después de usarlo.
          </p>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 rounded-2xl bg-white/80 p-4 font-mono text-sm font-bold sm:grid-cols-5">
        {codes.map((code) => <span key={code}>{code}</span>)}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" onClick={copyCodes} className="inline-flex items-center gap-2 rounded-xl bg-amber-900 px-4 py-2 text-sm font-bold text-white">
          {copied ? <Check size={16} /> : <Clipboard size={16} />}
          {copied ? 'Copiados' : 'Copiar códigos'}
        </button>
        <button type="button" onClick={downloadCodes} className="inline-flex items-center gap-2 rounded-xl border border-amber-400 px-4 py-2 text-sm font-bold">
          <Download size={16} /> Descargar
        </button>
      </div>
    </div>
  );
}

export default function SeguridadSection() {
  const [status, setStatus] = useState(EMPTY_STATUS);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [setup, setSetup] = useState(null);
  const [setupPassword, setSetupPassword] = useState('');
  const [setupCode, setSetupCode] = useState('');
  const [action, setAction] = useState('');
  const [actionPassword, setActionPassword] = useState('');
  const [actionCode, setActionCode] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState([]);

  const loadStatus = async () => {
    try {
      setLoading(true);
      const response = await getAdminTwoFactorStatus();
      setStatus({ ...EMPTY_STATUS, ...response.twoFactor });
    } catch (error) {
      setFeedback({ type: 'error', text: error.userMessage });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadStatus();
  }, []);

  const beginSetup = async (event) => {
    event.preventDefault();
    try {
      setBusy(true);
      setFeedback(null);
      setRecoveryCodes([]);
      const response = await startAdminTwoFactorSetup(setupPassword);
      setSetup(response.setup);
      setSetupPassword('');
    } catch (error) {
      setFeedback({ type: 'error', text: error.userMessage });
    } finally {
      setBusy(false);
    }
  };

  const confirmSetup = async (event) => {
    event.preventDefault();
    try {
      setBusy(true);
      setFeedback(null);
      const response = await confirmAdminTwoFactorSetup(setupCode);
      setRecoveryCodes(response.recoveryCodes || []);
      setStatus((current) => ({
        ...current,
        ...response.twoFactor,
        lastUsedAt: new Date().toISOString(),
        setupPending: false,
      }));
      setSetup(null);
      setSetupCode('');
      setFeedback({ type: 'success', text: response.message });
    } catch (error) {
      setFeedback({ type: 'error', text: error.userMessage });
      if (error?.response?.data?.setupExpired) setSetup(null);
    } finally {
      setBusy(false);
    }
  };

  const submitProtectedAction = async (event) => {
    event.preventDefault();
    if (!action) return;
    try {
      setBusy(true);
      setFeedback(null);
      const payload = { currentPassword: actionPassword, code: actionCode };
      const response = action === 'disable'
        ? await disableAdminTwoFactor(payload)
        : await regenerateAdminRecoveryCodes(payload);

      if (action === 'disable') {
        setStatus(EMPTY_STATUS);
        setRecoveryCodes([]);
      } else {
        setRecoveryCodes(response.recoveryCodes || []);
        setStatus((current) => ({
          ...current,
          recoveryCodesRemaining: response.recoveryCodes?.length || 0,
        }));
      }
      setAction('');
      setActionPassword('');
      setActionCode('');
      setFeedback({ type: 'success', text: response.message });
    } catch (error) {
      setFeedback({ type: 'error', text: error.userMessage });
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return <div className="flex min-h-64 items-center justify-center"><Loader2 className="animate-spin" /></div>;
  }

  return (
    <div className="grid gap-5">
      {feedback ? (
        <div className={`rounded-2xl border px-4 py-3 text-sm font-semibold ${feedback.type === 'error' ? 'border-rose-300 bg-rose-50 text-rose-800' : 'border-emerald-300 bg-emerald-50 text-emerald-800'}`} role="status">
          {feedback.text}
        </div>
      ) : null}

      <section className="overflow-hidden rounded-[28px] border p-5 md:p-6" style={{ background: 'var(--admin-card-bg)', borderColor: 'var(--admin-glass-border)', color: 'var(--admin-card-text)' }}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-4">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl" style={{ background: 'var(--admin-primary-soft-bg)', color: 'var(--admin-primary)' }}>
              {status.enabled ? <ShieldCheck /> : <ShieldOff />}
            </span>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] opacity-60">Seguridad personal</p>
              <h2 className="mt-1 text-2xl font-black">Autenticación en dos pasos</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 opacity-70">
                Protege tu usuario con una aplicación TOTP. La sesión administrativa
                solo se crea después de validar la contraseña y el segundo factor.
              </p>
            </div>
          </div>
          <span className={`rounded-full px-3 py-1.5 text-xs font-black ${status.enabled ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'}`}>
            {status.enabled ? 'ACTIVO' : 'INACTIVO'}
          </span>
        </div>

        {status.enabled ? (
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border p-4" style={{ borderColor: 'var(--admin-glass-border)' }}><small className="opacity-60">Activado</small><p className="mt-1 text-sm font-bold">{formatDate(status.enabledAt)}</p></div>
            <div className="rounded-2xl border p-4" style={{ borderColor: 'var(--admin-glass-border)' }}><small className="opacity-60">Último uso</small><p className="mt-1 text-sm font-bold">{formatDate(status.lastUsedAt)}</p></div>
            <div className="rounded-2xl border p-4" style={{ borderColor: 'var(--admin-glass-border)' }}><small className="opacity-60">Códigos disponibles</small><p className="mt-1 text-sm font-bold">{status.recoveryCodesRemaining}</p></div>
          </div>
        ) : null}
      </section>

      <RecoveryCodes codes={recoveryCodes} />

      {!status.enabled ? (
        <section className="rounded-[28px] border p-5 md:p-6" style={{ background: 'var(--admin-card-bg)', borderColor: 'var(--admin-glass-border)', color: 'var(--admin-card-text)' }}>
          {!setup ? (
            <form onSubmit={beginSetup} className="grid max-w-xl gap-4">
              <div className="flex items-center gap-3"><Smartphone /><div><h3 className="font-black">Vincula tu aplicación</h3><p className="text-sm opacity-65">Confirma primero tu contraseña actual.</p></div></div>
              <input type="password" value={setupPassword} onChange={(event) => setSetupPassword(event.target.value)} placeholder="Contraseña actual" autoComplete="current-password" required disabled={busy} className="rounded-2xl border px-4 py-3 outline-none" style={{ background: 'var(--admin-input-bg)', borderColor: 'var(--admin-input-border)', color: 'var(--admin-input-text)' }} />
              <button disabled={busy} className="inline-flex w-fit items-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white disabled:opacity-60">{busy ? <Loader2 className="animate-spin" size={17} /> : <KeyRound size={17} />} Configurar 2FA</button>
            </form>
          ) : (
            <form onSubmit={confirmSetup} className="grid gap-5 md:grid-cols-[300px_1fr]">
              <div className="rounded-3xl bg-white p-3"><img src={setup.qrCodeDataUrl} alt="Código QR para configurar autenticación en dos pasos" className="w-full" /></div>
              <div className="grid content-start gap-4">
                <div><h3 className="text-xl font-black">Escanea el código QR</h3><p className="mt-1 text-sm leading-6 opacity-70">Usa Google Authenticator, Microsoft Authenticator, Authy o cualquier aplicación TOTP.</p></div>
                <div className="rounded-2xl border p-3 text-sm" style={{ borderColor: 'var(--admin-glass-border)' }}><small className="opacity-60">Clave manual</small><p className="mt-1 break-all font-mono font-bold tracking-wider">{setup.manualSecret}</p></div>
                <input value={setupCode} onChange={(event) => setSetupCode(event.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" placeholder="Código de 6 dígitos" required disabled={busy} className="rounded-2xl border px-4 py-3 text-center text-lg font-black tracking-[0.2em] outline-none" style={{ background: 'var(--admin-input-bg)', borderColor: 'var(--admin-input-border)', color: 'var(--admin-input-text)' }} />
                <button disabled={busy} className="inline-flex w-fit items-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white disabled:opacity-60">{busy ? <Loader2 className="animate-spin" size={17} /> : <ShieldCheck size={17} />} Confirmar y activar</button>
              </div>
            </form>
          )}
        </section>
      ) : (
        <section className="rounded-[28px] border p-5 md:p-6" style={{ background: 'var(--admin-card-bg)', borderColor: 'var(--admin-glass-border)', color: 'var(--admin-card-text)' }}>
          {!action ? (
            <div className="flex flex-wrap gap-3">
              <button type="button" onClick={() => setAction('regenerate')} className="inline-flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm font-black" style={{ borderColor: 'var(--admin-glass-border)' }}><RefreshCw size={17} /> Regenerar códigos</button>
              <button type="button" onClick={() => setAction('disable')} className="inline-flex items-center gap-2 rounded-2xl border border-rose-300 px-4 py-3 text-sm font-black text-rose-700"><ShieldOff size={17} /> Desactivar 2FA</button>
            </div>
          ) : (
            <form onSubmit={submitProtectedAction} className="grid max-w-xl gap-4">
              <div><h3 className="font-black">{action === 'disable' ? 'Desactivar segundo factor' : 'Crear códigos nuevos'}</h3><p className="mt-1 text-sm opacity-65">Confirma tu contraseña y un código TOTP o de recuperación. Las demás sesiones se revocarán.</p></div>
              <input type="password" value={actionPassword} onChange={(event) => setActionPassword(event.target.value)} placeholder="Contraseña actual" autoComplete="current-password" required disabled={busy} className="rounded-2xl border px-4 py-3 outline-none" style={{ background: 'var(--admin-input-bg)', borderColor: 'var(--admin-input-border)', color: 'var(--admin-input-text)' }} />
              <input value={actionCode} onChange={(event) => setActionCode(event.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 11))} placeholder="Código TOTP o de recuperación" autoComplete="one-time-code" required disabled={busy} className="rounded-2xl border px-4 py-3 outline-none" style={{ background: 'var(--admin-input-bg)', borderColor: 'var(--admin-input-border)', color: 'var(--admin-input-text)' }} />
              <div className="flex flex-wrap gap-2"><button disabled={busy} className={`inline-flex items-center gap-2 rounded-2xl px-5 py-3 text-sm font-black text-white disabled:opacity-60 ${action === 'disable' ? 'bg-rose-700' : 'bg-slate-950'}`}>{busy ? <Loader2 className="animate-spin" size={17} /> : <Check size={17} />} Confirmar</button><button type="button" onClick={() => setAction('')} disabled={busy} className="rounded-2xl border px-5 py-3 text-sm font-bold" style={{ borderColor: 'var(--admin-glass-border)' }}>Cancelar</button></div>
            </form>
          )}
        </section>
      )}
    </div>
  );
}
