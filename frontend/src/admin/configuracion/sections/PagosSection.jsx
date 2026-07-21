// src/admin/configuracion/sections/PagosSection.jsx
import React, { useEffect, useMemo, useState } from 'react';
import InfoCard from '../components/InfoCard';
import EmptyHint from '../components/EmptyHint';
import {
  fetchAdminSiteSettings,
  saveSiteSettings,
} from '../../../lib/siteSettingsApi';

const PROVIDERS = [
  {
    value: 'bold',
    label: 'Bold',
    shortDescription: 'Pasarela enfocada en pagos online para comercios en Colombia.',
    helper:
      'Configura las credenciales de Bold según el ambiente seleccionado. Esta configuración servirá después para conectar el checkout con el proveedor activo.',
    fields: [
      {
        key: 'publicKey',
        label: 'Public key',
        placeholder: 'Llave pública de Bold',
        secret: false,
        fullWidth: true,
      },
      {
        key: 'secretKey',
        label: 'Secret key',
        placeholder: 'Llave secreta de Bold',
        secret: true,
        fullWidth: true,
      },
      {
        key: 'webhookSecret',
        label: 'Webhook secret',
        placeholder: 'Secreto del webhook de Bold',
        secret: true,
        fullWidth: true,
      },
    ],
  },
  {
    value: 'wompi',
    label: 'Wompi',
    shortDescription: 'Pasarela con llaves públicas, privadas e integrity key.',
    helper:
      'Wompi normalmente requiere una llave pública, una privada y una integrity key para validar transacciones y firmas.',
    fields: [
      {
        key: 'publicKey',
        label: 'Public key',
        placeholder: 'Llave pública de Wompi',
        secret: false,
        fullWidth: true,
      },
      {
        key: 'privateKey',
        label: 'Private key',
        placeholder: 'Llave privada de Wompi',
        secret: true,
        fullWidth: true,
      },
      {
        key: 'integrityKey',
        label: 'Integrity key',
        placeholder: 'Integrity key de Wompi',
        secret: true,
        fullWidth: true,
      },
      {
        key: 'webhookSecret',
        label: 'Webhook secret',
        placeholder: 'Secreto del webhook de Wompi',
        secret: true,
        fullWidth: true,
      },
    ],
  },
  {
    value: 'mercado-pago',
    label: 'Mercado Pago',
    shortDescription: 'Proveedor popular para pagos online y billeteras.',
    helper:
      'Mercado Pago normalmente utiliza public key y access token. El token debe tratarse siempre como una credencial sensible.',
    fields: [
      {
        key: 'publicKey',
        label: 'Public key',
        placeholder: 'Llave pública de Mercado Pago',
        secret: false,
        fullWidth: true,
      },
      {
        key: 'accessToken',
        label: 'Access token',
        placeholder: 'Access token de Mercado Pago',
        secret: true,
        fullWidth: true,
      },
      {
        key: 'webhookSecret',
        label: 'Webhook secret',
        placeholder: 'Secreto del webhook de Mercado Pago',
        secret: true,
        fullWidth: true,
      },
    ],
  },
  {
    value: 'payu',
    label: 'PayU',
    shortDescription: 'Pasarela clásica con merchant y account ID.',
    helper:
      'PayU suele requerir merchant ID, account ID, API key y API login según el país y el ambiente configurado.',
    fields: [
      {
        key: 'merchantId',
        label: 'Merchant ID',
        placeholder: 'Merchant ID de PayU',
        secret: false,
        fullWidth: false,
      },
      {
        key: 'accountId',
        label: 'Account ID',
        placeholder: 'Account ID de PayU',
        secret: false,
        fullWidth: false,
      },
      {
        key: 'apiKey',
        label: 'API Key',
        placeholder: 'API Key de PayU',
        secret: true,
        fullWidth: true,
      },
      {
        key: 'apiLogin',
        label: 'API Login',
        placeholder: 'API Login de PayU',
        secret: true,
        fullWidth: true,
      },
    ],
  },
  {
    value: 'manual',
    label: 'Pago manual / transferencia',
    shortDescription: 'Método para pagos coordinados manualmente por el comercio.',
    helper:
      'Este método sirve para transferencias bancarias, Nequi, Daviplata o acuerdos manuales. Luego puedes mostrar instrucciones en checkout.',
    fields: [
      {
        key: 'accountHolder',
        label: 'Titular de la cuenta',
        placeholder: 'Ej: Rosa Boutique SAS',
        secret: false,
        fullWidth: true,
      },
      {
        key: 'bankName',
        label: 'Banco',
        placeholder: 'Ej: Bancolombia',
        secret: false,
        fullWidth: false,
      },
      {
        key: 'accountType',
        label: 'Tipo de cuenta',
        placeholder: 'Ej: Ahorros',
        secret: false,
        fullWidth: false,
      },
      {
        key: 'accountNumber',
        label: 'Número de cuenta',
        placeholder: 'Ej: 1234567890',
        secret: false,
        fullWidth: true,
      },
      {
        key: 'paymentInstructions',
        label: 'Instrucciones de pago',
        placeholder: 'Ej: Envía el comprobante al WhatsApp de la tienda',
        secret: false,
        fullWidth: true,
      },
    ],
  },
];

function buildEmptyCredentials() {
  return {
    bold: {
      publicKey: '',
      secretKey: '',
      webhookSecret: '',
    },
    wompi: {
      publicKey: '',
      privateKey: '',
      integrityKey: '',
      webhookSecret: '',
    },
    'mercado-pago': {
      publicKey: '',
      accessToken: '',
      webhookSecret: '',
    },
    payu: {
      merchantId: '',
      accountId: '',
      apiKey: '',
      apiLogin: '',
    },
    manual: {
      accountHolder: '',
      bankName: '',
      accountType: '',
      accountNumber: '',
      paymentInstructions: '',
    },
  };
}

function normalizeProviderValue(value) {
  const safe = String(value || '').trim().toLowerCase();
  return PROVIDERS.some((provider) => provider.value === safe) ? safe : '';
}

function normalizeModeValue(value) {
  return value === 'production' ? 'production' : 'sandbox';
}

function normalizeBoolean(value, fallback = false) {
  return typeof value === 'boolean' ? value : fallback;
}

function normalizePayments(raw) {
  const payments = raw && typeof raw === 'object' ? raw : {};
  const credentials = payments.credentials && typeof payments.credentials === 'object'
    ? payments.credentials
    : {};

  const emptyCredentials = buildEmptyCredentials();

  return {
    active: payments.active !== false,
    provider: normalizeProviderValue(payments.provider),
    mode: normalizeModeValue(payments.mode),
    currency:
      typeof payments.currency === 'string' && payments.currency.trim()
        ? payments.currency.trim().toUpperCase()
        : 'COP',
    checkoutLabel:
      typeof payments.checkoutLabel === 'string'
        ? payments.checkoutLabel
        : '',
    successMessage:
      typeof payments.successMessage === 'string'
        ? payments.successMessage
        : '',
    enableWebhook: normalizeBoolean(payments.enableWebhook, false),
    credentials: {
      bold: {
        publicKey:
          typeof credentials?.bold?.publicKey === 'string'
            ? credentials.bold.publicKey
            : emptyCredentials.bold.publicKey,
        secretKey:
          typeof credentials?.bold?.secretKey === 'string'
            ? credentials.bold.secretKey
            : emptyCredentials.bold.secretKey,
        webhookSecret:
          typeof credentials?.bold?.webhookSecret === 'string'
            ? credentials.bold.webhookSecret
            : emptyCredentials.bold.webhookSecret,
      },
      wompi: {
        publicKey:
          typeof credentials?.wompi?.publicKey === 'string'
            ? credentials.wompi.publicKey
            : emptyCredentials.wompi.publicKey,
        privateKey:
          typeof credentials?.wompi?.privateKey === 'string'
            ? credentials.wompi.privateKey
            : emptyCredentials.wompi.privateKey,
        integrityKey:
          typeof credentials?.wompi?.integrityKey === 'string'
            ? credentials.wompi.integrityKey
            : emptyCredentials.wompi.integrityKey,
        webhookSecret:
          typeof credentials?.wompi?.webhookSecret === 'string'
            ? credentials.wompi.webhookSecret
            : emptyCredentials.wompi.webhookSecret,
      },
      'mercado-pago': {
        publicKey:
          typeof credentials?.['mercado-pago']?.publicKey === 'string'
            ? credentials['mercado-pago'].publicKey
            : emptyCredentials['mercado-pago'].publicKey,
        accessToken:
          typeof credentials?.['mercado-pago']?.accessToken === 'string'
            ? credentials['mercado-pago'].accessToken
            : emptyCredentials['mercado-pago'].accessToken,
        webhookSecret:
          typeof credentials?.['mercado-pago']?.webhookSecret === 'string'
            ? credentials['mercado-pago'].webhookSecret
            : emptyCredentials['mercado-pago'].webhookSecret,
      },
      payu: {
        merchantId:
          typeof credentials?.payu?.merchantId === 'string'
            ? credentials.payu.merchantId
            : emptyCredentials.payu.merchantId,
        accountId:
          typeof credentials?.payu?.accountId === 'string'
            ? credentials.payu.accountId
            : emptyCredentials.payu.accountId,
        apiKey:
          typeof credentials?.payu?.apiKey === 'string'
            ? credentials.payu.apiKey
            : emptyCredentials.payu.apiKey,
        apiLogin:
          typeof credentials?.payu?.apiLogin === 'string'
            ? credentials.payu.apiLogin
            : emptyCredentials.payu.apiLogin,
      },
      manual: {
        accountHolder:
          typeof credentials?.manual?.accountHolder === 'string'
            ? credentials.manual.accountHolder
            : emptyCredentials.manual.accountHolder,
        bankName:
          typeof credentials?.manual?.bankName === 'string'
            ? credentials.manual.bankName
            : emptyCredentials.manual.bankName,
        accountType:
          typeof credentials?.manual?.accountType === 'string'
            ? credentials.manual.accountType
            : emptyCredentials.manual.accountType,
        accountNumber:
          typeof credentials?.manual?.accountNumber === 'string'
            ? credentials.manual.accountNumber
            : emptyCredentials.manual.accountNumber,
        paymentInstructions:
          typeof credentials?.manual?.paymentInstructions === 'string'
            ? credentials.manual.paymentInstructions
            : emptyCredentials.manual.paymentInstructions,
      },
    },
  };
}

function getProviderMeta(providerValue) {
  return PROVIDERS.find((item) => item.value === providerValue) || null;
}

function maskValue(value) {
  const raw = String(value || '');
  if (!raw.trim()) return 'No configurado';
  if (raw.length <= 6) return '••••••';
  return `${raw.slice(0, 3)}••••••${raw.slice(-2)}`;
}

function buildStatusTone(isReady) {
  return isReady
    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
    : 'border-amber-200 bg-amber-50 text-amber-700';
}

export default function PagosSection() {
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState(() => normalizePayments({}));
  const [showSecrets, setShowSecrets] = useState({});
  const [credentialStatus, setCredentialStatus] = useState({});

  useEffect(() => {
    let cancel = false;

    const load = async () => {
      try {
        setLoadingConfig(true);
        const data = await fetchAdminSiteSettings();
        if (cancel) return;

        const payments = data?.theme?.global?.payments || {};
        setForm(normalizePayments(payments));
        setCredentialStatus(data?._credentialStatus || {});
      } catch (err) {
        console.error('Error cargando pagos', err);
      } finally {
        if (!cancel) setLoadingConfig(false);
      }
    };

    load();

    return () => {
      cancel = true;
    };
  }, []);

  const providerMeta = useMemo(() => {
    return getProviderMeta(form.provider);
  }, [form.provider]);

  const providerValues = useMemo(() => {
    if (!form.provider) return {};
    return form.credentials?.[form.provider] || {};
  }, [form.provider, form.credentials]);

  const configuredCount = useMemo(() => {
    if (!providerMeta) return 0;

    return providerMeta.fields.filter((field) => {
      const value = providerValues[field.key];
      const statusPath = `theme.global.payments.credentials.${form.provider}.${field.key}`;
      return (
        String(value || '').trim() !== '' ||
        (field.secret && credentialStatus[statusPath] === true)
      );
    }).length;
  }, [credentialStatus, form.provider, providerMeta, providerValues]);

  const requiredCount = providerMeta?.fields?.length || 0;
  const isProviderReady =
    !!providerMeta && requiredCount > 0 && configuredCount === requiredCount;

  const previewRules = useMemo(() => {
    if (!form.active) {
      return 'Los pagos online están desactivados. El checkout no debería intentar iniciar ninguna pasarela.';
    }

    if (!providerMeta) {
      return 'Selecciona una pasarela para definir cómo cobrará la tienda en checkout.';
    }

    if (form.provider === 'manual') {
      return `La tienda usará ${providerMeta.label} en modo ${form.mode === 'production' ? 'producción' : 'pruebas'
        }. El cliente verá instrucciones manuales de pago y el comercio confirmará el pago por fuera de la pasarela.`;
    }

    return `La tienda usará ${providerMeta.label} en modo ${form.mode === 'production' ? 'producción' : 'pruebas'
      } con moneda ${form.currency}. ${form.enableWebhook
        ? 'También queda preparado el uso de webhook para confirmar estados automáticos.'
        : 'El webhook está desactivado por ahora.'
      }`;
  }, [form.active, form.provider, form.mode, form.currency, form.enableWebhook, providerMeta]);

  const handleChange = (key, value) => {
    setForm((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleCredentialChange = (provider, key, value) => {
    setForm((prev) => ({
      ...prev,
      credentials: {
        ...(prev.credentials || {}),
        [provider]: {
          ...(prev.credentials?.[provider] || {}),
          [key]: value,
        },
      },
    }));
  };

  const handleProviderChange = (value) => {
    setForm((prev) => ({
      ...prev,
      provider: value,
    }));
  };

  const toggleSecretVisibility = (provider, fieldKey) => {
    const compoundKey = `${provider}.${fieldKey}`;
    setShowSecrets((prev) => ({
      ...prev,
      [compoundKey]: !prev[compoundKey],
    }));
  };

  const handleSave = async () => {
    try {
      setLoading(true);

      const cleanedCredentials = Object.fromEntries(
        Object.entries(form.credentials || {}).map(([providerKey, providerValuesRaw]) => {
          const providerValuesSafe =
            providerValuesRaw && typeof providerValuesRaw === 'object'
              ? providerValuesRaw
              : {};

          const cleanedProviderValues = Object.fromEntries(
            Object.entries(providerValuesSafe).map(([fieldKey, fieldValue]) => [
              fieldKey,
              typeof fieldValue === 'string' ? fieldValue.trim() : '',
            ])
          );

          return [providerKey, cleanedProviderValues];
        })
      );

      const payloadPayments = {
        active: form.active,
        provider: form.provider,
        mode: form.mode,
        currency: String(form.currency || 'COP').trim().toUpperCase() || 'COP',
        checkoutLabel: String(form.checkoutLabel || '').trim(),
        successMessage: String(form.successMessage || '').trim(),
        enableWebhook: form.enableWebhook === true,
        credentials: cleanedCredentials,
      };

      const updated = {
        theme: {
          global: {
            payments: payloadPayments,
          },
        },
      };

      const saved = await saveSiteSettings(updated);
      setCredentialStatus(saved?._credentialStatus || {});

      alert('✅ Configuración de pagos guardada');
    } catch (err) {
      console.error(err);
      alert('❌ Error guardando pagos');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid gap-4">
      <InfoCard
        title="Pasarela de pago"
        description="Aquí se centraliza la configuración del proveedor de pagos de la tienda. El formulario cambia según la pasarela elegida para que el usuario no vea campos innecesarios."
      >
        <div className="grid gap-5">
          <div className="flex items-center justify-between rounded-xl border border-gray-200 p-4">
            <div>
              <p className="font-semibold text-gray-800">Activar pagos</p>
              <p className="text-sm text-gray-500">
                Si lo desactivas, la tienda no debería iniciar cobros automáticos desde checkout.
              </p>
            </div>

            <input
              type="checkbox"
              checked={form.active}
              onChange={() => handleChange('active', !form.active)}
              className="h-5 w-5 accent-pink-500"
            />
          </div>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
            <div className="grid gap-4">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-gray-700">
                    Proveedor activo
                  </span>

                  <select
                    value={form.provider}
                    onChange={(e) => handleProviderChange(e.target.value)}
                    className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-gray-800 focus:outline-none focus:ring-2 focus:ring-pink-400"
                  >
                    <option value="">Selecciona una pasarela</option>
                    {PROVIDERS.map((provider) => (
                      <option key={provider.value} value={provider.value}>
                        {provider.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-gray-700">
                    Modo
                  </span>

                  <select
                    value={form.mode}
                    onChange={(e) => handleChange('mode', e.target.value)}
                    className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-gray-800 focus:outline-none focus:ring-2 focus:ring-pink-400"
                  >
                    <option value="sandbox">Pruebas / Sandbox</option>
                    <option value="production">Producción</option>
                  </select>
                </label>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-gray-700">
                    Moneda
                  </span>

                  <select
                    value={form.currency}
                    onChange={(e) => handleChange('currency', e.target.value)}
                    className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-gray-800 focus:outline-none focus:ring-2 focus:ring-pink-400"
                  >
                    <option value="COP">COP</option>
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                  </select>
                </label>

                <div className="flex items-end">
                  <label className="flex w-full items-center justify-between rounded-xl border border-gray-200 px-4 py-3">
                    <div>
                      <span className="block text-sm font-medium text-gray-700">
                        Activar webhook
                      </span>
                      <span className="mt-1 block text-xs text-gray-500">
                        Preparar confirmación automática de estados de pago.
                      </span>
                    </div>

                    <input
                      type="checkbox"
                      checked={form.enableWebhook}
                      onChange={() => handleChange('enableWebhook', !form.enableWebhook)}
                      className="h-5 w-5 accent-pink-500"
                    />
                  </label>
                </div>
              </div>

              <div className="grid gap-4">
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-gray-700">
                    Texto visible en checkout
                  </span>

                  <input
                    value={form.checkoutLabel}
                    onChange={(e) => handleChange('checkoutLabel', e.target.value)}
                    className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-gray-800 focus:outline-none focus:ring-2 focus:ring-pink-400"
                    placeholder="Ej: Serás redirigido a una plataforma de pago segura"
                  />
                </label>

                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-gray-700">
                    Mensaje de éxito / referencia interna
                  </span>

                  <textarea
                    value={form.successMessage}
                    onChange={(e) => handleChange('successMessage', e.target.value)}
                    rows={3}
                    className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-gray-800 focus:outline-none focus:ring-2 focus:ring-pink-400"
                    placeholder="Ej: Tu pago fue recibido correctamente. Estamos validando la transacción."
                  />
                </label>
              </div>

              {!providerMeta && (
                <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 px-4 py-4 text-sm text-gray-500">
                  {loadingConfig
                    ? 'Cargando configuración...'
                    : 'Selecciona una pasarela para mostrar los campos específicos del proveedor y preparar la configuración de pago.'}
                </div>
              )}

              {providerMeta && (
                <>
                  <div className="rounded-2xl border border-pink-100 bg-pink-50/70 p-4">
                    <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                      <div>
                        <h3 className="text-sm font-semibold text-pink-700">
                          {providerMeta.label}
                        </h3>
                        <p className="mt-1 text-sm text-gray-600">
                          {providerMeta.shortDescription}
                        </p>
                      </div>

                      <span
                        className={`inline-flex w-fit items-center rounded-full border px-3 py-1 text-xs font-semibold ${buildStatusTone(
                          isProviderReady
                        )}`}
                      >
                        {isProviderReady
                          ? 'Configuración completa'
                          : `${configuredCount}/${requiredCount} campos completos`}
                      </span>
                    </div>

                    <p className="mt-3 text-sm text-gray-600">
                      {providerMeta.helper}
                    </p>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <span className="inline-flex items-center rounded-full bg-white px-3 py-1 text-xs font-medium text-gray-600 ring-1 ring-pink-100">
                        Proveedor: {providerMeta.label}
                      </span>
                      <span className="inline-flex items-center rounded-full bg-white px-3 py-1 text-xs font-medium text-gray-600 ring-1 ring-pink-100">
                        Ambiente: {form.mode === 'production' ? 'Producción' : 'Pruebas / Sandbox'}
                      </span>
                      <span className="inline-flex items-center rounded-full bg-white px-3 py-1 text-xs font-medium text-gray-600 ring-1 ring-pink-100">
                        Moneda: {form.currency}
                      </span>
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    {providerMeta.fields.map((field) => {
                      const compoundKey = `${providerMeta.value}.${field.key}`;
                      const value = providerValues[field.key] || '';
                      const statusPath = `theme.global.payments.credentials.${providerMeta.value}.${field.key}`;
                      const secretConfigured =
                        field.secret && credentialStatus[statusPath] === true;
                      const isSecretVisible = !!showSecrets[compoundKey];
                      const inputType = field.secret
                        ? isSecretVisible
                          ? 'text'
                          : 'password'
                        : 'text';

                      return (
                        <label
                          key={compoundKey}
                          className={`block ${field.fullWidth ? 'md:col-span-2' : ''}`}
                        >
                          <span className="mb-1 block text-sm font-medium text-gray-700">
                            {field.label}
                          </span>

                          <div className="relative">
                            {field.key === 'paymentInstructions' ? (
                              <textarea
                                value={value}
                                onChange={(e) =>
                                  handleCredentialChange(
                                    providerMeta.value,
                                    field.key,
                                    e.target.value
                                  )
                                }
                                rows={4}
                                className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-gray-800 focus:outline-none focus:ring-2 focus:ring-pink-400"
                                placeholder={field.placeholder}
                              />
                            ) : (
                              <input
                                type={inputType}
                                value={value}
                                onChange={(e) =>
                                  handleCredentialChange(
                                    providerMeta.value,
                                    field.key,
                                    e.target.value
                                  )
                                }
                                className={`w-full rounded-xl border border-gray-300 px-3 py-2.5 text-gray-800 focus:outline-none focus:ring-2 focus:ring-pink-400 ${field.secret ? 'pr-24' : ''
                                  }`}
                                placeholder={
                                  secretConfigured && !value
                                    ? 'Configurado; escribe para reemplazarlo'
                                    : field.placeholder
                                }
                                autoComplete="off"
                                spellCheck={false}
                              />
                            )}

                            {field.secret && (
                              <button
                                type="button"
                                onClick={() =>
                                  toggleSecretVisibility(providerMeta.value, field.key)
                                }
                                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg border border-gray-200 bg-white px-3 py-1 text-xs font-medium text-gray-600 transition hover:bg-gray-50"
                              >
                                {isSecretVisible ? 'Ocultar' : 'Ver'}
                              </button>
                            )}
                          </div>

                          <span className="mt-1 block text-xs text-gray-500">
                            {secretConfigured && !value
                              ? 'Credencial configurada y protegida. Su valor no se vuelve a mostrar.'
                              : field.secret
                                ? 'Campo sensible. Se recomienda manejarlo con cuidado y no compartirlo.'
                              : 'Campo visible de configuración del proveedor.'}
                          </span>
                        </label>
                      );
                    })}
                  </div>

                  <div className="rounded-2xl border border-gray-200 bg-white p-4">
                    <h4 className="text-sm font-semibold text-gray-800">
                      Resumen rápido de la configuración
                    </h4>

                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                      {providerMeta.fields.map((field) => {
                        const value = providerValues[field.key] || '';
                        const statusPath = `theme.global.payments.credentials.${providerMeta.value}.${field.key}`;
                        const secretConfigured =
                          field.secret && credentialStatus[statusPath] === true;

                        return (
                          <div
                            key={`summary-${providerMeta.value}-${field.key}`}
                            className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-3"
                          >
                            <div className="text-xs font-medium uppercase tracking-wide text-gray-500">
                              {field.label}
                            </div>
                            <div className="mt-1 break-all text-sm text-gray-700">
                              {field.secret
                                ? value
                                  ? maskValue(value)
                                  : secretConfigured
                                    ? 'Configurado (valor protegido)'
                                    : 'No configurado'
                                : value || 'No configurado'}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="grid gap-4">
              <div className="rounded-3xl border border-pink-100 bg-pink-50/60 p-5">
                <div className="text-xs font-semibold uppercase tracking-wide text-pink-600">
                  Estado actual
                </div>

                <div className="mt-3 space-y-3">
                  <div>
                    <div className="text-xs text-gray-500">Proveedor</div>
                    <div className="text-sm font-semibold text-gray-800">
                      {providerMeta?.label || 'Sin seleccionar'}
                    </div>
                  </div>

                  <div>
                    <div className="text-xs text-gray-500">Ambiente</div>
                    <div className="text-sm font-semibold text-gray-800">
                      {form.mode === 'production' ? 'Producción' : 'Pruebas / Sandbox'}
                    </div>
                  </div>

                  <div>
                    <div className="text-xs text-gray-500">Campos completos</div>
                    <div className="text-sm font-semibold text-gray-800">
                      {providerMeta ? `${configuredCount} de ${requiredCount}` : '0 de 0'}
                    </div>
                  </div>

                  <div>
                    <div className="text-xs text-gray-500">Webhook</div>
                    <div className="text-sm font-semibold text-gray-800">
                      {form.enableWebhook ? 'Activo' : 'Inactivo'}
                    </div>
                  </div>
                </div>
              </div>

              <div
                className={`rounded-3xl border p-5 ${form.mode === 'production'
                    ? 'border-rose-200 bg-rose-50/70'
                    : 'border-sky-200 bg-sky-50/70'
                  }`}
              >
                <div
                  className={`text-xs font-semibold uppercase tracking-wide ${form.mode === 'production' ? 'text-rose-600' : 'text-sky-600'
                    }`}
                >
                  {form.mode === 'production' ? 'Modo producción' : 'Modo pruebas'}
                </div>

                <p className="mt-2 text-sm leading-6 text-gray-600">
                  {form.mode === 'production'
                    ? 'Este modo debe usarse únicamente cuando las credenciales reales del comercio ya fueron verificadas y el flujo de pagos está listo para operar con clientes.'
                    : 'En este modo se recomienda probar credenciales, conexión, callbacks y comportamiento del checkout antes de publicar la tienda.'}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-dashed border-pink-200 bg-pink-50/60 p-4">
            <p className="text-sm font-semibold text-pink-700">
              Vista lógica del sistema
            </p>
            <p className="mt-1 text-sm leading-6 text-gray-700">
              {loadingConfig ? 'Cargando configuración...' : previewRules}
            </p>
          </div>

          <button
            onClick={handleSave}
            disabled={loading}
            className="w-fit rounded-xl bg-pink-500 px-4 py-2 text-white hover:bg-pink-600 disabled:opacity-60"
          >
            {loading ? 'Guardando...' : 'Guardar configuración'}
          </button>
        </div>
      </InfoCard>

      <EmptyHint
        title="Siguiente fase natural"
        text="Esta pantalla ya queda lista a nivel visual, estructural y de guardado. El siguiente paso será conectar el checkout para que use el proveedor activo y sus credenciales sin rehacer este formulario."
      />
    </div>
  );
}
