import React from 'react';

export default function ModalEnvio({ visible, onClose }) {
  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="relative bg-white max-w-2xl w-full mx-4 sm:mx-6 md:mx-8 lg:mx-auto rounded-xl p-6 shadow-lg animate-slide-in overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Marca de agua */}
        <img
          src="/icons/ROSA.PNG"
          alt="Marca de agua"
          className="absolute bottom-4 right-4 opacity-10 w-24 h-24 pointer-events-none select-none"
        />

        <button
          onClick={onClose}
          className="absolute top-3 right-4 text-gray-500 hover:text-pink-600 text-xl font-bold"
        >
          &times;
        </button>

        <h2 className="text-2xl font-bold text-pink-600 mb-4 text-center">
          Política de Envío
        </h2>

        <div className="text-sm text-gray-700 space-y-3 text-justify max-h-[65vh] overflow-y-auto pr-2">
          <p>
            Realizamos envíos a todo el territorio nacional. El tiempo de entrega varía según la ciudad de destino y puede demorar entre 2 a 7 días hábiles después de la confirmación del pedido.
          </p>
          <p>
            Los pedidos se procesan dentro de las primeras 24 horas hábiles luego de realizada la compra. En temporadas altas (como promociones, eventos especiales o navidad), los tiempos de entrega pueden extenderse.
          </p>
          <p>
            Una vez el pedido haya sido despachado, recibirás un número de guía para realizar el seguimiento. Es responsabilidad del cliente estar atento a la entrega y brindar datos correctos de ubicación.
          </p>
          <p>
            El costo del envío es de $20.000 para todo el país. En algunos casos se podrán aplicar costos adicionales si el destino está en zonas especiales o de difícil acceso.
          </p>
          <p>
            Si el pedido no puede ser entregado por razones imputables al cliente (como dirección incorrecta o ausencia reiterada), este deberá asumir el nuevo costo de envío.
          </p>
        </div>
      </div>
    </div>
  );
}
