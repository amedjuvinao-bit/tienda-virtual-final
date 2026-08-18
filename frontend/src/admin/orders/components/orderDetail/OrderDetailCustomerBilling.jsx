// frontend/src/admin/orders/components/orderDetail/OrderDetailCustomerBilling.jsx

import { useEffect, useMemo, useState } from 'react';
import api from '../../../../lib/api';
import { ORDER_DETAIL_THEME } from './orderDetailTheme';
import {
  cleanText,
  getBillingName,
  getCustomerName,
} from './orderDetailUtils';
import { OrderDetailIcons } from './OrderDetailIcons';
import {
  InfoLine,
  OrderDetailPanel,
  SectionTitle,
  SoftBadge,
} from './OrderDetailPrimitives';

const PERSON_TYPE_OPTIONS = [
  { value: 'natural', label: 'Persona natural' },
  { value: 'juridica', label: 'Persona jurídica' },
];

const DOCUMENT_TYPE_OPTIONS = [
  { value: 'RC', label: 'RC · Registro civil' },
  { value: 'TI', label: 'TI · Tarjeta de identidad' },
  { value: 'CC', label: 'CC · Cédula de ciudadanía' },
  { value: 'TE', label: 'TE · Tarjeta de extranjería' },
  { value: 'CE', label: 'CE · Cédula de extranjería' },
  { value: 'NIT', label: 'NIT · Identificación tributaria' },
  { value: 'PP', label: 'PP · Pasaporte' },
  { value: 'DIE', label: 'DIE · Documento de identificación extranjero' },
  { value: 'PEP', label: 'PEP · Permiso especial de permanencia' },
  { value: 'PPT', label: 'PPT · Permiso por protección temporal' },
  { value: 'NIT_EXTRANJERO', label: 'NIT de otro país' },
  { value: 'NUIP', label: 'NUIP · Número único de identificación personal' },
];

function firstValidText(...values) {
  const found = values
    .map((value) => String(value || '').trim())
    .find((value) => value && value !== '—');

  return found || '—';
}

function comparableText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function findUniqueByName(items = [], value = '') {
  const normalized = comparableText(value);
  if (!normalized) return null;

  const matches = items.filter(
    (item) => comparableText(item?.name) === normalized
  );
  return matches.length === 1 ? matches[0] : null;
}

function getEmailFromCustomer(customer, order) {
  const emailDirect = firstValidText(
    customer.email,
    customer.customerEmail,
    customer.emailAddress,
    order?.customerEmail
  );

  if (emailDirect !== '—') return emailDirect;

  const emailOrPhone = String(customer.emailOrPhone || '').trim();

  if (emailOrPhone.includes('@')) {
    return emailOrPhone;
  }

  return '—';
}

function getEditableForm(order = {}) {
  const customer = order.customer || {};
  const billing = order.billing || {};

  return {
    customer: {
      name: customer.name || '',
      lastname: customer.lastname || '',
      documentType: customer.documentType || billing.documentType || '',
      id: customer.id || billing.documentNumber || billing.id || '',
      email:
        customer.email ||
        (String(customer.emailOrPhone || '').includes('@')
          ? customer.emailOrPhone
          : ''),
      phone:
        customer.phone ||
        (!String(customer.emailOrPhone || '').includes('@')
          ? customer.emailOrPhone
          : '') ||
        billing.phone ||
        '',
      address: customer.address || billing.address || '',
      city: customer.city || billing.city || '',
      municipalityCode:
        customer.municipalityCode ||
        customer.municipalityId ||
        customer.municipality_id ||
        '',
      department: customer.department || billing.department || '',
      departmentCode: customer.departmentCode || '',
      country: customer.country || billing.country || 'Colombia',
      countryCode: customer.countryCode || billing.countryCode || 'CO',
      postalCode: customer.postalCode || billing.postalCode || '',
    },
    billing: {
      personType: billing.personType || '',
      businessName: billing.businessName || '',
      firstName: billing.firstName || billing.name || customer.name || '',
      lastName: billing.lastName || billing.lastname || customer.lastname || '',
      documentType: billing.documentType || customer.documentType || '',
      documentNumber: billing.documentNumber || billing.id || customer.id || '',
      email: billing.email || customer.email || '',
      phone: billing.phone || customer.phone || '',
      address: billing.address || customer.address || '',
      city: billing.city || customer.city || '',
      municipalityCode:
        billing.municipalityCode ||
        billing.cityCode ||
        customer.municipalityCode ||
        customer.municipalityId ||
        customer.municipality_id ||
        '',
      cityCode:
        billing.cityCode ||
        billing.municipalityCode ||
        customer.municipalityCode ||
        customer.municipalityId ||
        customer.municipality_id ||
        '',
      department: billing.department || customer.department || '',
      departmentCode:
        billing.departmentCode || customer.departmentCode || '',
      country: billing.country || customer.country || 'Colombia',
      countryCode: billing.countryCode || customer.countryCode || 'CO',
      postalCode: billing.postalCode || customer.postalCode || '',
    },
  };
}

function isDemoOrder(order = {}) {
  const tags = (Array.isArray(order.tags) ? order.tags : [])
    .map((tag) => String(tag || '').trim().toLowerCase());
  const email = String(
    order?.customer?.email || order?.billing?.email || ''
  ).toLowerCase();

  return (
    tags.includes('demo') ||
    tags.includes('orders-trace') ||
    (
      String(order.source || '').toLowerCase() === 'system' &&
      email.endsWith('@example.com')
    )
  );
}

const fieldStyle = {
  width: '100%',
  minWidth: 0,
  border: `1px solid ${ORDER_DETAIL_THEME.cardBorder}`,
  borderRadius: 12,
  background: ORDER_DETAIL_THEME.cardBg,
  color: ORDER_DETAIL_THEME.cardText,
  padding: '10px 11px',
  fontSize: 12,
  fontWeight: 700,
  outline: 'none',
};

function EditField({ label, value, onChange, type = 'text', children }) {
  return (
    <label style={{ display: 'grid', gap: 6, minWidth: 0 }}>
      <span
        style={{
          color: ORDER_DETAIL_THEME.mutedText,
          fontSize: 10,
          fontWeight: 900,
          letterSpacing: '.06em',
          textTransform: 'uppercase',
        }}
      >
        {label}
      </span>
      {children || (
        <input
          type={type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          style={fieldStyle}
        />
      )}
    </label>
  );
}

export default function OrderDetailCustomerBilling({
  order,
  onSaveCustomerData,
  saving = false,
}) {
  const customer = order?.customer || {};
  const billing = order?.billing || {};
  const [editing, setEditing] = useState(false);
  const [syncCustomer, setSyncCustomer] = useState(false);
  const [form, setForm] = useState(() => getEditableForm(order));
  const [formError, setFormError] = useState('');
  const [regions, setRegions] = useState([]);
  const [regionsLoading, setRegionsLoading] = useState(false);
  const [customerCities, setCustomerCities] = useState([]);
  const [billingCities, setBillingCities] = useState([]);
  const [customerCitiesLoading, setCustomerCitiesLoading] = useState(false);
  const [billingCitiesLoading, setBillingCitiesLoading] = useState(false);
  const [geoError, setGeoError] = useState('');
  const demoOrder = useMemo(() => isDemoOrder(order), [order]);

  useEffect(() => {
    setEditing(false);
    setSyncCustomer(false);
    setForm(getEditableForm(order));
    setFormError('');
  }, [order?._id]);

  useEffect(() => {
    if (!editing) return undefined;

    let cancelled = false;
    setRegionsLoading(true);
    setGeoError('');

    api.get('/api/geo/regions', { params: { country: 'CO' } })
      .then((response) => {
        if (!cancelled) {
          setRegions(Array.isArray(response?.data) ? response.data : []);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setRegions([]);
          setGeoError('No fue posible cargar los departamentos. Intenta nuevamente.');
        }
      })
      .finally(() => {
        if (!cancelled) setRegionsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [editing]);

  useEffect(() => {
    if (!editing || !regions.length) return;

    setForm((current) => {
      let changed = false;
      const next = {
        ...current,
        customer: { ...current.customer },
        billing: { ...current.billing },
      };

      ['customer', 'billing'].forEach((party) => {
        if (next[party].departmentCode || !next[party].department) return;
        const region = findUniqueByName(regions, next[party].department);
        if (!region?.code) return;

        next[party].departmentCode = String(region.code);
        next[party].department = region.name || next[party].department;
        changed = true;
      });

      return changed ? next : current;
    });
  }, [editing, regions]);

  useEffect(() => {
    const departmentCode = String(form.customer.departmentCode || '').trim();
    if (!editing || !departmentCode) {
      setCustomerCities([]);
      return undefined;
    }

    let cancelled = false;
    setCustomerCitiesLoading(true);

    api.get('/api/geo/cities', {
      params: { country: 'CO', region: departmentCode, limit: 10000 },
    })
      .then((response) => {
        if (!cancelled) {
          setCustomerCities(Array.isArray(response?.data) ? response.data : []);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCustomerCities([]);
          setGeoError('No fue posible cargar los municipios. Intenta nuevamente.');
        }
      })
      .finally(() => {
        if (!cancelled) setCustomerCitiesLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [editing, form.customer.departmentCode]);

  useEffect(() => {
    const departmentCode = String(form.billing.departmentCode || '').trim();
    if (!editing || !departmentCode) {
      setBillingCities([]);
      return undefined;
    }

    let cancelled = false;
    setBillingCitiesLoading(true);

    api.get('/api/geo/cities', {
      params: { country: 'CO', region: departmentCode, limit: 10000 },
    })
      .then((response) => {
        if (!cancelled) {
          setBillingCities(Array.isArray(response?.data) ? response.data : []);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setBillingCities([]);
          setGeoError('No fue posible cargar los municipios. Intenta nuevamente.');
        }
      })
      .finally(() => {
        if (!cancelled) setBillingCitiesLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [editing, form.billing.departmentCode]);

  useEffect(() => {
    if (!editing || !customerCities.length || form.customer.municipalityCode) return;
    const city = findUniqueByName(customerCities, form.customer.city);
    if (!city?.code) return;

    setForm((current) => ({
      ...current,
      customer: {
        ...current.customer,
        city: city.name || current.customer.city,
        municipalityCode: String(city.code),
      },
    }));
  }, [customerCities, editing, form.customer.city, form.customer.municipalityCode]);

  useEffect(() => {
    if (!editing || !billingCities.length || form.billing.municipalityCode) return;
    const city = findUniqueByName(billingCities, form.billing.city);
    if (!city?.code) return;

    setForm((current) => ({
      ...current,
      billing: {
        ...current.billing,
        city: city.name || current.billing.city,
        municipalityCode: String(city.code),
        cityCode: String(city.code),
      },
    }));
  }, [billingCities, editing, form.billing.city, form.billing.municipalityCode]);

  const setPartyField = (party, field, value) => {
    setForm((current) => ({
      ...current,
      [party]: {
        ...current[party],
        [field]: value,
      },
    }));
  };

  const setBillingPersonType = (value) => {
    setForm((current) => ({
      ...current,
      billing: {
        ...current.billing,
        personType: value,
        documentType: value === 'juridica' ? 'NIT' : current.billing.documentType,
      },
    }));
  };

  const setDepartment = (party, code) => {
    const region = regions.find(
      (item) => String(item?.code || '') === String(code || '')
    );

    setForm((current) => ({
      ...current,
      [party]: {
        ...current[party],
        departmentCode: String(code || ''),
        department: region?.name || '',
        city: '',
        municipalityCode: '',
        ...(party === 'billing' ? { cityCode: '' } : {}),
      },
    }));
    setGeoError('');
  };

  const setMunicipality = (party, code) => {
    const cities = party === 'billing' ? billingCities : customerCities;
    const city = cities.find(
      (item) => String(item?.code || '') === String(code || '')
    );

    setForm((current) => ({
      ...current,
      [party]: {
        ...current[party],
        city: city?.name || '',
        municipalityCode: String(code || ''),
        ...(party === 'billing' ? { cityCode: String(code || '') } : {}),
      },
    }));
    setGeoError('');
  };

  const submit = async (event) => {
    event.preventDefault();
    setFormError('');

    const phoneDigits = String(form.customer.phone || '').replace(/\D/g, '');
    if (form.customer.phone && phoneDigits.length < 10) {
      setFormError('El celular debe tener al menos 10 dígitos.');
      return;
    }

    const colombianBilling = ['CO', 'COLOMBIA', ''].includes(
      String(form.billing.countryCode || form.billing.country || '')
        .trim()
        .toUpperCase()
    );
    if (colombianBilling && !form.billing.municipalityCode) {
      setFormError('Selecciona el departamento y municipio de facturación.');
      return;
    }

    try {
      await onSaveCustomerData?.({
        customer: form.customer,
        billing: form.billing,
        syncCustomer: demoOrder ? false : syncCustomer,
      });
      setEditing(false);
    } catch {
      // El modal presenta el error del servidor; el formulario conserva los datos.
    }
  };

  const customerName = getCustomerName(order);
  const billingName = getBillingName(order);

  const customerDocument = firstValidText(
    customer.document,
    customer.documentNumber,
    customer.identification,
    customer.idNumber,
    customer.id,
    customer.cedula,
    customer.cc,
    customer.legalId,
    customer.legal_id,
    order?.customerDocument,
    order?.customerId
  );

  const billingDocument = firstValidText(
    billing.document,
    billing.documentNumber,
    billing.identification,
    billing.idNumber,
    billing.id,
    billing.cedula,
    billing.cc,
    billing.legalId,
    billing.legal_id,
    customerDocument
  );
  const billingDocumentType = firstValidText(
    billing.documentType,
    customer.documentType
  );
  const billingPersonType = String(billing.personType || '').trim().toLowerCase();
  const billingPersonLabel =
    billingPersonType === 'juridica'
      ? 'Persona jurídica'
      : billingPersonType === 'natural'
        ? 'Persona natural'
        : '—';
  const billingDocumentWithDv =
    billingDocumentType === 'NIT' && billing.dv
      ? `${billingDocument}-${billing.dv}`
      : billingDocument;

  const customerAddress = firstValidText(
    customer.address,
    customer.shippingAddress,
    customer.addressLine,
    customer.deliveryAddress,
    order?.customerAddress
  );

  const billingAddress = firstValidText(
    billing.address,
    billing.billingAddress,
    billing.addressLine,
    billing.deliveryAddress,
    customerAddress
  );

  const customerCity = firstValidText(
    customer.city,
    customer.municipality,
    customer.town,
    customer.customerCity,
    order?.customerCity
  );

  const billingCity = firstValidText(
    billing.city,
    billing.municipality,
    billing.town,
    billing.billingCity,
    customerCity
  );

  const customerEmail = getEmailFromCustomer(customer, order);
  const billingEmail = firstValidText(
    billing.email,
    customerEmail
  );

  const customerPhone = firstValidText(
    customer.phone,
    customer.customerPhone,
    customer.phoneNumber,
    customer.mobile,
    customer.cellphone,
    customer.emailOrPhone && !String(customer.emailOrPhone).includes('@')
      ? customer.emailOrPhone
      : '',
    order?.customerPhone
  );

  const billingDepartment = firstValidText(
    billing.department,
    billing.state,
    billing.region,
    customer.department,
    customer.state,
    customer.region
  );

  const billingCountry = firstValidText(
    billing.country,
    customer.country,
    'Colombia'
  );

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
        gap: 14,
      }}
    >
      <OrderDetailPanel
        style={{
          padding: 18,
        }}
      >
        <SectionTitle
          icon={OrderDetailIcons.User}
          title="Cliente"
          subtitle="Información principal de contacto"
          action={
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <SoftBadge variant="primary">Comprador</SoftBadge>
              {onSaveCustomerData ? (
                <button
                  type="button"
                  onClick={() => setEditing((value) => !value)}
                  style={{
                    border: `1px solid ${ORDER_DETAIL_THEME.cardBorder}`,
                    borderRadius: 999,
                    background: editing
                      ? ORDER_DETAIL_THEME.primary
                      : ORDER_DETAIL_THEME.cardBg,
                    color: editing ? '#fff' : ORDER_DETAIL_THEME.primary,
                    padding: '7px 11px',
                    fontSize: 10,
                    fontWeight: 950,
                    cursor: 'pointer',
                  }}
                >
                  {editing ? 'Cerrar edición' : 'Corregir datos'}
                </button>
              ) : null}
            </div>
          }
        />

        <div
          style={{
            display: 'grid',
            gap: 11,
          }}
        >
          <InfoLine label="Nombre:" value={customerName} strong />
          <InfoLine label="Documento:" value={cleanText(customerDocument)} />
          <InfoLine label="Correo:" value={cleanText(customerEmail)} />
          <InfoLine label="Teléfono:" value={cleanText(customerPhone)} />
          <InfoLine label="Dirección:" value={cleanText(customerAddress)} />
          <InfoLine label="Ciudad:" value={cleanText(customerCity)} />
        </div>
      </OrderDetailPanel>

      {editing ? (
        <OrderDetailPanel
          style={{
            padding: 18,
            gridColumn: '1 / -1',
            order: 2,
          }}
        >
          <SectionTitle
            icon={OrderDetailIcons.Settings2}
            title="Corregir datos de la orden"
            subtitle="Define el alcance antes de guardar; ningún cambio se aplica automáticamente."
          />

          <form onSubmit={submit} style={{ display: 'grid', gap: 16 }}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                gap: 10,
                padding: 12,
                border: `1px solid ${ORDER_DETAIL_THEME.cardBorder}`,
                borderRadius: 16,
                background: ORDER_DETAIL_THEME.primarySoftBg,
              }}
            >
              <button
                type="button"
                onClick={() => setSyncCustomer(false)}
                style={{
                  ...fieldStyle,
                  cursor: 'pointer',
                  borderColor: !syncCustomer
                    ? ORDER_DETAIL_THEME.primary
                    : ORDER_DETAIL_THEME.cardBorder,
                  color: !syncCustomer
                    ? ORDER_DETAIL_THEME.primary
                    : ORDER_DETAIL_THEME.cardText,
                }}
              >
                Solo esta orden
              </button>
              <button
                type="button"
                disabled={demoOrder}
                onClick={() => setSyncCustomer(true)}
                style={{
                  ...fieldStyle,
                  cursor: demoOrder ? 'not-allowed' : 'pointer',
                  opacity: demoOrder ? 0.5 : 1,
                  borderColor: syncCustomer
                    ? ORDER_DETAIL_THEME.primary
                    : ORDER_DETAIL_THEME.cardBorder,
                  color: syncCustomer
                    ? ORDER_DETAIL_THEME.primary
                    : ORDER_DETAIL_THEME.cardText,
                }}
              >
                Esta orden y ficha del cliente
              </button>
              {!demoOrder && (
                <div
                  style={{
                    gridColumn: '1 / -1',
                    color: ORDER_DETAIL_THEME.mutedText,
                    fontSize: 11,
                    fontWeight: 700,
                    lineHeight: 1.45,
                  }}
                >
                  {syncCustomer
                    ? 'Los datos de contacto también quedarán disponibles en el módulo Clientes.'
                    : 'La ficha maestra del cliente no será modificada.'}
                </div>
              )}
            </div>

            <div className="order-customer-edit-grid">
              <div style={{ display: 'grid', gap: 12 }}>
                <strong style={{ fontSize: 12 }}>Contacto del comprador</strong>
                <div className="order-customer-edit-fields">
                  <EditField label="Nombre" value={form.customer.name} onChange={(value) => setPartyField('customer', 'name', value)} />
                  <EditField label="Apellido" value={form.customer.lastname} onChange={(value) => setPartyField('customer', 'lastname', value)} />
                  <EditField label="Tipo documento">
                    <select
                      aria-label="Tipo documento del comprador"
                      value={form.customer.documentType}
                      onChange={(event) => setPartyField('customer', 'documentType', event.target.value)}
                      style={fieldStyle}
                    >
                      <option value="">Selecciona tipo de documento</option>
                      {DOCUMENT_TYPE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </EditField>
                  <EditField label="Documento" value={form.customer.id} onChange={(value) => setPartyField('customer', 'id', value)} />
                  <EditField label="Correo" type="email" value={form.customer.email} onChange={(value) => setPartyField('customer', 'email', value)} />
                  <EditField label="Celular" type="tel" value={form.customer.phone} onChange={(value) => setPartyField('customer', 'phone', value)} />
                  <EditField label="Dirección" value={form.customer.address} onChange={(value) => setPartyField('customer', 'address', value)} />
                  <EditField label="Departamento del comprador">
                    <select
                      aria-label="Departamento del comprador"
                      value={form.customer.departmentCode}
                      onChange={(event) => setDepartment('customer', event.target.value)}
                      disabled={regionsLoading}
                      style={fieldStyle}
                    >
                      <option value="">{regionsLoading ? 'Cargando departamentos…' : 'Selecciona departamento'}</option>
                      {regions.map((region) => (
                        <option key={region.code} value={region.code}>{region.name}</option>
                      ))}
                    </select>
                  </EditField>
                  <EditField label="Municipio del comprador">
                    <select
                      aria-label="Municipio del comprador"
                      value={form.customer.municipalityCode}
                      onChange={(event) => setMunicipality('customer', event.target.value)}
                      disabled={!form.customer.departmentCode || customerCitiesLoading}
                      style={fieldStyle}
                    >
                      <option value="">{customerCitiesLoading ? 'Cargando municipios…' : 'Selecciona municipio'}</option>
                      {customerCities.map((city) => (
                        <option key={city.code} value={city.code}>{city.name}</option>
                      ))}
                    </select>
                  </EditField>
                </div>
              </div>

              <div style={{ display: 'grid', gap: 12 }}>
                <strong style={{ fontSize: 12 }}>Datos de facturación</strong>
                <div className="order-customer-edit-fields">
                  <EditField label="Tipo persona">
                    <select
                      aria-label="Tipo de persona"
                      value={form.billing.personType}
                      onChange={(event) => setBillingPersonType(event.target.value)}
                      style={fieldStyle}
                    >
                      <option value="">Selecciona tipo de persona</option>
                      {PERSON_TYPE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </EditField>
                  <EditField label="Razón social" value={form.billing.businessName} onChange={(value) => setPartyField('billing', 'businessName', value)} />
                  <EditField label="Tipo documento">
                    <select
                      aria-label="Tipo documento fiscal"
                      value={form.billing.documentType}
                      onChange={(event) => setPartyField('billing', 'documentType', event.target.value)}
                      style={fieldStyle}
                    >
                      <option value="">Selecciona tipo de documento</option>
                      {DOCUMENT_TYPE_OPTIONS
                        .filter((option) => form.billing.personType !== 'juridica' || option.value === 'NIT')
                        .map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                    </select>
                  </EditField>
                  <EditField label="Documento fiscal" value={form.billing.documentNumber} onChange={(value) => setPartyField('billing', 'documentNumber', value)} />
                  <EditField label="Correo fiscal" type="email" value={form.billing.email} onChange={(value) => setPartyField('billing', 'email', value)} />
                  <EditField label="Teléfono fiscal" type="tel" value={form.billing.phone} onChange={(value) => setPartyField('billing', 'phone', value)} />
                  <EditField label="Dirección fiscal" value={form.billing.address} onChange={(value) => setPartyField('billing', 'address', value)} />
                  <EditField label="Departamento fiscal">
                    <select
                      aria-label="Departamento fiscal"
                      value={form.billing.departmentCode}
                      onChange={(event) => setDepartment('billing', event.target.value)}
                      disabled={regionsLoading}
                      style={fieldStyle}
                    >
                      <option value="">{regionsLoading ? 'Cargando departamentos…' : 'Selecciona departamento'}</option>
                      {regions.map((region) => (
                        <option key={region.code} value={region.code}>{region.name}</option>
                      ))}
                    </select>
                  </EditField>
                  <EditField label="Municipio fiscal">
                    <select
                      aria-label="Municipio fiscal"
                      value={form.billing.municipalityCode}
                      onChange={(event) => setMunicipality('billing', event.target.value)}
                      disabled={!form.billing.departmentCode || billingCitiesLoading}
                      style={fieldStyle}
                    >
                      <option value="">{billingCitiesLoading ? 'Cargando municipios…' : 'Selecciona municipio'}</option>
                      {billingCities.map((city) => (
                        <option key={city.code} value={city.code}>{city.name}</option>
                      ))}
                    </select>
                  </EditField>
                </div>
              </div>
            </div>

            {formError ? (
              <div style={{ color: '#be123c', fontSize: 11, fontWeight: 800 }}>
                {formError}
              </div>
            ) : null}

            {geoError ? (
              <div style={{ color: '#be123c', fontSize: 11, fontWeight: 800 }}>
                {geoError}
              </div>
            ) : null}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 9 }}>
              <button
                type="button"
                onClick={() => setEditing(false)}
                disabled={saving}
                style={{ ...fieldStyle, width: 'auto', cursor: 'pointer' }}
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                style={{
                  ...fieldStyle,
                  width: 'auto',
                  borderColor: ORDER_DETAIL_THEME.primary,
                  background: ORDER_DETAIL_THEME.primary,
                  color: '#fff',
                  cursor: saving ? 'wait' : 'pointer',
                }}
              >
                {saving ? 'Guardando…' : 'Guardar corrección'}
              </button>
            </div>
          </form>
        </OrderDetailPanel>
      ) : null}

      <OrderDetailPanel
        style={{
          padding: 18,
        }}
      >
        <SectionTitle
          icon={OrderDetailIcons.ReceiptText}
          title="Facturación"
          subtitle="Datos usados para documento fiscal"
          action={<SoftBadge variant="neutral">Validación</SoftBadge>}
        />

        <div
          style={{
            display: 'grid',
            gap: 11,
          }}
        >
          <InfoLine
            label={billingPersonType === 'juridica' ? 'Razón social:' : 'Nombre:'}
            value={billingName}
            strong
          />
          <InfoLine label="Tipo de persona:" value={billingPersonLabel} />
          <InfoLine
            label="Documento:"
            value={cleanText(`${billingDocumentType !== '—' ? `${billingDocumentType} ` : ''}${billingDocumentWithDv}`)}
          />
          <InfoLine label="Correo fiscal:" value={cleanText(billingEmail)} />
          <InfoLine label="Dirección:" value={cleanText(billingAddress)} />
          <InfoLine label="Ciudad:" value={cleanText(billingCity)} />
          <InfoLine
            label="Departamento:"
            value={cleanText(billingDepartment)}
          />
          <InfoLine
            label="País:"
            value={cleanText(billingCountry)}
          />
        </div>
      </OrderDetailPanel>

      <style>
        {`
          @media (max-width: 900px) {
            div[style*="grid-template-columns: minmax(0, 1fr) minmax(0, 1fr)"] {
              grid-template-columns: 1fr !important;
            }
          }

          .order-customer-edit-grid {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 18px;
          }

          .order-customer-edit-fields {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 10px;
          }

          @media (max-width: 720px) {
            .order-customer-edit-grid,
            .order-customer-edit-fields {
              grid-template-columns: 1fr;
            }
          }
        `}
      </style>
    </div>
  );
}
