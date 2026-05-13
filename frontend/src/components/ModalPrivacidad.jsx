// src/components/ModalPrivacidad.jsx
import React, { useEffect } from 'react';

export default function ModalPrivacidad({ visible, onClose }) {
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
      aria-labelledby="privacidad-title"
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
          <h2 id="privacidad-title" className="text-lg font-semibold text-gray-800 mb-3">
            Política de Privacidad y Tratamiento de Datos Personales
          </h2>

          <div style={{ textAlign: 'justify' }} className="space-y-4 text-sm text-gray-700">
            <p>
              En <strong>nuestra tienda</strong> protegemos tus datos personales conforme a la Ley 1581 de 2012 y
              normas concordantes en Colombia. Esta política explica cómo recolectamos, usamos, almacenamos y
              protegemos tu información.
            </p>

            <section>
              <h3 className="font-semibold text-gray-800 mb-1">Finalidades del tratamiento</h3>
              <ul className="list-disc pl-5 space-y-1">
                <li>Procesar compras, envíos, facturación y garantías.</li>
                <li>Gestionar comunicaciones transaccionales y servicio al cliente.</li>
                <li>Enviar (si lo autorizas) novedades, promociones y encuestas.</li>
                <li>Prevención de fraudes y cumplimiento de obligaciones legales.</li>
              </ul>
            </section>

            <section>
              <h3 className="font-semibold text-gray-800 mb-1">Base legal y autorización</h3>
              <p>
                Tratamos tus datos con base en tu <strong>autorización previa, expresa e informada</strong>,
                así como en <strong>obligaciones contractuales y legales</strong> aplicables.
                Podrás revocar tu autorización cuando sea procedente.
              </p>
            </section>

            <section>
              <h3 className="font-semibold text-gray-800 mb-1">Confidencialidad y seguridad</h3>
              <p>
                Implementamos medidas administrativas, técnicas y físicas razonables para proteger la
                confidencialidad, integridad y disponibilidad de los datos, evitando accesos no autorizados y usos indebidos.
              </p>
            </section>

            <section>
              <h3 className="font-semibold text-gray-800 mb-1">Derechos de los titulares (ARCO)</h3>
              <ul className="list-disc pl-5 space-y-1">
                <li><strong>Acceso</strong> a la información objeto de tratamiento.</li>
                <li><strong>Rectificación</strong> de datos inexactos o desactualizados.</li>
                <li><strong>Cancelación/Supresión</strong> cuando sea procedente por ley.</li>
                <li><strong>Oposición</strong> al tratamiento en casos permitidos.</li>
              </ul>
            </section>

            <section>
              <h3 className="font-semibold text-gray-800 mb-1">Canales de contacto</h3>
              <p>
                Para ejercer tus derechos o presentar consultas/reclamos, contáctanos por WhatsApp
                <strong> 3163502520</strong>. Responderemos dentro de los plazos legales.
              </p>
            </section>

            <section>
              <h3 className="font-semibold text-gray-800 mb-1">Almacenamiento y conservación</h3>
              <p>
                Conservamos los datos por el tiempo necesario para las finalidades informadas y exigencias legales.
                Luego, procederemos a su supresión o anonimización segura.
              </p>
            </section>

            <section>
              <h3 className="font-semibold text-gray-800 mb-1">Encargados y terceros</h3>
              <p>
                Podemos compartir datos con <strong>encargados</strong> (p. ej., pasarelas de pago, logística),
                quienes deben garantizar confidencialidad y protección de la información.
              </p>
            </section>

            <section>
              <h3 className="font-semibold text-gray-800 mb-1">Actualizaciones de la política</h3>
              <p>
                Esta política puede actualizarse. Publicaremos la versión vigente y su fecha de última actualización en nuestros canales.
              </p>
            </section>

            <p className="text-xs text-gray-500 italic">
              Nota: Este documento es informativo y no constituye asesoría legal.
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
