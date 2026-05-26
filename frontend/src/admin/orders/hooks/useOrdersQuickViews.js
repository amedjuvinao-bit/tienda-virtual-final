// src/admin/orders/hooks/useOrdersQuickViews.js

import { useState } from 'react';

function formatLocalDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function getTodayDate() {
  return formatLocalDate(new Date());
}

function getLastSevenDaysRange() {
  const today = new Date();
  const sevenDaysAgo = new Date();

  sevenDaysAgo.setDate(today.getDate() - 6);

  return {
    from: formatLocalDate(sevenDaysAgo),
    to: formatLocalDate(today),
  };
}

export default function useOrdersQuickViews({
  setPage,
  setDateFrom,
  setDateTo,
  setStatusFilter,
  clearStatus,
}) {
  const [quickView, setQuickView] = useState('all');

  // Filtros operativos preparados para conectar luego con la consulta principal.
  const [printedFilter, setPrintedFilter] = useState('all');
  const [archivedFilter, setArchivedFilter] = useState('active');

  const goFirstPage = () => {
    if (typeof setPage === 'function') {
      setPage(1);
    }
  };

  const clearDateFilters = () => {
    setDateFrom('');
    setDateTo('');
  };

  const clearStatusFilters = () => {
    if (typeof clearStatus === 'function') {
      clearStatus();
      return;
    }

    if (typeof setStatusFilter === 'function') {
      setStatusFilter([]);
    }
  };

  const resetOperationalFilters = () => {
    setPrintedFilter('all');
    setArchivedFilter('active');
  };

  const resetBaseFilters = () => {
    clearDateFilters();
    clearStatusFilters();
    resetOperationalFilters();
  };

  const applyQuickView = (viewKey) => {
    setQuickView(viewKey);
    goFirstPage();

    if (viewKey === 'all') {
      resetBaseFilters();
      return;
    }

    if (viewKey === 'today') {
      const today = getTodayDate();

      setDateFrom(today);
      setDateTo(today);
      clearStatusFilters();
      resetOperationalFilters();
      return;
    }

    if (viewKey === 'last7') {
      const range = getLastSevenDaysRange();

      setDateFrom(range.from);
      setDateTo(range.to);
      clearStatusFilters();
      resetOperationalFilters();
      return;
    }

    if (viewKey === 'paid') {
      clearDateFilters();
      setStatusFilter(['paid']);
      resetOperationalFilters();
      return;
    }

    if (viewKey === 'pending') {
      clearDateFilters();
      setStatusFilter(['pending']);
      resetOperationalFilters();
      return;
    }

    if (viewKey === 'notPrinted') {
      clearDateFilters();
      clearStatusFilters();
      setPrintedFilter('not_printed');
      setArchivedFilter('active');
      return;
    }

    if (viewKey === 'archived') {
      clearDateFilters();
      clearStatusFilters();
      setPrintedFilter('all');
      setArchivedFilter('archived');
      return;
    }

    resetBaseFilters();
  };

  const clearQuickView = () => {
    applyQuickView('all');
  };

  return {
    quickView,
    setQuickView,
    applyQuickView,
    clearQuickView,

    printedFilter,
    setPrintedFilter,

    archivedFilter,
    setArchivedFilter,
  };
}