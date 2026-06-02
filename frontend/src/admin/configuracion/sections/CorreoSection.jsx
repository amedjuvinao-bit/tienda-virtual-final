// frontend/src/admin/configuracion/sections/CorreoSection.jsx

import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  KeyRound,
  Loader2,
  Mail,
  Save,
  Send,
  Server,
  ShieldCheck,
} from 'lucide-react';

import {
  getAdminMailSettings,
  sendAdminMailTest,
  updateAdminMailSettings,
} from '../../api/adminMailSettingsApi';

const DEFAULT_FORM = {
  enabled: false,
  provider: 'smtp',
  fromName: '',
  fromEmail: '',
  replyToEmail: '',
  smtpHost: '',
  smtpPort: 465,
  smtpSecurity: 'ssl',
  smtpUser: '',
  smtpPassword: '',
  clearSmtpPassword: false,
  testEmail: '',
};

const LOCAL_PRESETS = {
  gmail: {
    smtpHost: 'smtp.gmail.com',
    smtpPort: 465,
    smtpSecurity: 'ssl',
  },
  outlook: {
    smtpHost: 'smtp.office365.com',
    smtpPort: 587,
    smtpSecurity: 'starttls',
  },
  zoho: {
    smtpHost: 'smtp.zoho.com',
    smtpPort: 465,
    smtpSecurity: 'ssl',
  },
  smtp: {
    smtpHost: '',
    smtpPort: 465,
    smtpSecurity: 'ssl',
  },
};

function getApiMessage(error, fallback) {
  return error?.userMessage || error?.response?.data?.message || error?.message || fallback;
}

function normalizeSettingsToForm(settings = {}) {
  return {
    enabled: Boolean(settings.enabled),
    provider: settings.provider || 'smtp',
    fromName: settings.fromName || '',
    fromEmail: settings.fromEmail || '',
    replyToEmail: settings.replyToEmail || '',
    smtpHost: settings.smtpHost || '',
    smtpPort: settings.smtpPort || 465,
    smtpSecurity: settings.smtpSecurity || 'ssl',
    smtpUser: settings.smtpUser || '',
    smtpPassword: '',
    clearSmtpPassword: false,
    testEmail: settings.testEmail || '',
  };
}

function FieldLabel({ children, required = false }) {
  return (
    <label
      className="mb-1 block text-xs font-semibold uppercase tracking-wide"
      style={{ color: 'var(--admin-card-muted-text)' }}
    >
      {children}
      {required ? (
        <span className="ml-1" style={{ color: 'var(--admin-primary)' }}>
          *
        </span>
      ) : null}
    </label>
  );
}

function TextInput({
  value,
  onChange,
  placeholder = '',
  type = 'text',
  disabled = false,
  autoComplete = 'off',
}) {
  return (
    <input
      type={type}
      value={value}
      disabled={disabled}
      autoComplete={autoComplete}
      placeholder={placeholder}
      onChange={(event) => onChange(event.target.value)}
      className="w-full rounded-2xl border px-4 py-3 text-sm outline-none transition disabled:cursor-not-allowed disabled:opacity-60"
      style={{
        backgroundColor: 'var(--admin-input-bg, rgba(255,255,255,0.72))',
        borderColor: 'var(--admin-glass-border)',
        color: 'var(--admin-card-text)',
      }}
    />
  );
}

function SelectInput({ value, onChange, children, disabled = false }) {
  return (
    <select
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
      className="w-full rounded-2xl border px-4 py-3 text-sm outline-none transition disabled:cursor-not-allowed disabled:opacity-60"
      style={{
        backgroundColor: 'var(--admin-input-bg, rgba(255,255,255,0.72))',
        borderColor: 'var(--admin-glass-border)',
        color: 'var(--admin-card-text)',
      }}
    >
      {children}
    </select>
  );
}

function InfoBox({ type = 'info', children }) {
  const config = {
    info: {
      Icon: ShieldCheck,
      bg: 'rgba(59,130,246,0.08)',
      border: 'rgba(59,130,246,0.22)',
      color: '#1d4ed8',
    },
    warning: {
      Icon: AlertTriangle,
      bg: 'rgba(245,158,11,0.10)',
      border: 'rgba(245,158,11,0.28)',
      color: '#b45309',
    },
    success: {
      Icon: CheckCircle2,
      bg: 'rgba(34,197,94,0.10)',
      border: 'rgba(34,197,94,0.24)',
      color: '#15803d',
    },
    error: {
      Icon: AlertTriangle,
      bg: 'rgba(239,68,68,0.10)',
      border: 'rgba(239,68,68,0.24)',
      color: '#b91c1c',
    },
  };

  const current = config[type] || config.info;
  const Icon = current.Icon;

  return (
    <div
      className="flex gap-3 rounded-2xl border p-4 text-sm leading-6"
      style={{
        backgroundColor: current.bg,
        borderColor: current.border,
        color: current.color,
      }}
    >
      <Icon className="mt-0.5 h-5 w-5 flex-shrink-0" />
      <div>{children}</div>
    </div>
  );
}

export default function CorreoSection() {
  const [form, setForm] = useState(DEFAULT_FORM);
  const [settings, setSettings] = useState(null);
  const [meta, setMeta] = useState(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  const [statusMessage, setStatusMessage] = useState('');
  const [statusType, setStatusType] = useState('info');

  const providers = useMemo(() => {
    return meta?.providers?.length
      ? meta.providers
      : [
          {
            value: 'gmail',
            label: 'Gmail',
            description: 'Usa smtp.gmail.com con contraseña de aplicación.',
          },
          {
            value: 'outlook',
            label: 'Outlook / Microsoft 365',
            description: 'Usa smtp.office365.com con STARTTLS.',
          },
          {
            value: 'zoho',
            label: 'Zoho Mail',
            description: 'Usa smtp.zoho.com.',
          },
          {
            value: 'smtp',
            label: 'SMTP personalizado',
            description: 'Para Hostinger, GoDaddy, cPanel u otro correo corporativo.',
          },
        ];
  }, [meta]);

  const securityTypes = useMemo(() => {
    return meta?.securityTypes?.length
      ? meta.securityTypes
      : [
          {
            value: 'ssl',
            label: 'SSL / TLS',
            description: 'Normalmente puerto 465.',
          },
          {
            value: 'starttls',
            label: 'STARTTLS',
            description: 'Normalmente puerto 587.',
          },
          {
            value: 'none',
            label: 'Sin cifrado',
            description: 'No recomendado para producción.',
          },
        ];
  }, [meta]);

  const selectedProvider = useMemo(() => {
    return providers.find((item) => item.value === form.provider) || providers[0];
  }, [providers, form.provider]);

  const hasPasswordConfigured = Boolean(settings?.hasSmtpPassword);

  function updateField(field, value) {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  }

  function handleProviderChange(provider) {
    const presets = meta?.presetDefaults || LOCAL_PRESETS;
    const preset = presets[provider] || LOCAL_PRESETS[provider] || LOCAL_PRESETS.smtp;

    setForm((prev) => ({
      ...prev,
      provider,
      smtpHost: preset.smtpHost ?? prev.smtpHost,
      smtpPort: preset.smtpPort ?? prev.smtpPort,
      smtpSecurity: preset.smtpSecurity ?? prev.smtpSecurity,
    }));
  }

  async function loadSettings() {
    try {
      setLoading(true);
      setStatusMessage('');
      setStatusType('info');

      const response = await getAdminMailSettings();

      setSettings(response.settings || null);
      setMeta(response.meta || null);
      setForm(normalizeSettingsToForm(response.settings || {}));
    } catch (error) {
      setStatusType('error');
      setStatusMessage(
        getApiMessage(error, 'No se pudo cargar la configuración de correo.')
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleSave(event) {
    event.preventDefault();

    try {
      setSaving(true);
      setStatusMessage('');
      setStatusType('info');

      const payload = {
        enabled: form.enabled,
        provider: form.provider,
        fromName: form.fromName,
        fromEmail: form.fromEmail,
        replyToEmail: form.replyToEmail,
        smtpHost: form.smtpHost,
        smtpPort: Number(form.smtpPort || 465),
        smtpSecurity: form.smtpSecurity,
        smtpUser: form.smtpUser,
        testEmail: form.testEmail,
      };

      if (form.smtpPassword.trim()) {
        payload.smtpPassword = form.smtpPassword;
      }

      if (form.clearSmtpPassword === true) {
        payload.clearSmtpPassword = true;
      }

      const response = await updateAdminMailSettings(payload);

      setSettings(response.settings || null);
      setMeta(response.meta || meta);
      setForm(normalizeSettingsToForm(response.settings || {}));

      setStatusType('success');
      setStatusMessage(response.message || 'Configuración de correo guardada correctamente.');
    } catch (error) {
      setStatusType('error');
      setStatusMessage(
        getApiMessage(error, 'No se pudo guardar la configuración de correo.')
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleSendTest() {
    try {
      setTesting(true);
      setStatusMessage('');
      setStatusType('info');

      const response = await sendAdminMailTest({
        testEmail: form.testEmail,
      });

      setSettings(response.settings || settings);

      if (response.settings) {
        setForm((prev) => ({
          ...prev,
          testEmail: response.settings.testEmail || prev.testEmail,
        }));
      }

      setStatusType('success');
      setStatusMessage(response.message || 'Correo de prueba enviado correctamente.');
    } catch (error) {
      const nextSettings = error?.response?.data?.settings;

      if (nextSettings) {
        setSettings(nextSettings);
      }

      setStatusType('error');
      setStatusMessage(
        getApiMessage(error, 'No se pudo enviar el correo de prueba.')
      );
    } finally {
      setTesting(false);
    }
  }

  useEffect(() => {
    loadSettings();
  }, []);

  if (loading) {
    return (
      <div
        className="rounded-[28px] border p-6 shadow-sm"
        style={{
          backgroundColor: 'var(--admin-card-bg)',
          borderColor: 'var(--admin-glass-border)',
          color: 'var(--admin-card-text)',
        }}
      >
        <div className="flex items-center gap-3 text-sm font-semibold">
          <Loader2 className="h-5 w-5 animate-spin" />
          Cargando configuración de correo...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div
        className="rounded-[28px] border p-5 shadow-sm md:p-6"
        style={{
          backgroundColor: 'var(--admin-card-bg)',
          borderColor: 'var(--admin-glass-border)',
          color: 'var(--admin-card-text)',
        }}
      >
        <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <div
              className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold"
              style={{
                backgroundColor: 'var(--admin-primary-soft-bg)',
                borderColor: 'var(--admin-primary-soft-border)',
                color: 'var(--admin-primary-soft-text)',
              }}
            >
              <Mail className="h-4 w-4" />
              Servidor de correo
            </div>

            <h3
              className="mt-3 text-xl font-bold"
              style={{ color: 'var(--admin-card-text)' }}
            >
              Configuración SMTP de producción
            </h3>

            <p
              className="mt-2 max-w-3xl text-sm leading-6"
              style={{ color: 'var(--admin-card-muted-text)' }}
            >
              Define el correo que usará la tienda para recuperación de contraseña,
              confirmaciones, notificaciones y mensajes internos. La clave SMTP se
              guarda cifrada y nunca se muestra en pantalla.
            </p>
          </div>

          <div
            className="rounded-2xl border px-4 py-3 text-sm"
            style={{
              backgroundColor: form.enabled
                ? 'rgba(34,197,94,0.10)'
                : 'rgba(245,158,11,0.10)',
              borderColor: form.enabled
                ? 'rgba(34,197,94,0.24)'
                : 'rgba(245,158,11,0.28)',
              color: form.enabled ? '#15803d' : '#b45309',
            }}
          >
            <div className="flex items-center gap-2 font-semibold">
              {form.enabled ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <AlertTriangle className="h-4 w-4" />
              )}
              {form.enabled ? 'Correo activo' : 'Correo desactivado'}
            </div>
          </div>
        </div>

        {statusMessage ? (
          <div className="mb-5">
            <InfoBox type={statusType}>{statusMessage}</InfoBox>
          </div>
        ) : null}

        <form onSubmit={handleSave} className="space-y-6">
          <div
            className="rounded-[24px] border p-4"
            style={{
              borderColor: 'var(--admin-glass-border)',
              backgroundColor: 'rgba(255,255,255,0.10)',
            }}
          >
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h4 className="text-sm font-bold" style={{ color: 'var(--admin-card-text)' }}>
                  Activar envío de correos
                </h4>
                <p
                  className="mt-1 text-sm"
                  style={{ color: 'var(--admin-card-muted-text)' }}
                >
                  Si está desactivado, el sistema no enviará correos automáticos.
                </p>
              </div>

              <button
                type="button"
                onClick={() => updateField('enabled', !form.enabled)}
                className="rounded-2xl border px-5 py-3 text-sm font-semibold transition hover:scale-[1.01] active:scale-[0.99]"
                style={{
                  backgroundColor: form.enabled
                    ? 'var(--admin-primary)'
                    : 'rgba(255,255,255,0.20)',
                  borderColor: form.enabled
                    ? 'var(--admin-primary)'
                    : 'var(--admin-glass-border)',
                  color: form.enabled ? '#fff' : 'var(--admin-card-text)',
                }}
              >
                {form.enabled ? 'Activo' : 'Desactivado'}
              </button>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <FieldLabel required>Proveedor</FieldLabel>
              <SelectInput value={form.provider} onChange={handleProviderChange}>
                {providers.map((provider) => (
                  <option key={provider.value} value={provider.value}>
                    {provider.label}
                  </option>
                ))}
              </SelectInput>
              {selectedProvider?.description ? (
                <p
                  className="mt-2 text-xs leading-5"
                  style={{ color: 'var(--admin-card-muted-text)' }}
                >
                  {selectedProvider.description}
                </p>
              ) : null}
            </div>

            <div>
              <FieldLabel required>Nombre del remitente</FieldLabel>
              <TextInput
                value={form.fromName}
                onChange={(value) => updateField('fromName', value)}
                placeholder="Rosa Boutique"
              />
            </div>

            <div>
              <FieldLabel required>Correo remitente</FieldLabel>
              <TextInput
                value={form.fromEmail}
                onChange={(value) => updateField('fromEmail', value)}
                placeholder="ventas@tutienda.com"
              />
            </div>

            <div>
              <FieldLabel>Correo de respuesta</FieldLabel>
              <TextInput
                value={form.replyToEmail}
                onChange={(value) => updateField('replyToEmail', value)}
                placeholder="soporte@tutienda.com"
              />
            </div>
          </div>

          <div
            className="rounded-[24px] border p-4"
            style={{
              borderColor: 'var(--admin-glass-border)',
              backgroundColor: 'rgba(255,255,255,0.10)',
            }}
          >
            <div className="mb-4 flex items-center gap-2">
              <Server className="h-5 w-5" style={{ color: 'var(--admin-primary)' }} />
              <h4 className="text-sm font-bold" style={{ color: 'var(--admin-card-text)' }}>
                Datos SMTP
              </h4>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <FieldLabel required>Servidor SMTP</FieldLabel>
                <TextInput
                  value={form.smtpHost}
                  onChange={(value) => updateField('smtpHost', value)}
                  placeholder="smtp.gmail.com"
                  disabled={form.provider !== 'smtp'}
                />
              </div>

              <div>
                <FieldLabel required>Puerto</FieldLabel>
                <TextInput
                  type="number"
                  value={form.smtpPort}
                  onChange={(value) => updateField('smtpPort', value)}
                  placeholder="465"
                  disabled={form.provider !== 'smtp'}
                />
              </div>

              <div>
                <FieldLabel required>Seguridad</FieldLabel>
                <SelectInput
                  value={form.smtpSecurity}
                  onChange={(value) => updateField('smtpSecurity', value)}
                  disabled={form.provider !== 'smtp'}
                >
                  {securityTypes.map((security) => (
                    <option key={security.value} value={security.value}>
                      {security.label}
                    </option>
                  ))}
                </SelectInput>
              </div>

              <div>
                <FieldLabel required>Usuario SMTP</FieldLabel>
                <TextInput
                  value={form.smtpUser}
                  onChange={(value) => updateField('smtpUser', value)}
                  placeholder="ventas@tutienda.com"
                />
              </div>
            </div>
          </div>

          <div
            className="rounded-[24px] border p-4"
            style={{
              borderColor: 'var(--admin-glass-border)',
              backgroundColor: 'rgba(255,255,255,0.10)',
            }}
          >
            <div className="mb-4 flex items-center gap-2">
              <KeyRound className="h-5 w-5" style={{ color: 'var(--admin-primary)' }} />
              <h4 className="text-sm font-bold" style={{ color: 'var(--admin-card-text)' }}>
                Clave SMTP
              </h4>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <FieldLabel>
                  {hasPasswordConfigured ? 'Cambiar clave SMTP' : 'Clave SMTP'}
                </FieldLabel>
                <TextInput
                  type="password"
                  value={form.smtpPassword}
                  onChange={(value) => updateField('smtpPassword', value)}
                  placeholder={
                    hasPasswordConfigured
                      ? 'Dejar vacío para conservar la clave actual'
                      : 'Contraseña de aplicación o clave SMTP'
                  }
                  autoComplete="new-password"
                />

                <p
                  className="mt-2 text-xs leading-5"
                  style={{ color: 'var(--admin-card-muted-text)' }}
                >
                  {hasPasswordConfigured
                    ? 'Ya existe una clave configurada. No se muestra por seguridad.'
                    : 'Debes configurar una clave para enviar correos.'}
                </p>
              </div>

              <div>
                <FieldLabel>Estado de la clave</FieldLabel>

                <div
                  className="rounded-2xl border px-4 py-3 text-sm"
                  style={{
                    backgroundColor: hasPasswordConfigured
                      ? 'rgba(34,197,94,0.10)'
                      : 'rgba(245,158,11,0.10)',
                    borderColor: hasPasswordConfigured
                      ? 'rgba(34,197,94,0.24)'
                      : 'rgba(245,158,11,0.28)',
                    color: hasPasswordConfigured ? '#15803d' : '#b45309',
                  }}
                >
                  <div className="flex items-center gap-2 font-semibold">
                    {hasPasswordConfigured ? (
                      <CheckCircle2 className="h-4 w-4" />
                    ) : (
                      <AlertTriangle className="h-4 w-4" />
                    )}
                    {hasPasswordConfigured
                      ? 'Clave configurada y protegida'
                      : 'Clave no configurada'}
                  </div>
                </div>

                {hasPasswordConfigured ? (
                  <label
                    className="mt-3 flex cursor-pointer items-center gap-2 text-sm"
                    style={{ color: 'var(--admin-card-muted-text)' }}
                  >
                    <input
                      type="checkbox"
                      checked={form.clearSmtpPassword}
                      onChange={(event) =>
                        updateField('clearSmtpPassword', event.target.checked)
                      }
                    />
                    Eliminar clave SMTP guardada
                  </label>
                ) : null}
              </div>
            </div>
          </div>

          <div
            className="rounded-[24px] border p-4"
            style={{
              borderColor: 'var(--admin-glass-border)',
              backgroundColor: 'rgba(255,255,255,0.10)',
            }}
          >
            <div className="mb-4 flex items-center gap-2">
              <Send className="h-5 w-5" style={{ color: 'var(--admin-primary)' }} />
              <h4 className="text-sm font-bold" style={{ color: 'var(--admin-card-text)' }}>
                Prueba de envío
              </h4>
            </div>

            <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
              <div>
                <FieldLabel>Correo de prueba</FieldLabel>
                <TextInput
                  value={form.testEmail}
                  onChange={(value) => updateField('testEmail', value)}
                  placeholder="admin@tutienda.com"
                />
              </div>

              <button
                type="button"
                onClick={handleSendTest}
                disabled={testing || saving}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border px-5 py-3 text-sm font-semibold transition hover:scale-[1.01] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
                style={{
                  backgroundColor: 'rgba(255,255,255,0.18)',
                  borderColor: 'var(--admin-glass-border)',
                  color: 'var(--admin-card-text)',
                }}
              >
                {testing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                Enviar prueba
              </button>
            </div>

            {settings?.lastTestStatus && settings.lastTestStatus !== 'none' ? (
              <div className="mt-4">
                <InfoBox type={settings.lastTestStatus === 'success' ? 'success' : 'error'}>
                  <strong>Última prueba:</strong>{' '}
                  {settings.lastTestMessage || 'Sin mensaje registrado.'}
                </InfoBox>
              </div>
            ) : null}
          </div>

          <InfoBox type="warning">
            Para Gmail debes usar una contraseña de aplicación, no la contraseña normal
            de la cuenta. Para Hostinger, GoDaddy, cPanel u otro proveedor, usa la
            configuración SMTP que entregue el proveedor del dominio.
          </InfoBox>

          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-end">
            <button
              type="button"
              onClick={loadSettings}
              disabled={saving || testing}
              className="rounded-2xl border px-5 py-3 text-sm font-semibold transition hover:scale-[1.01] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
              style={{
                backgroundColor: 'rgba(255,255,255,0.18)',
                borderColor: 'var(--admin-glass-border)',
                color: 'var(--admin-card-text)',
              }}
            >
              Recargar
            </button>

            <button
              type="submit"
              disabled={saving || testing}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border px-5 py-3 text-sm font-semibold text-white transition hover:scale-[1.01] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
              style={{
                backgroundColor: 'var(--admin-primary)',
                borderColor: 'var(--admin-primary)',
              }}
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Guardar configuración
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}