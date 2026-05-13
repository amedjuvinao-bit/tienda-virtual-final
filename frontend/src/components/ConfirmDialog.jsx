// frontend/src/components/ConfirmDialog.jsx
import React from 'react';

export default function ConfirmDialog({ show, onClose, onConfirm, message }) {
  if (!show) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* backdrop */}
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* modal */}
      <div
        className="relative bg-white rounded-2xl shadow-xl max-w-sm w-[92%] p-6
                   border border-[#E9D6AA] animate-[zoomIn_.15s_ease-out]"
        role="dialog"
        aria-modal="true"
      >
        <h3 className="text-lg font-semibold text-gray-800 mb-3">
          Confirmación
        </h3>
        <p className="text-gray-600 mb-5">{message}</p>

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="px-4 py-2 rounded-lg bg-pink-500 text-white hover:bg-pink-600 shadow-sm transition"
          >
            Sí, eliminar
          </button>
        </div>
      </div>

      {/* animación simple con Tailwind arbitrary values */}
      <style>{`
        @keyframes zoomIn { 
          from { transform: scale(0.95); opacity: .5; } 
          to   { transform: scale(1);     opacity: 1;  } 
        }
      `}</style>
    </div>
  );
}
