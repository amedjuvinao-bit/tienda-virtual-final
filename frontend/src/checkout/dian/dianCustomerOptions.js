// Tipos de documento válidos para Colombia (DIAN)

export const DOCUMENT_TYPES = [
  { value: 'CC', label: 'Cédula de ciudadanía' },
  { value: 'NIT', label: 'NIT' },
  { value: 'CE', label: 'Cédula de extranjería' },
  { value: 'TI', label: 'Tarjeta de identidad' },
  { value: 'PP', label: 'Pasaporte' },
  { value: 'PPT', label: 'Permiso por protección temporal' },
  { value: 'RC', label: 'Registro civil' },
];

// Tipos de persona (DIAN)

export const PERSON_TYPES = [
  { value: 'natural', label: 'Persona natural' },
  { value: 'juridica', label: 'Persona jurídica' },
];
