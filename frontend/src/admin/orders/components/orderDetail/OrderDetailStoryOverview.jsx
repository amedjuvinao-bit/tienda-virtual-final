import { ORDER_DETAIL_THEME } from './orderDetailTheme';
import {
  fmtDate,
  getInvoiceInfo,
  getOrderSourceLabel,
  normalizeText,
} from './orderDetailUtils';
import { OrderDetailIcons, IconBadge } from './OrderDetailIcons';
import { OrderDetailPanel, SectionTitle } from './OrderDetailPrimitives';

const PAID_ORDER_STATUSES = new Set([
  'paid',
  'processing',
  'shipped',
  'delivered',
  'refunded',
]);

const FINAL_ORDER_STATUSES = new Set([
  'delivered',
  'refunded',
  'cancelled',
  'canceled',
  'failed',
]);

const COMPLETE_PAYMENT_WORDS = ['paid', 'approved', 'aprob', 'pagado', 'complete'];
const FAILED_WORDS = ['failed', 'rechaz', 'cancel', 'error', 'declin'];
const COMPLETE_INVOICE_WORDS = [
  'accepted',
  'acept',
  'validated',
  'valid',
  'issued',
  'emit',
  'success',
  'complet',
];

const SHIPMENT_LABELS = {
  ready_to_pick: 'Lista para iniciar picking',
  picking: 'Picking en proceso',
  picked: 'Picking completado',
  packing: 'Empaque en proceso',
  packed: 'Empaque completado',
  dispatched: 'Despachada a transportadora',
  in_transit: 'En tránsito',
  delivered: 'Entrega confirmada',
  exception: 'Incidencia logística activa',
  cancelled: 'Envío cancelado',
};

function containsAny(value, fragments) {
  const normalized = normalizeText(value);
  return fragments.some((fragment) => normalized.includes(fragment));
}

function dateValue(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function latestDate(...values) {
  return values
    .flat(Infinity)
    .map(dateValue)
    .filter(Boolean)
    .sort((left, right) => right.getTime() - left.getTime())[0] || null;
}

function phaseDate(value) {
  return value ? fmtDate(value) : 'Sin registro horario';
}

function getInvoiceRecord(order) {
  return order?.electronicInvoice || order?.invoice || order?.factusInvoice || {};
}

function getPaymentState(order) {
  const orderStatus = normalizeText(order?.status);
  const payment = order?.payment || {};
  const paymentStatus = normalizeText(payment.status);
  const failed = containsAny(paymentStatus, FAILED_WORDS) || orderStatus === 'failed';
  const complete =
    !failed &&
    (containsAny(paymentStatus, COMPLETE_PAYMENT_WORDS) ||
      PAID_ORDER_STATUSES.has(orderStatus));

  return {
    complete,
    failed,
    date: latestDate(
      payment.paidAt,
      payment.paymentDate,
      order?.paymentDetails?.paidAt,
      order?.paymentDetails?.paymentDate,
      order?.transaction?.finalized_at,
      order?.pos?.confirmedAt,
      order?.paidAt
    ),
  };
}

function getInvoiceState(order, paymentComplete) {
  const invoice = getInvoiceRecord(order);
  const info = getInvoiceInfo(order);
  const status = normalizeText(info.status);
  const failed = containsAny(status, FAILED_WORDS) || status.includes('reject');
  const hasDocument = info.number !== 'Sin número' || info.cufe !== '—';
  const complete =
    hasDocument &&
    !failed &&
    (!status || containsAny(status, COMPLETE_INVOICE_WORDS) || !status.includes('pend'));

  return {
    complete,
    failed,
    hasDocument,
    status: info.status,
    number: info.number,
    date: latestDate(
      invoice.validatedAt,
      invoice.acceptedAt,
      invoice.issuedAt,
      invoice.generatedAt,
      invoice.createdAt,
      invoice?.provider?.raw?.validated_at,
      invoice?.provider?.raw?.created_at
    ),
    pendingAfterPayment: paymentComplete && !complete,
  };
}

function getFulfillmentState(order, paymentComplete) {
  const fulfillment = order?.fulfillment || {};
  const shipments = Array.isArray(fulfillment.shipments) ? fulfillment.shipments : [];
  const digital = Array.isArray(fulfillment.digitalDeliveries)
    ? fulfillment.digitalDeliveries
    : [];
  const services = Array.isArray(fulfillment.services) ? fulfillment.services : [];
  const allocations = Array.isArray(order?.inventoryAllocations)
    ? order.inventoryAllocations
    : [];
  const orderStatus = normalizeText(order?.status);
  const source = normalizeText(order?.source);
  const logisticsStatus = normalizeText(fulfillment?.logisticsSummary?.status);
  const fulfillmentStatus = normalizeText(fulfillment.status || order?.fulfillmentStatus);
  const shipmentStatuses = shipments.map((shipment) => normalizeText(shipment?.status));
  const hasIncident =
    logisticsStatus === 'exception' ||
    Number(fulfillment?.logisticsSummary?.exceptionCount || 0) > 0 ||
    shipmentStatuses.includes('exception') ||
    shipments.some((shipment) =>
      (shipment?.incidents || []).some((incident) => !incident?.resolvedAt)
    );
  const allShipmentsDelivered =
    shipments.length > 0 && shipmentStatuses.every((status) => status === 'delivered');
  const dispatched = shipmentStatuses.some((status) =>
    ['dispatched', 'in_transit', 'delivered'].includes(status)
  );
  const activeShipment = shipments
    .slice()
    .reverse()
    .find((shipment) => shipment?.status && shipment.status !== 'delivered');
  const soldQuantity = allocations.reduce(
    (total, allocation) => total + Number(allocation?.soldQuantity || 0),
    0
  );
  const deliveredQuantity = allocations.reduce(
    (total, allocation) => total + Number(allocation?.deliveredQuantity || 0),
    0
  );
  const digitalComplete =
    digital.length > 0 &&
    digital.every((delivery) =>
      ['ready', 'delivered', 'completed', 'manual'].includes(normalizeText(delivery?.status))
    );
  const servicesComplete =
    services.length > 0 &&
    services.every((service) => normalizeText(service?.status) === 'completed');
  const isPos = source === 'pos' || normalizeText(order?.saleType).includes('pos');
  const finalDelivered = orderStatus === 'delivered' || fulfillmentStatus === 'delivered';
  const delivered =
    finalDelivered ||
    allShipmentsDelivered ||
    (soldQuantity > 0 && deliveredQuantity >= soldQuantity) ||
    ((digital.length > 0 || services.length > 0) &&
      (!digital.length || digitalComplete) &&
      (!services.length || servicesComplete));
  const hasPhysicalOperation = shipments.length > 0 || allocations.length > 0;
  const hasDigitalOrService = digital.length > 0 || services.length > 0;
  const operationComplete =
    delivered ||
    dispatched ||
    (isPos && finalDelivered) ||
    (hasDigitalOrService && digitalComplete && (!services.length || servicesComplete));
  const operationStarted =
    operationComplete ||
    hasIncident ||
    shipments.length > 0 ||
    logisticsStatus === 'ready' ||
    logisticsStatus === 'in_progress' ||
    soldQuantity > 0 ||
    ['processing', 'shipped'].includes(orderStatus);

  const operationDate = latestDate(
    shipments.map((shipment) => [
      shipment?.inTransitAt,
      shipment?.dispatchedAt,
      shipment?.packedAt,
      shipment?.pickedAt,
      shipment?.startedAt,
    ]),
    allocations.map((allocation) => [allocation?.shippedAt, allocation?.soldAt]),
    fulfillment.processedAt,
    isPos ? order?.pos?.confirmedAt : null
  );
  const deliveredAt = latestDate(
    shipments.map((shipment) => [
      shipment?.deliveredAt,
      shipment?.deliveryEvidence?.recordedAt,
    ]),
    allocations.map((allocation) => allocation?.deliveredAt),
    digital.map((delivery) => delivery?.deliveredAt),
    services.map((service) => service?.completedAt),
    order?.deliveredAt
  );

  let operationTitle = 'Preparación pendiente';
  let operationDescription = paymentComplete
    ? 'El pago permite iniciar la preparación de la orden.'
    : 'La operación comenzará cuando el pago quede confirmado.';

  if (isPos && finalDelivered) {
    operationTitle = 'Venta física completada en sede';
    operationDescription = 'La preparación y entrega se resolvieron en el punto de venta.';
  } else if (hasIncident) {
    operationTitle = 'Incidencia logística activa';
    operationDescription = 'La operación requiere revisión antes de continuar el recorrido.';
  } else if (activeShipment) {
    operationTitle = SHIPMENT_LABELS[normalizeText(activeShipment.status)] || 'Operación en curso';
    operationDescription = `El envío ${activeShipment.code || 'activo'} registra el avance más reciente.`;
  } else if (dispatched) {
    operationTitle = 'Despacho completado';
    operationDescription = 'La orden salió de la sede y continúa hacia su entrega.';
  } else if (hasDigitalOrService && operationComplete) {
    operationTitle = 'Cumplimiento completado';
    operationDescription = 'Las entregas digitales o prestaciones quedaron atendidas.';
  } else if (operationStarted) {
    operationTitle = 'Preparación habilitada';
    operationDescription = hasPhysicalOperation
      ? 'Existe inventario vendido o una operación logística en curso.'
      : 'La orden ya entró en su proceso de cumplimiento.';
  }

  return {
    delivered,
    deliveredAt,
    dispatched,
    hasIncident,
    operationComplete,
    operationStarted,
    operationDate,
    operationTitle,
    operationDescription,
    isPos,
    hasDigitalOrService,
    needsLogisticsInitialization:
      paymentComplete &&
      !isPos &&
      shipments.length === 0 &&
      soldQuantity > 0 &&
      !hasDigitalOrService,
  };
}

function storyPhase({ id, label, title, description, state, date, icon }) {
  return { id, label, title, description, state, date, icon };
}

export function buildOrderStory(order) {
  const orderStatus = normalizeText(order?.status);
  const payment = getPaymentState(order);
  const invoice = getInvoiceState(order, payment.complete);
  const fulfillment = getFulfillmentState(order, payment.complete);
  const isCancelled = ['cancelled', 'canceled'].includes(orderStatus);
  const isFailed = orderStatus === 'failed';
  const isRefunded = orderStatus === 'refunded';
  const terminalProblem = isCancelled || isFailed;

  const paymentState = payment.failed
    ? 'attention'
    : payment.complete
      ? 'complete'
      : 'current';
  const invoiceState = invoice.failed
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
      description: `Se creó por ${getOrderSourceLabel(order?.source).toLowerCase()}.`,
      state: 'complete',
      date: dateValue(order?.createdAt),
      icon: OrderDetailIcons.ShoppingBag,
    }),
    storyPhase({
      id: 'payment',
      label: '02 · Pago',
      title: payment.failed
        ? 'Pago rechazado o fallido'
        : payment.complete
          ? 'Pago confirmado'
          : 'Pago pendiente',
      description: payment.failed
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
      title: invoice.failed
        ? 'Facturación con novedad'
        : invoice.complete
          ? `Factura ${invoice.number}`
          : payment.complete
            ? 'Factura pendiente de emisión o validación'
            : 'Facturación aún no iniciada',
      description: invoice.complete
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
  } else if (isRefunded) {
    current = {
      title: 'Orden reembolsada',
      description: 'El ciclo comercial terminó con devolución del dinero.',
      tone: 'warning',
    };
    next = {
      title: 'Confirmar conciliación final',
      description: 'Comprueba el soporte del reembolso y el ajuste de inventario.',
      tone: 'warning',
    };
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
  } else if (!payment.complete) {
    next = {
      title: 'Confirmar el pago',
      description: 'La preparación y la facturación deben esperar una transacción aprobada.',
      tone: 'primary',
    };
  } else if (
    fulfillment.needsLogisticsInitialization ||
    !fulfillment.operationStarted
  ) {
    next = {
      title: 'Preparar logística',
      description: 'Crea el envío por sede usando el inventario vendido y confirmado.',
      tone: 'primary',
    };
  } else if (fulfillment.dispatched && !fulfillment.delivered) {
    next = {
      title: 'Confirmar la entrega',
      description: 'Registra la evidencia del destinatario cuando el envío llegue.',
      tone: 'primary',
    };
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
    next,
    isFinal: FINAL_ORDER_STATUSES.has(orderStatus),
  };
}

function StorySummaryCard({ eyebrow, title, description, icon, tone = 'primary' }) {
  const tones = {
    primary: { color: ORDER_DETAIL_THEME.primary, background: ORDER_DETAIL_THEME.primarySoftBg },
    success: { color: '#15803d', background: 'rgba(34, 197, 94, 0.10)' },
    warning: { color: '#b45309', background: 'rgba(245, 158, 11, 0.11)' },
    danger: { color: '#b91c1c', background: 'rgba(239, 68, 68, 0.10)' },
  };
  const currentTone = tones[tone] || tones.primary;

  return (
    <article
      data-story-card={eyebrow}
      style={{
        minWidth: 0,
        border: `1px solid ${ORDER_DETAIL_THEME.cardBorder}`,
        borderTop: `3px solid ${currentTone.color}`,
        borderRadius: 18,
        background: `linear-gradient(145deg, ${currentTone.background}, ${ORDER_DETAIL_THEME.cardBg})`,
        padding: 15,
        display: 'grid',
        gridTemplateColumns: '38px minmax(0, 1fr)',
        gap: 11,
      }}
    >
      <IconBadge icon={icon} size={38} iconSize={16} variant={tone === 'primary' ? 'primary' : tone} />
      <div style={{ minWidth: 0 }}>
        <span
          style={{
            display: 'block',
            color: currentTone.color,
            fontSize: 9,
            fontWeight: 950,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            marginBottom: 5,
          }}
        >
          {eyebrow}
        </span>
        <strong
          style={{
            display: 'block',
            color: ORDER_DETAIL_THEME.cardText,
            fontSize: 13,
            fontWeight: 950,
            lineHeight: 1.25,
          }}
        >
          {title}
        </strong>
        <p
          style={{
            margin: '6px 0 0',
            color: ORDER_DETAIL_THEME.mutedText,
            fontSize: 11,
            fontWeight: 650,
            lineHeight: 1.4,
          }}
        >
          {description}
        </p>
      </div>
    </article>
  );
}

export default function OrderDetailStoryOverview({ order }) {
  const story = buildOrderStory(order);

  return (
    <OrderDetailPanel className="order-story-panel" style={{ padding: 18 }}>
      <SectionTitle
        icon={OrderDetailIcons.History}
        title="Historia de la orden"
        subtitle="Qué ocurrió, dónde está el proceso y cuál es el siguiente paso."
      />

      <div className="order-story-summary-grid">
        <StorySummaryCard
          eyebrow="Qué pasó"
          title={story.happened.title}
          description={story.happened.description}
          icon={OrderDetailIcons.ClipboardList}
          tone="success"
        />
        <StorySummaryCard
          eyebrow="Estado actual"
          title={story.current.title}
          description={story.current.description}
          icon={story.current.tone === 'danger' ? OrderDetailIcons.AlertTriangle : OrderDetailIcons.Zap}
          tone={story.current.tone}
        />
        <StorySummaryCard
          eyebrow="Qué sigue"
          title={story.next.title}
          description={story.next.description}
          icon={OrderDetailIcons.CheckCircle2}
          tone={story.next.tone}
        />
      </div>

      <style>
        {`
          .order-story-summary-grid {
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 10px;
          }

          @media (max-width: 900px) {
            .order-story-summary-grid {
              grid-template-columns: 1fr;
            }
          }

        `}
      </style>
    </OrderDetailPanel>
  );
}
