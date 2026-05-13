// src/components/ModalContacto.jsx
import React, { useEffect } from 'react';

export default function ModalContacto({ visible, onClose }) {
  if (!visible) return null;

  // Cerrar con tecla ESC
  useEffect(() => {
    const onEsc = (e) => e.key === 'Escape' && onClose?.();
    window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
  }, [onClose]);

  const stop = (e) => e.stopPropagation();

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="contacto-title"
      tabIndex={-1}
    >
      <div
        className="relative w-[92vw] max-w-2xl mx-4 bg-white rounded-2xl shadow-xl animate-slide-in"
        onClick={stop}
      >
        {/* Botón cerrar */}
        <button
          type="button"
          aria-label="Cerrar"
          className="absolute top-3 right-3 rounded-full w-9 h-9 flex items-center justify-center text-gray-600 hover:text-gray-800 hover:bg-gray-100 transition"
          onClick={onClose}
        >
          ×
        </button>

        {/* Contenido */}
        <div className="p-6 max-h-[65vh] overflow-y-auto pr-2">
          <h2 id="contacto-title" className="text-lg font-semibold text-gray-800 mb-3">
            Información de contacto
          </h2>

          <div style={{ textAlign: 'justify' }} className="space-y-4 text-sm text-gray-700">
            <section>
              <h3 className="font-semibold text-gray-800 mb-1">Canales de atención</h3>
              <ul className="list-disc pl-5 space-y-1">
                <li>
                  WhatsApp: <a href="https://wa.me/573163502520" className="text-pink-600 underline hover:text-pink-700">3163502520</a>
                </li>
                <li>
                  Correo: <a href="mailto:contacto@tu-tienda.co" className="text-pink-600 underline hover:text-pink-700">contacto@tu-tienda.co</a>
                  {/* Cambia este correo por el tuyo oficial */}
                </li>
                <li>
                  Horario de atención: <strong>L–V 9:00–18:00</strong>, <strong>Sáb 9:00–13:00</strong> (hora Colombia).
                </li>
              </ul>
            </section>

            <section>
              <h3 className="font-semibold text-gray-800 mb-1">Tiempos de respuesta</h3>
              <p>
                Respondemos mensajes y correos en un plazo estimado de <strong>24 a 48 horas hábiles</strong>.
                En temporadas de alta demanda, el tiempo puede extenderse ligeramente.
              </p>
            </section>

            <section>
              <h3 className="font-semibold text-gray-800 mb-1">PQRS (Peticiones, Quejas, Reclamos y Sugerencias)</h3>
              <ol className="list-decimal pl-5 space-y-1">
                <li>Envíanos tu caso por WhatsApp o correo (asunto: <em>PQRS</em>).</li>
                <li>Incluye <strong>número de pedido</strong>, nombre completo, cédula y una breve descripción.</li>
                <li>Adjunta fotos si aplica (producto, guía, empaque).</li>
                <li>Te daremos respuesta dentro de los plazos legales y te informaremos el seguimiento.</li>
              </ol>
            </section>

            <section>
              <h3 className="font-semibold text-gray-800 mb-1">Recomendaciones</h3>
              <ul className="list-disc pl-5 space-y-1">
                <li>Ten a mano tu <strong>número de pedido</strong> para agilizar la atención.</li>
                <li>Para temas de envío, comparte el <strong>número de guía</strong> si ya lo tienes.</li>
              </ul>
            </section>

            <p className="text-xs text-gray-500">
              Usaremos tu información de contacto exclusivamente para gestionar tu solicitud conforme a nuestra <strong>Política de Privacidad</strong>.
            </p>
          </div>

          {/* Marca de agua */}
          <img
            src="/icons/ROSA.PNG"
            alt=""
            aria-hidden="true"
            className="pointer-events-none select-none absolute bottom-3 right-3 w-24 h-24 opacity-10"
          />
        </div>
      </div>
    </div>
  );
}
