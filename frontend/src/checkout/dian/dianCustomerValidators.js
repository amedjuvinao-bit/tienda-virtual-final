export function validateDianCustomer(customer = {}) {
  const errors = [];

  const isBlank = (value) => !value || String(value).trim() === '';
  const personType = String(customer.personType || '').trim().toLowerCase();
  const documentType = String(customer.documentType || '').trim().toUpperCase();
  const countryCode = String(customer.country || customer.countryCode || '').trim().toUpperCase();
  const email = String(customer.email || '').trim();
  const validPersonTypes = new Set(['natural', 'juridica']);
  const validDocumentTypes = new Set(['CC', 'NIT', 'CE', 'TI', 'PP', 'PPT', 'RC']);

  if (!validPersonTypes.has(personType)) {
    errors.push('Selecciona el tipo de persona para facturación.');
  }

  if (!validDocumentTypes.has(documentType)) {
    errors.push('Selecciona el tipo de documento para facturación.');
  }

  if (isBlank(customer.documentNumber)) {
    errors.push('El número de documento para facturación es obligatorio.');
  }

  if (documentType === 'NIT') {
    if (isBlank(customer.dv)) {
      errors.push('El DV es obligatorio cuando el documento es NIT.');
    } else if (!/^\d$/.test(String(customer.dv).trim())) {
      errors.push('El DV del NIT debe contener un solo dígito.');
    }
  }

  if (personType === 'juridica') {
    if (isBlank(customer.businessName)) {
      errors.push('La razón social es obligatoria para persona jurídica.');
    }
  } else if (personType === 'natural') {
    if (isBlank(customer.firstName)) {
      errors.push('El nombre para facturación es obligatorio.');
    }

    if (isBlank(customer.lastName)) {
      errors.push('El apellido para facturación es obligatorio.');
    }
  }

  if (isBlank(email)) {
    errors.push('El correo electrónico para facturación es obligatorio.');
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.push('El correo electrónico para facturación no es válido.');
  }

  if (isBlank(countryCode)) {
    errors.push('El país para facturación es obligatorio.');
  }

  if (isBlank(customer.address)) {
    errors.push('La dirección para facturación es obligatoria.');
  }

  if (countryCode === 'CO') {
    if (isBlank(customer.department)) {
      errors.push('El departamento para facturación es obligatorio.');
    }

    if (isBlank(customer.city)) {
      errors.push('La ciudad para facturación es obligatoria.');
    }

    if (isBlank(customer.cityCode || customer.municipalityCode)) {
      errors.push('Selecciona una ciudad válida para la facturación electrónica.');
    }
  }

  return errors;
}
