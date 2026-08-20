import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  activateAdminShippingProvider,
  disableAdminShippingProvider,
  getAdminShippingSettings,
  registerAdminShippingWebhook,
  testAdminShippingConnection,
  updateAdminShippingSettings,
} from '../../../api/adminShippingSettingsApi';

function StatusPill({ tone = 'gray', children }) {
  const tones = {
    gray: 'border-gray-200 bg-gray-50 text-gray-700',
    green: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    amber: 'border-amber-200 bg-amber-50 text-amber-700',
    red: 'border-red-200 bg-red-50 text-red-700',
    blue: 'border-blue-200 bg-blue-50 text-blue-700',
  };
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${tones[tone]}`}>
      {children}
    </span>
  );
}

function ActionButton({ children, busy, disabled, tone = 'dark', ...props }) {
  const tones = {
    dark: 'bg-gray-900 text-white hover:bg-gray-800',
    pink: 'bg-pink-500 text-white hover:bg-pink-600',
    light: 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50',
    red: 'border border-red-200 bg-red-50 text-red-700 hover:bg-red-100',
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

export default function ShippingProvidersCard() {
  const [data, setData] = useState(null);
  const [mode, setMode] = useState('sandbox');
  const [token, setToken] = useState('');
  const [webhookSecret, setWebhookSecret] = useState('');
  const [dutiesPaymentEntity, setDutiesPaymentEntity] = useState('recipient');
  const [clearToken, setClearToken] = useState(false);
  const [clearWebhookSecret, setClearWebhookSecret] = useState(false);
  const [confirmProduction, setConfirmProduction] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState('');
  const [feedback, setFeedback] = useState(null);

  const applyResponse = useCallback((response) => {
    setData(response);
    setMode(response?.settings?.enviaMode || 'sandbox');
    setToken('');
    setWebhookSecret('');
    setDutiesPaymentEntity(
      response?.settings?.internationalDutiesPaymentEntity || 'recipient'
    );
    setClearToken(false);
    setClearWebhookSecret(false);
    setConfirmProduction(false);
  }, []);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      applyResponse(await getAdminShippingSettings());
      setFeedback(null);
    } catch (error) {
      setFeedback({ type: 'error', text: error.userMessage });
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
  const activeEnvia = settings.defaultProvider === 'envia';
  const production = mode === 'production';
  const writesSecret = Boolean(token.trim() || webhookSecret.trim());
  const secretsChanged = Boolean(writesSecret || clearToken || clearWebhookSecret);
  const saveBlocked = writesSecret && !meta.encryptionConfigured;
  const savedMode = mode === settings.enviaMode;

  const checklist = useMemo(
    () => [
      { label: 'Token guardado', done: savedMode && ready.hasToken },
      { label: 'Conexión autenticada', done: savedMode && ready.tested },
      ...(production
        ? [
            { label: 'Secreto de webhook guardado', done: savedMode && ready.hasWebhookSecret },
            { label: 'URL pública HTTPS', done: ready.webhookUrlReady },
            { label: 'Webhook registrado', done: savedMode && ready.webhookRegistered },
          ]
        : []),
    ],
    [production, ready, savedMode]
  );

  const runAction = async (name, action) => {
    try {
      setBusyAction(name);
      setFeedback(null);
      const response = await action();
      applyResponse(response);
      setFeedback({ type: 'success', text: response?.message || 'Operación completada.' });
    } catch (error) {
      setFeedback({ type: 'error', text: error.userMessage || error.message });
    } finally {
      setBusyAction('');
    }
  };

  const save = () =>
    runAction('save', () =>
      updateAdminShippingSettings({
        enviaMode: mode,
        internationalDutiesPaymentEntity: dutiesPaymentEntity,
        ...(token.trim() ? { enviaToken: token.trim() } : {}),
        ...(webhookSecret.trim() ? { webhookSecret: webhookSecret.trim() } : {}),
        ...(clearToken && !token.trim() ? { clearEnviaToken: true } : {}),
        ...(clearWebhookSecret && !webhookSecret.trim() ? { clearWebhookSecret: true } : {}),
      })
    );

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
      <div className="rounded-2xl border border-gray-200 bg-white p-5 text-sm text-gray-500">
        Cargando proveedores de transporte…
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-lg font-bold text-gray-900">Transportadoras e integración API</p>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-gray-500">
            El usuario administrador guarda las credenciales aquí. Nunca se muestran nuevamente y el servidor las cifra antes de almacenarlas.
          </p>
        </div>
        <StatusPill tone={activeEnvia ? 'green' : 'gray'}>
          Activo: {activeEnvia ? `Envia ${settings.enviaMode === 'production' ? 'Producción' : 'Sandbox'}` : 'Operación manual'}
        </StatusPill>
      </div>

      {feedback && (
        <div
          role="status"
          className={`mt-4 rounded-xl border px-4 py-3 text-sm ${feedback.type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-800'}`}
        >
          {feedback.text}
        </div>
      )}

      <div className="mt-5 grid gap-4 lg:grid-cols-[0.85fr_2fr]">
        <div className={`rounded-2xl border p-4 ${!activeEnvia ? 'border-emerald-300 bg-emerald-50/50' : 'border-gray-200'}`}>
          <div className="flex items-center justify-between gap-3">
            <p className="font-bold text-gray-900">Operación manual</p>
            {!activeEnvia && <StatusPill tone="green">Activa</StatusPill>}
          </div>
          <p className="mt-2 text-sm leading-6 text-gray-600">
            Funciona sin cuentas externas. El operador registra transportadora, guía, novedades y evidencias desde cada orden.
          </p>
          {activeEnvia && (
            <div className="mt-4">
              <ActionButton
                tone="red"
                busy={busyAction === 'disable'}
                onClick={() => runAction('disable', disableAdminShippingProvider)}
              >
                Desactivar API y volver a manual
              </ActionButton>
            </div>
          )}
        </div>

        <div className={`rounded-2xl border p-4 ${activeEnvia ? 'border-pink-300 bg-pink-50/30' : 'border-gray-200'}`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-bold text-gray-900">Envia.com</p>
              <p className="text-sm text-gray-500">Cotización, guía, recolección o entrega en oficina, seguimiento y cancelación.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {ready.tested ? <StatusPill tone="green">Conexión aprobada</StatusPill> : <StatusPill tone="amber">Sin probar</StatusPill>}
              {ready.webhookRegistered && <StatusPill tone="blue">Webhook registrado</StatusPill>}
            </div>
          </div>

          {!meta.encryptionConfigured && (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-900">
              Antes de guardar credenciales, el responsable del servidor debe definir una sola vez <code>INTEGRATIONS_ENCRYPTION_KEY</code> con 32 caracteres o más y reiniciar el backend.
            </div>
          )}

          <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm leading-6 text-blue-900">
            <p className="font-semibold">¿Qué queda automático?</p>
            <p className="mt-1">
              En cada orden el sistema consulta tarifas, crea la guía y consulta a Envia si la
              transportadora exige recolección o permite llevar el paquete a un punto de entrega.
              El administrador solo confirma la opción recomendada e imprime la etiqueta.
            </p>
            <p className="mt-2">
              El webhook es el aviso que Envia envía al servidor cuando cambia el estado de la guía.
              Con él registrado, el pedido se actualiza sin pulsar “Sincronizar”. En Sandbox también
              puede probarse con el token guardado; la firma HMAC se exige siempre para los eventos
              reales de Producción.
            </p>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-sm font-semibold text-gray-700">Ambiente</span>
              <select
                value={mode}
                onChange={(event) => {
                  setMode(event.target.value);
                  setConfirmProduction(false);
                }}
                className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-pink-400"
              >
                <option value="sandbox">Sandbox — pruebas</option>
                <option value="production">Producción — operaciones reales</option>
              </select>
            </label>

            <div className="block">
              <label htmlFor="envia-token" className="mb-1 block text-sm font-semibold text-gray-700">Token de Envia</label>
              <input
                id="envia-token"
                type="password"
                autoComplete="new-password"
                value={token}
                onChange={(event) => {
                  setToken(event.target.value);
                  if (event.target.value) setClearToken(false);
                }}
                className="w-full rounded-xl border border-gray-300 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-pink-400"
                placeholder={settings.enviaTokenHint || 'Pegar nuevo token'}
              />
              <span className="mt-1 block text-xs text-gray-500">
                {settings.hasEnviaToken ? `Guardado: ${settings.enviaTokenHint || 'credencial protegida'}. Déjalo vacío para conservarlo.` : 'Todavía no hay token guardado.'}
              </span>
              {meta.credentialSource === 'database' && (
                <label className="mt-2 flex items-center gap-2 text-xs text-red-700">
                  <input
                    type="checkbox"
                    checked={clearToken}
                    onChange={(event) => setClearToken(event.target.checked)}
                  />
                  Eliminar el token guardado al guardar
                </label>
              )}
            </div>

            <div className="block md:col-span-2">
              <label htmlFor="envia-webhook-secret" className="mb-1 block text-sm font-semibold text-gray-700">Secreto de firma del webhook</label>
              <input
                id="envia-webhook-secret"
                type="password"
                autoComplete="new-password"
                value={webhookSecret}
                onChange={(event) => {
                  setWebhookSecret(event.target.value);
                  if (event.target.value) setClearWebhookSecret(false);
                }}
                className="w-full rounded-xl border border-gray-300 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-pink-400"
                placeholder={settings.webhookSecretHint || 'Pegar secreto HMAC para producción'}
              />
              <span className="mt-1 block text-xs text-gray-500">
                {settings.hasWebhookSecret ? `Guardado: ${settings.webhookSecretHint || 'secreto protegido'}. Déjalo vacío para conservarlo.` : 'Requerido para validar eventos reales en producción.'}
              </span>
              {meta.webhookSecretSource === 'database' && (
                <label className="mt-2 flex items-center gap-2 text-xs text-red-700">
                  <input
                    type="checkbox"
                    checked={clearWebhookSecret}
                    onChange={(event) => setClearWebhookSecret(event.target.checked)}
                  />
                  Eliminar el secreto guardado al guardar
                </label>
              )}
            </div>

            <label className="block md:col-span-2">
              <span className="mb-1 block text-sm font-semibold text-gray-700">
                Impuestos y aranceles internacionales
              </span>
              <select
                value={dutiesPaymentEntity}
                onChange={(event) => setDutiesPaymentEntity(event.target.value)}
                className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-pink-400"
              >
                <option value="recipient">Los paga el destinatario (DAP)</option>
                <option value="sender">Los paga la tienda (DDP)</option>
                <option value="envia_guaranteed">Envia Guaranteed, cuando esté disponible</option>
              </select>
              <span className="mt-1 block text-xs text-gray-500">
                Se aplica únicamente cuando el origen y el destino están en países distintos.
              </span>
            </label>
          </div>

          <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">URL pública para seguimiento</p>
            <div className="mt-1 flex flex-col gap-2 sm:flex-row sm:items-center">
              <code className="min-w-0 flex-1 break-all text-sm text-gray-800">{meta.webhookUrl || 'BACKEND_URL no configurada'}</code>
              <ActionButton tone="light" disabled={!meta.webhookUrl} onClick={copyWebhookUrl}>Copiar</ActionButton>
            </div>
            {!ready.webhookUrlReady && (
              <p className="mt-2 text-xs text-amber-700">Para producción, BACKEND_URL debe ser pública y usar HTTPS.</p>
            )}
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {checklist.map((item) => (
              <div key={item.label} className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700">
                <span aria-hidden="true" className={item.done ? 'text-emerald-600' : 'text-gray-300'}>{item.done ? '●' : '○'}</span>
                {item.label}
              </div>
            ))}
          </div>

          {settings.lastTestMessage && (
            <p className={`mt-3 text-sm ${settings.lastTestStatus === 'success' ? 'text-emerald-700' : 'text-red-700'}`}>
              {settings.lastTestMessage}{settings.lastTestAt ? ` · ${formatDate(settings.lastTestAt)}` : ''}
            </p>
          )}

          {production && (
            <label className="mt-4 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-900">
              <input
                type="checkbox"
                checked={confirmProduction}
                onChange={(event) => setConfirmProduction(event.target.checked)}
                className="mt-0.5 h-4 w-4 accent-red-600"
              />
              Confirmo que este ambiente realizará cotizaciones y guías reales y que el webhook fue validado.
            </label>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            <ActionButton tone="pink" busy={busyAction === 'save'} disabled={saveBlocked} onClick={save}>
              Guardar configuración
            </ActionButton>
            <ActionButton tone="light" busy={busyAction === 'test'} disabled={!ready.canTest || secretsChanged || mode !== settings.enviaMode} onClick={() => runAction('test', testAdminShippingConnection)}>
              Probar conexión
            </ActionButton>
            <ActionButton tone="light" busy={busyAction === 'webhook'} disabled={!ready.canRegisterWebhook || production !== (settings.enviaMode === 'production')} onClick={() => runAction('webhook', registerAdminShippingWebhook)}>
              Registrar webhook
            </ActionButton>
            <ActionButton
              tone="dark"
              busy={busyAction === 'activate'}
              disabled={
                secretsChanged ||
                mode !== settings.enviaMode ||
                (production ? !ready.canActivateProduction || !confirmProduction : !ready.canActivateSandbox)
              }
              onClick={() => runAction('activate', () => activateAdminShippingProvider(production && confirmProduction))}
            >
              Activar {production ? 'Producción' : 'Sandbox'}
            </ActionButton>
          </div>

          {secretsChanged && (
            <p className="mt-2 text-xs text-gray-500">Guarda los cambios antes de probar o activar.</p>
          )}
        </div>
      </div>
    </div>
  );
}
