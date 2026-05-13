// src/components/ModalReembolso.jsx
import React from 'react';

export default function ModalReembolso({ visible, onClose }) {
  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40 backdrop-blur-sm animate-fade-in px-4"
      onClick={onClose}
    >
      <div
        className="relative bg-white w-full max-w-2xl md:rounded-xl rounded-lg p-6 md:p-8 shadow-lg animate-slide-in overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Imagen de marca de agua */}
       <img
        src="/icons/ROSA.png"
        alt="Marca de agua"
        className="absolute bottom-4 right-4 opacity-10 w-24 h-24 pointer-events-none select-none"
        />

        {/* Botón cerrar */}
        <button
          onClick={onClose}
          className="absolute top-2 right-3 text-gray-500 hover:text-pink-600 text-xl font-bold"
        >
          &times;
        </button>

        {/* Título */}
        <h2 className="text-xl md:text-2xl font-bold text-pink-600 mb-4 text-center">
          Políticas de Reembolso
        </h2>

        {/* Contenido del texto */}
        <div className="text-sm text-gray-700 space-y-3 text-justify max-h-[70vh] overflow-y-auto pr-2 md:pr-4">
          <p>
            Solo se aceptarán cambios de productos por talla en un tiempo de 30 días calendario desde el día que recibe su producto. Por esto es importante probar la prenda una vez la reciba para garantizar el cambio del producto dentro de los días permitidos.
          </p>
          <p>
            Para solicitar un cambio, deberá comunicarse a nuestra línea de atención de WhatsApp 3163502520 anunciando su nombre, cédula y producto adquirido. Una vez aprobado, le indicaremos el proceso de devolución.
          </p>
          <p>
            Los productos deben estar en perfectas condiciones, sin uso, con etiquetas y empaque original. No se aceptarán cambios de productos usados o dañados.
          </p>
          <p>
            En caso de defectos de fabricación, el cambio no tendrá costo adicional. Para cambios por talla o gusto personal, el costo de envío será asumido por el cliente.
          </p>
          <p>
            No se realizan devoluciones de dinero, únicamente se realizan cambios por productos de igual o mayor valor (asumiendo la diferencia).
          </p>
        </div>
      </div>
    </div>
  );
}
