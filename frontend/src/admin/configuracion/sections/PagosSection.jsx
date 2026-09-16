import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BadgeCheck,
  Banknote,
  CheckCircle2,
  Copy,
  CreditCard,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  RefreshCcw,
  Save,
  ShieldCheck,
  Store,
  Webhook,
} from 'lucide-react';

import {
  fetchPaymentSettings,
  savePaymentSettings,
  testWompiMerchant,
} from '../api/paymentSettingsApi';
import { API_BASE_URL } from '../../../config/apiBaseUrl';
import './PagosSection.css';

const PROVIDERS = Object.freeze([
  {
    id: 'wompi',
    label: 'Wompi',
    description: 'Checkout colombiano con validación directa del comercio.',
    icon: CreditCard,
    webhookPath: '/api/payments/wompi/webhook',
    fields: [
      { key: 'publicKey', label: 'Llave pública', placeholder: 'pub_test_…' },
      { key: 'privateKey', label: 'Llave privada', placeholder: 'prv_test_…', secret: true },
      { key: 'integrityKey', label: 'Llave de integridad', placeholder: 'test_integrity_…', secret: true },
      { key: 'webhookSecret', label: 'Secreto del webhook', placeholder: 'Secreto de eventos', secret: true, webhook: true },
    ],
  },
  {
    id: 'payu',
    label: 'PayU',
    description: 'Gateway con identificación de comercio y confirmación firmada.',
    icon: ShieldCheck,
    webhookPath: '/api/payments/payu/webhook',
    fields: [
      { key: 'merchantId', label: 'Merchant ID', placeholder: 'Identificador del comercio' },
      { key: 'accountId', label: 'Account ID', placeholder: 'Identificador de la cuenta' },
      { key: 'apiLogin', label: 'API Login', placeholder: 'Login de integración', secret: true },
      { key: 'apiKey', label: 'API Key', placeholder: 'Llave de firma', secret: true },
    ],
  },
  {
    id: 'manual',
    label: 'Pago manual',
    description: 'Transferencia o consignación verificada por el equipo.',
    icon: Banknote,
    fields: [
      { key: 'accountHolder', label: 'Titular', placeholder: 'Razón social o titular' },
      { key: 'bankName', label: 'Banco o billetera', placeholder: 'Ej. Bancolombia o Nequi' },
      { key: 'accountType', label: 'Tipo de cuenta', placeholder: 'Ej. Ahorros', optional: true },
      { key: 'accountNumber', label: 'Número de cuenta', placeholder: 'Número protegido', secret: true },
      { key: 'paymentInstructions', label: 'Instrucciones para el cliente', placeholder: 'Indica cómo pagar y enviar el comprobante.', textarea: true },
    ],
  },
]);

const EMPTY_SETTINGS = Object.freeze({
  active: false,
  provider: '',
  mode: 'sandbox',
  currency: 'COP',
  checkoutLabel: '',
  successMessage: '',
  enableWebhook: false,
  credentials: {
    wompi: { publicKey: '', privateKey: '', integrityKey: '', webhookSecret: '' },
    payu: { merchantId: '', accountId: '', apiLogin: '', apiKey: '' },
    manual: { accountHolder: '', bankName: '', accountType: '', accountNumber: '', paymentInstructions: '' },
  },
});

const STEPS = [
  { id: 'provider', label: 'Proveedor', description: 'Canal y ambiente', icon: CreditCard },
  { id: 'credentials', label: 'Credenciales', description: 'Acceso protegido', icon: KeyRound },
  { id: 'checkout', label: 'Checkout', description: 'Experiencia y webhooks', icon: Store },
];

function normalizeSettings(raw = {}) {
  return {
    ...EMPTY_SETTINGS,
    ...raw,
    credentials: Object.fromEntries(
      Object.entries(EMPTY_SETTINGS.credentials).map(([provider, fields]) => [
        provider,
        { ...fields, ...(raw.credentials?.[provider] || {}) },
      ])
    ),
  };
}

function formatUpdatedAt(value) {
  if (!value) return 'Sin actualizaciones registradas';
  return new Date(value).toLocaleString('es-CO');
}

function fieldPath(provider, field) {
  return `credentials.${provider}.${field}`;
}

function providerMeta(provider) {
  return PROVIDERS.find((item) => item.id === provider) || null;
}

function paymentErrorMessage(error) {
  return error?.response?.data?.message || error?.userMessage || 'No fue posible completar la operación.';
}

function Field({ label, error, help, children }) {
  const controlId = React.useId();
  const feedbackId = `${controlId}-feedback`;
  const controlProps = {
    id: controlId,
    'aria-invalid': error ? 'true' : 'false',
    'aria-describedby': error || help ? feedbackId : undefined,
  };
  const isNativeControl = ['input', 'select', 'textarea'].includes(children?.type);
  const control = isNativeControl
    ? React.cloneElement(children, controlProps)
    : React.cloneElement(children, {}, React.Children.map(
      children.props.children,
      (child, index) => index === 0 && React.isValidElement(child)
        ? React.cloneElement(child, controlProps)
        : child
    ));
  return (
    <div className="payments-field">
      <label htmlFor={controlId}>{label}</label>
      {control}
      {error ? <small id={feedbackId} className="payments-field__error">{error}</small> : null}
      {!error && help ? <small id={feedbackId}>{help}</small> : null}
    </div>
  );
}

export default function PagosSection() {
  const [settings, setSettings] = useState(EMPTY_SETTINGS);
  const [snapshot, setSnapshot] = useState(EMPTY_SETTINGS);
  const [credentialStatus, setCredentialStatus] = useState({});
  const [readiness, setReadiness] = useState({});
  const [revision, setRevision] = useState(0);
  const [updatedAt, setUpdatedAt] = useState(null);
  const [updatedBy, setUpdatedBy] = useState('');
  const [activeStep, setActiveStep] = useState('provider');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [showSecrets, setShowSecrets] = useState({});
  const [errors, setErrors] = useState({});
  const [feedback, setFeedback] = useState(null);
  const [testResult, setTestResult] = useState(null);
  const [confirmProduction, setConfirmProduction] = useState(false);
  const [copied, setCopied] = useState(false);

  const currentProvider = useMemo(() => providerMeta(settings.provider), [settings.provider]);
  const dirty = useMemo(
    () => JSON.stringify(settings) !== JSON.stringify(snapshot),
    [settings, snapshot]
  );

  const localReadiness = useMemo(() => {
    if (!currentProvider) return { ready: false, completed: 0, required: 0, missing: [] };
    const status = credentialStatus[currentProvider.id] || {};
    const requiredFields = currentProvider.fields.filter(
      (field) => !field.optional && (!field.webhook || settings.enableWebhook)
    );
    const missing = requiredFields.filter((field) => {
      const value = settings.credentials?.[currentProvider.id]?.[field.key];
      return !String(value || '').trim() && !(field.secret && status[field.key]);
    });
    return {
      ready: missing.length === 0,
      completed: requiredFields.length - missing.length,
      required: requiredFields.length,
      missing: missing.map((field) => field.key),
    };
  }, [credentialStatus, currentProvider, settings.credentials, settings.enableWebhook]);

  const load = async () => {
    try {
      setLoading(true);
      setFeedback(null);
      setErrors({});
      const response = await fetchPaymentSettings();
      const next = normalizeSettings(response?.settings);
      setSettings(next);
      setSnapshot(next);
      setCredentialStatus(response?.credentialStatus || {});
      setReadiness(response?.readiness || {});
      setRevision(Number(response?.revision || 0));
      setUpdatedAt(response?.updatedAt || null);
      setUpdatedBy(response?.updatedBy || '');
      setConfirmProduction(false);
      setTestResult(null);
    } catch (error) {
      setFeedback({ type: 'error', message: paymentErrorMessage(error) });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    const warn = (event) => {
      if (!dirty) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const update = (changes) => {
    setSettings((current) => ({ ...current, ...changes }));
    setFeedback((current) => current?.type === 'success' ? null : current);
  };

  const updateCredential = (field, value) => {
    if (!currentProvider) return;
    setSettings((current) => ({
      ...current,
      credentials: {
        ...current.credentials,
        [currentProvider.id]: {
          ...current.credentials[currentProvider.id],
          [field]: value,
        },
      },
    }));
    setErrors((current) => {
      const path = fieldPath(currentProvider.id, field);
      if (!current[path]) return current;
      const next = { ...current };
      delete next[path];
      return next;
    });
    setTestResult(null);
  };

  const selectProvider = (provider) => {
    update({
      provider,
      currency: provider === 'wompi' ? 'COP' : settings.currency,
      enableWebhook: provider === 'manual' ? false : settings.enableWebhook,
    });
    setErrors({});
    setTestResult(null);
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setErrors({});
      setFeedback(null);
      const response = await savePaymentSettings({
        settings: { ...settings, confirmProduction },
        revision,
      });
      const next = normalizeSettings(response?.settings);
      setSettings(next);
      setSnapshot(next);
      setCredentialStatus(response?.credentialStatus || {});
      setReadiness(response?.readiness || {});
      setRevision(Number(response?.revision ?? revision + 1));
      setUpdatedAt(response?.updatedAt || new Date().toISOString());
      setUpdatedBy(response?.updatedBy || updatedBy);
      setConfirmProduction(false);
      setFeedback({ type: 'success', message: response?.message || 'Configuración guardada.' });
    } catch (error) {
      const details = Array.isArray(error?.response?.data?.details)
        ? error.response.data.details
        : [];
      const nextErrors = Object.fromEntries(
        details.filter((item) => item?.field).map((item) => [item.field, item.message])
      );
      setErrors(nextErrors);
      if (details.some((item) => String(item.field).startsWith('credentials.'))) {
        setActiveStep('credentials');
      } else if (details.some((item) => item.field === 'confirmProduction')) {
        setActiveStep('provider');
      }
      setFeedback({
        type: error?.response?.data?.error === 'PAYMENT_SETTINGS_CONFLICT' ? 'conflict' : 'error',
        message: paymentErrorMessage(error),
      });
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    if (settings.provider !== 'wompi') return;
    try {
      setTesting(true);
      setTestResult(null);
      const response = await testWompiMerchant({
        mode: settings.mode,
        publicKey: settings.credentials.wompi.publicKey,
      });
      setTestResult({
        ok: true,
        message: response?.merchant?.name
          ? `Conexión aprobada con ${response.merchant.name}.`
          : 'Conexión aprobada por Wompi.',
      });
    } catch (error) {
      setTestResult({ ok: false, message: paymentErrorMessage(error) });
    } finally {
      setTesting(false);
    }
  };

  const webhookUrl = currentProvider?.webhookPath
    ? `${API_BASE_URL}${currentProvider.webhookPath}`
    : '';

  const copyWebhook = async () => {
    if (!webhookUrl) return;
    try {
      await navigator.clipboard.writeText(webhookUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setFeedback({ type: 'error', message: 'No fue posible copiar la URL automáticamente.' });
    }
  };

  if (loading) {
    return <div className="payments-loading"><Loader2 className="animate-spin" /> Preparando el centro de pagos…</div>;
  }

  const ProviderIcon = currentProvider?.icon || CreditCard;
  const serverReady = readiness?.[settings.provider]?.ready === true;

  return (
    <div className="payments-settings">
      <section className="payments-hero">
        <div className="payments-hero__identity">
          <div className="payments-hero__icon"><ProviderIcon size={25} /></div>
          <div>
            <span className="payments-eyebrow">Centro seguro de cobros</span>
            <h2>{currentProvider?.label || 'Configura tus pagos'}</h2>
            <p>Define el único proveedor que usará el checkout y protege sus credenciales.</p>
          </div>
        </div>
        <div className="payments-readiness">
          <div><span>Preparación del proveedor</span><strong>{localReadiness.completed}/{localReadiness.required}</strong></div>
          <div className="payments-readiness__track"><span style={{ width: `${localReadiness.required ? (localReadiness.completed / localReadiness.required) * 100 : 0}%` }} /></div>
          <small>Versión {revision} · {formatUpdatedAt(updatedAt)}{updatedBy ? ` · ${updatedBy}` : ''}</small>
        </div>
      </section>

      {feedback ? (
        <div className={`payments-feedback payments-feedback--${feedback.type}`} role="status">
          {feedback.type === 'success' ? <CheckCircle2 size={19} /> : <AlertTriangle size={19} />}
          <span>{feedback.message}</span>
          {feedback.type === 'conflict' ? <button type="button" onClick={load}>Recargar</button> : null}
        </div>
      ) : null}

      <nav className="payments-steps" aria-label="Etapas de configuración de pagos">
        {STEPS.map((step) => {
          const Icon = step.icon;
          return (
            <button key={step.id} type="button" aria-label={`Abrir ${step.label}`} data-active={activeStep === step.id} onClick={() => setActiveStep(step.id)}>
              <Icon size={19} /><span><strong>{step.label}</strong><small>{step.description}</small></span>
            </button>
          );
        })}
      </nav>

      <div className="payments-workspace">
        <section className="payments-card">
          {activeStep === 'provider' ? (
            <div className="payments-panel" data-testid="payments-step-provider">
              <header><CreditCard size={22} /><div><h3>Proveedor y ambiente</h3><p>Solo aparecen integraciones que el checkout soporta realmente.</p></div></header>
              <div className="payments-provider-grid">
                {PROVIDERS.map((provider) => {
                  const Icon = provider.icon;
                  const providerReady = readiness?.[provider.id]?.ready;
                  return (
                    <button key={provider.id} type="button" data-selected={settings.provider === provider.id} onClick={() => selectProvider(provider.id)}>
                      <Icon size={22} />
                      <span><strong>{provider.label}</strong><small>{provider.description}</small></span>
                      <b data-ready={providerReady === true}>{providerReady ? 'Listo' : 'Configurar'}</b>
                    </button>
                  );
                })}
              </div>
              {errors.provider ? <p className="payments-inline-error">{errors.provider}</p> : null}
              <div className="payments-form-grid">
                <Field label="Ambiente">
                  <select value={settings.mode} onChange={(event) => { update({ mode: event.target.value }); setConfirmProduction(false); }}>
                    <option value="sandbox">Pruebas / Sandbox</option>
                    <option value="production">Producción</option>
                  </select>
                </Field>
                <Field label="Moneda">
                  <select value={settings.currency} disabled={settings.provider === 'wompi'} onChange={(event) => update({ currency: event.target.value })}>
                    <option value="COP">COP · Peso colombiano</option>
                    {settings.provider !== 'wompi' ? <option value="USD">USD · Dólar estadounidense</option> : null}
                    {settings.provider !== 'wompi' ? <option value="EUR">EUR · Euro</option> : null}
                  </select>
                </Field>
              </div>
              <label className="payments-switch-row">
                <span><strong>Pagos activos</strong><small>Habilita este proveedor para nuevas órdenes del checkout.</small></span>
                <input type="checkbox" checked={settings.active} onChange={(event) => update({ active: event.target.checked })} />
              </label>
              {settings.active && settings.mode === 'production' ? (
                <label className="payments-production-confirm" data-error={Boolean(errors.confirmProduction)}>
                  <input type="checkbox" checked={confirmProduction} onChange={(event) => setConfirmProduction(event.target.checked)} />
                  <span><strong>Confirmo el uso de cobros reales</strong><small>Verifiqué credenciales, moneda y flujo completo antes de activar producción.</small></span>
                </label>
              ) : null}
            </div>
          ) : null}

          {activeStep === 'credentials' ? (
            <div className="payments-panel" data-testid="payments-step-credentials">
              <header><KeyRound size={22} /><div><h3>Credenciales protegidas</h3><p>Los secretos guardados nunca vuelven a mostrarse. Déjalos vacíos para conservarlos.</p></div></header>
              {!currentProvider ? <div className="payments-empty">Selecciona primero un proveedor.</div> : (
                <div className="payments-form-grid">
                  {currentProvider.fields.map((field) => {
                    const path = fieldPath(currentProvider.id, field.key);
                    const compound = `${currentProvider.id}.${field.key}`;
                    const configured = field.secret && credentialStatus?.[currentProvider.id]?.[field.key];
                    const value = settings.credentials[currentProvider.id][field.key] || '';
                    const visible = showSecrets[compound] === true;
                    return (
                      <Field key={field.key} label={field.label} error={errors[path]} help={configured && !value ? 'Configurado y protegido; escribe solo si deseas reemplazarlo.' : field.secret ? 'Se almacenará como credencial sensible.' : null}>
                        <div className="payments-secret-control">
                          {field.textarea ? (
                            <textarea rows={4} value={value} placeholder={field.placeholder} onChange={(event) => updateCredential(field.key, event.target.value)} />
                          ) : (
                            <input type={field.secret && !visible ? 'password' : 'text'} value={value} placeholder={configured && !value ? '•••••••• configurado' : field.placeholder} autoComplete="off" spellCheck={false} onChange={(event) => updateCredential(field.key, event.target.value)} />
                          )}
                          {field.secret ? <button type="button" aria-label={visible ? 'Ocultar valor' : 'Mostrar valor'} onClick={() => setShowSecrets((current) => ({ ...current, [compound]: !visible }))}>{visible ? <EyeOff size={17} /> : <Eye size={17} />}</button> : null}
                        </div>
                      </Field>
                    );
                  })}
                </div>
              )}
              {settings.provider === 'wompi' ? (
                <div className="payments-test-box">
                  <div><strong>Validación de comercio Wompi</strong><small>Consulta el comercio usando la llave pública y el ambiente seleccionados.</small></div>
                  <button type="button" onClick={handleTest} disabled={testing || !settings.credentials.wompi.publicKey}>{testing ? <Loader2 className="animate-spin" size={16} /> : <BadgeCheck size={16} />} Probar conexión</button>
                  {testResult ? <p data-ok={testResult.ok}>{testResult.message}</p> : null}
                </div>
              ) : null}
            </div>
          ) : null}

          {activeStep === 'checkout' ? (
            <div className="payments-panel" data-testid="payments-step-checkout">
              <header><Store size={22} /><div><h3>Experiencia de checkout</h3><p>Mensajes y confirmaciones que acompañarán el pago del cliente.</p></div></header>
              <div className="payments-form-grid payments-form-grid--single">
                <Field label="Texto visible en checkout" help="Explica de forma breve qué ocurrirá al continuar."><input value={settings.checkoutLabel} maxLength={180} onChange={(event) => update({ checkoutLabel: event.target.value })} placeholder="Paga de forma segura con…" /></Field>
                <Field label="Mensaje posterior al pago"><textarea rows={4} value={settings.successMessage} maxLength={500} onChange={(event) => update({ successMessage: event.target.value })} placeholder="Recibimos tu pago y estamos validando la transacción." /></Field>
              </div>
              {currentProvider && currentProvider.id !== 'manual' ? (
                <div className="payments-webhook">
                  <div className="payments-webhook__heading"><Webhook size={19} /><span><strong>Confirmación automática</strong><small>Registra esta URL exacta en el panel del proveedor.</small></span><input type="checkbox" checked={settings.enableWebhook} onChange={(event) => update({ enableWebhook: event.target.checked })} /></div>
                  <div className="payments-webhook__url"><code>{webhookUrl}</code><button type="button" onClick={copyWebhook}><Copy size={15} /> {copied ? 'Copiado' : 'Copiar'}</button></div>
                </div>
              ) : null}
            </div>
          ) : null}
        </section>

        <aside className="payments-summary">
          <span className="payments-eyebrow">Estado operativo</span>
          <div className="payments-summary__provider"><ProviderIcon size={21} /><div><strong>{currentProvider?.label || 'Sin proveedor'}</strong><small>{settings.mode === 'production' ? 'Producción' : 'Pruebas / Sandbox'}</small></div></div>
          <dl>
            <div><dt>Configuración</dt><dd data-ok={localReadiness.ready}>{localReadiness.ready ? 'Completa' : 'Pendiente'}</dd></div>
            <div><dt>Checkout</dt><dd data-ok={settings.active && localReadiness.ready}>{settings.active ? 'Activo' : 'Desactivado'}</dd></div>
            <div><dt>Webhook</dt><dd>{settings.provider === 'manual' ? 'No aplica' : settings.enableWebhook ? 'Activo' : 'Inactivo'}</dd></div>
            <div><dt>Moneda</dt><dd>{settings.currency}</dd></div>
          </dl>
          <div className="payments-summary__notice" data-ready={serverReady || localReadiness.ready}>
            {localReadiness.ready ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
            <p>{localReadiness.ready ? 'El proveedor tiene los datos obligatorios. Guarda los cambios para sincronizarlo.' : 'Completa las credenciales obligatorias antes de activar cobros.'}</p>
          </div>
          <p className="payments-summary__boundary"><ShieldCheck size={15} /> Facturación fiscal continúa administrándose exclusivamente desde el módulo principal de Facturación.</p>
        </aside>
      </div>

      <footer className="payments-actions">
        <div><strong>{dirty ? 'Tienes cambios sin guardar' : 'Información sincronizada'}</strong><small>Versión {revision}</small></div>
        <button type="button" className="payments-button payments-button--secondary" onClick={() => { setSettings(snapshot); setErrors({}); setFeedback(null); setConfirmProduction(false); }} disabled={!dirty || saving}><RefreshCcw size={17} /> Descartar</button>
        <button type="button" className="payments-button payments-button--primary" onClick={handleSave} disabled={!dirty || saving}>{saving ? <Loader2 className="animate-spin" size={17} /> : <Save size={17} />} {saving ? 'Guardando…' : 'Guardar cambios'}</button>
      </footer>
    </div>
  );
}
