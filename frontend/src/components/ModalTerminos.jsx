// src/components/ModalTerminos.jsx
import React, { useEffect } from 'react';

export default function ModalTerminos({ visible, onClose }) {
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
      aria-labelledby="terminos-title"
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
          <h2 id="terminos-title" className="text-lg font-semibold text-gray-800 mb-3">
            Términos del servicio
          </h2>

          <div style={{ textAlign: 'justify' }} className="space-y-4 text-sm text-gray-700">
            <section>
              <h3 className="font-semibold text-gray-800 mb-1">1. Aceptación</h3>
              <p>
                Al acceder y usar <strong>nuestra tienda</strong>, aceptas estos Términos del servicio y las políticas
                complementarias (Privacidad, Envío, Cambios/Devoluciones). Si no estás de acuerdo, por favor no uses el sitio.
              </p>
            </section>

            <section>
              <h3 className="font-semibold text-gray-800 mb-1">2. Uso del sitio</h3>
              <p>
                Debes contar con capacidad legal para contratar. El contenido del sitio es para uso personal y no comercial,
                salvo autorización expresa. Nos reservamos el derecho de limitar o suspender el acceso ante usos indebidos.
              </p>
            </section>

            <section>
              <h3 className="font-semibold text-gray-800 mb-1">3. Cuenta y seguridad</h3>
              <p>
                Si creas una cuenta, eres responsable de mantener la confidencialidad de tus credenciales y de todas las
                actividades realizadas. Notifícanos cualquier acceso no autorizado de inmediato.
              </p>
            </section>

            <section>
              <h3 className="font-semibold text-gray-800 mb-1">4. Pedidos y disponibilidad</h3>
              <p>
                La confirmación de pedido está sujeta a verificación de <strong>disponibilidad</strong>, validaciones
                anti-fraude y al procesamiento de pago. Podemos rechazar o cancelar pedidos por errores evidentes de precio,
                problemas de stock o información incompleta del cliente (se realizará devolución cuando corresponda).
              </p>
            </section>

            <section>
              <h3 className="font-semibold text-gray-800 mb-1">5. Precios, impuestos y errores</h3>
              <p>
                Los precios se expresan en <strong>COP</strong> e incluyen impuestos según aplique. Podemos actualizar precios
                en cualquier momento. Ante errores tipográficos o de cálculo, podremos anular o ajustar el pedido previa notificación.
              </p>
            </section>

            <section>
              <h3 className="font-semibold text-gray-800 mb-1">6. Pagos</h3>
              <p>
                Aceptamos los medios habilitados por nuestras pasarelas de pago. Las transacciones pueden estar sujetas a
                validaciones de seguridad y a procesos de <strong>reversión</strong> conforme a la normativa aplicable.
              </p>
            </section>

            <section>
              <h3 className="font-semibold text-gray-800 mb-1">7. Envíos y entrega</h3>
              <p>
                Los envíos se rigen por nuestra <strong>Política de Envío</strong>. El riesgo de pérdida se transfiere al
                comprador al momento de la entrega registrada por la transportadora.
              </p>
            </section>

            <section>
              <h3 className="font-semibold text-gray-800 mb-1">8. Cambios, devoluciones y garantías</h3>
              <p>
                Se aplican las condiciones indicadas en la <strong>Política de Cambios/Devoluciones</strong> (incluida la garantía legal).
              </p>
            </section>

            <section>
              <h3 className="font-semibold text-gray-800 mb-1">9. Propiedad intelectual</h3>
              <p>
                Todo el contenido (marcas, imágenes, textos, diseños) es propiedad de sus titulares y está protegido por la
                legislación aplicable. No se concede licencia salvo autorización expresa por escrito.
              </p>
            </section>

            <section>
              <h3 className="font-semibold text-gray-800 mb-1">10. Conductas prohibidas</h3>
              <p>
                Está prohibido vulnerar medidas de seguridad, realizar scraping o usos que afecten la disponibilidad del sitio,
                publicar contenido ofensivo, ilícito o que infrinja derechos de terceros.
              </p>
            </section>

            <section>
              <h3 className="font-semibold text-gray-800 mb-1">11. Limitación de responsabilidad</h3>
              <p>
                En la medida permitida por la ley, no seremos responsables por daños indirectos, incidentales o consecuenciales
                derivados del uso o imposibilidad de uso del sitio. Eventos de <em>fuerza mayor</em> pueden afectar la prestación del servicio.
              </p>
            </section>

            <section>
              <h3 className="font-semibold text-gray-800 mb-1">12. Datos personales</h3>
              <p>
                El tratamiento de tus datos se rige por nuestra <strong>Política de Privacidad</strong> conforme a la normativa colombiana.
              </p>
            </section>

            <section>
              <h3 className="font-semibold text-gray-800 mb-1">13. Comunicaciones</h3>
              <p>
                Aceptas recibir comunicaciones electrónicas sobre tu compra. Podrás gestionar preferencias de marketing en cualquier momento.
              </p>
            </section>

            <section>
              <h3 className="font-semibold text-gray-800 mb-1">14. Modificaciones</h3>
              <p>
                Podemos actualizar estos Términos. La versión vigente se publicará en nuestros canales con su fecha de actualización.
                El uso continuo del sitio implica aceptación de los cambios.
              </p>
            </section>

            <section>
              <h3 className="font-semibold text-gray-800 mb-1">15. Ley aplicable y jurisdicción</h3>
              <p>
                Estos Términos se rigen por las leyes de <strong>Colombia</strong>. Cualquier controversia se resolverá ante los
                jueces competentes en Colombia, sin perjuicio de los mecanismos de conciliación aplicables.
              </p>
            </section>

            <section>
              <h3 className="font-semibold text-gray-800 mb-1">16. Contacto</h3>
              <p>
                Para consultas, escríbenos por WhatsApp <strong>3163502520</strong>. Atenderemos tus solicitudes en horarios hábiles.
              </p>
            </section>

            <p className="text-xs text-gray-500 italic">
              Nota: Documento informativo, no constituye asesoría legal. Última actualización: {new Date().toLocaleDateString()}.
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
