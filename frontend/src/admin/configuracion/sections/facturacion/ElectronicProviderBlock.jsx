import React from 'react';

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
  return <p className="text-xs font-medium text-red-500">{text}</p>;
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
        className={`rounded-lg border px-3 py-2 text-sm outline-none transition focus:ring-2 ${
          readOnly
            ? 'cursor-not-allowed border-gray-200 bg-gray-100 text-gray-600'
            : hasError
              ? 'border-red-300 bg-red-50 focus:ring-red-100'
              : 'border-gray-300 bg-white focus:border-pink-300 focus:ring-pink-100'
        }`}
      />

      <FieldError
        show={hasError}
        text={`Campo obligatorio: ${placeholder}`}
      />

      {configured && isEmpty(value) ? (
        <p className="text-xs font-medium text-emerald-600">
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

  const statusClass =
    status === 'success'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
      : status === 'error'
        ? 'border-red-200 bg-red-50 text-red-800'
        : 'border-amber-200 bg-amber-50 text-amber-900';

  return (
    <div className="grid gap-4">
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">
          Proveedor de facturación electrónica
        </label>

        <select
          value={provider}
          disabled
          className="w-full cursor-not-allowed rounded-xl border border-gray-200 bg-gray-100 px-3 py-2.5 text-gray-700"
        >
          <option value="mock">Comprobante interno</option>
          <option value="factus">Factus</option>
        </select>

        <p className="mt-1 text-xs text-gray-500">
          Factus es el único proveedor externo habilitado. El backend determina el proveedor según el tipo de emisión.
        </p>
      </div>

      {!isExternal ? (
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
          El modo interno no envía documentos fiscales a Factus.
        </div>
      ) : (
        <div className="grid gap-3 rounded-xl border border-gray-200 bg-white p-4">
          <div>
            <h4 className="text-sm font-semibold text-gray-800">
              Configuración Factus (OAuth2)
            </h4>
            <p className="mt-1 text-xs leading-5 text-gray-500">
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
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              <strong className="block text-red-800">
                Faltan datos obligatorios
              </strong>
              Completa: {missingFields.map((field) => field.label).join(', ')}.
            </div>
          ) : null}

          <button
            type="button"
            onClick={onTestConnection}
            disabled={testing || missingFields.length > 0}
            className="rounded-xl border border-pink-300 bg-white px-4 py-2.5 text-sm font-semibold text-pink-600 hover:bg-pink-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {testing ? 'Verificando con Factus...' : 'Probar conexión real'}
          </button>

          <div className={`rounded-xl border px-4 py-3 text-sm ${statusClass}`}>
            <strong className="block text-gray-900">
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
