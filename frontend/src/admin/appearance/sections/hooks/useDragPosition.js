import { useRef } from "react";
import { clampNumber } from "../ui/sectionHelpers";

// ============================================
// ✅ Hook para manejar drag SIN guardar en cada movimiento
// - onPreviewChange: solo mueve visualmente
// - onCommit: guarda al soltar
// ============================================
export default function useDragPosition({
  onPreviewChange,
  onCommit,
}) {
  const ref = useRef(null);
  const draggingRef = useRef(false);
  const lastPosRef = useRef({ x: 50, y: 50 });

  const pointerToPercent = (e) => {
    const el = ref.current;
    if (!el) return null;

    const rect = el.getBoundingClientRect();
    if (!rect || rect.width <= 0 || rect.height <= 0) return null;

    const x = clampNumber(((e.clientX - rect.left) / rect.width) * 100, {
      min: 0,
      max: 100,
      fallback: 50,
    });

    const y = clampNumber(((e.clientY - rect.top) / rect.height) * 100, {
      min: 0,
      max: 100,
      fallback: 50,
    });

    return { x, y };
  };

  const onPointerDown = (e) => {
    if (!ref.current) return;
    if (typeof e.button === "number" && e.button !== 0) return;

    draggingRef.current = true;

    try {
      ref.current.setPointerCapture?.(e.pointerId);
    } catch (_) {}

    const p = pointerToPercent(e);
    if (!p) return;

    lastPosRef.current = p;
    onPreviewChange?.(p.x, p.y);
  };

  const onPointerMove = (e) => {
    if (!draggingRef.current) return;

    const p = pointerToPercent(e);
    if (!p) return;

    lastPosRef.current = p;
    onPreviewChange?.(p.x, p.y);
  };

  const finishDrag = (e) => {
    if (!draggingRef.current) return;

    draggingRef.current = false;

    const p = pointerToPercent(e) || lastPosRef.current;
    lastPosRef.current = p;

    try {
      ref.current?.releasePointerCapture?.(e.pointerId);
    } catch (_) {}

    onCommit?.(p.x, p.y);
  };

  const onPointerUp = (e) => {
    finishDrag(e);
  };

  const onPointerCancel = (e) => {
    finishDrag(e);
  };

  const onLostPointerCapture = (e) => {
    finishDrag(e);
  };

  const onPointerLeave = () => {
    // ✅ No guardar aquí
    // Solo dejamos que siga el drag si vuelve o termina con pointerup
  };

  return {
    ref,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
    onLostPointerCapture,
    onPointerLeave,
  };
}