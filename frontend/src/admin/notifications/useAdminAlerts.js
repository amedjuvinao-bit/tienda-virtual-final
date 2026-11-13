import { useEffect, useMemo, useRef, useState } from 'react';
import { ADMIN_ALERTS_CHANGED, getAdminAlertSources } from './adminAlertsApi';

export default function useAdminAlerts(user, enabled) {
  const sources = useMemo(() => (enabled ? getAdminAlertSources(user) : []), [enabled, user]);
  const [snapshot, setSnapshot] = useState({ sources: null, groups: {} });
  const refreshRef = useRef(null);

  useEffect(() => {
    if (!sources.length) return undefined;
    const controller = new AbortController();
    const pending = new Set();
    const lastStarted = new Map();
    const queued = new Set();

    async function refresh(source, force) {
      if (controller.signal.aborted || document.visibilityState === 'hidden') return;
      if (pending.has(source.id)) {
        if (force) queued.add(source.id);
        return;
      }
      if (!force && Date.now() - (lastStarted.get(source.id) || 0) < 15000) return;
      pending.add(source.id);
      lastStarted.set(source.id, Date.now());
      let result;
      try {
        result = { alerts: source.alerts(await source.load(controller.signal)) };
      } catch (error) {
        result = { alerts: [], failed: error?.response?.status !== 403 };
      } finally {
        pending.delete(source.id);
      }
      if (controller.signal.aborted) return;
      setSnapshot((previous) => ({
        sources,
        groups: {
          ...(previous.sources === sources ? previous.groups : {}),
          [source.id]: result,
        },
      }));
      if (queued.delete(source.id)) void refresh(source, true);
    }

    const refreshAll = (force = false) => sources.forEach((source) => { void refresh(source, force); });
    const resume = () => refreshAll();
    const refreshNow = () => refreshAll(true);
    const onChange = (event) => {
      const source = sources.find(({ id }) => id === event.detail);
      if (source) void refresh(source, true);
    };
    refreshRef.current = refreshNow;
    refreshNow();
    const timer = window.setInterval(resume, 60000);
    window.addEventListener('focus', resume);
    window.addEventListener(ADMIN_ALERTS_CHANGED, onChange);
    document.addEventListener('visibilitychange', resume);
    return () => {
      controller.abort();
      refreshRef.current = null;
      window.clearInterval(timer);
      window.removeEventListener('focus', resume);
      window.removeEventListener(ADMIN_ALERTS_CHANGED, onChange);
      document.removeEventListener('visibilitychange', resume);
    };
  }, [sources]);

  const groups = snapshot.sources === sources ? snapshot.groups : {};
  return {
    alerts: sources.flatMap((source) => groups[source.id]?.alerts || []),
    partial: Object.values(groups).some((group) => group.failed),
    loading: Object.keys(groups).length < sources.length,
    refresh: () => refreshRef.current?.(),
  };
}
