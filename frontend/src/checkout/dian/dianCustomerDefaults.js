// Valores iniciales para datos DIAN del cliente
// Este objeto será la base para el estado del checkout

export const dianCustomerDefaults = {
  personType: '', // natural | juridica | consumidor_final

  documentType: '', // CC | NIT | CE | TI | PPT
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

  country: 'CO', // Colombia por defecto
};