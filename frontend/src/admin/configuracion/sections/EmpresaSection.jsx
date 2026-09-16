import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BadgeCheck,
  Building2,
  CheckCircle2,
  Clock3,
  ContactRound,
  Globe2,
  Loader2,
  MapPin,
  RotateCcw,
  Save,
  Store,
} from 'lucide-react';

import {
  fetchStoreCities,
  fetchStoreRegions,
  fetchStoreSettings,
  saveStoreSettings,
} from '../api/storeSettingsApi';
import StoreHoursEditor from './StoreHoursEditor';
import {
  formatWeeklySchedule,
  normalizeWeeklySchedule,
  validateWeeklySchedule,
} from './storeHours';
import './EmpresaSection.css';

const EMPTY_STORE = Object.freeze({
  name: '',
  businessName: '',
  email: '',
  phone: '',
  whatsapp: '',
  supportEmail: '',
  website: '',
  address: '',
  city: '',
  cityCode: '',
  department: '',
  departmentCode: '',
  country: 'CO',
  timezone: 'America/Bogota',
  locale: 'es-CO',
  customerServiceHours: '',
  weeklySchedule: null,
});

const STEPS = [
  {
    id: 'identity',
    label: 'Identidad',
    description: 'Cómo se reconoce tu tienda',
    icon: Building2,
    fields: ['name', 'businessName', 'website'],
  },
  {
    id: 'contact',
    label: 'Contacto',
    description: 'Canales para tus clientes',
    icon: ContactRound,
    fields: ['email', 'phone', 'whatsapp', 'supportEmail'],
  },
  {
    id: 'operation',
    label: 'Operación',
    description: 'Ubicación y horario',
    icon: MapPin,
    fields: [
      'address',
      'city',
      'cityCode',
      'department',
      'departmentCode',
      'country',
      'timezone',
      'locale',
      'customerServiceHours',
      'weeklySchedule',
    ],
  },
];

const REQUIRED_FIELDS = [
  'name',
  'email',
  'phone',
  'address',
  'city',
  'department',
];

function normalizeStore(raw = {}) {
  const normalized = Object.fromEntries(
    Object.entries(EMPTY_STORE).map(([key, fallback]) => [
      key,
      raw?.[key] ?? fallback,
    ])
  );
  normalized.weeklySchedule = normalizeWeeklySchedule(raw?.weeklySchedule);
  return normalized;
}

function normalizeGeoText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

function validateStore(store) {
  const errors = {};
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const phonePattern = /^\+?[\d\s().-]{7,24}$/;

  if (String(store.name || '').trim().length < 2) {
    errors.name = 'Escribe el nombre comercial de la tienda.';
  }
  if (!emailPattern.test(String(store.email || '').trim())) {
    errors.email = 'Escribe un correo principal válido.';
  }
  if (!phonePattern.test(String(store.phone || '').trim())) {
    errors.phone = 'Escribe un teléfono principal válido.';
  }
  if (store.whatsapp && !phonePattern.test(String(store.whatsapp).trim())) {
    errors.whatsapp = 'Escribe un número de WhatsApp válido.';
  }
  if (store.supportEmail && !emailPattern.test(String(store.supportEmail).trim())) {
    errors.supportEmail = 'Escribe un correo de atención válido.';
  }
  if (store.website) {
    try {
      const url = new URL(store.website);
      if (!['http:', 'https:'].includes(url.protocol)) throw new Error('protocol');
    } catch {
      errors.website = 'Usa una dirección completa, por ejemplo https://mitienda.com.';
    }
  }
  if (String(store.address || '').trim().length < 5) {
    errors.address = 'Escribe la dirección principal.';
  }
  if (String(store.city || '').trim().length < 2) {
    errors.city = 'Escribe la ciudad principal.';
  }
  if (String(store.department || '').trim().length < 2) {
    errors.department = 'Escribe el departamento o región.';
  }
  if (store.country === 'CO' && !/^\d{2}$/.test(String(store.departmentCode || ''))) {
    errors.departmentCode = 'Selecciona un departamento del catálogo.';
  }
  if (store.country === 'CO' && !/^\d{5}$/.test(String(store.cityCode || ''))) {
    errors.cityCode = 'Selecciona un municipio del catálogo.';
  }
  const scheduleError = validateWeeklySchedule(store.weeklySchedule);
  if (scheduleError) errors.weeklySchedule = scheduleError;

  return errors;
}

function stepForField(field) {
  return STEPS.find((step) => step.fields.includes(field))?.id || 'identity';
}

function formatUpdatedAt(value) {
  if (!value) return 'Sin actualizaciones registradas';
  return `Última actualización: ${new Date(value).toLocaleString('es-CO')}`;
}

function Field({ label, required = false, help, error, children }) {
  const controlId = React.useId();
  const feedbackId = `${controlId}-feedback`;
  const control = React.cloneElement(children, {
    id: children.props.id || controlId,
    'aria-invalid': error ? 'true' : 'false',
    'aria-describedby': error || help ? feedbackId : undefined,
  });

  return (
    <div className="store-field">
      <label className="store-field__label" htmlFor={children.props.id || controlId}>
        {label}
        {required ? <b aria-hidden="true">*</b> : null}
      </label>
      {control}
      {error ? (
        <span id={feedbackId} className="store-field__error" role="alert">{error}</span>
      ) : help ? (
        <span id={feedbackId} className="store-field__help">{help}</span>
      ) : null}
    </div>
  );
}

export default function EmpresaSection() {
  const [store, setStore] = useState(EMPTY_STORE);
  const [snapshot, setSnapshot] = useState(EMPTY_STORE);
  const [revision, setRevision] = useState(0);
  const [updatedAt, setUpdatedAt] = useState(null);
  const [updatedBy, setUpdatedBy] = useState('');
  const [activeStep, setActiveStep] = useState('identity');
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [regions, setRegions] = useState([]);
  const [cities, setCities] = useState([]);
  const [regionsLoading, setRegionsLoading] = useState(false);
  const [citiesLoading, setCitiesLoading] = useState(false);
  const [geoError, setGeoError] = useState('');

  const dirty = useMemo(
    () => JSON.stringify(store) !== JSON.stringify(snapshot),
    [store, snapshot]
  );
  const completedRequired = REQUIRED_FIELDS.filter((field) =>
    String(store[field] || '').trim()
  ).length;
  const completion = Math.round((completedRequired / REQUIRED_FIELDS.length) * 100);

  const loadSettings = async () => {
    try {
      setLoading(true);
      setFeedback(null);
      setErrors({});
      const response = await fetchStoreSettings();
      const nextStore = normalizeStore(response?.store);
      setStore(nextStore);
      setSnapshot(nextStore);
      setRevision(Number(response?.revision || 0));
      setUpdatedAt(response?.updatedAt || null);
      setUpdatedBy(response?.updatedBy || '');
    } catch (error) {
      setFeedback({
        type: 'error',
        message: error?.userMessage || 'No pudimos cargar los datos de la tienda.',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  useEffect(() => {
    if (!store.country) {
      setRegions([]);
      setCities([]);
      return undefined;
    }
    let active = true;
    setRegionsLoading(true);
    setGeoError('');
    fetchStoreRegions(store.country)
      .then((data) => {
        if (!active) return;
        setRegions(data);
        if (!data.length) setGeoError('No hay departamentos disponibles para el país seleccionado.');
      })
      .catch(() => {
        if (!active) return;
        setRegions([]);
        setCities([]);
        setGeoError('No fue posible cargar los departamentos. Intenta nuevamente.');
      })
      .finally(() => {
        if (active) setRegionsLoading(false);
      });
    return () => { active = false; };
  }, [store.country]);

  useEffect(() => {
    if (!regions.length || store.departmentCode || !store.department) return;
    const match = regions.find(
      (region) => normalizeGeoText(region.name) === normalizeGeoText(store.department)
    );
    if (!match) return;
    const code = String(match.code || match.isoCode || '');
    setStore((current) => ({ ...current, department: match.name, departmentCode: code }));
    setSnapshot((current) =>
      !current.departmentCode && normalizeGeoText(current.department) === normalizeGeoText(match.name)
        ? { ...current, department: match.name, departmentCode: code }
        : current
    );
  }, [regions, store.department, store.departmentCode]);

  useEffect(() => {
    if (!store.country || !store.departmentCode) {
      setCities([]);
      return undefined;
    }
    let active = true;
    setCitiesLoading(true);
    setGeoError('');
    fetchStoreCities(store.country, store.departmentCode)
      .then((data) => {
        if (!active) return;
        setCities(data);
        if (!data.length) setGeoError('No hay municipios disponibles para el departamento seleccionado.');
      })
      .catch(() => {
        if (!active) return;
        setCities([]);
        setGeoError('No fue posible cargar los municipios. Intenta nuevamente.');
      })
      .finally(() => {
        if (active) setCitiesLoading(false);
      });
    return () => { active = false; };
  }, [store.country, store.departmentCode]);

  useEffect(() => {
    if (!cities.length || store.cityCode || !store.city) return;
    const match = cities.find(
      (city) => normalizeGeoText(city.name) === normalizeGeoText(store.city)
    );
    if (!match) return;
    const code = String(match.code || '');
    setStore((current) => ({ ...current, city: match.name, cityCode: code }));
    setSnapshot((current) =>
      !current.cityCode && normalizeGeoText(current.city) === normalizeGeoText(match.name)
        ? { ...current, city: match.name, cityCode: code }
        : current
    );
  }, [cities, store.city, store.cityCode]);

  useEffect(() => {
    const warnUnsavedChanges = (event) => {
      if (!dirty) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warnUnsavedChanges);
    return () => window.removeEventListener('beforeunload', warnUnsavedChanges);
  }, [dirty]);

  const updateField = (field, value) => {
    setStore((current) => ({ ...current, [field]: value }));
    setErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
    if (feedback?.type === 'success') setFeedback(null);
  };

  const updateLocation = (changes) => {
    setStore((current) => ({ ...current, ...changes }));
    const changedFields = Object.keys(changes);
    setErrors((current) => {
      if (!changedFields.some((field) => current[field])) return current;
      const next = { ...current };
      changedFields.forEach((field) => delete next[field]);
      return next;
    });
    if (feedback?.type === 'success') setFeedback(null);
  };

  const updateSchedule = (weeklySchedule) => {
    updateLocation({
      weeklySchedule,
      customerServiceHours: formatWeeklySchedule(weeklySchedule),
    });
  };

  const handleReset = () => {
    setStore(snapshot);
    setErrors({});
    setFeedback(null);
  };

  const handleSave = async () => {
    const validationErrors = validateStore(store);
    if (Object.keys(validationErrors).length) {
      const firstField = Object.keys(validationErrors)[0];
      setErrors(validationErrors);
      setActiveStep(stepForField(firstField));
      setFeedback({
        type: 'error',
        message: 'Hay datos pendientes. Revisa los campos señalados.',
      });
      return;
    }

    try {
      setSaving(true);
      setFeedback(null);
      setErrors({});
      const response = await saveStoreSettings({ store, revision });
      const nextStore = normalizeStore(response?.store);
      setStore(nextStore);
      setSnapshot(nextStore);
      setRevision(Number(response?.revision || revision + 1));
      setUpdatedAt(response?.updatedAt || new Date().toISOString());
      setUpdatedBy(response?.updatedBy || updatedBy);
      setFeedback({
        type: 'success',
        message: 'Los datos de la tienda quedaron guardados y sincronizados.',
      });
    } catch (error) {
      const details = Array.isArray(error?.response?.data?.details)
        ? error.response.data.details
        : [];
      const serverErrors = Object.fromEntries(
        details
          .filter((item) => item?.field && item?.message)
          .map((item) => [item.field, item.message])
      );
      if (Object.keys(serverErrors).length) {
        setErrors(serverErrors);
        setActiveStep(stepForField(Object.keys(serverErrors)[0]));
      }
      const conflict = error?.response?.data?.error === 'STORE_SETTINGS_CONFLICT';
      setFeedback({
        type: conflict ? 'conflict' : 'error',
        message:
          error?.response?.data?.message ||
          error?.userMessage ||
          'No fue posible guardar los datos de la tienda.',
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="store-loading" aria-live="polite">
        <Loader2 className="animate-spin" size={24} />
        <span>Preparando los datos de tu tienda…</span>
      </div>
    );
  }

  return (
    <div className="store-settings">
      <section className="store-hero">
        <div className="store-hero__identity">
          <div className="store-hero__icon"><Store size={26} /></div>
          <div>
            <span className="store-eyebrow">Centro de identidad comercial</span>
            <h2>{store.name || 'Configura tu tienda'}</h2>
            <p>Centraliza la información que verán tus clientes y usarán los procesos internos.</p>
          </div>
        </div>
        <div className="store-readiness" aria-label={`${completion}% de datos esenciales completos`}>
          <div className="store-readiness__label"><span>Datos esenciales</span><strong>{completion}%</strong></div>
          <div className="store-readiness__track"><span style={{ width: `${completion}%` }} /></div>
          <small>{formatUpdatedAt(updatedAt)}{updatedBy ? ` · ${updatedBy}` : ''}</small>
        </div>
      </section>

      {feedback ? (
        <div className={`store-feedback store-feedback--${feedback.type}`} role="status">
          {feedback.type === 'success' ? <CheckCircle2 size={19} /> : <AlertTriangle size={19} />}
          <span>{feedback.message}</span>
          {feedback.type === 'conflict' ? <button type="button" onClick={loadSettings}>Recargar versión actual</button> : null}
        </div>
      ) : null}

      <nav className="store-steps" aria-label="Secciones de datos de la tienda">
        {STEPS.map((step) => {
          const Icon = step.icon;
          const hasErrors = step.fields.some((field) => errors[field]);
          return (
            <button key={step.id} type="button" className="store-step" data-active={activeStep === step.id} data-error={hasErrors} aria-current={activeStep === step.id ? 'step' : undefined} onClick={() => setActiveStep(step.id)}>
              <Icon size={19} />
              <span><strong>{step.label}</strong><small>{step.description}</small></span>
              {hasErrors ? <b className="store-step__alert">Revisar</b> : null}
            </button>
          );
        })}
      </nav>

      <div className="store-workspace">
        <section className="store-form-card">
          {activeStep === 'identity' ? (
            <div className="store-panel" data-testid="store-step-identity">
              <header><BadgeCheck size={22} /><div><h3>Identidad de la tienda</h3><p>Información comercial; los datos fiscales continúan exclusivamente en Facturación.</p></div></header>
              <div className="store-form-grid">
                <Field label="Nombre comercial" required error={errors.name} help="El nombre que reconocerán tus clientes."><input value={store.name} onChange={(event) => updateField('name', event.target.value)} placeholder="Ej. Rosa Boutique" /></Field>
                <Field label="Razón social" error={errors.businessName} help="Opcional. No reemplaza la configuración fiscal."><input value={store.businessName} onChange={(event) => updateField('businessName', event.target.value)} placeholder="Nombre legal registrado" /></Field>
                <Field label="Página web" error={errors.website} help="Usa la URL completa con https://."><input type="url" value={store.website} onChange={(event) => updateField('website', event.target.value)} placeholder="https://mitienda.com" /></Field>
              </div>
            </div>
          ) : null}

          {activeStep === 'contact' ? (
            <div className="store-panel" data-testid="store-step-contact">
              <header><ContactRound size={22} /><div><h3>Canales de contacto</h3><p>Define cómo podrán comunicarse los clientes con la tienda.</p></div></header>
              <div className="store-form-grid">
                <Field label="Correo principal" required error={errors.email}><input type="email" value={store.email} onChange={(event) => updateField('email', event.target.value)} placeholder="contacto@mitienda.com" /></Field>
                <Field label="Teléfono principal" required error={errors.phone} help="Incluye indicativo cuando corresponda."><input value={store.phone} onChange={(event) => updateField('phone', event.target.value)} placeholder="+57 300 000 0000" /></Field>
                <Field label="WhatsApp comercial" error={errors.whatsapp} help="Opcional. Puede ser diferente al teléfono principal."><input value={store.whatsapp} onChange={(event) => updateField('whatsapp', event.target.value)} placeholder="+57 300 000 0000" /></Field>
                <Field label="Correo de atención" error={errors.supportEmail} help="Opcional, para soporte y novedades de pedidos."><input type="email" value={store.supportEmail} onChange={(event) => updateField('supportEmail', event.target.value)} placeholder="soporte@mitienda.com" /></Field>
              </div>
            </div>
          ) : null}

          {activeStep === 'operation' ? (
            <div className="store-panel" data-testid="store-step-operation">
              <header><Clock3 size={22} /><div><h3>Operación principal</h3><p>Ubicación, zona horaria e idioma usados por la administración.</p></div></header>
              <div className="store-form-grid">
                <Field label="Dirección principal" required error={errors.address}><input value={store.address} onChange={(event) => updateField('address', event.target.value)} placeholder="Calle, número y referencia" /></Field>
                <Field label="País" required error={errors.country}><select value={store.country} onChange={(event) => updateLocation({ country: event.target.value, department: '', departmentCode: '', city: '', cityCode: '' })}><option value="CO">Colombia</option><option value="EC">Ecuador</option><option value="MX">México</option><option value="PE">Perú</option><option value="US">Estados Unidos</option></select></Field>
                <Field label={store.country === 'CO' ? 'Departamento' : 'Estado o región'} required error={errors.departmentCode || errors.department} help={regionsLoading ? 'Cargando catálogo…' : 'Selecciona una opción registrada en la base de datos.'}>
                  <select
                    value={store.departmentCode}
                    disabled={regionsLoading || !regions.length}
                    onChange={(event) => {
                      const region = regions.find((item) => String(item.code || item.isoCode) === event.target.value);
                      updateLocation({ department: region?.name || '', departmentCode: event.target.value, city: '', cityCode: '' });
                    }}
                  >
                    <option value="">{regionsLoading ? 'Cargando departamentos…' : 'Selecciona un departamento'}</option>
                    {regions.map((region) => {
                      const code = String(region.code || region.isoCode || '');
                      return <option key={code} value={code}>{region.name}</option>;
                    })}
                  </select>
                </Field>
                <Field label={store.country === 'CO' ? 'Municipio' : 'Ciudad'} required error={errors.cityCode || errors.city} help={citiesLoading ? 'Cargando catálogo…' : !store.departmentCode ? 'Primero selecciona el departamento.' : 'La lista depende del departamento seleccionado.'}>
                  <select
                    value={store.cityCode}
                    disabled={citiesLoading || !store.departmentCode || !cities.length}
                    onChange={(event) => {
                      const city = cities.find((item) => String(item.code) === event.target.value);
                      updateLocation({ city: city?.name || '', cityCode: event.target.value });
                    }}
                  >
                    <option value="">{citiesLoading ? 'Cargando municipios…' : 'Selecciona un municipio'}</option>
                    {cities.map((city) => <option key={city.code} value={String(city.code)}>{city.name}</option>)}
                  </select>
                </Field>
                {geoError ? <div className="store-geo-error" role="alert"><AlertTriangle size={15} /> {geoError}</div> : null}
                <Field label="Zona horaria" required error={errors.timezone}><select value={store.timezone} onChange={(event) => updateField('timezone', event.target.value)}><option value="America/Bogota">Bogotá (UTC-5)</option><option value="America/Guayaquil">Guayaquil (UTC-5)</option><option value="America/Lima">Lima (UTC-5)</option><option value="America/Mexico_City">Ciudad de México</option><option value="America/New_York">Nueva York</option></select></Field>
                <Field label="Idioma regional" required error={errors.locale}><select value={store.locale} onChange={(event) => updateField('locale', event.target.value)}><option value="es-CO">Español (Colombia)</option><option value="en-US">English (United States)</option></select></Field>
                <StoreHoursEditor value={store.weeklySchedule} legacySummary={store.customerServiceHours} error={errors.weeklySchedule} onChange={updateSchedule} />
              </div>
            </div>
          ) : null}
        </section>

        <aside className="store-preview" aria-label="Resumen de la tienda">
          <span className="store-eyebrow">Vista resumida</span>
          <div className="store-preview__brand"><Store size={24} /><div><strong>{store.name || 'Tu tienda'}</strong><small>{store.businessName || 'Identidad comercial'}</small></div></div>
          <dl>
            <div><dt><MapPin size={15} /> Ubicación</dt><dd>{[store.city, store.department].filter(Boolean).join(', ') || 'Pendiente'}</dd></div>
            <div><dt><ContactRound size={15} /> Contacto</dt><dd>{store.email || store.phone || 'Pendiente'}</dd></div>
            <div><dt><Clock3 size={15} /> Atención</dt><dd>{store.customerServiceHours || 'Sin horario publicado'}</dd></div>
            <div><dt><Globe2 size={15} /> Región</dt><dd>{store.locale} · {store.timezone}</dd></div>
          </dl>
          <p><BadgeCheck size={16} /> La información fiscal se administra separadamente en Facturación.</p>
        </aside>
      </div>

      <footer className="store-actions">
        <div><strong>{dirty ? 'Tienes cambios sin guardar' : 'Información sincronizada'}</strong><span>Versión {revision}</span></div>
        <div className="store-actions__buttons">
          <button type="button" className="store-button store-button--secondary" onClick={handleReset} disabled={!dirty || saving}><RotateCcw size={17} /> Descartar</button>
          <button type="button" className="store-button store-button--primary" onClick={handleSave} disabled={!dirty || saving}>{saving ? <Loader2 className="animate-spin" size={17} /> : <Save size={17} />}{saving ? 'Guardando…' : 'Guardar cambios'}</button>
        </div>
      </footer>
    </div>
  );
}

export { EMPTY_STORE, normalizeStore, validateStore };
