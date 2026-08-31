import {
  getOrderExchangeInfo,
  getOrderSourceLabel,
  normalizeText,
} from './orderDetailUtils';
import { OrderDetailIcons } from './OrderDetailIcons';
import {
  dateValue,
  getFulfillmentState,
  getInvoiceState,
  getPaymentState,
  isRefundReconciliationComplete,
  phaseDate,
} from './orderStoryStateModel';

const FINAL_ORDER_STATUSES = new Set([
  'delivered',
  'refunded',
  'cancelled',
  'canceled',
  'failed',
]);

function storyPhase({ id, label, title, description, state, date, icon }) {
  return { id, label, title, description, state, date, icon };
}

export function buildOrderStory(order, refunds = []) {
  const orderStatus = normalizeText(order?.status);
  const exchange = getOrderExchangeInfo(order);
  const payment = getPaymentState(order);
  const invoice = getInvoiceState(order, payment.complete);
  const fulfillment = getFulfillmentState(order, payment.complete);
  const isCancelled = ['cancelled', 'canceled'].includes(orderStatus);
  const isFailed = orderStatus === 'failed';
  const isRefunded = orderStatus === 'refunded';
  const refundReconciliationComplete = isRefundReconciliationComplete(refunds);
  const terminalProblem = isCancelled || isFailed;

  const paymentState = payment.failed
    ? 'attention'
    : payment.complete
      ? 'complete'
      : 'current';
  const invoiceState = exchange.noCharge
    ? 'skipped'
    : invoice.failed
    ? 'attention'
    : invoice.complete
      ? 'complete'
      : invoice.pendingAfterPayment
        ? 'current'
        : 'pending';
  const operationState = fulfillment.hasIncident
    ? 'attention'
    : fulfillment.operationComplete
      ? 'complete'
      : fulfillment.operationStarted
        ? 'current'
        : terminalProblem
          ? 'skipped'
          : 'pending';
  const deliveryState = fulfillment.delivered
    ? 'complete'
    : fulfillment.dispatched
      ? 'current'
      : terminalProblem
        ? 'skipped'
        : 'pending';

  const phases = [
    storyPhase({
      id: 'received',
      label: '01 · Pedido',
      title: 'Orden recibida',
      description: exchange.isExchange
        ? `Se creó como reemplazo desde ${exchange.returnNumber || 'un RMA'}.`
        : `Se creó por ${getOrderSourceLabel(order?.source).toLowerCase()}.`,
      state: 'complete',
      date: dateValue(order?.createdAt),
      icon: OrderDetailIcons.ShoppingBag,
    }),
    storyPhase({
      id: 'payment',
      label: '02 · Pago',
      title: exchange.noCharge
        ? 'Cambio sin cobro confirmado'
        : payment.failed
        ? 'Pago rechazado o fallido'
        : payment.complete
          ? 'Pago confirmado'
          : 'Pago pendiente',
      description: exchange.noCharge
        ? 'Esta reposición no genera un nuevo recaudo al cliente.'
        : payment.failed
        ? 'La transacción requiere revisión antes de continuar.'
        : payment.complete
          ? 'La operación comercial quedó habilitada.'
          : 'La orden espera la confirmación de la transacción.',
      state: paymentState,
      date: payment.date,
      icon: OrderDetailIcons.CreditCard,
    }),
    storyPhase({
      id: 'invoice',
      label: '03 · Factura',
      title: exchange.noCharge
        ? 'No requiere una nueva factura'
        : invoice.failed
        ? 'Facturación con novedad'
        : invoice.complete
          ? `Factura ${invoice.number}`
          : payment.complete
            ? 'Factura pendiente de emisión o validación'
            : 'Facturación aún no iniciada',
      description: exchange.noCharge
        ? `La trazabilidad fiscal permanece en la venta original y ${exchange.returnNumber || 'su RMA'}.`
        : invoice.complete
        ? 'El documento fiscal está disponible para consulta.'
        : invoice.failed
          ? `Estado reportado: ${invoice.status}.`
          : 'Se completará después de confirmar el pago y los datos fiscales.',
      state: invoiceState,
      date: invoice.date,
      icon: OrderDetailIcons.ReceiptText,
    }),
    storyPhase({
      id: 'operation',
      label: '04 · Operación',
      title: fulfillment.operationTitle,
      description: fulfillment.operationDescription,
      state: operationState,
      date: fulfillment.operationDate,
      icon: fulfillment.hasDigitalOrService
        ? OrderDetailIcons.Zap
        : OrderDetailIcons.PackageCheck,
    }),
    storyPhase({
      id: 'delivery',
      label: '05 · Entrega',
      title: fulfillment.delivered
        ? 'Entrega confirmada'
        : fulfillment.dispatched
          ? 'Entrega en curso'
          : terminalProblem
            ? 'Entrega no realizada'
            : 'Entrega pendiente',
      description: fulfillment.delivered
        ? 'El recorrido operativo terminó correctamente.'
        : fulfillment.dispatched
          ? 'La orden se encuentra camino al destino final.'
          : terminalProblem
            ? 'El cierre de la orden detuvo el proceso de entrega.'
            : 'Se habilitará al finalizar la preparación o prestación.',
      state: deliveryState,
      date: fulfillment.deliveredAt,
      icon: OrderDetailIcons.Truck,
    }),
  ];

  const completedPhases = phases.filter((phase) => phase.state === 'complete');
  const lastCompleted = completedPhases[completedPhases.length - 1] || phases[0];
  const activePhase = phases.find((phase) =>
    ['attention', 'current'].includes(phase.state)
  );

  let current = {
    title: activePhase?.title || lastCompleted.title,
    description: activePhase?.description || 'La orden no tiene novedades operativas pendientes.',
    tone: activePhase?.state === 'attention' ? 'danger' : 'primary',
  };
  let next = {
    title: 'Continuar con la etapa activa',
    description: activePhase?.description || 'Revisa la etapa actual para completar el recorrido.',
    tone: 'primary',
  };
  let actionTarget = 'operation';
  let actionLabel = 'Revisar etapa';

  if (fulfillment.hasIncident) {
    current = {
      title: 'Operación con incidencia',
      description: 'Hay una novedad logística que requiere atención administrativa.',
      tone: 'danger',
    };
    next = {
      title: 'Resolver la incidencia',
      description: 'Abre el centro logístico, registra la solución y reanuda el envío.',
      tone: 'danger',
    };
    actionTarget = 'operation';
    actionLabel = 'Resolver incidencia';
  } else if (isCancelled) {
    current = {
      title: 'Orden cancelada',
      description: 'El recorrido comercial fue detenido y no debe continuar a entrega.',
      tone: 'danger',
    };
    next = {
      title: 'Verificar el cierre administrativo',
      description: 'Comprueba inventario, pago, factura y posibles devoluciones.',
      tone: 'warning',
    };
    actionTarget = 'payment';
    actionLabel = 'Revisar cierre';
  } else if (isFailed) {
    current = {
      title: 'Orden fallida',
      description: 'La transacción no completó el recorrido esperado.',
      tone: 'danger',
    };
    next = {
      title: 'Revisar pago y trazabilidad',
      description: 'Valida el motivo del fallo antes de reintentar o cerrar la orden.',
      tone: 'danger',
    };
    actionTarget = 'payment';
    actionLabel = 'Revisar pago';
  } else if (isRefunded) {
    current = {
      title: 'Orden reembolsada',
      description: 'El ciclo comercial terminó con devolución del dinero.',
      tone: 'warning',
    };
    next = refundReconciliationComplete
      ? {
          title: 'Conciliación completada',
          description: 'Inventario, dinero y documento fiscal quedaron conciliados; no hay acciones pendientes.',
          tone: 'success',
        }
      : {
          title: 'Confirmar conciliación final',
          description: 'Comprueba el soporte del reembolso y el ajuste de inventario.',
          tone: 'warning',
        };
    actionTarget = 'payment';
    actionLabel = refundReconciliationComplete ? 'Ver trazabilidad' : 'Ver conciliación';
  } else if (exchange.noCharge && fulfillment.delivered) {
    current = {
      title: 'Cambio entregado',
      description: 'La reposición sin cobro completó su recorrido operativo.',
      tone: 'success',
    };
    next = {
      title: 'Sin operación pendiente',
      description: `La venta original conserva la factura y ${exchange.returnNumber || 'el RMA'} conserva la trazabilidad del cambio.`,
      tone: 'success',
    };
    actionTarget = 'customer';
    actionLabel = 'Ver historial';
  } else if (fulfillment.delivered && invoice.complete) {
    current = {
      title: 'Proceso completado',
      description: 'Pago, documento fiscal y entrega están registrados.',
      tone: 'success',
    };
    next = {
      title: 'Sin operación pendiente',
      description: 'Puedes consultar PDF, factura, notas o gestionar una devolución.',
      tone: 'success',
    };
    actionTarget = 'customer';
    actionLabel = 'Ver historial';
  } else if (fulfillment.delivered && !invoice.complete) {
    current = {
      title: 'Entrega completada con facturación pendiente',
      description: 'La entrega terminó, pero falta emitir o validar el documento fiscal.',
      tone: 'warning',
    };
    next = {
      title: 'Completar facturación',
      description: 'Revisa los datos fiscales y finaliza la emisión de la factura.',
      tone: 'warning',
    };
    actionTarget = 'payment';
    actionLabel = 'Revisar factura';
  } else if (!payment.complete) {
    next = {
      title: 'Confirmar el pago',
      description: 'La preparación y la facturación deben esperar una transacción aprobada.',
      tone: 'primary',
    };
    actionTarget = 'payment';
    actionLabel = 'Revisar pago';
  } else if (
    fulfillment.needsLogisticsInitialization ||
    !fulfillment.operationStarted
  ) {
    next = {
      title: 'Preparar logística',
      description: 'Crea el envío por sede usando el inventario vendido y confirmado.',
      tone: 'primary',
    };
    actionTarget = 'operation';
    actionLabel = 'Preparar logística';
  } else if (fulfillment.dispatched && !fulfillment.delivered) {
    next = {
      title: 'Confirmar la entrega',
      description: 'Registra la evidencia del destinatario cuando el envío llegue.',
      tone: 'primary',
    };
    actionTarget = 'operation';
    actionLabel = 'Abrir operación';
  }

  return {
    phases,
    happened: {
      title: lastCompleted.title,
      description: lastCompleted.date
        ? `Último hito confirmado: ${phaseDate(lastCompleted.date)}.`
        : lastCompleted.description,
    },
    current,
    next: {
      ...next,
      targetTab: actionTarget,
      actionLabel,
    },
    isFinal: FINAL_ORDER_STATUSES.has(orderStatus),
  };
}
