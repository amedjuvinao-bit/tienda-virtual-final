import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Mail,
  RefreshCw,
  Save,
  Send,
  Server,
  ShieldCheck,
  Store,
} from 'lucide-react';

import {
  getAdminMailSettings,
  sendAdminMailTest,
  updateAdminMailSettings,
} from '../../api/adminMailSettingsApi';
import './CorreoSection.css';

const DEFAULT_FORM = {
  provider: 'gmail',
  fromEmail: '',
  replyToEmail: '',
  smtpHost: 'smtp.gmail.com',
  smtpPort: 465,
  smtpSecurity: 'ssl',
  smtpUser: '',
  smtpPassword: '',
  clearSmtpPassword: false,
  testEmail: '',
};

const FALLBACK_META = {
  providers: [
    { value: 'gmail', label: 'Gmail', description: 'Cuenta de Google con contraseña de aplicación.' },
    { value: 'outlook', label: 'Outlook / Microsoft 365', description: 'Cuenta de Microsoft con acceso SMTP habilitado.' },
    { value: 'zoho', label: 'Zoho Mail', description: 'Cuenta de Zoho con acceso SMTP habilitado.' },
    { value: 'smtp', label: 'Otro correo', description: 'Correo corporativo de otro proveedor.' },
  ],
  securityTypes: [
    { value: 'ssl', label: 'SSL / TLS' },
    { value: 'starttls', label: 'STARTTLS' },
    { value: 'none', label: 'Sin cifrado' },
  ],
  presetDefaults: {
    gmail: { smtpHost: 'smtp.gmail.com', smtpPort: 465, smtpSecurity: 'ssl' },
    outlook: { smtpHost: 'smtp.office365.com', smtpPort: 587, smtpSecurity: 'starttls' },
    zoho: { smtpHost: 'smtp.zoho.com', smtpPort: 465, smtpSecurity: 'ssl' },
    smtp: { smtpHost: '', smtpPort: 465, smtpSecurity: 'ssl' },
  },
};

const TABS = [
  { id: 'identity', label: 'Remitente', detail: 'Nombre y proveedor', Icon: Mail },
  { id: 'access', label: 'Acceso', detail: 'Cuenta protegida', Icon: KeyRound },
  { id: 'verify', label: 'Comprobar', detail: 'Prueba y activación', Icon: ShieldCheck },
];

function apiMessage(error, fallback) {
  return error?.userMessage || error?.response?.data?.message || error?.message || fallback;
}

function normalizeForm(settings = {}, store = {}) {
  return {
    provider: settings.provider || 'gmail',
    fromEmail: settings.fromEmail || store.email || '',
    replyToEmail: settings.replyToEmail || store.supportEmail || '',
    smtpHost: settings.smtpHost || '',
    smtpPort: settings.smtpPort || 465,
    smtpSecurity: settings.smtpSecurity || 'ssl',
    smtpUser: settings.smtpUser || '',
    smtpPassword: '',
    clearSmtpPassword: false,
    testEmail: settings.testEmail || store.email || '',
  };
}

function comparableForm(form) {
  return JSON.stringify({
    provider: form.provider,
    fromEmail: form.fromEmail.trim().toLowerCase(),
    replyToEmail: form.replyToEmail.trim().toLowerCase(),
    smtpHost: form.smtpHost.trim().toLowerCase(),
    smtpPort: Number(form.smtpPort),
    smtpSecurity: form.smtpSecurity,
    smtpUser: form.smtpUser.trim(),
    testEmail: form.testEmail.trim().toLowerCase(),
    passwordChanged: Boolean(form.smtpPassword || form.clearSmtpPassword),
  });
}

function Field({ label, required = false, hint = '', error = '', children }) {
  return (
    <label className="mail-field">
      <span className="mail-field__label">
        {label}{required ? <b aria-hidden="true">*</b> : null}
      </span>
      {children}
      {error ? <span className="mail-field__error">{error}</span> : null}
      {!error && hint ? <span className="mail-field__hint">{hint}</span> : null}
    </label>
  );
}

function Notice({ type = 'info', children }) {
  return (
    <div className={`mail-notice mail-notice--${type}`} role={type === 'error' ? 'alert' : 'status'}>
      {type === 'success' ? <CheckCircle2 /> : <AlertCircle />}
      <span>{children}</span>
    </div>
  );
}

export default function CorreoSection() {
  const [activeTab, setActiveTab] = useState('identity');
  const [form, setForm] = useState(DEFAULT_FORM);
  const [savedForm, setSavedForm] = useState(DEFAULT_FORM);
  const [settings, setSettings] = useState({});
  const [store, setStore] = useState({});
  const [readiness, setReadiness] = useState({ checks: [], completed: 0, required: 5 });
  const [meta, setMeta] = useState(FALLBACK_META);
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});

  const providers = meta.providers?.length ? meta.providers : FALLBACK_META.providers;
  const securityTypes = meta.securityTypes?.length
    ? meta.securityTypes
    : FALLBACK_META.securityTypes;
  const selectedProvider = providers.find((item) => item.value === form.provider) || providers[0];
  const hasPassword = Boolean(settings.hasSmtpPassword) && !form.clearSmtpPassword;
  const dirty = comparableForm(form) !== comparableForm(savedForm);
  const progress = readiness.required
    ? Math.round((readiness.completed / readiness.required) * 100)
    : 0;

  const status = useMemo(() => {
    if (readiness.active) return { label: 'Activo', detail: 'La tienda está enviando correos.', tone: 'success' };
    if (readiness.tested) return { label: 'Comprobado', detail: 'Ya puedes activar los correos.', tone: 'ready' };
    if (readiness.canTest) return { label: 'Listo para probar', detail: 'Envía una prueba para comprobarlo.', tone: 'warning' };
    return { label: 'En preparación', detail: 'Completa los datos pendientes.', tone: 'neutral' };
  }, [readiness]);

  function applyResponse(response) {
    const nextSettings = response.settings || {};
    const nextStore = response.store || {};
    const nextForm = normalizeForm(nextSettings, nextStore);
    setSettings(nextSettings);
    setStore(nextStore);
    setReadiness(response.readiness || { checks: [], completed: 0, required: 5 });
    setMeta(response.meta || meta || FALLBACK_META);
    setRevision(Number(response.revision || 0));
    setForm(nextForm);
    setSavedForm(nextForm);
    setFieldErrors({});
  }

  async function load() {
    try {
      setLoading(true);
      setFeedback(null);
      applyResponse(await getAdminMailSettings());
    } catch (error) {
      setFeedback({ type: 'error', message: apiMessage(error, 'No se pudo cargar la configuración de correo.') });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => ({ ...current, [field]: '' }));
    setFeedback(null);
  }

  function chooseProvider(provider) {
    const preset = meta.presetDefaults?.[provider] || FALLBACK_META.presetDefaults[provider];
    setForm((current) => ({
      ...current,
      provider,
      smtpHost: preset?.smtpHost ?? current.smtpHost,
      smtpPort: preset?.smtpPort ?? current.smtpPort,
      smtpSecurity: preset?.smtpSecurity ?? current.smtpSecurity,
    }));
    setFeedback(null);
  }

  function validateCurrentForm() {
    const errors = {};
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(form.fromEmail)) errors.fromEmail = 'Escribe un correo válido.';
    if (form.replyToEmail && !emailPattern.test(form.replyToEmail)) {
      errors.replyToEmail = 'Escribe un correo válido.';
    }
    if (!form.smtpUser.trim()) errors.smtpUser = 'Escribe el usuario de la cuenta.';
    if (!hasPassword && !form.smtpPassword.trim() && !form.clearSmtpPassword) {
      errors.smtpPassword = 'Escribe la clave de la cuenta.';
    }
    if (form.provider === 'smtp' && !form.smtpHost.trim()) errors.smtpHost = 'Escribe el servidor.';
    const port = Number(form.smtpPort);
    if (form.provider === 'smtp' && (!Number.isInteger(port) || port < 1 || port > 65535)) {
      errors.smtpPort = 'Usa un puerto entre 1 y 65535.';
    }
    setFieldErrors(errors);
    if (Object.keys(errors).length) {
      setActiveTab(errors.fromEmail || errors.replyToEmail ? 'identity' : 'access');
      setFeedback({ type: 'error', message: 'Revisa los datos marcados antes de guardar.' });
      return false;
    }
    return true;
  }

  function payload(enabled = Boolean(settings.enabled)) {
    return {
      revision,
      enabled,
      settings: {
        provider: form.provider,
        fromEmail: form.fromEmail,
        replyToEmail: form.replyToEmail,
        smtpHost: form.smtpHost,
        smtpPort: Number(form.smtpPort),
        smtpSecurity: form.smtpSecurity,
        smtpUser: form.smtpUser,
        smtpPassword: form.smtpPassword,
        clearSmtpPassword: form.clearSmtpPassword,
        testEmail: form.testEmail,
      },
    };
  }

  async function save() {
    if (!validateCurrentForm()) return;
    try {
      setBusy('save');
      const response = await updateAdminMailSettings(payload());
      applyResponse(response);
      setFeedback({ type: 'success', message: response.message || 'Configuración guardada.' });
      if (!response.readiness?.tested) setActiveTab('verify');
    } catch (error) {
      const details = error?.response?.data?.details || [];
      setFieldErrors(Object.fromEntries(details.map((item) => [item.field, item.message])));
      setFeedback({ type: 'error', message: apiMessage(error, 'No se pudo guardar la configuración.') });
    } finally {
      setBusy('');
    }
  }

  async function testConnection() {
    if (dirty) {
      setFeedback({ type: 'warning', message: 'Guarda primero los cambios para probar exactamente esa configuración.' });
      return;
    }
    try {
      setBusy('test');
      const response = await sendAdminMailTest({ testEmail: form.testEmail, revision });
      applyResponse(response);
      setFeedback({ type: 'success', message: response.message || 'La prueba fue enviada.' });
    } catch (error) {
      const responseSettings = error?.response?.data?.settings;
      if (responseSettings) setSettings(responseSettings);
      setFeedback({ type: 'error', message: apiMessage(error, 'No se pudo enviar la prueba.') });
    } finally {
      setBusy('');
    }
  }

  async function toggleActivation() {
    if (dirty) {
      setFeedback({ type: 'warning', message: 'Guarda los cambios antes de activar el correo.' });
      return;
    }
    try {
      setBusy('activate');
      const response = await updateAdminMailSettings(payload(!readiness.active));
      applyResponse(response);
      setFeedback({ type: 'success', message: response.message });
    } catch (error) {
      setFeedback({ type: 'error', message: apiMessage(error, 'No se pudo cambiar el estado del correo.') });
    } finally {
      setBusy('');
    }
  }

  if (loading) {
    return (
      <div className="mail-loading">
        <Loader2 className="animate-spin" />
        Cargando correo de la tienda…
      </div>
    );
  }

  return (
    <section className="mail-center">
      <header className="mail-hero">
        <div className="mail-hero__identity">
          <span className="mail-hero__icon"><Mail /></span>
          <div>
            <span className="mail-eyebrow">COMUNICACIONES DE LA TIENDA</span>
            <h1>Correo de {store.name || 'la tienda'}</h1>
            <p>Configura una vez la cuenta que enviará comprobantes, avisos y recuperaciones.</p>
          </div>
        </div>
        <div className={`mail-state mail-state--${status.tone}`}>
          <b>{status.label}</b>
          <span>{status.detail}</span>
        </div>
      </header>

      <nav className="mail-tabs" aria-label="Configuración del correo">
        {TABS.map(({ id, label, detail, Icon }) => (
          <button
            key={id}
            type="button"
            className="mail-tab"
            data-active={activeTab === id}
            onClick={() => setActiveTab(id)}
            aria-label={`Abrir ${label}`}
          >
            <Icon />
            <span><b>{label}</b><small>{detail}</small></span>
          </button>
        ))}
      </nav>

      {feedback ? <Notice type={feedback.type}>{feedback.message}</Notice> : null}

      <div className="mail-layout">
        <main className="mail-panel">
          {activeTab === 'identity' ? (
            <div className="mail-section">
              <div className="mail-section__title">
                <div><span className="mail-step">01</span><h2>¿Quién envía los mensajes?</h2></div>
                <p>El cliente verá el nombre actualizado de la tienda.</p>
              </div>

              <div className="mail-store-source">
                <Store />
                <div><span>Nombre tomado de Configuración → Tienda</span><b>{store.name || 'Nombre pendiente'}</b></div>
                <CheckCircle2 />
              </div>

              <div className="mail-grid">
                <Field label="Proveedor de correo" required>
                  <select value={form.provider} onChange={(event) => chooseProvider(event.target.value)}>
                    {providers.map((provider) => (
                      <option key={provider.value} value={provider.value}>{provider.label}</option>
                    ))}
                  </select>
                </Field>
                <div className="mail-provider-note">
                  <Server /><span><b>{selectedProvider?.label}</b>{selectedProvider?.description}</span>
                </div>
                <Field label="Correo remitente" required error={fieldErrors.fromEmail} hint="Dirección que verá el cliente.">
                  <input
                    type="email"
                    value={form.fromEmail}
                    onChange={(event) => updateField('fromEmail', event.target.value)}
                    placeholder="ventas@mitienda.com"
                  />
                </Field>
                <Field label="Respuestas de clientes" error={fieldErrors.replyToEmail} hint="Opcional. Puede ser el correo de soporte.">
                  <input
                    type="email"
                    value={form.replyToEmail}
                    onChange={(event) => updateField('replyToEmail', event.target.value)}
                    placeholder="soporte@mitienda.com"
                  />
                </Field>
              </div>
            </div>
          ) : null}

          {activeTab === 'access' ? (
            <div className="mail-section">
              <div className="mail-section__title">
                <div><span className="mail-step">02</span><h2>Acceso a la cuenta</h2></div>
                <p>La clave se guarda protegida y nunca vuelve a mostrarse.</p>
              </div>

              <div className="mail-grid">
                <Field label="Usuario de correo" required error={fieldErrors.smtpUser} hint="Generalmente es la dirección completa.">
                  <input
                    value={form.smtpUser}
                    onChange={(event) => updateField('smtpUser', event.target.value)}
                    placeholder="ventas@mitienda.com"
                    autoComplete="username"
                  />
                </Field>
                <Field
                  label={hasPassword ? 'Cambiar clave' : 'Clave de acceso'}
                  required={!hasPassword}
                  error={fieldErrors.smtpPassword}
                  hint={hasPassword ? 'Déjala vacía para conservar la clave guardada.' : 'En Gmail usa una contraseña de aplicación.'}
                >
                  <span className="mail-password">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={form.smtpPassword}
                      onChange={(event) => updateField('smtpPassword', event.target.value)}
                      placeholder={hasPassword ? '•••••••• configurada' : 'Escribe la clave'}
                      autoComplete="new-password"
                      disabled={form.clearSmtpPassword}
                    />
                    <button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? 'Ocultar clave' : 'Mostrar clave'}>
                      {showPassword ? <EyeOff /> : <Eye />}
                    </button>
                  </span>
                </Field>
              </div>

              <div className={`mail-credential-state ${hasPassword ? 'is-ready' : ''}`}>
                {hasPassword ? <CheckCircle2 /> : <AlertCircle />}
                <span><b>{hasPassword ? 'Clave protegida' : 'Falta la clave'}</b>{hasPassword ? 'No necesitas escribirla nuevamente.' : 'Guárdala para poder enviar la prueba.'}</span>
                {hasPassword ? (
                  <label><input type="checkbox" checked={form.clearSmtpPassword} onChange={(event) => setForm((current) => ({ ...current, clearSmtpPassword: event.target.checked, smtpPassword: '' }))} /> Eliminar clave guardada</label>
                ) : null}
              </div>

              {form.provider === 'smtp' ? (
                <details className="mail-advanced" open>
                  <summary>Datos del servidor</summary>
                  <div className="mail-grid mail-grid--three">
                    <Field label="Servidor" required error={fieldErrors.smtpHost}>
                      <input value={form.smtpHost} onChange={(event) => updateField('smtpHost', event.target.value)} placeholder="smtp.proveedor.com" />
                    </Field>
                    <Field label="Puerto" required error={fieldErrors.smtpPort}>
                      <input type="number" value={form.smtpPort} onChange={(event) => updateField('smtpPort', event.target.value)} />
                    </Field>
                    <Field label="Seguridad" required>
                      <select value={form.smtpSecurity} onChange={(event) => updateField('smtpSecurity', event.target.value)}>
                        {securityTypes.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                      </select>
                    </Field>
                  </div>
                </details>
              ) : (
                <div className="mail-server-summary">
                  <Server /><span><b>Servidor configurado automáticamente</b>{form.smtpHost} · puerto {form.smtpPort}</span>
                </div>
              )}
            </div>
          ) : null}

          {activeTab === 'verify' ? (
            <div className="mail-section">
              <div className="mail-section__title">
                <div><span className="mail-step">03</span><h2>Comprueba antes de activar</h2></div>
                <p>Recibe un mensaje real en la dirección que elijas.</p>
              </div>

              <div className="mail-test-box">
                <div className="mail-test-box__copy">
                  <span className="mail-test-box__icon"><Send /></span>
                  <div><b>Enviar correo de prueba</b><span>No activa avisos automáticos todavía.</span></div>
                </div>
                <Field label="Recibir la prueba en" error={fieldErrors.testEmail}>
                  <input type="email" value={form.testEmail} onChange={(event) => updateField('testEmail', event.target.value)} placeholder="admin@mitienda.com" />
                </Field>
                <button type="button" className="mail-button mail-button--primary" onClick={testConnection} disabled={Boolean(busy) || !readiness.canTest || dirty}>
                  {busy === 'test' ? <Loader2 className="animate-spin" /> : <Send />}
                  Enviar prueba
                </button>
              </div>

              {dirty ? <Notice type="warning">Hay cambios sin guardar. Guárdalos antes de enviar la prueba.</Notice> : null}
              {!feedback && settings.lastTestStatus === 'success' && readiness.tested ? (
                <Notice type="success">{settings.lastTestMessage || 'La conexión fue comprobada correctamente.'}</Notice>
              ) : null}
              {!feedback && settings.lastTestStatus === 'error' ? (
                <Notice type="error">No se pudo entregar la última prueba. Revisa el acceso de la cuenta.</Notice>
              ) : null}

              <div className={`mail-activation ${readiness.tested ? 'is-ready' : ''}`}>
                <div><ShieldCheck /><span><b>Correos automáticos</b><small>{readiness.active ? 'Activos para comprobantes, avisos y recuperaciones.' : readiness.tested ? 'La conexión está comprobada y se puede activar.' : 'Se habilitan después de recibir la prueba.'}</small></span></div>
                <button type="button" onClick={toggleActivation} disabled={Boolean(busy) || (!readiness.tested && !readiness.active)}>
                  {busy === 'activate' ? <Loader2 className="animate-spin" /> : null}
                  {readiness.active ? 'Desactivar' : 'Activar correos'}
                </button>
              </div>
            </div>
          ) : null}
        </main>

        <aside className="mail-summary">
          <div className="mail-summary__top">
            <div><span>ESTADO GENERAL</span><b>{progress}%</b></div>
            <div className="mail-progress"><span style={{ width: `${progress}%` }} /></div>
          </div>
          <div className="mail-checks">
            {(readiness.checks || []).map((check) => (
              <div key={check.key} data-ready={check.ready}>
                <span>{check.ready ? <Check /> : '—'}</span>{check.label}
              </div>
            ))}
          </div>
          <div className="mail-summary__identity">
            <span>Remitente visible</span>
            <b>{store.name || 'Tienda'}</b>
            <small>{form.fromEmail || 'Correo pendiente'}</small>
          </div>
          <div className="mail-summary__actions">
            <button type="button" className="mail-button" onClick={() => applyResponse({ settings, store, readiness, meta, revision })} disabled={!dirty || Boolean(busy)}>
              <RefreshCw /> Descartar
            </button>
            <button type="button" className="mail-button mail-button--primary" onClick={save} disabled={!dirty || Boolean(busy)}>
              {busy === 'save' ? <Loader2 className="animate-spin" /> : <Save />}
              Guardar
            </button>
          </div>
          <small className="mail-version">Versión {revision}</small>
        </aside>
      </div>
    </section>
  );
}
