export function validateDianCustomer(customer = {}) {
  const errors = [];

  const isBlank = (value) => !value || String(value).trim() === '';

  if (isBlank(customer.personType)) {
    errors.push('Selecciona el tipo de persona para facturación.');
  }

  if (isBlank(customer.documentType)) {
    errors.push('Selecciona el tipo de documento para facturación.');
  }

  if (isBlank(customer.documentNumber)) {
    errors.push('El número de documento para facturación es obligatorio.');
  }

  if (customer.documentType === 'NIT' && isBlank(customer.dv)) {
    errors.push('El DV es obligatorio cuando el documento es NIT.');
  }

  if (customer.personType === 'juridica') {
    if (isBlank(customer.businessName)) {
      errors.push('La razón social es obligatoria para persona jurídica.');
    }
  } else if (customer.personType !== 'consumidor_final') {
    if (isBlank(customer.firstName)) {
      errors.push('El nombre para facturación es obligatorio.');
    }

    if (isBlank(customer.lastName)) {
      errors.push('El apellido para facturación es obligatorio.');
    }
  }

  if (customer.personType !== 'consumidor_final') {
    if (isBlank(customer.email)) {
      errors.push('El correo electrónico para facturación es obligatorio.');
    }
  }

  if (isBlank(customer.country)) {
    errors.push('El país para facturación es obligatorio.');
  }

  if (customer.country === 'CO') {
    if (isBlank(customer.department)) {
      errors.push('El departamento para facturación es obligatorio.');
    }

    if (isBlank(customer.city)) {
      errors.push('La ciudad para facturación es obligatoria.');
    }
  }

  return errors;
}