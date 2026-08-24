import { useEffect, useRef, useState } from 'react';

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
  delete summaryParams.limit;
  delete summaryParams.sort;
  delete summaryParams.populate;
  delete summaryParams.includeSummary;
  return stableParamsKey(summaryParams);
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

    const currentSummaryKey = summaryParamsKey(params);
    const includeSummary = completedSummaryKey.current !== currentSummaryKey;

    setLoading(true);
    setErr('');

    const request = acquireOrdersRequest({
      ...params,
      includeSummary: includeSummary ? 1 : 0,
    });

    request.promise
      .then((response) => {
        if (requestSequence.current !== sequence) return;

        const payload = response?.data || {};
        setData(Array.isArray(payload.data) ? payload.data : []);

        if (payload.summaryIncluded !== false) {
          completedSummaryKey.current = currentSummaryKey;
          knownTotal.current = Number(payload.total || 0);
          setTotal(knownTotal.current);
          setTotalPages(Number(payload.totalPages || 1));
          setFinancialSummary(payload.financialSummary || null);
          setOperationalSummary(payload.operationalSummary || null);
        } else {
          const pageSize = Math.max(1, Number(params?.limit || 20));
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
  }, [authLoading, hasSession, canView, params]);

  return {
    data,
    setData,
    totalPages,
    total,
    financialSummary,
    operationalSummary,
    loading,
    err,
    setErr,
  };
}
