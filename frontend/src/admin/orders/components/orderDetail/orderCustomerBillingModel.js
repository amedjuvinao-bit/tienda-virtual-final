import {
  cleanText,
  getBillingName,
  getCustomerName,
} from './orderDetailUtils';

export const PERSON_TYPE_OPTIONS = [
  { value: 'natural', label: 'Persona natural' },
  { value: 'juridica', label: 'Persona jurídica' },
];

export const DOCUMENT_TYPE_OPTIONS = [
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

export function firstValidText(...values) {
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

export function findUniqueByName(items = [], value = '') {
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
  return emailOrPhone.includes('@') ? emailOrPhone : '—';
}

export function getEditableCustomerBillingForm(order = {}) {
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
      isFinalConsumer:
        typeof billing.isFinalConsumer === 'boolean'
          ? billing.isFinalConsumer
          : customer.isFinalConsumer === true ||
            order?.pos?.customerMode === 'guest' ||
            (String(order?.source || '').toLowerCase() === 'pos' &&
              order?.pos?.quickSale === true),
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

export function isDemoOrder(order = {}) {
  const tags = (Array.isArray(order.tags) ? order.tags : []).map((tag) =>
    String(tag || '').trim().toLowerCase()
  );
  const email = String(
    order?.customer?.email || order?.billing?.email || ''
  ).toLowerCase();

  return (
    tags.includes('demo') ||
    tags.includes('orders-trace') ||
    (String(order.source || '').toLowerCase() === 'system' &&
      email.endsWith('@example.com'))
  );
}

export function validateCustomerBillingForm(form) {
  const phoneDigits = String(form.customer.phone || '').replace(/\D/g, '');
  if (form.customer.phone && phoneDigits.length < 10) {
    return 'El celular debe tener al menos 10 dígitos.';
  }

  const colombianBilling = ['CO', 'COLOMBIA', ''].includes(
    String(form.billing.countryCode || form.billing.country || '')
      .trim()
      .toUpperCase()
  );
  if (colombianBilling && !form.billing.municipalityCode) {
    return 'Selecciona el departamento y municipio de facturación.';
  }

  return '';
}

export function getCustomerBillingViewModel(order = {}) {
  const customer = order.customer || {};
  const billing = order.billing || {};

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
    order.customerDocument,
    order.customerId
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
    order.customerAddress
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
    order.customerCity
  );
  const billingCity = firstValidText(
    billing.city,
    billing.municipality,
    billing.town,
    billing.billingCity,
    customerCity
  );
  const customerEmail = getEmailFromCustomer(customer, order);
  const billingEmail = firstValidText(billing.email, customerEmail);
  const customerPhone = firstValidText(
    customer.phone,
    customer.customerPhone,
    customer.phoneNumber,
    customer.mobile,
    customer.cellphone,
    customer.emailOrPhone && !String(customer.emailOrPhone).includes('@')
      ? customer.emailOrPhone
      : '',
    order.customerPhone
  );

  return {
    customer: {
      name: getCustomerName(order),
      document: cleanText(customerDocument),
      email: cleanText(customerEmail),
      phone: cleanText(customerPhone),
      address: cleanText(customerAddress),
      city: cleanText(customerCity),
    },
    billing: {
      name: getBillingName(order),
      personType: billingPersonType,
      personLabel: billingPersonLabel,
      document: cleanText(
        `${billingDocumentType !== '—' ? `${billingDocumentType} ` : ''}${billingDocumentWithDv}`
      ),
      email: cleanText(billingEmail),
      address: cleanText(billingAddress),
      city: cleanText(billingCity),
      department: cleanText(
        firstValidText(
          billing.department,
          billing.state,
          billing.region,
          customer.department,
          customer.state,
          customer.region
        )
      ),
      country: cleanText(
        firstValidText(billing.country, customer.country, 'Colombia')
      ),
    },
  };
}
