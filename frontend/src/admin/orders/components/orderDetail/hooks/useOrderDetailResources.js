import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import api from '../../../../../lib/api';

const EMPTY_RETURNS = Object.freeze({
  orderId: '',
  policy: {},
  eligibility: [],
  returns: [],
});

export async function synchronizeOrderDetailState({
  updatedOrder,
  orderId,
  onOrderUpdated,
  loadOrder,
  refreshRelated = [],
  shouldApplyResult = () => true,
} = {}) {
  const canApply = () => shouldApplyResult(orderId) !== false;

  if (updatedOrder?._id && canApply()) onOrderUpdated?.(updatedOrder);

  const tasks = [
    typeof loadOrder === 'function'
      ? Promise.resolve().then(() => loadOrder(orderId))
      : Promise.resolve(null),
    ...refreshRelated
      .filter((refresh) => typeof refresh === 'function')
      .map((refresh) => Promise.resolve().then(() => refresh(orderId))),
  ];
  const [orderResult] = await Promise.allSettled(tasks);
  const freshOrder = orderResult?.status === 'fulfilled'
    ? orderResult.value
    : null;

  if (freshOrder?._id && canApply()) onOrderUpdated?.(freshOrder);
  return freshOrder || updatedOrder || null;
}

function keyedItems(orderId = '', items = [], pagination = {}) {
  return { orderId: String(orderId || ''), items, pagination };
}

function mergeUniqueItems(current = [], incoming = []) {
  const seen = new Set();
  return [...current, ...incoming].filter((item, index) => {
    const key = String(item?._id || item?.id || `row-${index}`);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export default function useOrderDetailResources({
  open,
  orderId,
  canAddNotes = false,
  onOrderUpdated,
  showToast,
}) {
  const normalizedOrderId = String(orderId || '');
  const openRef = useRef(open);
  const orderIdRef = useRef(normalizedOrderId);
  const requestRef = useRef({ timeline: 0, notes: 0, refunds: 0, returns: 0, order: 0 });

  openRef.current = open;
  orderIdRef.current = normalizedOrderId;

  const [timelineState, setTimelineState] = useState(() => keyedItems());
  const [notesState, setNotesState] = useState(() => keyedItems());
  const timelineStateRef = useRef(timelineState);
  const notesStateRef = useRef(notesState);
  const [refundsState, setRefundsState] = useState(() => keyedItems());
  const [returnsState, setReturnsState] = useState(EMPTY_RETURNS);
  const [noteText, setNoteText] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [refundsLoading, setRefundsLoading] = useState(false);
  const [returnsLoading, setReturnsLoading] = useState(false);
  const [timelineMoreLoading, setTimelineMoreLoading] = useState(false);
  const [notesMoreLoading, setNotesMoreLoading] = useState(false);

  timelineStateRef.current = timelineState;
  notesStateRef.current = notesState;

  const isCurrent = useCallback((resource, requestId, targetOrderId) => (
    openRef.current &&
    orderIdRef.current === targetOrderId &&
    requestRef.current[resource] === requestId
  ), []);

  const fetchTimeline = useCallback(async (requestedOrderId, options = {}) => {
    const targetOrderId = String(requestedOrderId || orderIdRef.current || '');
    if (!targetOrderId || !openRef.current) return [];
    const append = options?.append === true;
    const current = timelineStateRef.current;
    const cursor = append && current.orderId === targetOrderId
      ? current.pagination?.nextCursor
      : null;
    if (append && !cursor) return current.items || [];
    const requestId = ++requestRef.current.timeline;
    if (append) setTimelineMoreLoading(true);

    try {
      const { data } = await api.get(
        `/api/orders/${targetOrderId}/timeline`,
        { params: cursor ? { cursor } : {} }
      );
      const items = Array.isArray(data?.data) ? data.data : [];
      if (isCurrent('timeline', requestId, targetOrderId)) {
        const previous = timelineStateRef.current;
        const nextItems = append && previous.orderId === targetOrderId
          ? mergeUniqueItems(previous.items, items)
          : items;
        const nextState = keyedItems(targetOrderId, nextItems, data?.pagination || {});
        timelineStateRef.current = nextState;
        setTimelineState(nextState);
      }
      return items;
    } catch {
      if (!append && isCurrent('timeline', requestId, targetOrderId)) {
        const nextState = keyedItems(targetOrderId);
        timelineStateRef.current = nextState;
        setTimelineState(nextState);
      }
      return [];
    } finally {
      if (append && isCurrent('timeline', requestId, targetOrderId)) {
        setTimelineMoreLoading(false);
      }
    }
  }, [isCurrent]);

  const fetchNotes = useCallback(async (requestedOrderId, options = {}) => {
    const targetOrderId = String(requestedOrderId || orderIdRef.current || '');
    if (!targetOrderId || !openRef.current) return [];
    const append = options?.append === true;
    const current = notesStateRef.current;
    if (append && current.orderId === targetOrderId && !current.pagination?.hasMore) {
      return current.items || [];
    }
    const page = append && current.orderId === targetOrderId
      ? Number(current.pagination?.page || 1) + 1
      : 1;
    const requestId = ++requestRef.current.notes;
    if (append) setNotesMoreLoading(true);

    try {
      const { data } = await api.get(
        `/api/orders/${targetOrderId}/notes`,
        { params: { page } }
      );
      const items = Array.isArray(data?.data) ? data.data : [];
      if (isCurrent('notes', requestId, targetOrderId)) {
        const previous = notesStateRef.current;
        const nextItems = append && previous.orderId === targetOrderId
          ? mergeUniqueItems(previous.items, items)
          : items;
        const nextState = keyedItems(targetOrderId, nextItems, data?.pagination || {});
        notesStateRef.current = nextState;
        setNotesState(nextState);
      }
      return items;
    } catch {
      if (!append && isCurrent('notes', requestId, targetOrderId)) {
        const nextState = keyedItems(targetOrderId);
        notesStateRef.current = nextState;
        setNotesState(nextState);
      }
      return [];
    } finally {
      if (append && isCurrent('notes', requestId, targetOrderId)) {
        setNotesMoreLoading(false);
      }
    }
  }, [isCurrent]);

  const fetchRefunds = useCallback(async (requestedOrderId) => {
    const targetOrderId = String(requestedOrderId || orderIdRef.current || '');
    if (!targetOrderId || !openRef.current) return [];
    const requestId = ++requestRef.current.refunds;
    setRefundsLoading(true);

    try {
      const { data } = await api.get(`/api/orders/${targetOrderId}/refunds`);
      const items = Array.isArray(data?.refunds) ? data.refunds : [];
      if (isCurrent('refunds', requestId, targetOrderId)) {
        setRefundsState(keyedItems(targetOrderId, items));
      }
      return items;
    } catch {
      if (isCurrent('refunds', requestId, targetOrderId)) {
        setRefundsState(keyedItems(targetOrderId));
      }
      return [];
    } finally {
      if (isCurrent('refunds', requestId, targetOrderId)) {
        setRefundsLoading(false);
      }
    }
  }, [isCurrent]);

  const fetchReturns = useCallback(async (requestedOrderId) => {
    const targetOrderId = String(requestedOrderId || orderIdRef.current || '');
    if (!targetOrderId || !openRef.current) return EMPTY_RETURNS;
    const requestId = ++requestRef.current.returns;
    setReturnsLoading(true);

    try {
      const { data } = await api.get(`/api/orders/${targetOrderId}/returns`);
      const result = {
        orderId: targetOrderId,
        policy: data?.policy || {},
        eligibility: Array.isArray(data?.eligibility) ? data.eligibility : [],
        returns: Array.isArray(data?.returns) ? data.returns : [],
      };
      if (isCurrent('returns', requestId, targetOrderId)) setReturnsState(result);
      return result;
    } catch {
      const result = { ...EMPTY_RETURNS, orderId: targetOrderId };
      if (isCurrent('returns', requestId, targetOrderId)) setReturnsState(result);
      return result;
    } finally {
      if (isCurrent('returns', requestId, targetOrderId)) {
        setReturnsLoading(false);
      }
    }
  }, [isCurrent]);

  const synchronizeAfterMutation = useCallback((
    updatedOrder = null,
    refreshRelated = [fetchTimeline, fetchRefunds, fetchReturns]
  ) => {
    const targetOrderId = orderIdRef.current;
    const requestId = ++requestRef.current.order;

    return synchronizeOrderDetailState({
      updatedOrder,
      orderId: targetOrderId,
      onOrderUpdated,
      loadOrder: async (id) => {
        if (!id) return null;
        const { data } = await api.get(`/api/orders/${id}`);
        return data?._id ? data : null;
      },
      refreshRelated,
      shouldApplyResult: (id) => (
        openRef.current &&
        orderIdRef.current === id &&
        requestRef.current.order === requestId
      ),
    });
  }, [fetchRefunds, fetchReturns, fetchTimeline, onOrderUpdated]);

  useEffect(() => {
    requestRef.current.timeline += 1;
    requestRef.current.notes += 1;
    requestRef.current.refunds += 1;
    requestRef.current.returns += 1;
    requestRef.current.order += 1;

    const emptyTimeline = keyedItems(normalizedOrderId);
    const emptyNotes = keyedItems(normalizedOrderId);
    timelineStateRef.current = emptyTimeline;
    notesStateRef.current = emptyNotes;
    setTimelineState(emptyTimeline);
    setNotesState(emptyNotes);
    setRefundsState(keyedItems(normalizedOrderId));
    setReturnsState({ ...EMPTY_RETURNS, orderId: normalizedOrderId });
    setNoteText('');
    setSavingNote(false);
    setRefundsLoading(false);
    setReturnsLoading(false);
    setTimelineMoreLoading(false);
    setNotesMoreLoading(false);

    if (!open || !normalizedOrderId) return undefined;

    fetchTimeline(normalizedOrderId);
    fetchNotes(normalizedOrderId);
    fetchRefunds(normalizedOrderId);
    fetchReturns(normalizedOrderId);

    return () => {
      requestRef.current.timeline += 1;
      requestRef.current.notes += 1;
      requestRef.current.refunds += 1;
      requestRef.current.returns += 1;
      requestRef.current.order += 1;
    };
  }, [fetchNotes, fetchRefunds, fetchReturns, fetchTimeline, normalizedOrderId, open]);

  const addNote = useCallback(async () => {
    const text = String(noteText || '').trim();
    const targetOrderId = orderIdRef.current;
    if (!canAddNotes || !text || !targetOrderId || !openRef.current) return;

    try {
      setSavingNote(true);
      await api.post(`/api/orders/${targetOrderId}/notes`, { text });
      if (orderIdRef.current !== targetOrderId || !openRef.current) return;
      setNoteText('');
      showToast({
        type: 'success',
        title: 'Nota guardada',
        message: 'La nota interna se agregó correctamente.',
      });
      await Promise.allSettled([
        fetchNotes(targetOrderId),
        fetchTimeline(targetOrderId),
      ]);
    } catch {
      if (orderIdRef.current === targetOrderId && openRef.current) {
        showToast({
          type: 'error',
          title: 'No se pudo crear la nota',
          message: 'Revisa la conexión o intenta nuevamente.',
        });
      }
    } finally {
      if (orderIdRef.current === targetOrderId && openRef.current) {
        setSavingNote(false);
      }
    }
  }, [canAddNotes, fetchNotes, fetchTimeline, noteText, showToast]);

  const timeline = timelineState.orderId === normalizedOrderId
    ? timelineState.items
    : [];
  const notes = notesState.orderId === normalizedOrderId ? notesState.items : [];
  const refunds = refundsState.orderId === normalizedOrderId
    ? refundsState.items
    : [];
  const returnsData = returnsState.orderId === normalizedOrderId
    ? returnsState
    : { ...EMPTY_RETURNS, orderId: normalizedOrderId };

  const normalizedNotes = useMemo(() => notes.map((note) => ({
    ...note,
    content: note?.content || note?.text || note?.note || note?.message || '',
    createdByName:
      note?.createdByName ||
      note?.author?.name ||
      note?.createdBy?.name ||
      note?.createdBy?.username ||
      '',
  })), [notes]);

  const loadMoreTimeline = useCallback(
    () => fetchTimeline(orderIdRef.current, { append: true }),
    [fetchTimeline]
  );
  const loadMoreNotes = useCallback(
    () => fetchNotes(orderIdRef.current, { append: true }),
    [fetchNotes]
  );

  return {
    timeline,
    timelineHasMore: Boolean(timelineState.pagination?.hasMore),
    timelineMoreLoading,
    loadMoreTimeline,
    notes: normalizedNotes,
    notesHasMore: Boolean(notesState.pagination?.hasMore),
    notesMoreLoading,
    loadMoreNotes,
    noteText,
    setNoteText,
    savingNote,
    addNote,
    fetchTimeline,
    fetchNotes,
    refunds,
    refundsLoading,
    fetchRefunds,
    returnsData,
    returnsLoading,
    fetchReturns,
    synchronizeAfterMutation,
  };
}
