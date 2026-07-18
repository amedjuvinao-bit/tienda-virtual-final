// frontend/src/admin/customers/customerEditHelpers.js

export function customerToEditForm(customer = {}) {
  return {
    fullName: customer.fullName || customer.displayName || '',
    phone: customer.phone || '',
    documentType: customer.documentType || 'CC',
    documentNumber: customer.documentNumber || '',
    email: customer.email || '',
    address: customer.address || '',
    city: customer.city || '',
    department: customer.department || '',
    notes: customer.notes || '',
  };
}

export function isValidCustomerEditForm(form = {}) {
  return String(form.fullName || '').trim().replace(/\s+/g, ' ').length >= 3;
}
