// Customer-facing copy follows the storefront's existing purchase/return flow.
// Commercial rates, deadlines and providers are intentionally not promised here.
export const HELP_STARTER = [
  {
    id: "pedidos",
    title: "Pedidos",
    heading: "Sobre tus pedidos",
    icon: "package",
    questions: [
      {
        id: "realizar-compra",
        question: "¿Cómo realizo una compra?",
        answer:
          "Explora el catálogo, abre el producto que te interesa y elige entre sus opciones disponibles. Añade tu selección al carrito, revisa las cantidades y continúa para completar tus datos y elegir el medio de pago.",
        actionText: "Explorar catálogo",
        actionHref: "/#categorias",
      },
      {
        id: "estado-pedido",
        question: "¿Dónde consulto el estado de mi pedido?",
        answer:
          "Conserva el número de pedido y la confirmación de tu compra. Si necesitas conocer su avance o resolver una novedad, comunícate con nuestro equipo e indica ese número para que podamos identificarla.",
        actionText: "Consultar con el equipo",
        actionHref: "/contacto",
      },
      {
        id: "modificar-pedido",
        question: "¿Puedo modificar mi pedido?",
        answer:
          "Antes de finalizar la compra puedes revisar los productos y las cantidades en el carrito, y comprobar tus datos durante el proceso de compra. Si ya finalizaste el pedido, contacta al equipo con su número para revisar tu solicitud.",
        actionText: "Contactar al equipo",
        actionHref: "/contacto",
      },
      {
        id: "guardar-favoritos",
        question: "¿Cómo guardo un producto para verlo después?",
        answer:
          "Pulsa el corazón del producto para añadirlo a tus favoritos. Puedes abrir Favoritos para volver a consultarlo. Antes de comprar, revisa el precio y las opciones disponibles en su ficha.",
        actionText: "Ver favoritos",
        actionHref: "/favoritos",
      },
    ],
  },
  {
    id: "pagos",
    title: "Pagos",
    heading: "Sobre tus pagos",
    icon: "credit-card",
    questions: [
      {
        id: "medios-pago",
        question: "¿Qué medios de pago puedo utilizar?",
        answer:
          "Los medios disponibles se muestran al finalizar la compra. Revisa las opciones que aparecen en ese momento, elige la que prefieras y sigue sus instrucciones para completar el pago.",
        actionText: "Revisar mi carrito",
        actionHref: "/carrito",
      },
      {
        id: "pago-pendiente",
        question: "¿Qué significa que mi pago está pendiente?",
        answer:
          "El pago todavía está en proceso de confirmación. Revisa el resultado de tu compra y conserva el comprobante o la referencia de la transacción. Si necesitas aclarar el estado de un cobro, contacta al equipo antes de realizar otro intento de pago.",
        actionText: "Consultar mi pago",
        actionHref: "/contacto",
      },
      {
        id: "pago-rechazado",
        question: "¿Qué hago si el pago aparece rechazado o presenta un error?",
        answer:
          "Revisa el mensaje que aparece en el resultado del pago y conserva la referencia del intento. Si observas un cobro o tienes dudas sobre lo ocurrido, comunícate con nuestro equipo e indica el número de pedido y la referencia disponible.",
        actionText: "Solicitar ayuda",
        actionHref: "/contacto",
      },
    ],
  },
  {
    id: "envios",
    title: "Envíos",
    heading: "Sobre la entrega",
    icon: "truck",
    questions: [
      {
        id: "costo-envio",
        question: "¿Dónde veo el costo del envío?",
        answer:
          "Si tu compra requiere envío físico, completa la dirección de entrega al finalizar la compra. Allí podrás revisar el costo aplicable y el total antes de confirmar tu pedido.",
        actionText: "Revisar mi carrito",
        actionHref: "/carrito",
      },
      {
        id: "destino-entrega",
        question: "¿Cómo consulto si pueden entregar en mi ubicación?",
        answer:
          "Introduce tu país, ciudad y dirección durante el proceso de compra para consultar las opciones de entrega disponibles. Si no encuentras tu ubicación o necesitas aclarar una condición de entrega, comunícate con nuestro equipo antes de completar la compra.",
        actionText: "Consultar una entrega",
        actionHref: "/contacto",
      },
      {
        id: "retiro-tienda",
        question: "¿Puedo retirar mi compra en la tienda?",
        answer:
          "Cuando el retiro esté disponible para tu compra, podrás seleccionarlo al finalizar el pedido. Consulta la dirección y el horario de atención en Contacto, y coordina con el equipo la disponibilidad de tu compra antes de desplazarte.",
        actionText: "Consultar ubicación y horarios",
        actionHref: "/contacto",
      },
      {
        id: "seguimiento-entrega",
        question: "¿Qué hago si necesito información sobre mi entrega?",
        answer:
          "Si recibiste una guía de transporte, utilízala para consultar el seguimiento con la transportadora. Para revisar una demora, una novedad o una dirección, contacta a nuestro equipo con el número de pedido y, si la tienes, la guía de envío.",
        actionText: "Consultar mi entrega",
        actionHref: "/contacto",
      },
    ],
  },
  {
    id: "cambios",
    title: "Cambios",
    heading: "Cambios y novedades",
    icon: "refresh",
    questions: [
      {
        id: "solicitar-cambio",
        question: "¿Cómo solicito un cambio o una devolución?",
        answer:
          "Cuando tu compra tenga habilitada la gestión de cambios o devoluciones, utiliza el acceso disponible en su confirmación. Allí podrás consultar los productos y las opciones disponibles para esa compra. Si no encuentras el acceso o necesitas orientación, contacta al equipo con tu número de pedido.",
        actionText: "Pedir orientación",
        actionHref: "/contacto",
      },
      {
        id: "producto-novedad",
        question:
          "¿Qué hago si recibí un producto equivocado o con una novedad?",
        answer:
          "Conserva el producto, sus accesorios y el empaque disponible. Comunícate con nuestro equipo, indica el número de pedido y describe lo ocurrido. Ten a mano fotografías que permitan revisar la novedad y orientar tu solicitud.",
        actionText: "Informar una novedad",
        actionHref: "/contacto",
      },
      {
        id: "entregar-devolucion",
        question: "¿Cómo coordino la entrega de un producto para revisión?",
        answer:
          "Después de presentar tu solicitud, sigue las instrucciones que se indiquen para tu caso. El equipo te informará cómo coordinar la entrega cuando corresponda. Conserva el número del pedido y de la solicitud para dar seguimiento al proceso.",
        actionText: "Consultar mi solicitud",
        actionHref: "/contacto",
      },
    ],
  },
];
