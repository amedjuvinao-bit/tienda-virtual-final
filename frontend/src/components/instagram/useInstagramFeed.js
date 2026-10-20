import { useCallback, useEffect, useRef, useState } from 'react';
import api from '../../lib/api';
const empty = { connected: false, posts: [], account: null, nextCursor: '', loading: false, error: '', stale: false };
export default function useInstagramFeed(enabled, adminPreview = false) {
  const [state, setState] = useState(empty), request = useRef(null), current = useRef(empty);
  current.current = state;
  const load = useCallback(async (more = false, refresh = false) => {
    if (!enabled || request.current) return;
    const cursor = more ? current.current.nextCursor : '';
    if (more && !cursor) return;
    const controller = new AbortController(); request.current = controller;
    setState(s => ({ ...s, loading: true, error: '' }));
    try {
      const { data } = refresh && adminPreview
        ? await api.post('/api/instagram/admin/refresh', {}, { signal: controller.signal })
        : await api.get(adminPreview ? '/api/instagram/admin/feed' : '/api/instagram/feed', { params: cursor ? { cursor } : {}, signal: controller.signal });
      if (controller.signal.aborted) return;
      setState(s => ({ ...data, posts: more && data.connected && s.account?.id === data.account?.id ? [...new Map([...s.posts, ...(data.posts || [])].map(p => [p.id, p])).values()] : data.posts || [], loading: false, error: '' }));
    } catch (error) {
      if (!controller.signal.aborted) setState(s => ({ ...s, loading: false, error: error.response?.data?.message || 'No se pudo cargar Instagram. Puedes volver a intentar.' }));
    } finally { if (request.current === controller) request.current = null; }
  }, [enabled, adminPreview]);
  useEffect(() => {
    setState(empty);
    if (enabled) load();
    return () => { request.current?.abort(); request.current = null; };
  }, [enabled, load]);
  return { ...state, loadMore: () => load(true), retry: () => load(false), refresh: () => load(false, true) };
}
