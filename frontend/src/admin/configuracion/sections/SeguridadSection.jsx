import { useEffect, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  BellRing,
  Check,
  ChevronRight,
  Clipboard,
  Download,
  KeyRound,
  Laptop,
  LayoutDashboard,
  Loader2,
  LogOut,
  MonitorSmartphone,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  ShieldOff,
  Smartphone,
} from 'lucide-react';
import {
  confirmAdminTwoFactorReconfiguration,
  confirmAdminTwoFactorSetup,
  disableAdminTwoFactor,
  getAdminSecurityCenter,
  getAdminTwoFactorStatus,
  regenerateAdminRecoveryCodes,
  respondAdminSecurityAlert,
  reviewAdminSecurityAlert,
  revokeAllAdminSessions,
  revokeAdminSession,
  revokeOtherAdminSessions,
  startAdminTwoFactorReconfiguration,
  startAdminTwoFactorSetup,
} from '../../api/adminAuthApi';

const EMPTY_STATUS = {
  enabled: false,
  enabledAt: null,
  lastUsedAt: null,
  recoveryCodesRemaining: 0,
  setupPending: false,
  required: false,
  compliant: true,
  requiredRoles: [],
  configuredRequired: false,
  enforcementReady: true,
  misconfigured: false,
  canSelfActivate: false,
  canSelfDisable: false,
  managedByOwner: false,
};

const EMPTY_SECURITY = {
  policy: {},
  summary: {
    activeSessions: 0,
    knownDevices: 0,
    failedAttempts24Hours: 0,
    pendingAlerts: 0,
  },
  sessions: [],
  alerts: [],
  activity: [],
};

const SECURITY_VIEWS = [
  { id: 'overview', label: 'Resumen', description: 'Estado general', icon: LayoutDashboard },
  { id: 'twoFactor', label: 'Autenticación', description: 'Aplicación y códigos', icon: ShieldCheck },
  { id: 'sessions', label: 'Sesiones', description: 'Dispositivos conectados', icon: MonitorSmartphone },
  { id: 'alerts', label: 'Alertas', description: 'Riesgos y actividad', icon: BellRing },
];

function formatDate(value) {
  if (!value) return 'Sin registro';
  return new Date(value).toLocaleString('es-CO');
}

function statusText(status) {
  if (status === 'active') return 'Activa';
  if (status === 'revoked') return 'Cerrada';
  return 'Expirada';
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

function SecuritySummary({ summary }) {
  const cards = [
    ['Sesiones activas', summary.activeSessions, MonitorSmartphone],
    ['Dispositivos conocidos', summary.knownDevices, Laptop],
    ['Fallos en 24 horas', summary.failedAttempts24Hours, ShieldAlert],
    ['Alertas por revisar', summary.pendingAlerts, AlertTriangle],
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map(([label, value, Icon]) => (
        <article key={label} className="rounded-[22px] border p-4" style={{ background: 'var(--admin-card-bg)', borderColor: 'var(--admin-glass-border)', color: 'var(--admin-card-text)' }}>
          <div className="flex items-center justify-between gap-3">
            <div><p className="text-xs font-bold uppercase tracking-wide opacity-55">{label}</p><strong className="mt-2 block text-2xl">{value || 0}</strong></div>
            <span className="grid h-10 w-10 place-items-center rounded-2xl" style={{ background: 'var(--admin-primary-soft-bg)', color: 'var(--admin-primary)' }}><Icon size={19} /></span>
          </div>
        </article>
      ))}
    </div>
  );
}

function SecurityNavigation({ activeView, onChange, pendingAlerts }) {
  return (
    <nav
      aria-label="Secciones del centro de seguridad"
      className="grid gap-2 rounded-[26px] border p-2 sm:grid-cols-2 xl:grid-cols-4"
      style={{
        background: 'color-mix(in srgb, var(--admin-card-bg) 88%, transparent)',
        borderColor: 'var(--admin-glass-border)',
      }}
    >
      {SECURITY_VIEWS.map(({ id, label, description, icon: Icon }) => {
        const selected = activeView === id;
        return (
          <button
            key={id}
            type="button"
            aria-current={selected ? 'page' : undefined}
            onClick={() => onChange(id)}
            className={`flex min-h-[64px] items-center gap-3 rounded-[20px] px-4 py-3 text-left transition ${selected ? 'shadow-sm' : 'hover:bg-white/45'}`}
            style={selected ? {
              background: 'var(--admin-primary-soft-bg)',
              color: 'var(--admin-card-text)',
            } : { color: 'var(--admin-card-text)' }}
          >
            <span
              className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl"
              style={{
                background: selected ? 'var(--admin-primary)' : 'var(--admin-card-bg)',
                color: selected ? '#fff' : 'var(--admin-primary)',
              }}
            >
              <Icon size={18} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2 text-sm font-black">
                {label}
                {id === 'alerts' && pendingAlerts > 0 ? (
                  <span className="grid min-w-5 place-items-center rounded-full bg-rose-600 px-1.5 py-0.5 text-[10px] text-white">
                    {pendingAlerts}
                  </span>
                ) : null}
              </span>
              <span className="mt-0.5 block truncate text-xs opacity-60">{description}</span>
            </span>
          </button>
        );
      })}
    </nav>
  );
}

function SecurityOverview({ status, security, onNavigate }) {
  const summary = security.summary || EMPTY_SECURITY.summary;
  const overviewCards = [
    {
      id: 'twoFactor',
      icon: status.enabled ? ShieldCheck : ShieldAlert,
      eyebrow: 'Protección de la cuenta',
      title: status.enabled ? 'Segundo factor activo' : 'Segundo factor pendiente',
      detail: status.enabled
        ? `${status.recoveryCodesRemaining || 0} códigos de recuperación disponibles.`
        : 'Configura una aplicación autenticadora para reforzar el acceso.',
      action: status.enabled ? 'Administrar 2FA' : 'Configurar 2FA',
      tone: status.enabled ? 'emerald' : 'amber',
    },
    {
      id: 'sessions',
      icon: MonitorSmartphone,
      eyebrow: 'Accesos abiertos',
      title: `${summary.activeSessions || 0} sesiones activas`,
      detail: `${summary.knownDevices || 0} dispositivos reconocidos por el sistema.`,
      action: 'Revisar sesiones',
      tone: 'slate',
    },
    {
      id: 'alerts',
      icon: summary.pendingAlerts > 0 ? ShieldAlert : ShieldCheck,
      eyebrow: 'Vigilancia',
      title: summary.pendingAlerts > 0
        ? `${summary.pendingAlerts} alertas requieren atención`
        : 'Sin alertas pendientes',
      detail: `${summary.failedAttempts24Hours || 0} accesos fallidos durante las últimas 24 horas.`,
      action: 'Ver alertas y actividad',
      tone: summary.pendingAlerts > 0 ? 'rose' : 'emerald',
    },
  ];

  const toneClasses = {
    amber: 'border-amber-200 bg-amber-50/75 text-amber-950',
    emerald: 'border-emerald-200 bg-emerald-50/75 text-emerald-950',
    rose: 'border-rose-200 bg-rose-50/75 text-rose-950',
    slate: 'border-slate-200 bg-slate-50/75 text-slate-950',
  };

  return (
    <div className="grid gap-5">
      <div>
        <p className="text-xs font-black uppercase tracking-[0.18em] opacity-55">Vista general</p>
        <h2 className="mt-1 text-2xl font-black">Tu seguridad, en un solo vistazo</h2>
        <p className="mt-1 text-sm opacity-65">Revisa el estado y entra únicamente a la tarea que necesitas realizar.</p>
      </div>
      <SecuritySummary summary={summary} />
      <div className="grid gap-4 xl:grid-cols-3">
        {overviewCards.map(({ id, icon: Icon, eyebrow, title, detail, action, tone }) => (
          <article key={id} className={`flex min-h-[205px] flex-col rounded-[26px] border p-5 ${toneClasses[tone]}`}>
            <div className="flex items-start justify-between gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-white/75"><Icon size={20} /></span>
              <span className="text-[10px] font-black uppercase tracking-[0.16em] opacity-55">{eyebrow}</span>
            </div>
            <h3 className="mt-5 text-lg font-black">{title}</h3>
            <p className="mt-1 text-sm leading-6 opacity-70">{detail}</p>
            <button type="button" onClick={() => onNavigate(id)} className="mt-auto flex items-center justify-between pt-5 text-sm font-black">
              {action} <ChevronRight size={17} />
            </button>
          </article>
        ))}
      </div>
    </div>
  );
}

function SessionList({ sessions, busy, onRevoke, onRevokeAll, onRevokeOthers }) {
  const [filter, setFilter] = useState('active');
  const [visibleCount, setVisibleCount] = useState(5);
  const activeSessions = sessions.filter((session) => session.active);
  const otherActiveSessions = activeSessions.filter((session) => !session.isCurrent);
  const historicalSessions = sessions.filter((session) => !session.active);
  const filteredSessions = filter === 'active' ? activeSessions : historicalSessions;
  const visibleSessions = filteredSessions.slice(0, visibleCount);

  const changeFilter = (nextFilter) => {
    setFilter(nextFilter);
    setVisibleCount(5);
  };

  return (
    <section className="rounded-[28px] border p-5 md:p-6" style={{ background: 'var(--admin-card-bg)', borderColor: 'var(--admin-glass-border)', color: 'var(--admin-card-text)' }}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div><p className="text-xs font-black uppercase tracking-[0.18em] opacity-55">Control de acceso</p><h2 className="mt-1 text-xl font-black">Sesiones y dispositivos</h2><p className="mt-1 text-sm opacity-65">Reconoce dónde está abierta tu cuenta y cierra cualquier acceso que no identifiques.</p></div>
        <div className="flex flex-wrap gap-2">{otherActiveSessions.length ? <button type="button" onClick={onRevokeOthers} disabled={busy} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-rose-300 px-4 py-2.5 text-sm font-black text-rose-700 disabled:opacity-50"><LogOut size={16} /> Cerrar las demás</button> : null}{activeSessions.length ? <button type="button" onClick={onRevokeAll} disabled={busy} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-rose-700 px-4 py-2.5 text-sm font-black text-white disabled:opacity-50"><ShieldOff size={16} /> Cerrar todas</button> : null}</div>
      </div>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-b pb-4" style={{ borderColor: 'var(--admin-glass-border)' }}>
        <div className="inline-flex rounded-2xl p-1" style={{ background: 'var(--admin-primary-soft-bg)' }}>
          <button type="button" onClick={() => changeFilter('active')} className={`rounded-xl px-4 py-2 text-xs font-black ${filter === 'active' ? 'bg-white shadow-sm' : 'opacity-60'}`}>Activas ({activeSessions.length})</button>
          <button type="button" onClick={() => changeFilter('history')} className={`rounded-xl px-4 py-2 text-xs font-black ${filter === 'history' ? 'bg-white shadow-sm' : 'opacity-60'}`}>Historial ({historicalSessions.length})</button>
        </div>
        <p className="text-xs opacity-55">Mostrando {Math.min(visibleCount, filteredSessions.length)} de {filteredSessions.length}</p>
      </div>
      <div className="mt-4 grid gap-2">
        {filteredSessions.length === 0 ? <p className="rounded-2xl border border-dashed p-5 text-sm opacity-65">{filter === 'active' ? 'No hay sesiones activas.' : 'Todavía no existe historial de sesiones.'}</p> : visibleSessions.map((session) => (
          <article key={session.id} className={`rounded-[20px] border p-3.5 ${session.isCurrent ? 'border-emerald-300 bg-emerald-50/60' : ''}`} style={!session.isCurrent ? { borderColor: 'var(--admin-glass-border)' } : undefined}>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-slate-100 text-slate-700">{session.device?.type === 'Teléfono' ? <Smartphone size={18} /> : <Laptop size={18} />}</span>
                <div><div className="flex flex-wrap items-center gap-2"><strong className="text-sm">{session.device?.label || 'Dispositivo desconocido'}</strong>{session.isCurrent ? <span className="rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-black text-emerald-800">ESTA SESIÓN</span> : null}<span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-700">{statusText(session.status)}</span></div><p className="mt-1 text-xs opacity-65">IP {session.ip || 'no disponible'} · Última actividad {formatDate(session.lastSeenAt)}</p>{filter === 'history' ? <p className="mt-1 text-xs opacity-55">Creada {formatDate(session.createdAt)} · Venció {formatDate(session.expiresAt)}</p> : null}</div>
              </div>
              {session.active && !session.isCurrent ? <button type="button" disabled={busy} onClick={() => onRevoke(session)} className="inline-flex items-center justify-center gap-2 rounded-xl border border-rose-300 px-3 py-2 text-xs font-black text-rose-700 disabled:opacity-50"><LogOut size={14} /> Cerrar sesión</button> : null}
            </div>
          </article>
        ))}
        {visibleCount < filteredSessions.length ? <button type="button" onClick={() => setVisibleCount((count) => count + 5)} className="mt-2 rounded-2xl border px-4 py-3 text-sm font-black" style={{ borderColor: 'var(--admin-glass-border)' }}>Ver {Math.min(5, filteredSessions.length - visibleCount)} más</button> : null}
      </div>
    </section>
  );
}

function alertActionLabel(action) {
  if (action === 'revoke_session') return 'Cerrar sesión';
  if (action === 'revoke_all') return 'Cerrar todas';
  if (action === 'block_user') return 'Bloquear usuario';
  return 'Resolver';
}

function AlertsAndActivity({ alerts, activity, busy, onReview, onRespond }) {
  const [alertFilter, setAlertFilter] = useState('pending');
  const [visibleAlerts, setVisibleAlerts] = useState(5);
  const [visibleActivity, setVisibleActivity] = useState(6);
  const pendingAlerts = alerts.filter((alert) => alert.status !== 'resolved');
  const filteredAlerts = alertFilter === 'pending' ? pendingAlerts : alerts;

  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <section className="rounded-[28px] border p-5 md:p-6" style={{ background: 'var(--admin-card-bg)', borderColor: 'var(--admin-glass-border)', color: 'var(--admin-card-text)' }}>
        <div className="flex items-center gap-3"><AlertTriangle /><div><h2 className="font-black">Alertas de seguridad</h2><p className="text-sm opacity-60">Dispositivos nuevos, cambios de red y accesos rechazados.</p></div></div>
        <div className="mt-4 inline-flex rounded-2xl p-1" style={{ background: 'var(--admin-primary-soft-bg)' }}>
          <button type="button" onClick={() => { setAlertFilter('pending'); setVisibleAlerts(5); }} className={`rounded-xl px-4 py-2 text-xs font-black ${alertFilter === 'pending' ? 'bg-white shadow-sm' : 'opacity-60'}`}>Por atender ({pendingAlerts.length})</button>
          <button type="button" onClick={() => { setAlertFilter('all'); setVisibleAlerts(5); }} className={`rounded-xl px-4 py-2 text-xs font-black ${alertFilter === 'all' ? 'bg-white shadow-sm' : 'opacity-60'}`}>Todas ({alerts.length})</button>
        </div>
        <div className="mt-4 grid gap-3">
          {filteredAlerts.length === 0 ? <p className="rounded-2xl bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">{alertFilter === 'pending' ? 'No hay alertas pendientes.' : 'No hay alertas recientes.'}</p> : filteredAlerts.slice(0, visibleAlerts).map((alert) => {
            const actions = alert.availableActions || [];
            const closed = alert.status === 'resolved';
            return <article key={alert.id} className={`rounded-2xl border p-4 ${closed ? 'border-slate-200 bg-slate-50 text-slate-700' : alert.severity === 'high' || alert.severity === 'critical' ? 'border-rose-300 bg-rose-50 text-rose-900' : 'border-amber-300 bg-amber-50 text-amber-950'}`}>
              <div className="flex items-start justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2"><strong className="text-sm">{alert.title}</strong><span className="rounded-full bg-white/70 px-2 py-1 text-[9px] font-black uppercase">{alert.status === 'open' ? 'Pendiente' : alert.status === 'reviewed' ? 'Revisada' : 'Resuelta'}</span>{alert.occurrenceCount > 1 ? <span className="rounded-full bg-white/70 px-2 py-1 text-[9px] font-black">{alert.occurrenceCount} eventos</span> : null}</div><p className="mt-1 text-xs leading-5 opacity-75">{alert.detail}</p><p className="mt-1 text-[11px] opacity-60">Usuario: {alert.username || 'no identificado'}{alert.ip ? ` · IP ${alert.ip}` : ''}</p></div><small className="shrink-0 text-[10px] opacity-60">{formatDate(alert.occurredAt)}</small></div>
              {actions.length ? <div className="mt-3 flex flex-wrap gap-2">{actions.includes('review') ? <button type="button" disabled={busy} onClick={() => onReview(alert)} className="rounded-xl border border-current/25 bg-white/70 px-3 py-2 text-xs font-black disabled:opacity-50">Marcar revisada</button> : null}{actions.filter((item) => item !== 'review').map((item) => <button key={item} type="button" disabled={busy} onClick={() => onRespond(alert, item)} className={`rounded-xl px-3 py-2 text-xs font-black disabled:opacity-50 ${item === 'block_user' ? 'bg-rose-700 text-white' : 'border border-current/25 bg-white/70'}`}>{alertActionLabel(item)}</button>)}</div> : null}
              {closed && alert.resolutionReason ? <p className="mt-3 rounded-xl bg-white/60 p-2 text-xs"><strong>Respuesta:</strong> {alertActionLabel(alert.resolutionAction)} · {alert.resolutionReason}</p> : null}
            </article>;
          })}
          {visibleAlerts < filteredAlerts.length ? <button type="button" onClick={() => setVisibleAlerts((count) => count + 5)} className="rounded-2xl border px-4 py-3 text-sm font-black" style={{ borderColor: 'var(--admin-glass-border)' }}>Ver más alertas</button> : null}
        </div>
      </section>
      <section className="rounded-[28px] border p-5 md:p-6" style={{ background: 'var(--admin-card-bg)', borderColor: 'var(--admin-glass-border)', color: 'var(--admin-card-text)' }}>
        <div className="flex items-center gap-3"><Activity /><div><h2 className="font-black">Actividad reciente</h2><p className="text-sm opacity-60">Historial personal de accesos y cambios de seguridad.</p></div></div>
        <div className="mt-4 grid gap-3">
          {activity.length === 0 ? <p className="rounded-2xl border border-dashed p-4 text-sm opacity-60">Aún no hay actividad registrada.</p> : activity.slice(0, visibleActivity).map((item) => <article key={item.id} className="rounded-2xl border p-3" style={{ borderColor: 'var(--admin-glass-border)' }}><div className="flex items-start justify-between gap-3"><div><strong className="text-sm">{item.title}</strong><p className="mt-1 text-xs opacity-65">{item.detail}{item.ip ? ` · IP ${item.ip}` : ''}</p></div><small className="shrink-0 text-[10px] opacity-55">{formatDate(item.occurredAt)}</small></div></article>)}
          {visibleActivity < activity.length ? <button type="button" onClick={() => setVisibleActivity((count) => count + 6)} className="rounded-2xl border px-4 py-3 text-sm font-black" style={{ borderColor: 'var(--admin-glass-border)' }}>Ver más actividad</button> : null}
        </div>
      </section>
    </div>
  );
}

export default function SeguridadSection() {
  const [activeView, setActiveView] = useState('overview');
  const [status, setStatus] = useState(EMPTY_STATUS);
  const [security, setSecurity] = useState(EMPTY_SECURITY);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [setup, setSetup] = useState(null);
  const [setupPassword, setSetupPassword] = useState('');
  const [setupCode, setSetupCode] = useState('');
  const [reconfiguration, setReconfiguration] = useState(null);
  const [reconfigurationCode, setReconfigurationCode] = useState('');
  const [action, setAction] = useState('');
  const [actionPassword, setActionPassword] = useState('');
  const [actionCode, setActionCode] = useState('');
  const [sessionAction, setSessionAction] = useState(null);
  const [sessionPassword, setSessionPassword] = useState('');
  const [sessionCode, setSessionCode] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState([]);
  const [alertAction, setAlertAction] = useState(null);
  const [alertReason, setAlertReason] = useState('');
  const [alertPassword, setAlertPassword] = useState('');
  const [alertCode, setAlertCode] = useState('');

  const loadSecurity = async ({ showLoader = true } = {}) => {
    try {
      if (showLoader) setLoading(true);
      const [statusResponse, centerResponse] = await Promise.all([
        getAdminTwoFactorStatus(),
        getAdminSecurityCenter(),
      ]);
      setStatus({ ...EMPTY_STATUS, ...statusResponse.twoFactor });
      setSecurity({ ...EMPTY_SECURITY, ...(centerResponse?.security || {}) });
    } catch (error) {
      setFeedback({ type: 'error', text: error.userMessage });
    } finally {
      if (showLoader) setLoading(false);
    }
  };

  useEffect(() => { void loadSecurity(); }, []);

  const beginSetup = async (event) => {
    event.preventDefault();
    try {
      setBusy(true); setFeedback(null); setRecoveryCodes([]);
      const response = await startAdminTwoFactorSetup(setupPassword);
      setSetup(response.setup); setSetupPassword('');
    } catch (error) { setFeedback({ type: 'error', text: error.userMessage }); }
    finally { setBusy(false); }
  };

  const confirmSetup = async (event) => {
    event.preventDefault();
    try {
      setBusy(true); setFeedback(null);
      const response = await confirmAdminTwoFactorSetup(setupCode);
      setRecoveryCodes(response.recoveryCodes || []);
      setStatus((current) => ({ ...current, ...response.twoFactor, required: current.required, compliant: true, lastUsedAt: new Date().toISOString(), setupPending: false }));
      setSetup(null); setSetupCode(''); setFeedback({ type: 'success', text: response.message });
      window.dispatchEvent(new CustomEvent('admin-two-factor-policy-updated'));
      await loadSecurity({ showLoader: false });
    } catch (error) {
      setFeedback({ type: 'error', text: error.userMessage });
      if (error?.response?.data?.setupExpired) setSetup(null);
    } finally { setBusy(false); }
  };

  const submitProtectedAction = async (event) => {
    event.preventDefault();
    if (!action) return;
    try {
      setBusy(true); setFeedback(null);
      const payload = { currentPassword: actionPassword, code: actionCode };
      const response = action === 'disable'
        ? await disableAdminTwoFactor(payload)
        : action === 'reconfigure'
          ? await startAdminTwoFactorReconfiguration(payload)
          : await regenerateAdminRecoveryCodes(payload);
      if (action === 'reconfigure') {
        setReconfiguration(response.setup);
        setAction(''); setActionPassword(''); setActionCode('');
        setFeedback({ type: 'success', text: response.message });
        return;
      }
      if (action === 'disable') { setStatus(EMPTY_STATUS); setRecoveryCodes([]); }
      else { setRecoveryCodes(response.recoveryCodes || []); setStatus((current) => ({ ...current, recoveryCodesRemaining: response.recoveryCodes?.length || 0 })); }
      setAction(''); setActionPassword(''); setActionCode(''); setFeedback({ type: 'success', text: response.message });
      await loadSecurity({ showLoader: false });
    } catch (error) { setFeedback({ type: 'error', text: error.userMessage }); }
    finally { setBusy(false); }
  };

  const confirmReconfiguration = async (event) => {
    event.preventDefault();
    try {
      setBusy(true); setFeedback(null);
      const response = await confirmAdminTwoFactorReconfiguration(reconfigurationCode);
      setRecoveryCodes(response.recoveryCodes || []);
      setStatus((current) => ({ ...current, ...response.twoFactor }));
      setReconfiguration(null); setReconfigurationCode('');
      setFeedback({ type: 'success', text: response.message });
      await loadSecurity({ showLoader: false });
    } catch (error) {
      setFeedback({ type: 'error', text: error.userMessage });
      if (error?.response?.data?.setupExpired) {
        setReconfiguration(null);
        setReconfigurationCode('');
      }
    } finally { setBusy(false); }
  };

  const submitSessionAction = async (event) => {
    event.preventDefault();
    if (!sessionAction) return;
    try {
      setBusy(true); setFeedback(null);
      const payload = { currentPassword: sessionPassword, code: sessionCode };
      const response = sessionAction.type === 'others'
        ? await revokeOtherAdminSessions(payload)
        : sessionAction.type === 'all'
          ? await revokeAllAdminSessions(payload)
          : await revokeAdminSession(sessionAction.session.id, payload);
      setFeedback({ type: 'success', text: response.message });
      setSessionAction(null); setSessionPassword(''); setSessionCode('');
      if (response.currentSessionRevoked) {
        window.dispatchEvent(new CustomEvent('admin-session-expired'));
        return;
      }
      await loadSecurity({ showLoader: false });
    } catch (error) { setFeedback({ type: 'error', text: error.userMessage }); }
    finally { setBusy(false); }
  };

  const reviewAlert = async (alert) => {
    try {
      setBusy(true); setFeedback(null);
      const response = await reviewAdminSecurityAlert(alert.id);
      setFeedback({ type: 'success', text: response.message });
      await loadSecurity({ showLoader: false });
    } catch (error) { setFeedback({ type: 'error', text: error.userMessage }); }
    finally { setBusy(false); }
  };

  const submitAlertResponse = async (event) => {
    event.preventDefault();
    if (!alertAction) return;
    try {
      setBusy(true); setFeedback(null);
      const response = await respondAdminSecurityAlert(alertAction.alert.id, {
        action: alertAction.type,
        reason: alertReason,
        currentPassword: alertPassword,
        code: alertCode,
      });
      setFeedback({ type: 'success', text: response.message });
      setAlertAction(null); setAlertReason(''); setAlertPassword(''); setAlertCode('');
      if (response.currentSessionRevoked) {
        window.dispatchEvent(new CustomEvent('admin-session-expired'));
        return;
      }
      await loadSecurity({ showLoader: false });
    } catch (error) { setFeedback({ type: 'error', text: error.userMessage }); }
    finally { setBusy(false); }
  };

  if (loading) return <div className="flex min-h-64 items-center justify-center"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="grid gap-5">
      {feedback ? <div className={`rounded-2xl border px-4 py-3 text-sm font-semibold ${feedback.type === 'error' ? 'border-rose-300 bg-rose-50 text-rose-800' : 'border-emerald-300 bg-emerald-50 text-emerald-800'}`} role="status">{feedback.text}</div> : null}

      <SecurityNavigation
        activeView={activeView}
        onChange={setActiveView}
        pendingAlerts={security.summary?.pendingAlerts || 0}
      />

      {status.misconfigured ? <div className="rounded-[24px] border border-amber-300 bg-amber-50 p-4 text-amber-950"><div className="flex items-start gap-3"><AlertTriangle className="shrink-0" /><div><strong>Falta configurar la clave segura de 2FA</strong><p className="mt-1 text-sm leading-6">El perfil debe usar 2FA, pero el servidor aún necesita ADMIN_2FA_ENCRYPTION_KEY. La política no bloqueará el panel local hasta corregirlo.</p></div></div></div> : null}

      {status.required && (activeView === 'overview' || activeView === 'twoFactor') ? <div className={`rounded-[24px] border p-4 ${status.enabled ? 'border-emerald-300 bg-emerald-50 text-emerald-900' : 'border-rose-300 bg-rose-50 text-rose-900'}`}><div className="flex items-start gap-3">{status.enabled ? <ShieldCheck className="shrink-0" /> : <ShieldAlert className="shrink-0" />}<div><strong>{status.enabled ? 'Tu cuenta cumple la política de seguridad' : '2FA obligatorio para este perfil'}</strong><p className="mt-1 text-sm leading-6">{status.enabled ? 'Propietarios y administradores deben conservar activo el segundo factor.' : 'Activa el segundo factor para desbloquear el resto del panel administrativo.'}</p></div></div></div> : null}

      {activeView === 'overview' ? (
        <SecurityOverview status={status} security={security} onNavigate={setActiveView} />
      ) : null}

      {activeView === 'twoFactor' ? <section className="overflow-hidden rounded-[28px] border p-5 md:p-6" style={{ background: 'var(--admin-card-bg)', borderColor: 'var(--admin-glass-border)', color: 'var(--admin-card-text)' }}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div className="flex items-start gap-4"><span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl" style={{ background: 'var(--admin-primary-soft-bg)', color: 'var(--admin-primary)' }}>{status.enabled ? <ShieldCheck /> : <ShieldOff />}</span><div><p className="text-xs font-black uppercase tracking-[0.2em] opacity-60">Seguridad personal</p><h2 className="mt-1 text-2xl font-black">Autenticación en dos pasos</h2><p className="mt-2 max-w-2xl text-sm leading-6 opacity-70">Protege tu usuario con una aplicación TOTP. La sesión administrativa solo se crea después de validar la contraseña y el segundo factor.</p></div></div><span className={`rounded-full px-3 py-1.5 text-xs font-black ${status.enabled ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'}`}>{status.enabled ? 'ACTIVO' : 'INACTIVO'}</span></div>
        {status.enabled ? <div className="mt-6 grid gap-3 sm:grid-cols-3"><div className="rounded-2xl border p-4" style={{ borderColor: 'var(--admin-glass-border)' }}><small className="opacity-60">Activado</small><p className="mt-1 text-sm font-bold">{formatDate(status.enabledAt)}</p></div><div className="rounded-2xl border p-4" style={{ borderColor: 'var(--admin-glass-border)' }}><small className="opacity-60">Último uso</small><p className="mt-1 text-sm font-bold">{formatDate(status.lastUsedAt)}</p></div><div className="rounded-2xl border p-4" style={{ borderColor: 'var(--admin-glass-border)' }}><small className="opacity-60">Códigos disponibles</small><p className="mt-1 text-sm font-bold">{status.recoveryCodesRemaining}</p></div></div> : null}
      </section> : null}

      {activeView === 'twoFactor' ? <RecoveryCodes codes={recoveryCodes} /> : null}

      {activeView === 'twoFactor' && (!status.enabled ? (
        <section className="rounded-[28px] border p-5 md:p-6" style={{ background: 'var(--admin-card-bg)', borderColor: 'var(--admin-glass-border)', color: 'var(--admin-card-text)' }}>
          {!status.canSelfActivate ? <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-amber-950"><div className="flex items-start gap-3"><ShieldAlert className="mt-0.5 shrink-0" /><div><h3 className="font-black">2FA administrado por el propietario</h3><p className="mt-1 text-sm leading-6">El owner debe habilitar esta protección para tu usuario. Después podrás vincular aquí tu propia aplicación sin compartir el código QR ni la clave secreta.</p></div></div></div> : !setup ? <form onSubmit={beginSetup} className="grid max-w-xl gap-4"><div className="flex items-center gap-3"><Smartphone /><div><h3 className="font-black">Vincula tu aplicación</h3><p className="text-sm opacity-65">Confirma primero tu contraseña actual.</p></div></div><input type="password" value={setupPassword} onChange={(event) => setSetupPassword(event.target.value)} placeholder="Contraseña actual" autoComplete="current-password" required disabled={busy} className="rounded-2xl border px-4 py-3 outline-none" style={{ background: 'var(--admin-input-bg)', borderColor: 'var(--admin-input-border)', color: 'var(--admin-input-text)' }} /><button disabled={busy} className="inline-flex w-fit items-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white disabled:opacity-60">{busy ? <Loader2 className="animate-spin" size={17} /> : <KeyRound size={17} />} Configurar 2FA</button></form> : <form onSubmit={confirmSetup} className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,300px)_minmax(0,1fr)]"><div className="min-w-0 rounded-3xl bg-white p-3"><img src={setup.qrCodeDataUrl} alt="Código QR para configurar autenticación en dos pasos" className="w-full" /></div><div className="grid min-w-0 content-start gap-4"><div><h3 className="text-xl font-black">Escanea el código QR</h3><p className="mt-1 text-sm leading-6 opacity-70">Usa Google Authenticator, Microsoft Authenticator, Authy o cualquier aplicación TOTP.</p></div><div className="rounded-2xl border p-3 text-sm" style={{ borderColor: 'var(--admin-glass-border)' }}><small className="opacity-60">Clave manual</small><p className="mt-1 break-all font-mono font-bold tracking-wider">{setup.manualSecret}</p></div><input value={setupCode} onChange={(event) => setSetupCode(event.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" placeholder="Código de 6 dígitos" required disabled={busy} className="rounded-2xl border px-4 py-3 text-center text-lg font-black tracking-[0.2em] outline-none" style={{ background: 'var(--admin-input-bg)', borderColor: 'var(--admin-input-border)', color: 'var(--admin-input-text)' }} /><button disabled={busy} className="inline-flex w-fit items-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white disabled:opacity-60">{busy ? <Loader2 className="animate-spin" size={17} /> : <ShieldCheck size={17} />} Confirmar y activar</button></div></form>}
        </section>
      ) : (
        <section className="rounded-[28px] border p-5 md:p-6" style={{ background: 'var(--admin-card-bg)', borderColor: 'var(--admin-glass-border)', color: 'var(--admin-card-text)' }}>
          {reconfiguration ? (
            <form onSubmit={confirmReconfiguration} className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,300px)_minmax(0,1fr)]">
              <div className="min-w-0 rounded-3xl bg-white p-3"><img src={reconfiguration.qrCodeDataUrl} alt="Nuevo código QR para cambiar la aplicación 2FA" className="w-full" /></div>
              <div className="grid min-w-0 content-start gap-4">
                <div><h3 className="text-xl font-black">Vincula la nueva aplicación</h3><p className="mt-1 text-sm leading-6 opacity-70">La aplicación anterior continúa activa hasta que confirmes un código generado por esta nueva vinculación.</p></div>
                <div className="rounded-2xl border p-3 text-sm" style={{ borderColor: 'var(--admin-glass-border)' }}><small className="opacity-60">Nueva clave manual</small><p className="mt-1 break-all font-mono font-bold tracking-wider">{reconfiguration.manualSecret}</p></div>
                <input value={reconfigurationCode} onChange={(event) => setReconfigurationCode(event.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" placeholder="Código nuevo de 6 dígitos" required disabled={busy} className="rounded-2xl border px-4 py-3 text-center text-lg font-black tracking-[0.2em] outline-none" style={{ background: 'var(--admin-input-bg)', borderColor: 'var(--admin-input-border)', color: 'var(--admin-input-text)' }} />
                <div className="flex flex-wrap gap-2"><button disabled={busy} className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white disabled:opacity-60">{busy ? <Loader2 className="animate-spin" size={17} /> : <ShieldCheck size={17} />} Confirmar cambio seguro</button><button type="button" onClick={() => { setReconfiguration(null); setReconfigurationCode(''); setFeedback({ type: 'success', text: 'Cambio cancelado. La aplicación anterior continúa activa.' }); }} disabled={busy} className="rounded-2xl border px-5 py-3 text-sm font-bold" style={{ borderColor: 'var(--admin-glass-border)' }}>Cancelar</button></div>
              </div>
            </form>
          ) : !action ? (
            <div className="flex flex-wrap gap-3"><button type="button" onClick={() => setAction('reconfigure')} className="inline-flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm font-black" style={{ borderColor: 'var(--admin-glass-border)' }}><Smartphone size={17} /> Cambiar aplicación 2FA</button><button type="button" onClick={() => setAction('regenerate')} className="inline-flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm font-black" style={{ borderColor: 'var(--admin-glass-border)' }}><RefreshCw size={17} /> Regenerar códigos</button>{status.canSelfDisable ? <button type="button" onClick={() => setAction('disable')} className="inline-flex items-center gap-2 rounded-2xl border border-rose-300 px-4 py-3 text-sm font-black text-rose-700"><ShieldOff size={17} /> Desactivar 2FA</button> : null}</div>
          ) : (
            <form onSubmit={submitProtectedAction} className="grid max-w-xl gap-4"><div><h3 className="font-black">{action === 'disable' ? 'Desactivar segundo factor' : action === 'reconfigure' ? 'Autorizar cambio de aplicación' : 'Crear códigos nuevos'}</h3><p className="mt-1 text-sm opacity-65">Confirma tu contraseña y un código TOTP o de recuperación. {action === 'reconfigure' ? 'La aplicación anterior seguirá activa hasta validar la nueva.' : 'Las demás sesiones se revocarán.'}</p></div><input type="password" value={actionPassword} onChange={(event) => setActionPassword(event.target.value)} placeholder="Contraseña actual" autoComplete="current-password" required disabled={busy} className="rounded-2xl border px-4 py-3 outline-none" style={{ background: 'var(--admin-input-bg)', borderColor: 'var(--admin-input-border)', color: 'var(--admin-input-text)' }} /><input value={actionCode} onChange={(event) => setActionCode(event.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 11))} placeholder="Código TOTP o de recuperación" autoComplete="one-time-code" required disabled={busy} className="rounded-2xl border px-4 py-3 outline-none" style={{ background: 'var(--admin-input-bg)', borderColor: 'var(--admin-input-border)', color: 'var(--admin-input-text)' }} /><div className="flex flex-wrap gap-2"><button disabled={busy} className={`inline-flex items-center gap-2 rounded-2xl px-5 py-3 text-sm font-black text-white disabled:opacity-60 ${action === 'disable' ? 'bg-rose-700' : 'bg-slate-950'}`}>{busy ? <Loader2 className="animate-spin" size={17} /> : <Check size={17} />} Confirmar</button><button type="button" onClick={() => setAction('')} disabled={busy} className="rounded-2xl border px-5 py-3 text-sm font-bold" style={{ borderColor: 'var(--admin-glass-border)' }}>Cancelar</button></div></form>
          )}
        </section>
      ))}

      {activeView === 'sessions' ? <SessionList sessions={security.sessions || []} busy={busy} onRevoke={(session) => setSessionAction({ type: 'one', session })} onRevokeAll={() => setSessionAction({ type: 'all' })} onRevokeOthers={() => setSessionAction({ type: 'others' })} /> : null}

      {activeView === 'sessions' && sessionAction ? <section className="rounded-[28px] border border-rose-200 bg-rose-50 p-5 text-rose-950 md:p-6"><form onSubmit={submitSessionAction} className="grid max-w-xl gap-4"><div><h3 className="font-black">{sessionAction.type === 'others' ? 'Cerrar las demás sesiones' : sessionAction.type === 'all' ? 'Cerrar todas las sesiones' : 'Cerrar sesión seleccionada'}</h3><p className="mt-1 text-sm opacity-70">Confirma tu identidad antes de revocar el acceso. Esta acción queda registrada.</p></div><input type="password" value={sessionPassword} onChange={(event) => setSessionPassword(event.target.value)} placeholder="Contraseña para cerrar sesiones" autoComplete="current-password" required disabled={busy} className="rounded-2xl border border-rose-200 bg-white px-4 py-3 outline-none" />{status.enabled ? <input value={sessionCode} onChange={(event) => setSessionCode(event.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 11))} placeholder="Código de seguridad para cerrar sesiones" autoComplete="one-time-code" required disabled={busy} className="rounded-2xl border border-rose-200 bg-white px-4 py-3 outline-none" /> : null}<div className="flex gap-2"><button disabled={busy} className="inline-flex items-center gap-2 rounded-2xl bg-rose-700 px-5 py-3 text-sm font-black text-white disabled:opacity-50">{busy ? <Loader2 className="animate-spin" size={17} /> : <LogOut size={17} />} Confirmar cierre</button><button type="button" onClick={() => setSessionAction(null)} disabled={busy} className="rounded-2xl border border-rose-300 px-5 py-3 text-sm font-bold">Cancelar</button></div></form></section> : null}

      {activeView === 'alerts' && alertAction ? <section className="rounded-[28px] border border-amber-300 bg-amber-50 p-5 text-amber-950 md:p-6"><form onSubmit={submitAlertResponse} className="grid max-w-xl gap-4"><div><h3 className="font-black">Responder alerta: {alertActionLabel(alertAction.type)}</h3><p className="mt-1 text-sm opacity-75">{alertAction.alert.title} · usuario {alertAction.alert.username || 'no identificado'}. Confirma tu identidad y deja una justificación para la auditoría.</p></div><textarea value={alertReason} onChange={(event) => setAlertReason(event.target.value.slice(0, 500))} minLength={8} maxLength={500} rows={3} placeholder="Motivo de la respuesta (mínimo 8 caracteres)" required disabled={busy} className="rounded-2xl border border-amber-300 bg-white px-4 py-3 outline-none" /><input type="password" value={alertPassword} onChange={(event) => setAlertPassword(event.target.value)} placeholder="Contraseña actual" autoComplete="current-password" required disabled={busy} className="rounded-2xl border border-amber-300 bg-white px-4 py-3 outline-none" />{status.enabled ? <input value={alertCode} onChange={(event) => setAlertCode(event.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 11))} placeholder="Código TOTP o de recuperación" autoComplete="one-time-code" required disabled={busy} className="rounded-2xl border border-amber-300 bg-white px-4 py-3 outline-none" /> : null}<div className="flex flex-wrap gap-2"><button disabled={busy} className={`inline-flex items-center gap-2 rounded-2xl px-5 py-3 text-sm font-black text-white disabled:opacity-50 ${alertAction.type === 'block_user' ? 'bg-rose-700' : 'bg-slate-950'}`}>{busy ? <Loader2 className="animate-spin" size={17} /> : <ShieldAlert size={17} />} Confirmar respuesta</button><button type="button" onClick={() => { setAlertAction(null); setAlertReason(''); setAlertPassword(''); setAlertCode(''); }} disabled={busy} className="rounded-2xl border border-amber-400 px-5 py-3 text-sm font-bold">Cancelar</button></div></form></section> : null}

      {activeView === 'alerts' ? <AlertsAndActivity alerts={security.alerts || []} activity={security.activity || []} busy={busy} onReview={reviewAlert} onRespond={(alert, type) => { setAlertAction({ alert, type }); setAlertReason(''); setAlertPassword(''); setAlertCode(''); }} /> : null}
    </div>
  );
}
