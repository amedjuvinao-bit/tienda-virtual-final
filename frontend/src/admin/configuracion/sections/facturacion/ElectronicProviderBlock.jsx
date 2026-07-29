import React from 'react';
import {
  billingDangerButtonStyle,
  billingFieldClass,
  billingFieldStyle,
  billingMessageStyle,
  billingPanelStyle,
  billingSecondaryButtonStyle,
  billingSoftPanelStyle,
} from './billingTheme';

const FACTUS_API_URLS = {
  habilitacion: 'https://api-sandbox.factus.com.co',
  production: 'https://api.factus.com.co',
};

const REQUIRED_FIELDS = [
  { key: 'clientId', label: 'Client ID', secret: false },
  { key: 'clientSecret', label: 'Client Secret', secret: true },
  { key: 'username', label: 'Usuario', secret: false },
  { key: 'password', label: 'Contraseña', secret: true },
];

function isEmpty(value) {
  return !value || String(value).trim() === '';
}

function formatDate(value) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString('es-CO');
}

function FieldError({ show, text }) {
  if (!show) return null;
  return (
    <p
      className="text-xs font-medium"
      style={{ color: 'var(--admin-danger-text, var(--admin-card-text))' }}
    >
      {text}
    </p>
  );
}

function ProviderInput({
  type = 'text',
  placeholder,
  value,
  onChange,
  required = false,
  configured = false,
  readOnly = false,
}) {
  const hasError = required && isEmpty(value) && !configured;
  const resolvedPlaceholder = configured
    ? `${placeholder} configurado; escribe para reemplazarlo`
    : placeholder;

  return (
    <div className="grid gap-1">
      <input
        type={type}
        placeholder={resolvedPlaceholder}
        value={value || ''}
        onChange={onChange}
        readOnly={readOnly}
        autoComplete={type === 'password' ? 'new-password' : 'off'}
        spellCheck={false}
        className={`${billingFieldClass} ${
          readOnly ? 'cursor-not-allowed opacity-75' : ''
        }`}
        style={{
          ...billingFieldStyle,
          ...(hasError ? billingMessageStyle('error') : {}),
        }}
      />

      <FieldError
        show={hasError}
        text={`Campo obligatorio: ${placeholder}`}
      />

      {configured && isEmpty(value) ? (
        <p
          className="text-xs font-medium"
          style={{ color: 'var(--admin-success-text, var(--admin-card-text))' }}
        >
          Credencial configurada y protegida.
        </p>
      ) : null}
    </div>
  );
}

export default function ElectronicProviderBlock({
  value = {},
  onChange,
  credentialStatus = {},
  mode = 'internal',
  testing = false,
  connectionFeedback = null,
  connectionChanged = false,
  onTestConnection,
  onClearCredentials,
}) {
  const normalizedMode = mode === 'production' ? 'production' : 'habilitacion';
  const isExternal = mode !== 'internal';
  const provider = isExternal ? 'factus' : 'mock';
  const apiUrl = isExternal ? FACTUS_API_URLS[normalizedMode] : '';

  const isConfigured = (field) =>
    credentialStatus[`billing.electronicProvider.${field}`] === true;

  const missingFields = isExternal
    ? REQUIRED_FIELDS.filter(
        (field) =>
          isEmpty(value?.[field.key]) &&
          !(field.secret && isConfigured(field.key))
      )
    : [];

  const handleChange = (field, nextValue) => {
    if (typeof onChange !== 'function') return;

    onChange({
      ...value,
      provider,
      apiUrl,
      [field]: nextValue,
    });
  };

  const persistedStatus = value?.lastConnectionStatus || 'none';
  const status = connectionChanged
    ? 'stale'
    : connectionFeedback?.status || persistedStatus;
  const message = connectionChanged
    ? 'La configuración cambió. Debes ejecutar nuevamente la prueba real.'
    : connectionFeedback?.message || value?.lastConnectionMessage || '';
  const company =
    connectionFeedback?.company || value?.lastConnectionCompany || {};
  const verifiedAt =
    connectionFeedback?.verifiedAt || value?.lastConnectionAt || null;
  const environment =
    connectionFeedback?.environment ||
    value?.lastConnectionEnvironment ||
    '';

  const statusStyle =
    status === 'success'
      ? billingMessageStyle('success')
      : status === 'error'
        ? billingMessageStyle('error')
        : billingMessageStyle('warning');
  const hasStoredCredentials =
    REQUIRED_FIELDS.some((field) => isConfigured(field.key)) ||
    REQUIRED_FIELDS.some((field) => !isEmpty(value?.[field.key]));

  return (
    <div className="grid gap-4">
      <div>
        <label
          className="mb-1 block text-sm font-medium"
          style={{ color: 'var(--admin-card-text)' }}
        >
          Proveedor de facturación electrónica
        </label>

        <select
          value={provider}
          disabled
          className={`${billingFieldClass} cursor-not-allowed opacity-75`}
          style={billingFieldStyle}
        >
          <option value="mock">Comprobante interno</option>
          <option value="factus">Factus</option>
        </select>

        <p
          className="mt-1 text-xs"
          style={{ color: 'var(--admin-card-muted-text)' }}
        >
          Factus es el único proveedor externo habilitado. El backend determina el proveedor según el tipo de emisión.
        </p>
      </div>

      {!isExternal ? (
        <div
          className="rounded-xl border px-4 py-3 text-sm"
          style={billingMessageStyle('info')}
        >
          El modo interno no envía documentos fiscales a Factus.
        </div>
      ) : (
        <div
          className="grid gap-3 rounded-xl border p-4"
          style={billingPanelStyle}
        >
          <div>
            <h4
              className="text-sm font-semibold"
              style={{ color: 'var(--admin-card-text)' }}
            >
              Configuración Factus (OAuth2)
            </h4>
            <p
              className="mt-1 text-xs leading-5"
              style={{ color: 'var(--admin-card-muted-text)' }}
            >
              La URL se asigna automáticamente según el ambiente. Las credenciales secretas se almacenan cifradas y nunca vuelven al navegador.
            </p>
          </div>

          <ProviderInput
            placeholder="API URL oficial"
            value={apiUrl}
            readOnly
            onChange={() => {}}
          />

          <ProviderInput
            placeholder="Client ID"
            value={value?.clientId}
            required
            onChange={(event) => handleChange('clientId', event.target.value)}
          />

          <ProviderInput
            type="password"
            placeholder="Client Secret"
            value={value?.clientSecret}
            required
            configured={isConfigured('clientSecret')}
            onChange={(event) =>
              handleChange('clientSecret', event.target.value)
            }
          />

          <ProviderInput
            placeholder="Usuario"
            value={value?.username}
            required
            onChange={(event) => handleChange('username', event.target.value)}
          />

          <ProviderInput
            type="password"
            placeholder="Contraseña"
            value={value?.password}
            required
            configured={isConfigured('password')}
            onChange={(event) => handleChange('password', event.target.value)}
          />

          {missingFields.length > 0 ? (
            <div
              className="rounded-xl border px-4 py-3 text-sm"
              style={billingMessageStyle('error')}
            >
              <strong className="block">
                Faltan datos obligatorios
              </strong>
              Completa: {missingFields.map((field) => field.label).join(', ')}.
            </div>
          ) : null}

          <div
            className="grid gap-2 rounded-xl border p-3 sm:grid-cols-2"
            style={billingSoftPanelStyle}
          >
            <button
              type="button"
              onClick={onTestConnection}
              disabled={testing || missingFields.length > 0}
              className="rounded-xl border px-4 py-2.5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
              style={billingSecondaryButtonStyle}
            >
              {testing ? 'Verificando con Factus...' : 'Probar conexión real'}
            </button>
            <button
              type="button"
              onClick={onClearCredentials}
              disabled={testing || !hasStoredCredentials}
              className="rounded-xl border px-4 py-2.5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
              style={billingDangerButtonStyle}
            >
              Eliminar credenciales
            </button>
          </div>
          <p
            className="text-xs leading-5"
            style={{ color: 'var(--admin-card-muted-text)' }}
          >
            Eliminar credenciales desactiva Factus, borra rangos y exige una
            nueva verificación antes de volver a Producción.
          </p>

          <div
            className="rounded-xl border px-4 py-3 text-sm"
            style={statusStyle}
          >
            <strong className="block">
              {status === 'success'
                ? 'Conexión verificada'
                : status === 'error'
                  ? 'Conexión rechazada'
                  : status === 'stale'
                    ? 'Nueva verificación requerida'
                    : 'Conexión pendiente'}
            </strong>

            {message ? <p className="mt-1">{message}</p> : null}

            {company?.name || company?.nit ? (
              <div className="mt-2 grid gap-1 border-t border-current/10 pt-2">
                <span>
                  <strong>Empresa:</strong>{' '}
                  {company.name || company.tradeName || 'Sin nombre'}
                </span>
                <span>
                  <strong>NIT:</strong>{' '}
                  {company.nit
                    ? `${company.nit}${company.dv ? `-${company.dv}` : ''}`
                    : 'No informado'}
                </span>
                <span>
                  <strong>Ambiente:</strong>{' '}
                  {environment || normalizedMode}
                </span>
                {verifiedAt ? (
                  <span>
                    <strong>Verificado:</strong> {formatDate(verifiedAt)}
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
