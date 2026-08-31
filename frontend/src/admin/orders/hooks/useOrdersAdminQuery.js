import { useEffect, useMemo, useRef, useState } from 'react';

import api from '../../../lib/api';

const inflightOrderQueries = new Map();

function stableParamsKey(params = {}) {
  return JSON.stringify(
    Object.entries(params)
      .filter(([, value]) => value !== undefined && value !== null && value !== '')
      .sort(([left], [right]) => left.localeCompare(right))
  );
}

function summaryParamsKey(params = {}) {
  const summaryParams = { ...params };
  delete summaryParams.page;
  delete summaryParams.cursor;
  delete summaryParams.pagination;
  delete summaryParams.limit;
  delete summaryParams.sort;
  delete summaryParams.populate;
  delete summaryParams.includeSummary;
  return stableParamsKey(summaryParams);
}

function isCanonicalCursorSort(value) {
  const normalized = String(value || 'createdAt:-1')
    .replace(/\s+/g, '')
    .toLowerCase();
  return normalized === 'createdat:-1' || normalized === 'createdat:-1,_id:-1';
}

function cursorContextKey(params = {}) {
  const context = { ...params };
  delete context.page;
  delete context.cursor;
  return stableParamsKey(context);
}

function initialCursorNavigation(key = '') {
  return {
    contextKey: key,
    cursor: '',
    cursorStack: [],
    page: 1,
  };
}

export function buildOrdersAdminRequestParams(params = {}, cursor = '') {
  const wantsCursor = String(params.pagination || '').toLowerCase() === 'cursor';
  const cursorMode = wantsCursor && isCanonicalCursorSort(params.sort);

  if (!cursorMode) {
    const pageParams = { ...params };
    delete pageParams.cursor;
    delete pageParams.pagination;
    return { cursorMode: false, params: pageParams };
  }

  const cursorParams = {
    ...params,
    pagination: 'cursor',
    sort: 'createdAt:-1',
  };
  delete cursorParams.page;
  delete cursorParams.cursor;
  if (cursor) cursorParams.cursor = cursor;

  return { cursorMode: true, params: cursorParams };
}

function acquireOrdersRequest(params) {
  const key = stableParamsKey(params);
  let entry = inflightOrderQueries.get(key);

  if (!entry) {
    const controller = new AbortController();
    entry = {
      abortTimer: null,
      controller,
      subscribers: 0,
      promise: null,
    };
    entry.promise = api
      .get('/api/orders/admin', { params, signal: controller.signal })
      .finally(() => {
        if (inflightOrderQueries.get(key) === entry) {
          inflightOrderQueries.delete(key);
        }
      });
    inflightOrderQueries.set(key, entry);
  }

  if (entry.abortTimer) {
    clearTimeout(entry.abortTimer);
    entry.abortTimer = null;
  }
  entry.subscribers += 1;

  let released = false;
  return {
    promise: entry.promise,
    release() {
      if (released) return;
      released = true;
      entry.subscribers = Math.max(0, entry.subscribers - 1);

      if (entry.subscribers === 0 && !entry.controller.signal.aborted) {
        // StrictMode desmonta y monta el mismo efecto inmediatamente. Esperar un
        // turno permite reutilizar esa lectura y cancela solo filtros obsoletos.
        entry.abortTimer = setTimeout(() => {
          entry.abortTimer = null;
          if (
            entry.subscribers === 0 &&
            inflightOrderQueries.get(key) === entry &&
            !entry.controller.signal.aborted
          ) {
            entry.controller.abort();
            inflightOrderQueries.delete(key);
          }
        }, 0);
      }
    },
  };
}

export function clearOrdersAdminQueryInflight() {
  inflightOrderQueries.forEach((entry) => {
    if (entry.abortTimer) clearTimeout(entry.abortTimer);
    if (!entry.controller.signal.aborted) entry.controller.abort();
  });
  inflightOrderQueries.clear();
}

export default function useOrdersAdminQuery({
  authLoading,
  hasSession,
  canView,
  params,
}) {
  const [data, setData] = useState([]);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [financialSummary, setFinancialSummary] = useState(null);
  const [operationalSummary, setOperationalSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const requestSequence = useRef(0);
  const completedSummaryKey = useRef('');
  const knownTotal = useRef(0);
  const contextKey = cursorContextKey(params);
  const [cursorNavigation, setCursorNavigation] = useState(() =>
    initialCursorNavigation(contextKey)
  );
  const activeCursorNavigation = cursorNavigation.contextKey === contextKey
    ? cursorNavigation
    : initialCursorNavigation(contextKey);
  const requestConfiguration = useMemo(
    () => buildOrdersAdminRequestParams(params, activeCursorNavigation.cursor),
    [params, activeCursorNavigation.cursor]
  );
  const [cursorPage, setCursorPage] = useState({
    contextKey: '',
    cursor: '',
    hasMore: false,
    nextCursor: '',
  });

  useEffect(() => {
    setCursorNavigation((current) => (
      current.contextKey === contextKey
        ? current
        : initialCursorNavigation(contextKey)
    ));
    setCursorPage((current) => (
      current.contextKey === contextKey
        ? current
        : {
            contextKey,
            cursor: '',
            hasMore: false,
            nextCursor: '',
          }
    ));
  }, [contextKey]);

  useEffect(() => {
    const sequence = ++requestSequence.current;

    if (authLoading) return undefined;

    if (!hasSession || !canView) {
      knownTotal.current = 0;
      completedSummaryKey.current = '';
      setData([]);
      setTotal(0);
      setTotalPages(1);
      setFinancialSummary(null);
      setOperationalSummary(null);
      setLoading(false);
      setErr(
        hasSession
          ? 'No tienes permiso para consultar órdenes.'
          : 'Tu sesión administrativa no es válida. Inicia sesión nuevamente.'
      );
      return undefined;
    }

    const requestParams = requestConfiguration.params;
    const currentSummaryKey = summaryParamsKey(requestParams);
    const includeSummary = completedSummaryKey.current !== currentSummaryKey;

    setLoading(true);
    setErr('');

    const request = acquireOrdersRequest({
      ...requestParams,
      includeSummary: includeSummary ? 1 : 0,
    });

    request.promise
      .then((response) => {
        if (requestSequence.current !== sequence) return;

        const payload = response?.data || {};
        setData(Array.isArray(payload.data) ? payload.data : []);

        if (requestConfiguration.cursorMode) {
          const nextCursor = typeof payload.nextCursor === 'string'
            ? payload.nextCursor.trim()
            : '';
          setCursorPage({
            contextKey,
            cursor: activeCursorNavigation.cursor,
            hasMore: Boolean(payload.hasMore && nextCursor),
            nextCursor,
          });
        }

        if (payload.summaryIncluded !== false) {
          completedSummaryKey.current = currentSummaryKey;
          knownTotal.current = Number(payload.total || 0);
          setTotal(knownTotal.current);
          setTotalPages(Number(payload.totalPages || 1));
          setFinancialSummary(payload.financialSummary || null);
          setOperationalSummary(payload.operationalSummary || null);
        } else {
          const pageSize = Math.max(1, Number(requestParams?.limit || 20));
          setTotalPages(Math.max(1, Math.ceil(knownTotal.current / pageSize)));
        }
      })
      .catch((error) => {
        if (requestSequence.current !== sequence) return;
        setErr(
          error?.response?.status === 401
            ? 'No autorizado. Inicia una sesion administrativa valida.'
            : 'No se pudieron cargar las órdenes.'
        );
      })
      .finally(() => {
        if (requestSequence.current === sequence) setLoading(false);
      });

    return request.release;
  }, [
    authLoading,
    hasSession,
    canView,
    requestConfiguration,
    contextKey,
    activeCursorNavigation.cursor,
  ]);

  const currentCursorPage = cursorPage.contextKey === contextKey &&
    cursorPage.cursor === activeCursorNavigation.cursor
    ? cursorPage
    : null;
  const cursorMode = requestConfiguration.cursorMode;
  const page = cursorMode
    ? activeCursorNavigation.page
    : Math.max(1, Number(params?.page || 1));
  const canGoPrevious = cursorMode
    ? activeCursorNavigation.cursorStack.length > 0
    : page > 1;
  const canGoNext = cursorMode
    ? Boolean(currentCursorPage?.hasMore && currentCursorPage.nextCursor)
    : page < totalPages;

  const goToPreviousCursorPage = () => {
    if (!cursorMode) return;
    const expectedCursor = activeCursorNavigation.cursor;
    setCursorNavigation((current) => {
      const navigation = current.contextKey === contextKey
        ? current
        : initialCursorNavigation(contextKey);
      if (
        navigation.cursor !== expectedCursor ||
        !navigation.cursorStack.length
      ) {
        return navigation;
      }
      const cursorStack = navigation.cursorStack.slice(0, -1);
      return {
        contextKey,
        cursor: navigation.cursorStack[navigation.cursorStack.length - 1] || '',
        cursorStack,
        page: Math.max(1, navigation.page - 1),
      };
    });
  };

  const goToNextCursorPage = () => {
    if (!cursorMode || !currentCursorPage?.hasMore || !currentCursorPage.nextCursor) {
      return;
    }
    setCursorNavigation((current) => {
      const navigation = current.contextKey === contextKey
        ? current
        : initialCursorNavigation(contextKey);
      if (navigation.cursor !== currentCursorPage.cursor) return navigation;
      return {
        contextKey,
        cursor: currentCursorPage.nextCursor,
        cursorStack: [...navigation.cursorStack, navigation.cursor],
        page: navigation.page + 1,
      };
    });
  };

  return {
    canGoNext,
    canGoPrevious,
    cursorMode,
    data,
    setData,
    totalPages,
    total,
    financialSummary,
    operationalSummary,
    loading,
    err,
    goToNextCursorPage,
    goToPreviousCursorPage,
    hasMore: cursorMode ? Boolean(currentCursorPage?.hasMore) : page < totalPages,
    page,
    setErr,
  };
}
