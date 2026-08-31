import React from 'react';
import { createPortal } from 'react-dom';
import { Pin, SlidersHorizontal } from 'lucide-react';

export default function OrdersControlToggle({
  controlsOpen,
  dragging,
  pinned,
  position,
  toggleRef,
  onClick,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
  onTogglePin,
}) {
  const content = (
    <div
      ref={toggleRef}
      className={`orders-control-toggle ${dragging ? 'is-dragging' : ''} ${
        pinned ? 'is-pinned' : ''
      }`}
      style={{
        position: pinned ? 'absolute' : 'fixed',
        ...(position
          ? {
            left: position.x,
            top: position.y,
            right: 'auto',
            bottom: 'auto',
          }
          : {}),
      }}
    >
      <button
        type="button"
        aria-controls="orders-control-panel"
        aria-expanded={controlsOpen}
        aria-label={
          controlsOpen ? 'Ocultar panel de filtros' : 'Mostrar panel de filtros'
        }
        title={
          pinned
            ? 'Botón anclado. Haz clic para mostrar u ocultar los filtros.'
            : 'Arrastra para mover. Haz clic para mostrar u ocultar los filtros.'
        }
        onClick={onClick}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        className="orders-control-toggle-action"
      >
        <SlidersHorizontal aria-hidden="true" className="h-3.5 w-3.5" />
        <span>{controlsOpen ? 'Ocultar filtros' : 'Mostrar filtros'}</span>
      </button>
      <button
        type="button"
        className="orders-control-toggle-pin"
        aria-label={
          pinned
            ? 'Quitar anclaje del botón de filtros'
            : 'Anclar botón de filtros en esta posición'
        }
        aria-pressed={pinned}
        title={
          pinned
            ? 'Anclado aquí. Pulsa para volver a moverlo.'
            : 'Anclar el botón en esta posición.'
        }
        onClick={onTogglePin}
      >
        <Pin
          aria-hidden="true"
          className="h-3.5 w-3.5"
          fill={pinned ? 'currentColor' : 'none'}
        />
      </button>
    </div>
  );

  return typeof document === 'undefined'
    ? content
    : createPortal(content, document.body);
}
