import { useEffect, useState } from 'react';
import { getAdminRouteRequestCount, subscribeAdminRouteRequests } from '../../lib/api';

export default function useAdminModuleLoading(pathname) {
  const [pendingPath, setPendingPath] = useState(null);

  useEffect(() => {
    let sawRequest = false;
    let finished = false;

    const onRequestsChanged = (changedPath, count) => {
      if (changedPath !== pathname || finished) return;
      if (count > 0) {
        sawRequest = true;
        setPendingPath(pathname);
      } else if (sawRequest) {
        finished = true;
        setPendingPath(null);
      }
    };

    const unsubscribe = subscribeAdminRouteRequests(onRequestsChanged);
    onRequestsChanged(pathname, getAdminRouteRequestCount(pathname));
    return unsubscribe;
  }, [pathname]);

  return pendingPath === pathname;
}
