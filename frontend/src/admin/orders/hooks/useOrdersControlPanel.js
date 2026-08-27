import { useEffect, useLayoutEffect, useRef, useState } from 'react';

export const ORDERS_CONTROL_TOGGLE_POSITION_KEY =
  'orders-admin-control-toggle-position-v1';

export function clampControlTogglePosition(position, width = 132, height = 40) {
  if (typeof window === 'undefined') return position;

  const safeWidth = Number(width) > 0 ? Number(width) : 132;
  const safeHeight = Number(height) > 0 ? Number(height) : 40;
  const viewportLeft = Number(window.visualViewport?.offsetLeft) || 0;
  const viewportTop = Number(window.visualViewport?.offsetTop) || 0;
  const viewportWidth = Number(window.visualViewport?.width) || window.innerWidth;
  const viewportHeight = Number(window.visualViewport?.height) || window.innerHeight;
  const margin = 12;
  const minX = viewportLeft + margin;
  const minY = viewportTop + margin;
  const maxX = Math.max(minX, viewportLeft + viewportWidth - safeWidth - margin);
  const maxY = Math.max(minY, viewportTop + viewportHeight - safeHeight - margin);

  return {
    x: Math.min(maxX, Math.max(minX, Number(position?.x) || minX)),
    y: Math.min(maxY, Math.max(minY, Number(position?.y) || minY)),
  };
}

export function clampPinnedControlTogglePosition(position, width = 132) {
  if (typeof window === 'undefined') return position;

  const safeWidth = Number(width) > 0 ? Number(width) : 132;
  const documentScrollX = Number(window.scrollX) || 0;
  const viewportOffsetLeft = Number(window.visualViewport?.offsetLeft) || 0;
  const viewportWidth = Number(window.visualViewport?.width) || window.innerWidth;
  const margin = 12;
  const minX = documentScrollX + viewportOffsetLeft + margin;
  const maxX = Math.max(
    minX,
    documentScrollX + viewportOffsetLeft + viewportWidth - safeWidth - margin
  );

  return {
    x: Math.min(maxX, Math.max(minX, Number(position?.x) || minX)),
    y: Number(position?.y) || 0,
  };
}

function persistTogglePosition(position, pinned) {
  if (typeof window === 'undefined' || !position) return;

  window.localStorage.setItem(
    ORDERS_CONTROL_TOGGLE_POSITION_KEY,
    JSON.stringify({
      ...position,
      pinned,
      coordinateSpace: pinned ? 'document' : 'viewport',
    })
  );
}

export default function useOrdersControlPanel() {
  const [controlsOpen, setControlsOpen] = useState(false);
  const [controlTogglePosition, setControlTogglePosition] = useState(null);
  const [controlTogglePinned, setControlTogglePinned] = useState(false);
  const [draggingControlToggle, setDraggingControlToggle] = useState(false);
  const ordersShellRef = useRef(null);
  const controlPanelRef = useRef(null);
  const controlToggleRef = useRef(null);
  const controlTogglePositionRef = useRef(null);
  const controlTogglePinnedRef = useRef(false);
  const controlToggleDragRef = useRef(null);
  const lastControlToggleDragAtRef = useRef(0);

  useLayoutEffect(() => {
    const shell = ordersShellRef.current;
    const panel = controlPanelRef.current;
    if (!shell) return undefined;

    const clearReservedHeight = () => {
      shell.style.removeProperty('--orders-control-panel-min-height');
    };

    if (!controlsOpen || !panel || typeof window === 'undefined') {
      clearReservedHeight();
      return undefined;
    }

    let frameId = null;
    const applyReservedHeight = () => {
      const desktopLayout = window.matchMedia
        ? window.matchMedia('(min-width: 1181px)').matches
        : window.innerWidth > 1180;

      if (!desktopLayout) {
        clearReservedHeight();
        return;
      }

      const shellRect = shell.getBoundingClientRect();
      const panelRect = panel.getBoundingClientRect();
      const panelHeight = Math.max(panel.scrollHeight || 0, panelRect.height || 0);
      if (panelHeight <= 0) return;

      const panelTop = Math.max(0, panelRect.top - shellRect.top);
      shell.style.setProperty(
        '--orders-control-panel-min-height',
        `${Math.ceil(panelTop + panelHeight + 16)}px`
      );
    };
    const syncReservedHeight = () => {
      if (frameId != null) window.cancelAnimationFrame(frameId);
      frameId = window.requestAnimationFrame(applyReservedHeight);
    };

    applyReservedHeight();
    const ResizeObserverCtor = window.ResizeObserver;
    const observer = typeof ResizeObserverCtor === 'function'
      ? new ResizeObserverCtor(syncReservedHeight)
      : null;
    observer?.observe(panel);
    const heading = shell.querySelector('.orders-admin-heading');
    if (heading) observer?.observe(heading);
    window.addEventListener('resize', syncReservedHeight);

    return () => {
      if (frameId != null) window.cancelAnimationFrame(frameId);
      observer?.disconnect();
      window.removeEventListener('resize', syncReservedHeight);
      clearReservedHeight();
    };
  }, [controlsOpen]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    try {
      const stored = JSON.parse(
        window.localStorage.getItem(ORDERS_CONTROL_TOGGLE_POSITION_KEY)
      );
      if (Number.isFinite(stored?.x) && Number.isFinite(stored?.y)) {
        const rect = controlToggleRef.current?.getBoundingClientRect();
        const nextPinned = stored?.pinned === true;
        const restoredPosition = nextPinned
          ? stored?.coordinateSpace === 'document'
            ? { x: Number(stored.x), y: Number(stored.y) }
            : {
              x: Number(stored.x) + (Number(window.scrollX) || 0),
              y: Number(stored.y) + (Number(window.scrollY) || 0),
            }
          : stored;
        const next = nextPinned
          ? clampPinnedControlTogglePosition(restoredPosition, rect?.width)
          : clampControlTogglePosition(restoredPosition, rect?.width, rect?.height);
        controlTogglePositionRef.current = next;
        controlTogglePinnedRef.current = nextPinned;
        setControlTogglePosition(next);
        setControlTogglePinned(nextPinned);
        persistTogglePosition(next, nextPinned);
      }
    } catch {
      window.localStorage.removeItem(ORDERS_CONTROL_TOGGLE_POSITION_KEY);
    }

    const keepToggleInsideViewport = () => {
      if (!controlTogglePositionRef.current) return;
      const rect = controlToggleRef.current?.getBoundingClientRect();
      const next = controlTogglePinnedRef.current
        ? clampPinnedControlTogglePosition(
          controlTogglePositionRef.current,
          rect?.width
        )
        : clampControlTogglePosition(
          controlTogglePositionRef.current,
          rect?.width,
          rect?.height
        );
      controlTogglePositionRef.current = next;
      setControlTogglePosition(next);
      persistTogglePosition(next, controlTogglePinnedRef.current);
    };

    window.addEventListener('resize', keepToggleInsideViewport);
    window.addEventListener('pageshow', keepToggleInsideViewport);
    window.visualViewport?.addEventListener('resize', keepToggleInsideViewport);
    return () => {
      window.removeEventListener('resize', keepToggleInsideViewport);
      window.removeEventListener('pageshow', keepToggleInsideViewport);
      window.visualViewport?.removeEventListener('resize', keepToggleInsideViewport);
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || !controlTogglePositionRef.current) {
      return undefined;
    }

    const frameId = window.requestAnimationFrame(() => {
      const rect = controlToggleRef.current?.getBoundingClientRect();
      const next = controlTogglePinnedRef.current
        ? clampPinnedControlTogglePosition(
          controlTogglePositionRef.current,
          rect?.width
        )
        : clampControlTogglePosition(
          controlTogglePositionRef.current,
          rect?.width,
          rect?.height
        );
      controlTogglePositionRef.current = next;
      setControlTogglePosition(next);
      persistTogglePosition(next, controlTogglePinnedRef.current);
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [controlsOpen, controlTogglePinned]);

  const handleControlTogglePointerDown = (event) => {
    if (controlTogglePinnedRef.current) return;
    if (event.button != null && event.button !== 0) return;

    const rect = controlToggleRef.current?.getBoundingClientRect()
      || event.currentTarget.getBoundingClientRect();
    controlToggleDragRef.current = {
      pointerId: event.pointerId ?? 'primary',
      startX: event.clientX,
      startY: event.clientY,
      originX: rect.left,
      originY: rect.top,
      width: rect.width,
      height: rect.height,
      moved: false,
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const handleControlTogglePointerMove = (event) => {
    if (controlTogglePinnedRef.current) return;
    const drag = controlToggleDragRef.current;
    if (!drag || drag.pointerId !== (event.pointerId ?? 'primary')) return;

    const deltaX = event.clientX - drag.startX;
    const deltaY = event.clientY - drag.startY;
    if (!drag.moved && Math.hypot(deltaX, deltaY) < 4) return;

    drag.moved = true;
    setDraggingControlToggle(true);
    const next = clampControlTogglePosition(
      { x: drag.originX + deltaX, y: drag.originY + deltaY },
      drag.width,
      drag.height
    );
    controlTogglePositionRef.current = next;
    setControlTogglePosition(next);
    event.preventDefault();
  };

  const finishControlToggleDrag = (event) => {
    const drag = controlToggleDragRef.current;
    if (!drag || drag.pointerId !== (event.pointerId ?? 'primary')) return;

    const cancelled = event.type === 'pointercancel';
    if (drag.moved && !cancelled) lastControlToggleDragAtRef.current = Date.now();
    controlToggleDragRef.current = null;
    setDraggingControlToggle(false);
    event.currentTarget.releasePointerCapture?.(event.pointerId);

    if (drag.moved && !cancelled) {
      persistTogglePosition(controlTogglePositionRef.current, false);
    }
  };

  const handleControlToggleClick = () => {
    if (Date.now() - lastControlToggleDragAtRef.current < 300) return;
    setControlsOpen((open) => !open);
  };

  const handleControlTogglePin = () => {
    if (typeof window === 'undefined') return;

    const rect = controlToggleRef.current?.getBoundingClientRect();
    const nextPinned = !controlTogglePinnedRef.current;
    const scrollX = Number(window.scrollX) || 0;
    const scrollY = Number(window.scrollY) || 0;
    const currentPosition = controlTogglePositionRef.current
      || clampControlTogglePosition(
        { x: rect?.left, y: rect?.top },
        rect?.width,
        rect?.height
      );
    const nextPosition = nextPinned
      ? {
        x: (Number.isFinite(rect?.left) ? rect.left : currentPosition.x) + scrollX,
        y: (Number.isFinite(rect?.top) ? rect.top : currentPosition.y) + scrollY,
      }
      : clampControlTogglePosition(
        {
          x: Number.isFinite(rect?.left) ? rect.left : currentPosition.x - scrollX,
          y: Number.isFinite(rect?.top) ? rect.top : currentPosition.y - scrollY,
        },
        rect?.width,
        rect?.height
      );

    controlToggleDragRef.current = null;
    setDraggingControlToggle(false);
    controlTogglePositionRef.current = nextPosition;
    controlTogglePinnedRef.current = nextPinned;
    setControlTogglePosition(nextPosition);
    setControlTogglePinned(nextPinned);
    persistTogglePosition(nextPosition, nextPinned);
  };

  return {
    controlsOpen,
    setControlsOpen,
    controlTogglePosition,
    controlTogglePinned,
    draggingControlToggle,
    ordersShellRef,
    controlPanelRef,
    controlToggleRef,
    handleControlTogglePointerDown,
    handleControlTogglePointerMove,
    finishControlToggleDrag,
    handleControlToggleClick,
    handleControlTogglePin,
  };
}
