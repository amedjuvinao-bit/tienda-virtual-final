// Valores iniciales para datos DIAN del cliente
// Este objeto será la base para el estado del checkout

export const dianCustomerDefaults = {
  personType: 'natural', // natural | juridica

  documentType: 'CC', // CC | NIT | CE | TI | PP | PPT | RC
  documentNumber: '',
  dv: '', // solo aplica si es NIT

  firstName: '',
  lastName: '',
  businessName: '', // solo si es empresa

  email: '',
  phone: '',

  address: '',
  city: '',
  cityCode: '',

  department: '',
  departmentCode: '',

  country: 'CO', // código ISO del país
  countryName: 'Colombia',
  postalCode: '',
  tributeCode: 'ZZ',
};
