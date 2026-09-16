import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  activateAdminShippingProvider,
  confirmAdminShippingWebhook,
  disableAdminShippingProvider,
  getAdminShippingSettings,
  getAdminShippingWebhookCandidates,
  testAdminShippingConnection,
  testAdminShippingWebhook,
  updateAdminShippingSettings,
} from '../../../api/adminShippingSettingsApi';
import './ShippingCenter.css';

function StatusPill({ tone = 'gray', children }) {
  const tones = {
    gray: 'neutral',
    green: 'success',
    amber: 'warning',
    red: 'danger',
    blue: 'primary',
  };
  return (
    <span
      data-tone={tones[tone]}
      className="shipping-status inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold"
    >
      {children}
    </span>
  );
}

function ActionButton({ children, busy, disabled, tone = 'dark', ...props }) {
  const tones = {
    dark: 'shipping-primary-action border',
    pink: 'shipping-primary-action border',
    light: 'shipping-secondary-action border',
    red: 'shipping-danger-action border',
  };
  return (
    <button
      type="button"
      disabled={disabled || busy}
      className={`rounded-xl px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${tones[tone]}`}
      {...props}
    >
      {busy ? 'Procesando…' : children}
    </button>
  );
}

function formatDate(value) {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toLocaleString('es-CO', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function friendlyShippingError(error) {
  const message = String(error?.userMessage || error?.message || '').trim();

  if (/INTEGRATIONS_ENCRYPTION_KEY|encryption key|llave compatible|llave maestra|reiniciar el backend/i.test(message)) {
    return 'La conexión segura con transportadoras aún no está habilitada. La tienda continuará trabajando con entrega manual mientras soporte técnico completa la preparación.';
  }

  if (/BACKEND_URL|trycloudflare|URL HTTPS permanente/i.test(message)) {
    return 'La dirección segura para recibir actualizaciones de la transportadora aún no está disponible. Contacta al soporte técnico.';
  }

  return message || 'No fue posible completar la operación. Intenta nuevamente.';
}

export default function ShippingProvidersCard({ onStatusChange }) {
  const [data, setData] = useState(null);
  const [mode, setMode] = useState('sandbox');
  const [token, setToken] = useState('');
  const [sandboxWebhookToken, setSandboxWebhookToken] = useState('');
  const sandboxWebhookTokenRef = useRef(null);
  const [webhookSecret, setWebhookSecret] = useState('');
  const [dutiesPaymentEntity, setDutiesPaymentEntity] = useState('recipient');
  const [clearToken, setClearToken] = useState(false);
  const [clearSandboxWebhookToken, setClearSandboxWebhookToken] = useState(false);
  const [clearWebhookSecret, setClearWebhookSecret] = useState(false);
  const [confirmProduction, setConfirmProduction] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState('');
  const [feedback, setFeedback] = useState(null);
  const [webhookCandidates, setWebhookCandidates] = useState([]);
  const [selectedWebhookCandidate, setSelectedWebhookCandidate] = useState('');
  const [loadingWebhookCandidates, setLoadingWebhookCandidates] = useState(false);
  const [manualCarrier, setManualCarrier] = useState('');
  const [manualTrackingNumber, setManualTrackingNumber] = useState('');

  const applyResponse = useCallback((response) => {
    setData(response);
    onStatusChange?.(response);
    setMode(response?.settings?.enviaMode || 'sandbox');
    setToken('');
    setSandboxWebhookToken('');
    setWebhookSecret('');
    setDutiesPaymentEntity(
      response?.settings?.internationalDutiesPaymentEntity || 'recipient'
    );
    setClearToken(false);
    setClearSandboxWebhookToken(false);
    setClearWebhookSecret(false);
    setConfirmProduction(false);
  }, [onStatusChange]);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      applyResponse(await getAdminShippingSettings());
      setFeedback(null);
    } catch (error) {
      setFeedback({ type: 'error', text: friendlyShippingError(error) });
    } finally {
      setLoading(false);
    }
  }, [applyResponse]);

  useEffect(() => {
    load();
  }, [load]);

  const settings = data?.settings || {};
  const meta = data?.meta || {};
  const ready = meta.readiness || {};
  const credentialStorageUnavailable = meta.encryptionConfigured === false;
  const selectedEnvia = settings.defaultProvider === 'envia';
  const savedProductionMode = settings.enviaMode === 'production';
  const activeEnvia = Boolean(
    selectedEnvia &&
    (savedProductionMode ? ready.canActivateProduction : ready.canActivateSandbox)
  );
  const pendingEnvia = selectedEnvia && !activeEnvia;
  const production = mode === 'production';
  const writesSecret = Boolean(
    token.trim() || sandboxWebhookToken.trim() || webhookSecret.trim()
  );
  const secretsChanged = Boolean(
    writesSecret || clearToken || clearSandboxWebhookToken || clearWebhookSecret
  );
  const saveBlocked = writesSecret && credentialStorageUnavailable;
  const savedMode = mode === settings.enviaMode;
  const waitingWebhookProof = Boolean(
    savedMode && ready.webhookRegistered && !ready.webhookVerified
  );

  const loadWebhookCandidates = useCallback(async ({ announce = false } = {}) => {
    try {
      setLoadingWebhookCandidates(true);
      const response = await getAdminShippingWebhookCandidates();
      const candidates = Array.isArray(response?.candidates)
        ? response.candidates
        : [];
      setWebhookCandidates(candidates);
      setSelectedWebhookCandidate((current) => {
        const stillExists = candidates.some(
          (candidate) =>
            `${candidate.carrier}:${candidate.trackingNumber}` === current
        );
        return stillExists
          ? current
          : candidates[0]
            ? `${candidates[0].carrier}:${candidates[0].trackingNumber}`
            : '';
      });
      if (announce) {
        setFeedback({
          type: candidates.length ? 'success' : 'error',
          text: candidates.length
            ? `Se encontraron ${candidates.length} guías disponibles en Envia Sandbox.`
            : 'Envia no devolvió guías recientes. Puedes escribir abajo una guía existente de esta cuenta.',
        });
      }
    } catch (error) {
      setWebhookCandidates([]);
      if (announce) {
        setFeedback({ type: 'error', text: friendlyShippingError(error) });
      }
    } finally {
      setLoadingWebhookCandidates(false);
    }
  }, []);

  useEffect(() => {
    if (!waitingWebhookProof || production) return;
    loadWebhookCandidates();
  }, [loadWebhookCandidates, production, waitingWebhookProof]);

  useEffect(() => {
    if (!waitingWebhookProof) return undefined;
    let active = true;

    const refreshWebhookProof = async () => {
      try {
        const response = await getAdminShippingSettings();
        if (!active) return;
        setData(response);
        if (response?.meta?.readiness?.webhookVerified) {
          setFeedback({
            type: 'success',
            text: 'Envia confirmó la conexión: la prueba real del webhook fue recibida.',
          });
        }
      } catch {
        // La consulta principal seguirá mostrando cualquier error relevante.
      }
    };

    const intervalId = window.setInterval(refreshWebhookProof, 3000);
    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, [waitingWebhookProof]);

  const checklist = useMemo(
    () => [
      { label: 'Token guardado', done: savedMode && ready.hasToken },
      { label: 'Conexión autenticada', done: savedMode && ready.tested },
      ...(!production
        ? [
            {
              label: 'Credencial del webhook guardada',
              done: savedMode && ready.hasSandboxWebhookToken,
            },
          ]
        : []),
      ...(production
        ? [
            { label: 'Secreto de webhook guardado', done: savedMode && ready.hasWebhookSecret },
          ]
        : []),
      {
        label: production ? 'URL HTTPS permanente' : 'URL pública HTTPS',
        done: production ? ready.webhookUrlPermanent : ready.webhookUrlReady,
      },
      { label: 'URL registrada en Envia', done: savedMode && ready.webhookRegistered },
      { label: 'Prueba recibida desde Envia', done: savedMode && ready.webhookVerified },
    ],
    [production, ready, savedMode]
  );

  const completedSteps = checklist.filter((item) => item.done).length;
  const progressPercent = checklist.length
    ? Math.round((completedSteps / checklist.length) * 100)
    : 0;
  const credentialsReady = Boolean(
    savedMode &&
      ready.hasToken &&
      (production ? ready.hasWebhookSecret : ready.hasSandboxWebhookToken)
  );
  const existingCredentialsDetected = Boolean(
    ready.hasToken || ready.hasSandboxWebhookToken || ready.hasWebhookSecret
  );
  const existingCredentialsReadOnly = Boolean(
    credentialStorageUnavailable && existingCredentialsDetected
  );
  const noExistingConnection = Boolean(
    credentialStorageUnavailable && !existingCredentialsDetected
  );
  const nextStep = noExistingConnection
    ? 'La entrega automática está pendiente de habilitación por soporte técnico.'
    : !savedMode
    ? 'Guarda el ambiente seleccionado para continuar.'
    : !credentialsReady
      ? existingCredentialsReadOnly
        ? 'La conexión existente fue detectada, pero falta completar la autorización de avisos automáticos.'
        : 'Completa y guarda las credenciales de esta conexión.'
      : !ready.tested
        ? 'Pulsa “Probar conexión” para validar el token con Envia.'
        : !ready.webhookRegistered
          ? 'Copia la URL, regístrala en Envia y confirma “Ya registré la URL”.'
          : !ready.webhookVerified
            ? 'Solicita la prueba oficial: Envia enviará un POST autenticado y esta pantalla lo detectará sola.'
            : !selectedEnvia
              ? `Todo está listo. Activa Envia ${production ? 'Producción' : 'Sandbox'}.`
              : 'Envia está conectado y ya puede operar desde las órdenes.';

  const runAction = async (name, action) => {
    try {
      setBusyAction(name);
      setFeedback(null);
      const response = await action();
      applyResponse(response);
      setFeedback({ type: 'success', text: response?.message || 'Operación completada.' });
    } catch (error) {
      setFeedback({ type: 'error', text: friendlyShippingError(error) });
    } finally {
      setBusyAction('');
    }
  };

  const selectedGuide = webhookCandidates.find(
    (candidate) =>
      `${candidate.carrier}:${candidate.trackingNumber}` === selectedWebhookCandidate
  );
  const requestWebhookTest = (guide = selectedGuide) => {
    const carrier = String(guide?.carrier || manualCarrier).trim();
    const trackingNumber = String(
      guide?.trackingNumber || manualTrackingNumber
    ).trim();
    if (!carrier || !trackingNumber) {
      setFeedback({
        type: 'error',
        text: 'Selecciona una guía o escribe la transportadora y el número de guía existente.',
      });
      return;
    }
    runAction('webhook-test', () =>
      testAdminShippingWebhook({ carrier, trackingNumber })
    );
  };

  const save = () => {
    const sandboxWebhookTokenFromField = String(
      sandboxWebhookTokenRef.current?.value || sandboxWebhookToken
    ).trim();
    return runAction('save', () =>
      updateAdminShippingSettings({
        enviaMode: mode,
        internationalDutiesPaymentEntity: dutiesPaymentEntity,
        ...(token.trim() ? { enviaToken: token.trim() } : {}),
        ...(sandboxWebhookTokenFromField
          ? { sandboxWebhookToken: sandboxWebhookTokenFromField }
          : {}),
        ...(webhookSecret.trim() ? { webhookSecret: webhookSecret.trim() } : {}),
        ...(clearToken && !token.trim() ? { clearEnviaToken: true } : {}),
        ...(clearSandboxWebhookToken && !sandboxWebhookTokenFromField
          ? { clearSandboxWebhookToken: true }
          : {}),
        ...(clearWebhookSecret && !webhookSecret.trim() ? { clearWebhookSecret: true } : {}),
      })
    );
  };

  const copyWebhookUrl = async () => {
    try {
      await navigator.clipboard.writeText(meta.webhookUrl || '');
      setFeedback({ type: 'success', text: 'URL del webhook copiada.' });
    } catch {
      setFeedback({ type: 'error', text: 'No fue posible copiar la URL.' });
    }
  };

  if (loading) {
    return (
      <div className="shipping-center shipping-surface shipping-muted rounded-[28px] border p-6 text-sm shadow-sm">
        Cargando la configuración de entrega…
      </div>
    );
  }

  const fieldClass =
    'shipping-field w-full rounded-xl border px-3 py-2.5 text-sm outline-none transition';
  const operationLabel = activeEnvia
    ? `Envia ${savedProductionMode ? 'Producción' : 'Sandbox'}`
    : 'Operación manual';

  return (
    <section className="shipping-center shipping-surface overflow-hidden rounded-[28px] border shadow-sm">
      <div className="shipping-provider-hero px-5 py-5 md:px-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="shipping-accent text-xs font-bold uppercase tracking-[0.18em]">
              Entrega del paquete
            </p>
            <h3 className="mt-1 text-2xl font-black">¿Quién llevará el pedido?</h3>
            <p className="shipping-muted mt-1 max-w-2xl text-sm leading-6">
              La operación manual seguirá protegiendo la tienda hasta que Envia complete todos los controles.
            </p>
          </div>
          <div className="shipping-current-operation min-w-[240px] rounded-2xl border px-4 py-3 backdrop-blur">
            <p className="shipping-muted text-xs font-bold uppercase tracking-wide">Funcionando ahora</p>
            <p className="mt-1 text-lg font-black">{operationLabel}</p>
            <div className="mt-2">
              <StatusPill tone={activeEnvia ? 'green' : pendingEnvia ? 'amber' : 'gray'}>
                {activeEnvia
                  ? `Activo: Envia ${savedProductionMode ? 'Producción' : 'Sandbox'}`
                  : pendingEnvia
                    ? `Pendiente: Envia ${savedProductionMode ? 'Producción' : 'Sandbox'}`
                    : 'Activo: Operación manual'}
              </StatusPill>
            </div>
          </div>
        </div>
      </div>

      <div className="p-4 md:p-5">
        {feedback && (
          <div
            role="status"
            className={`mb-4 rounded-xl border px-4 py-3 text-sm font-semibold ${feedback.type === 'success' ? 'shipping-alert-success' : 'shipping-alert-danger'}`}
          >
            {feedback.text}
          </div>
        )}

        {pendingEnvia && (
          <div className="shipping-alert-warning mb-4 flex flex-col gap-3 rounded-2xl border p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-black">Envia todavía no está transportando pedidos</p>
              <p className="mt-1 text-sm leading-6">
                Envia está seleccionada, pero todavía no opera. La tienda continúa en operación manual hasta recibir y comprobar la prueba del webhook.
              </p>
            </div>
            <StatusPill tone="green">Activa por seguridad</StatusPill>
          </div>
        )}

        <div className="shipping-soft-surface mb-5 rounded-2xl border p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="shipping-accent text-xs font-bold uppercase tracking-[0.16em]">
                {noExistingConnection ? 'Estado de la entrega' : 'Haz esto ahora'}
              </p>
              <p className="mt-1 text-base font-black">{nextStep}</p>
              {noExistingConnection && (
                <p className="shipping-muted mt-1 text-sm leading-5">
                  No necesitas configurar ni reiniciar nada. La tienda continuará procesando los envíos manualmente sin afectar las ventas.
                </p>
              )}
            </div>
            {noExistingConnection ? (
              <StatusPill tone="green">Operación manual activa</StatusPill>
            ) : (
              <div className="min-w-[190px]">
                <div className="shipping-muted flex items-center justify-between text-xs font-bold">
                  <span>Preparación de Envia</span>
                  <span>{completedSteps}/{checklist.length}</span>
                </div>
                <div className="shipping-progress-track mt-2 h-2 overflow-hidden rounded-full">
                  <div
                    className="shipping-progress-value h-full rounded-full transition-all"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="grid content-start gap-3">
            <details
              open={!noExistingConnection && (!credentialsReady || secretsChanged || !ready.tested)}
              className="shipping-details group overflow-hidden rounded-2xl border"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-4 marker:hidden">
                <span className="flex items-center gap-3">
                  <span data-active={!credentialsReady} className="shipping-step-number rounded-lg px-2 py-1 text-xs font-black">01</span>
                  <span>
                    <span className="block text-sm font-black">Cuenta y credenciales</span>
                    <span className="shipping-muted block text-xs">
                      {noExistingConnection
                        ? 'Pendiente de habilitación por soporte técnico'
                        : existingCredentialsReadOnly
                          ? 'Credenciales existentes detectadas'
                        : 'Ambiente, token y autorización segura'}
                    </span>
                  </span>
                </span>
                <span className="shipping-muted text-xs font-bold group-open:hidden">Abrir</span>
                <span className="shipping-muted hidden text-xs font-bold group-open:inline">Cerrar</span>
              </summary>

              <div className="shipping-details-body border-t p-4">
                {noExistingConnection ? (
                  <div className="shipping-alert-success rounded-xl border p-4">
                    <p className="text-sm font-black">La tienda puede continuar operando</p>
                    <p className="mt-1 text-sm leading-6">
                      La entrega manual permanece activa. Cuando soporte técnico habilite la conexión segura, este formulario se activará automáticamente.
                    </p>
                  </div>
                ) : existingCredentialsReadOnly ? (
                  <div className="grid gap-4">
                    <div className="shipping-alert-success rounded-xl border p-4">
                      <p className="text-sm font-black">Conexión existente detectada</p>
                      <p className="mt-1 text-sm leading-6">
                        El panel utilizará las credenciales que ya estaban configuradas. No necesitas pegarlas nuevamente.
                      </p>
                    </div>

                    <div className="grid gap-2 sm:grid-cols-2">
                      <div className="shipping-check-item rounded-xl border px-3 py-2 text-xs font-semibold" data-complete={Boolean(ready.hasToken)}>
                        <span className="flex items-center justify-between gap-3">
                          <span>Token de Envia</span>
                          <span>{ready.hasToken ? 'Listo' : 'Pendiente'}</span>
                        </span>
                      </div>
                      <div
                        className="shipping-check-item rounded-xl border px-3 py-2 text-xs font-semibold"
                        data-complete={Boolean(production ? ready.hasWebhookSecret : ready.hasSandboxWebhookToken)}
                      >
                        <span className="flex items-center justify-between gap-3">
                          <span>{production ? 'Autorización de Producción' : 'Autorización Sandbox'}</span>
                          <span>{production ? ready.hasWebhookSecret ? 'Lista' : 'Pendiente' : ready.hasSandboxWebhookToken ? 'Lista' : 'Pendiente'}</span>
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <ActionButton
                        tone="light"
                        busy={busyAction === 'test'}
                        disabled={!ready.canTest || mode !== settings.enviaMode}
                        onClick={() => runAction('test', testAdminShippingConnection)}
                      >
                        Probar conexión existente
                      </ActionButton>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="grid gap-4 md:grid-cols-2">
                  <label className="block">
                    <span className="mb-1 block text-sm font-bold text-gray-700">Ambiente</span>
                    <select
                      value={mode}
                      onChange={(event) => {
                        setMode(event.target.value);
                        setConfirmProduction(false);
                      }}
                      className={fieldClass}
                    >
                      <option value="sandbox">Sandbox — pruebas</option>
                      <option value="production">Producción — operaciones reales</option>
                    </select>
                  </label>

                  <div className="block">
                    <label htmlFor="envia-token" className="mb-1 block text-sm font-bold text-gray-700">Token de Envia</label>
                    <input
                      id="envia-token"
                      type="password"
                      autoComplete="new-password"
                      value={token}
                      onChange={(event) => {
                        setToken(event.target.value);
                        if (event.target.value) setClearToken(false);
                      }}
                      className={fieldClass}
                      placeholder={settings.enviaTokenHint || 'Pegar nuevo token'}
                    />
                    <span className="mt-1 block text-xs text-gray-500">
                      {settings.hasEnviaToken ? `Guardado: ${settings.enviaTokenHint || 'credencial protegida'}. Déjalo vacío para conservarlo.` : 'Todavía no hay token guardado.'}
                    </span>
                    {meta.credentialSource === 'database' && (
                      <label className="shipping-danger-text mt-2 flex items-center gap-2 text-xs">
                        <input type="checkbox" checked={clearToken} onChange={(event) => setClearToken(event.target.checked)} />
                        Eliminar el token guardado al guardar
                      </label>
                    )}
                  </div>

                  {!production && (
                    <div className="block md:col-span-2">
                      <label htmlFor="envia-sandbox-webhook-token" className="mb-1 block text-sm font-bold text-gray-700">
                        Credencial de autorización del webhook Sandbox
                      </label>
                      <input
                        id="envia-sandbox-webhook-token"
                        ref={sandboxWebhookTokenRef}
                        type="password"
                        autoComplete="new-password"
                        value={sandboxWebhookToken}
                        onChange={(event) => {
                          setSandboxWebhookToken(event.target.value);
                          if (event.target.value) setClearSandboxWebhookToken(false);
                        }}
                        className={fieldClass}
                        placeholder={settings.sandboxWebhookTokenHint || 'Pegar la credencial generada por Envia'}
                      />
                      <span className="mt-1 block text-xs text-gray-500">
                        {settings.hasSandboxWebhookToken
                          ? `Guardada: ${settings.sandboxWebhookTokenHint || 'credencial protegida'}. Déjala vacía para conservarla.`
                          : 'En el portal Sandbox, guarda un webhook firmado de seguimiento y copia aquí su secreto. No uses aquí el token de la API.'}
                      </span>
                      {meta.sandboxWebhookTokenSource === 'database' && (
                        <label className="shipping-danger-text mt-2 flex items-center gap-2 text-xs">
                          <input type="checkbox" checked={clearSandboxWebhookToken} onChange={(event) => setClearSandboxWebhookToken(event.target.checked)} />
                          Eliminar la credencial Sandbox guardada al guardar
                        </label>
                      )}
                    </div>
                  )}

                  {production && (
                    <div className="block md:col-span-2">
                      <label htmlFor="envia-webhook-secret" className="mb-1 block text-sm font-bold text-gray-700">Secreto de firma del webhook</label>
                      <input
                        id="envia-webhook-secret"
                        type="password"
                        autoComplete="new-password"
                        value={webhookSecret}
                        onChange={(event) => {
                          setWebhookSecret(event.target.value);
                          if (event.target.value) setClearWebhookSecret(false);
                        }}
                        className={fieldClass}
                        placeholder={settings.webhookSecretHint || 'Pegar secreto HMAC para producción'}
                      />
                      <span className="mt-1 block text-xs text-gray-500">
                        {settings.hasWebhookSecret ? `Guardado: ${settings.webhookSecretHint || 'secreto protegido'}. Déjalo vacío para conservarlo.` : 'Requerido para validar eventos reales en producción.'}
                      </span>
                      {meta.webhookSecretSource === 'database' && (
                        <label className="shipping-danger-text mt-2 flex items-center gap-2 text-xs">
                          <input type="checkbox" checked={clearWebhookSecret} onChange={(event) => setClearWebhookSecret(event.target.checked)} />
                          Eliminar el secreto guardado al guardar
                        </label>
                      )}
                    </div>
                  )}

                  <label className="block md:col-span-2">
                    <span className="mb-1 block text-sm font-bold text-gray-700">Impuestos internacionales</span>
                    <select value={dutiesPaymentEntity} onChange={(event) => setDutiesPaymentEntity(event.target.value)} className={fieldClass}>
                      <option value="recipient">Los paga el destinatario (DAP)</option>
                      <option value="sender">Los paga la tienda (DDP)</option>
                      <option value="envia_guaranteed">Envia Guaranteed, cuando esté disponible</option>
                    </select>
                    <span className="mt-1 block text-xs text-gray-500">Solo se usa cuando el origen y el destino están en países distintos.</span>
                  </label>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <ActionButton tone="pink" busy={busyAction === 'save'} disabled={saveBlocked} onClick={save}>Guardar configuración</ActionButton>
                      <ActionButton
                        tone="light"
                        busy={busyAction === 'test'}
                        disabled={!ready.canTest || secretsChanged || mode !== settings.enviaMode}
                        onClick={() => runAction('test', testAdminShippingConnection)}
                      >
                        Probar conexión
                      </ActionButton>
                    </div>
                    {secretsChanged && <p className="mt-2 text-xs text-gray-500">Guarda los cambios antes de probar o activar.</p>}
                  </>
                )}
              </div>
            </details>

            <details
              open={ready.tested && !ready.webhookVerified}
              className="shipping-details group overflow-hidden rounded-2xl border"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-4 marker:hidden">
                <span className="flex items-center gap-3">
                  <span data-active={!ready.webhookVerified} className="shipping-step-number rounded-lg px-2 py-1 text-xs font-black">02</span>
                  <span>
                    <span className="block text-sm font-black">Avisos automáticos de Envia</span>
                    <span className="shipping-muted block text-xs">Registra una sola URL y comprueba el webhook</span>
                  </span>
                </span>
                <span className="shipping-muted text-xs font-bold group-open:hidden">Abrir</span>
                <span className="shipping-muted hidden text-xs font-bold group-open:inline">Cerrar</span>
              </summary>

              <div className="shipping-details-body border-t p-4">
                <div className="shipping-surface rounded-xl border p-3">
                  <p className="shipping-muted text-xs font-bold uppercase tracking-wide">URL para registrar en Envia</p>
                  <code className="shipping-code mt-2 block break-all rounded-lg px-3 py-2 text-xs">{meta.webhookUrl || 'Dirección pública pendiente de habilitación'}</code>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <ActionButton tone="light" disabled={!meta.webhookUrl} onClick={copyWebhookUrl}>Copiar URL</ActionButton>
                    {meta.webhookDashboardUrl && (
                      <a href={meta.webhookDashboardUrl} target="_blank" rel="noreferrer" className="shipping-link-action rounded-xl border px-4 py-2 text-sm font-semibold">
                        Abrir portal de Envia
                      </a>
                    )}
                    <ActionButton
                      tone="light"
                      busy={busyAction === 'webhook'}
                      disabled={!ready.canConfirmWebhook || ready.webhookRegistered || production !== (settings.enviaMode === 'production')}
                      onClick={() => runAction('webhook', confirmAdminShippingWebhook)}
                    >
                      Ya registré la URL
                    </ActionButton>
                  </div>

                  {ready.webhookRegistered && !ready.webhookVerified && !production && (
                    <div className="shipping-soft-surface mt-3 rounded-xl border p-3">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                        <label className="min-w-0 flex-1">
                          <span className="mb-1 block text-xs font-bold uppercase tracking-wide">
                            Guía para la prueba
                          </span>
                          <select
                            aria-label="Guía para la prueba del webhook"
                            className={fieldClass}
                            value={selectedWebhookCandidate}
                            disabled={loadingWebhookCandidates || !webhookCandidates.length}
                            onChange={(event) => setSelectedWebhookCandidate(event.target.value)}
                          >
                            {!webhookCandidates.length && (
                              <option value="">
                                {loadingWebhookCandidates
                                  ? 'Consultando guías de Envia…'
                                  : 'No se encontraron guías recientes'}
                              </option>
                            )}
                            {webhookCandidates.map((candidate) => {
                              const value = `${candidate.carrier}:${candidate.trackingNumber}`;
                              return (
                                <option key={value} value={value}>
                                  {candidate.carrier.toUpperCase()} · {candidate.trackingNumber}
                                </option>
                              );
                            })}
                          </select>
                        </label>
                        <div className="flex flex-wrap gap-2">
                          <ActionButton
                            tone="light"
                            busy={loadingWebhookCandidates}
                            onClick={() => loadWebhookCandidates({ announce: true })}
                          >
                            Actualizar guías
                          </ActionButton>
                          <ActionButton
                            tone="pink"
                            busy={busyAction === 'webhook-test'}
                            disabled={!selectedGuide}
                            onClick={() => requestWebhookTest(selectedGuide)}
                          >
                            Enviar prueba con esta guía
                          </ActionButton>
                        </div>
                      </div>

                      <details className="mt-3">
                        <summary className="shipping-muted cursor-pointer text-xs font-semibold">
                          ¿La guía no aparece? Escribir una existente
                        </summary>
                        <div className="mt-2 grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_auto] sm:items-end">
                          <label>
                            <span className="mb-1 block text-xs font-bold">Transportadora</span>
                            <input
                              aria-label="Transportadora de la guía"
                              className={fieldClass}
                              value={manualCarrier}
                              onChange={(event) => setManualCarrier(event.target.value)}
                              placeholder="Ej. DHL"
                            />
                          </label>
                          <label>
                            <span className="mb-1 block text-xs font-bold">Número de guía</span>
                            <input
                              aria-label="Número de guía para la prueba"
                              className={fieldClass}
                              value={manualTrackingNumber}
                              onChange={(event) => setManualTrackingNumber(event.target.value)}
                              placeholder="Guía existente en esta cuenta Sandbox"
                            />
                          </label>
                          <ActionButton
                            tone="pink"
                            busy={busyAction === 'webhook-test'}
                            disabled={!manualCarrier.trim() || !manualTrackingNumber.trim()}
                            onClick={() => requestWebhookTest(null)}
                          >
                            Probar guía
                          </ActionButton>
                        </div>
                      </details>
                    </div>
                  )}
                </div>

                {ready.webhookRegistered && !ready.webhookVerified && (
                  <div className="shipping-alert-warning mt-3 rounded-xl border p-3 text-sm font-semibold">
                    Esperando el POST autenticado de Envia
                  </div>
                )}
                {ready.webhookVerified && (
                  <div className="shipping-alert-success mt-3 rounded-xl border p-3 text-sm font-semibold">
                    Webhook comprobado por Envia{settings.webhookVerifiedAt ? ` · ${formatDate(settings.webhookVerifiedAt)}` : ''}
                  </div>
                )}
                {!ready.webhookUrlReady && <p className="shipping-warning-text mt-2 text-xs">La dirección segura para recibir actualizaciones aún está pendiente. Contacta al soporte técnico.</p>}
                {production && ready.temporaryWebhookUrl && (
                  <p className="shipping-danger-text mt-2 text-xs font-semibold">
                    La dirección actual es temporal y no puede utilizarse para operaciones reales. Solicita a soporte técnico una dirección permanente y segura.
                  </p>
                )}
              </div>
            </details>

            <details className="shipping-details group overflow-hidden rounded-2xl border">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-4 marker:hidden">
                <span>
                  <span className="block text-sm font-black">¿Qué hará Envia automáticamente?</span>
                  <span className="shipping-muted block text-xs">Explicación sencilla del proceso</span>
                </span>
                <span className="shipping-muted text-xs font-bold group-open:hidden">Ver explicación</span>
                <span className="shipping-muted hidden text-xs font-bold group-open:inline">Ocultar</span>
              </summary>
              <div className="shipping-explanation border-t p-4 text-sm leading-6">
                <p className="font-bold">¿Qué queda automático?</p>
                <p className="mt-1">
                  En cada orden el sistema consulta tarifas, crea la guía y pregunta si el paquete se recoge o se lleva a un punto autorizado. El administrador solo confirma la opción recomendada e imprime la etiqueta.
                </p>
                <p className="mt-2">
                  El webhook es el aviso que Envia envía cuando cambia el estado de la guía. Por eso el pedido se actualiza solo, sin pulsar “Sincronizar”.
                </p>
              </div>
            </details>
          </div>

          <aside className="grid content-start gap-3 lg:sticky lg:top-4">
            {noExistingConnection ? (
              <div className="shipping-alert-success rounded-2xl border p-4">
                <p className="text-sm font-black">Entrega disponible</p>
                <p className="mt-1 text-xs leading-5">
                  Operación manual activa. Podrás registrar la transportadora y la guía directamente desde cada orden.
                </p>
              </div>
            ) : (
              <div className="shipping-surface rounded-2xl border p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-black">Estado de la conexión</p>
                  <span className="shipping-muted text-xs font-bold">{progressPercent}%</span>
                </div>
                <div className="mt-3 grid gap-2">
                  {checklist.map((item) => (
                    <div key={item.label} data-complete={item.done} className="shipping-check-item flex items-center justify-between gap-3 rounded-xl border px-3 py-2 text-xs font-semibold">
                      <span>{item.label}</span>
                      <span aria-hidden="true">{item.done ? 'Listo' : 'Pendiente'}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {ready.tested && (
              <div className="shipping-alert-success rounded-2xl border p-4">
                <p className="text-sm font-black">Conexión aprobada</p>
                {settings.lastTestMessage && (
                  <p className={`mt-1 text-xs leading-5 ${settings.lastTestStatus === 'success' ? 'shipping-success-text' : 'shipping-danger-text'}`}>
                    {friendlyShippingError({ userMessage: settings.lastTestMessage })}{settings.lastTestAt ? ` · ${formatDate(settings.lastTestAt)}` : ''}
                  </p>
                )}
              </div>
            )}

            {production && !noExistingConnection && (
              <label className="shipping-alert-danger flex items-start gap-3 rounded-2xl border p-4 text-xs leading-5">
                <input type="checkbox" checked={confirmProduction} onChange={(event) => setConfirmProduction(event.target.checked)} className="mt-0.5 h-4 w-4" />
                Confirmo que este ambiente realizará cotizaciones y guías reales y que Envia comprobó el webhook.
              </label>
            )}

            {!noExistingConnection && (
              <ActionButton
                tone="dark"
                busy={busyAction === 'activate'}
                disabled={
                  activeEnvia ||
                  secretsChanged ||
                  mode !== settings.enviaMode ||
                  (production ? !ready.canActivateProduction || !confirmProduction : !ready.canActivateSandbox)
                }
                onClick={() => runAction('activate', () => activateAdminShippingProvider(production && confirmProduction))}
              >
                Activar {production ? 'Producción' : 'Sandbox'}
              </ActionButton>
            )}

            <div className={`rounded-2xl border p-4 ${!activeEnvia ? 'shipping-alert-success' : 'shipping-page-surface'}`}>
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-black">Operación manual</p>
                {!activeEnvia && <StatusPill tone="green">{pendingEnvia ? 'Protección actual' : 'Activa'}</StatusPill>}
              </div>
              <p className="shipping-muted mt-2 text-xs leading-5">El operador registra transportadora, guía y novedades desde la orden.</p>
              {selectedEnvia && (
                <div className="mt-3">
                  <ActionButton tone="red" busy={busyAction === 'disable'} onClick={() => runAction('disable', disableAdminShippingProvider)}>
                    {activeEnvia ? 'Desactivar API y volver a manual' : 'Cancelar Envia y seguir manual'}
                  </ActionButton>
                </div>
              )}
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}
