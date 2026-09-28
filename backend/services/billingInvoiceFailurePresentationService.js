'use strict';

// Los códigos internos del proceso postpago se convierten en instrucciones
// comprensibles. Nunca se expone el mensaje del proveedor ni el estado privado.
const FAILURE_MESSAGES = Object.freeze({
  BILLING_MUNICIPALITY_REQUIRED: 'Falta el municipio fiscal. Selecciona departamento y municipio en Cliente e historial; después revisa la factura en Facturación.',
  BILLING_MUNICIPALITY_CODE_INVALID: 'El municipio fiscal guardado no es válido. Selecciónalo nuevamente en Cliente e historial.',
  BILLING_MUNICIPALITY_AMBIGUOUS: 'Selecciona el departamento y municipio fiscal exactos en Cliente e historial.',
  BILLING_MUNICIPALITY_NOT_FOUND: 'No se reconoció el municipio fiscal. Selecciónalo nuevamente en Cliente e historial.',
  BILLING_CUSTOMER_LAST_NAME_REQUIRED: 'Falta el apellido fiscal del comprador. Corrígelo en Cliente e historial.',
  BILLING_CUSTOMER_IDENTITY_REQUIRED: 'Faltan datos de identificación del comprador. Corrígelos en Cliente e historial.',
  BILLING_FISCAL_INFO_INCOMPLETE: 'La configuración fiscal de la tienda está incompleta. Revísala en Configuración → Facturación.',
  FACTUS_CREDENTIALS_INCOMPLETE: 'Falta configurar el acceso a Factus. Revísalo en Configuración → Facturación.',
});

function presentInvoiceFailureCode(code) {
  return FAILURE_MESSAGES[String(code || '').toUpperCase()] ||
    'No se pudo emitir la factura. Revisa los datos y el motivo en Facturación → Órdenes por facturar.';
}

module.exports = { presentInvoiceFailureCode };
