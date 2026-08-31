import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import api from '../../../lib/api';
import {
  parseDashboardStatusParam,
  parseOrdersSort,
  parseTagsInput,
} from '../ordersAdminModel';
import useOrdersInvoiceFilters from './useOrdersInvoiceFilters';
import useOrdersQuickViews from './useOrdersQuickViews';

export default function useOrdersAdminFilters({
  authLoading,
  canView,
  canViewBranches,
  hasSession,
}) {
  const [searchParams] = useSearchParams();
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [query, setQuery] = useState('');
  const [typingQuery, setTypingQuery] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [populate, setPopulate] = useState(true);
  const [branches, setBranches] = useState([]);
  const [branchId, setBranchId] = useState('');
  const [sort, setSort] = useState('createdAt:-1');
  const [statusFilter, setStatusFilter] = useState(() =>
    parseDashboardStatusParam(searchParams.get('status'))
  );
  const [tagsInput, setTagsInput] = useState('');
  const [tagsMode, setTagsMode] = useState('any');
  const parsedTags = useMemo(() => parseTagsInput(tagsInput), [tagsInput]);

  const toggleSort = (field) => {
    setSort((previous) => {
      const current = parseOrdersSort(previous);
      if (current.field === field) {
        return `${field}:${current.dir === 1 ? -1 : 1}`;
      }
      const defaultDir = (
        field === 'createdAt' || field === 'orderNumber' || field === 'total'
      ) ? -1 : -1;
      return `${field}:${defaultDir}`;
    });
    setPage(1);
  };

  const sortState = useMemo(() => parseOrdersSort(sort), [sort]);
  const sortIcon = (field) => {
    if (sortState.field !== field) return '↕';
    return sortState.dir === 1 ? '▲' : '▼';
  };
  const sortAria = (field) =>
    sortState.field === field
      ? (sortState.dir === 1 ? 'ascending' : 'descending')
      : 'none';

  useEffect(() => {
    const timer = setTimeout(() => setQuery(typingQuery.trim()), 300);
    return () => clearTimeout(timer);
  }, [typingQuery]);

  const toggleStatus = (status) => {
    setStatusFilter((previous) =>
      previous.includes(status)
        ? previous.filter((item) => item !== status)
        : [...previous, status]
    );
    setPage(1);
  };

  const clearStatus = () => {
    setStatusFilter([]);
    setPage(1);
  };

  useEffect(() => {
    const statusFromDashboard = parseDashboardStatusParam(searchParams.get('status'));
    if (!statusFromDashboard.length) return;

    setStatusFilter((previous) => {
      const sameLength = previous.length === statusFromDashboard.length;
      const sameValues = sameLength && statusFromDashboard.every(
        (status) => previous.includes(status)
      );
      return sameValues ? previous : statusFromDashboard;
    });
    setPage(1);
  }, [searchParams]);

  const quickViews = useOrdersQuickViews({
    setPage,
    setDateFrom,
    setDateTo,
    setStatusFilter,
    clearStatus,
  });
  const invoiceFilters = useOrdersInvoiceFilters({ setPage });

  useEffect(() => {
    let cancel = false;

    if (authLoading || !hasSession || !canView || !canViewBranches) {
      setBranches([]);
      return () => {
        cancel = true;
      };
    }

    api
      .get('/api/admin/branches', {
        params: { limit: 100, status: 'active' },
      })
      .then((response) => {
        if (cancel) return;
        const payload = response?.data || {};
        const list = Array.isArray(payload.data)
          ? payload.data
          : Array.isArray(payload.branches)
            ? payload.branches
            : Array.isArray(payload.items)
              ? payload.items
              : Array.isArray(payload)
                ? payload
                : [];
        setBranches(list);
      })
      .catch(() => {
        if (!cancel) setBranches([]);
      });

    return () => {
      cancel = true;
    };
  }, [authLoading, hasSession, canView, canViewBranches]);

  const params = useMemo(
    () => ({
      page,
      pagination: 'cursor',
      limit,
      q: query,
      populate: populate ? 1 : 0,
      sort,
      ...(dateFrom ? { dateFrom } : {}),
      ...(dateTo ? { dateTo } : {}),
      ...(statusFilter.length ? { status: statusFilter.join(',') } : {}),
      ...(parsedTags.length ? { tags: parsedTags.join(','), tagsMode } : {}),
      ...(branchId ? { branchId } : {}),
      ...(quickViews.printedFilter === 'not_printed' ? { printed: 0 } : {}),
      ...(quickViews.printedFilter === 'printed' ? { printed: 1 } : {}),
      ...(quickViews.archivedFilter === 'active' ? { archived: 0 } : {}),
      ...(quickViews.archivedFilter === 'archived' ? { archived: 1 } : {}),
      ...(invoiceFilters.invoiceFilter && invoiceFilters.invoiceFilter !== 'all'
        ? { invoiceFilter: invoiceFilters.invoiceFilter }
        : {}),
      ...(quickViews.operationalView && quickViews.operationalView !== 'all'
        ? { operationalView: quickViews.operationalView }
        : {}),
    }),
    [
      page,
      limit,
      query,
      populate,
      sort,
      dateFrom,
      dateTo,
      statusFilter,
      parsedTags,
      tagsMode,
      branchId,
      quickViews.printedFilter,
      quickViews.archivedFilter,
      invoiceFilters.invoiceFilter,
      quickViews.operationalView,
    ]
  );

  return {
    branchId,
    branches,
    clearStatus,
    dateFrom,
    dateTo,
    invoiceFilters,
    limit,
    page,
    params,
    populate,
    quickViews,
    setBranchId,
    setDateFrom,
    setDateTo,
    setLimit,
    setPage,
    setPopulate,
    setStatusFilter,
    setTagsInput,
    setTagsMode,
    setTypingQuery,
    sortAria,
    sortIcon,
    statusFilter,
    tagsInput,
    tagsMode,
    toggleSort,
    toggleStatus,
    typingQuery,
  };
}
