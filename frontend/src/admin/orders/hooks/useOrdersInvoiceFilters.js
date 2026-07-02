// frontend/src/admin/orders/hooks/useOrdersInvoiceFilters.js

import { useState } from 'react';

export default function useOrdersInvoiceFilters({ setPage }) {
  const [invoiceFilter, setInvoiceFilter] = useState('all');

  const applyInvoiceFilter = (filterKey) => {
    setInvoiceFilter(filterKey || 'all');

    if (typeof setPage === 'function') {
      setPage(1);
    }
  };

  const clearInvoiceFilter = () => {
    setInvoiceFilter('all');

    if (typeof setPage === 'function') {
      setPage(1);
    }
  };

  return {
    invoiceFilter,
    setInvoiceFilter,
    applyInvoiceFilter,
    clearInvoiceFilter,
  };
}