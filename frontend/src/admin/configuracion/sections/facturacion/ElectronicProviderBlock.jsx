import React from 'react';

const REQUIRED_FIELDS_BY_PROVIDER = {
  factus: [
    { key: 'apiUrl', label: 'API URL' },
    { key: 'clientId', label: 'Client ID' },
    { key: 'clientSecret', label: 'Client Secret' },
    { key: 'username', label: 'Usuario' },
    { key: 'password', label: 'Contraseña' },
  ],
  dian: [
    { key: 'softwareId', label: 'Software ID' },
    { key: 'softwarePin', label: 'Software PIN' },
    { key: 'technicalKey', label: 'Technical Key' },
  ],
};

function isEmpty(value) {
  return !value || String(value).trim() === '';
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
}) {
  const hasError = required && isEmpty(value);

  return (
    <div className="grid gap-1">
      <input
        type={type}
        placeholder={placeholder}
        value={value || ''}
        onChange={onChange}
        className={`rounded-lg border px-3 py-2 text-sm outline-none transition focus:ring-2 ${
          hasError
            ? 'border-red-300 bg-red-50 focus:ring-red-100'
            : 'border-gray-300 bg-white focus:border-pink-300 focus:ring-pink-100'
        }`}
      />

      <FieldError
        show={hasError}
        text={`Campo obligatorio: ${placeholder}`}
      />
    </div>
  );
}

export default function ElectronicProviderBlock({ value = {}, onChange }) {
  const provider = value?.provider || 'mock';

  const requiredFields = REQUIRED_FIELDS_BY_PROVIDER[provider] || [];

  const missingFields = requiredFields.filter((field) =>
    isEmpty(value?.[field.key])
  );

  const handleChange = (field, val) => {
    onChange({
      ...value,
      [field]: val,
    });
  };

  const handleProviderChange = (nextProvider) => {
    onChange({
      provider: nextProvider,
    });
  };

  return (
    <div className="grid gap-4">
      {/* 🔹 Selector de proveedor */}
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">
          Proveedor de facturación electrónica
        </label>

        <select
          value={provider}
          onChange={(e) => handleProviderChange(e.target.value)}
          className="w-full rounded-xl border border-gray-300 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-pink-400"
        >
          <option value="mock">Modo pruebas (interno)</option>
          <option value="dian">DIAN directa</option>
          <option value="factus">Factus</option>
          <option value="carvajal">Carvajal</option>
          <option value="siigo">Siigo</option>
          <option value="alegra">Alegra</option>
        </select>
      </div>

      {missingFields.length > 0 && provider !== 'mock' && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <strong className="block text-red-800">
            Faltan datos obligatorios
          </strong>
          Completa: {missingFields.map((field) => field.label).join(', ')}.
        </div>
      )}

      {provider === 'mock' && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
          Modo interno de pruebas: no se enviará factura electrónica a ningún
          proveedor real.
        </div>
      )}

      {/* =========================
         FACTUS
      ========================= */}
      {provider === 'factus' && (
        <div className="grid gap-3 rounded-xl border border-gray-200 bg-white p-4">
          <h4 className="text-sm font-semibold text-gray-800">
            Configuración Factus (OAuth2)
          </h4>

          <ProviderInput
            placeholder="API URL"
            value={value?.apiUrl}
            required
            onChange={(e) => handleChange('apiUrl', e.target.value)}
          />

          <ProviderInput
            placeholder="Client ID"
            value={value?.clientId}
            required
            onChange={(e) => handleChange('clientId', e.target.value)}
          />

          <ProviderInput
            placeholder="Client Secret"
            value={value?.clientSecret}
            required
            onChange={(e) => handleChange('clientSecret', e.target.value)}
          />

          <ProviderInput
            placeholder="Usuario"
            value={value?.username}
            required
            onChange={(e) => handleChange('username', e.target.value)}
          />

          <ProviderInput
            type="password"
            placeholder="Contraseña"
            value={value?.password}
            required
            onChange={(e) => handleChange('password', e.target.value)}
          />

          <p className="text-xs leading-5 text-gray-500">
            Factus usa autenticación OAuth2. Estos datos los entrega la
            plataforma cuando crees la cuenta y habilites el acceso API.
          </p>
        </div>
      )}

      {/* =========================
         DIAN DIRECTA
      ========================= */}
      {provider === 'dian' && (
        <div className="grid gap-3 rounded-xl border border-gray-200 bg-white p-4">
          <h4 className="text-sm font-semibold text-gray-800">
            Configuración DIAN directa
          </h4>

          <ProviderInput
            placeholder="Software ID"
            value={value?.softwareId}
            required
            onChange={(e) => handleChange('softwareId', e.target.value)}
          />

          <ProviderInput
            placeholder="Software PIN"
            value={value?.softwarePin}
            required
            onChange={(e) => handleChange('softwarePin', e.target.value)}
          />

          <ProviderInput
            placeholder="Technical Key"
            value={value?.technicalKey}
            required
            onChange={(e) => handleChange('technicalKey', e.target.value)}
          />
        </div>
      )}

      {/* =========================
         OTROS
      ========================= */}
      {(provider === 'carvajal' ||
        provider === 'siigo' ||
        provider === 'alegra') && (
        <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-800">
          Este proveedor ya está creado en la arquitectura, pero sus campos de
          configuración todavía no están definidos.
        </div>
      )}
    </div>
  );
}