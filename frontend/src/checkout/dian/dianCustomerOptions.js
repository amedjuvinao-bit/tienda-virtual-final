// Tipos de documento válidos para Colombia (DIAN)

export const DOCUMENT_TYPES = [
  { value: 'CC', label: 'Cédula de ciudadanía' },
  { value: 'NIT', label: 'NIT (empresa)' },
  { value: 'CE', label: 'Cédula de extranjería' },
  { value: 'TI', label: 'Tarjeta de identidad' },
  { value: 'PPT', label: 'Permiso por protección temporal' },
  { value: 'CF', label: 'Consumidor final' },
];

// Tipos de persona (DIAN)

export const PERSON_TYPES = [
  { value: 'natural', label: 'Persona natural' },
  { value: 'juridica', label: 'Persona jurídica' },
  { value: 'consumidor_final', label: 'Consumidor final' },
];