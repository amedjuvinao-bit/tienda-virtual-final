import { useCallback, useEffect, useRef, useState } from 'react';
import api from '../../lib/api';
const empty = { connected: false, posts: [], account: null, nextCursor: '', loading: false, loaded: false, error: '', stale: false };
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
        ? await api.post('/api/admin/instagram-settings/refresh-feed', {}, { signal: controller.signal, timeout: 45000 })
        : await api.get(adminPreview ? '/api/admin/instagram-settings/feed' : '/api/instagram/feed', { params: cursor ? { cursor } : {}, signal: controller.signal, ...(adminPreview ? { timeout: 45000 } : {}) });
      if (controller.signal.aborted) return;
      if (!data || typeof data !== 'object' || typeof data.connected !== 'boolean' || !Array.isArray(data.posts)) throw new Error('INVALID_INSTAGRAM_RESPONSE');
      setState(s => ({ ...data, posts: more && data.connected && s.account?.id === data.account?.id ? [...new Map([...s.posts, ...(data.posts || [])].map(p => [p.id, p])).values()] : data.posts || [], loading: false, loaded: true, error: '' }));
    } catch (error) {
      if (!controller.signal.aborted) setState(s => ({ ...s, loading: false, loaded: true, error: feedError(error, adminPreview) }));
    } finally { if (request.current === controller) request.current = null; }
  }, [enabled, adminPreview]);
  useEffect(() => {
    setState(empty);
    if (enabled) load();
    return () => { request.current?.abort(); request.current = null; };
  }, [enabled, load]);
  return { ...state, loadMore: () => load(true), retry: () => load(false), refresh: () => load(false, true) };
}

function feedError(error, adminPreview) {
  const status = error.response?.status;
  if (status === 404 && adminPreview) return 'El backend no tiene disponible la consulta de publicaciones de Apariencia (HTTP 404).';
  if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') return 'Instagram tardó demasiado en responder. Vuelve a intentar; tu selección se conserva.';
  if (error.message === 'INVALID_INSTAGRAM_RESPONSE') return 'El servidor no devolvió una lista válida de publicaciones de Instagram.';
  if (status === 401) return 'La sesión administrativa venció. Inicia sesión de nuevo.';
  if (status === 403) return 'Tu usuario necesita el permiso de consultar Apariencia para ver estas publicaciones.';
  return error.response?.data?.message || 'No se pudo cargar Instagram. Puedes volver a intentar.';
}
