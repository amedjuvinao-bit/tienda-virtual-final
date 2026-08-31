import {
  getOrderBranchInfo,
  getOrderSummary,
  normalizeText,
} from './orderDetailUtils';
import { OrderDetailIcons } from './OrderDetailIcons';
import { buildOrderStory } from './orderStoryBuilder';
import { latestDate } from './orderStoryStateModel';

function sumAllocationField(allocations, field) {
  return allocations.reduce(
    (total, allocation) => total + Number(allocation?.[field] || 0),
    0
  );
}

function getInventoryOverview(order, summary) {
  const allocations = Array.isArray(order?.inventoryAllocations)
    ? order.inventoryAllocations
    : [];
  const branch = getOrderBranchInfo(order);
  const reserved = sumAllocationField(allocations, 'reservedQuantity');
  const sold = sumAllocationField(allocations, 'soldQuantity');
  const delivered = sumAllocationField(allocations, 'deliveredQuantity');
  const hasOnlyNonPhysicalItems =
    summary.items.length > 0 &&
    summary.items.every((item) => {
      const type = normalizeText(item?.productType || item?.type);
      return ['digital', 'service', 'servicio'].includes(type) || item?.requiresShipping === false;
    });
  const eventDate = latestDate(
    allocations.map((allocation) => [
      allocation?.deliveredAt,
      allocation?.shippedAt,
      allocation?.soldAt,
      allocation?.reservedAt,
      allocation?.createdAt,
    ])
  );

  if (hasOnlyNonPhysicalItems) {
    return {
      value: 'No requiere inventario físico',
      movementTitle: 'Cumplimiento sin inventario físico',
      movementDescription: 'La orden corresponde a productos digitales o servicios.',
      eventDate,
    };
  }

  if (delivered > 0) {
    return {
      value: `${delivered} unidad(es) entregada(s) desde ${branch.name}`,
      movementTitle: 'Inventario entregado',
      movementDescription: `La sede ${branch.name} confirmó ${delivered} unidad(es).`,
      eventDate,
    };
  }

  if (sold > 0) {
    return {
      value: `${sold} unidad(es) confirmada(s) en ${branch.name}`,
      movementTitle: 'Inventario vendido',
      movementDescription: `La sede ${branch.name} confirmó el inventario de la orden.`,
      eventDate,
    };
  }

  if (reserved > 0) {
    return {
      value: `Reservado en ${branch.name}`,
      movementTitle: 'Inventario reservado',
      movementDescription: `La sede ${branch.name} reservó ${reserved} unidad(es).`,
      eventDate,
    };
  }

  return {
    value: branch.hasBranch ? `Asignado a ${branch.name}` : 'Pendiente de asignación',
    movementTitle: 'Inventario pendiente',
    movementDescription: branch.hasBranch
      ? `La orden está vinculada a ${branch.name}.`
      : 'Aún no existe una sede de preparación confirmada.',
    eventDate,
  };
}

function uniqueMovements(movements) {
  const seen = new Set();

  return movements.filter((movement) => {
    const key = `${movement.title}-${movement.date ? movement.date.getTime() : 'none'}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function buildOrderOverview(order, refunds = []) {
  const story = buildOrderStory(order, refunds);
  const summary = getOrderSummary(order);
  const inventory = getInventoryOverview(order, summary);
  const paymentPhase = story.phases.find((phase) => phase.id === 'payment');
  const operationPhase = story.phases.find((phase) => phase.id === 'operation');
  const paymentComplete = paymentPhase?.state === 'complete';

  const situation = [
    {
      id: 'order',
      label: 'Pedido',
      value: `${summary.itemsCount} producto(s) · ${summary.totalItems} unidad(es)`,
      icon: OrderDetailIcons.Package,
      tone: 'primary',
    },
    {
      id: 'payment',
      label: 'Pago',
      value: paymentPhase?.title || 'Sin información de pago',
      icon: OrderDetailIcons.CircleDollarSign,
      tone: paymentPhase?.state === 'attention' ? 'danger' : paymentComplete ? 'success' : 'primary',
    },
    {
      id: 'inventory',
      label: 'Inventario',
      value: inventory.value,
      icon: OrderDetailIcons.Store,
      tone: 'primary',
    },
    {
      id: 'preparation',
      label: 'Preparación',
      value: paymentComplete
        ? operationPhase?.title || 'Pendiente de preparación'
        : 'Bloqueada hasta confirmar el pago',
      icon: OrderDetailIcons.PackageCheck,
      tone: operationPhase?.state === 'attention' ? 'danger' : 'primary',
    },
  ];

  const phaseMovements = story.phases
    .filter((phase) => phase.date && phase.state === 'complete')
    .map((phase) => ({
      id: phase.id,
      title: phase.title,
      description: phase.description,
      date: phase.date,
      icon: phase.icon,
      tone: 'success',
    }));

  const inventoryMovement = inventory.eventDate
    ? [{
        id: 'inventory',
        title: inventory.movementTitle,
        description: inventory.movementDescription,
        date: inventory.eventDate,
        icon: OrderDetailIcons.Store,
        tone: 'success',
      }]
    : [];

  const movements = uniqueMovements([...phaseMovements, ...inventoryMovement])
    .sort((left, right) => (left.date?.getTime() || 0) - (right.date?.getTime() || 0))
    .slice(-2);

  if (movements.length < 2 && story.current.title !== movements[0]?.title) {
    movements.push({
      id: 'current',
      title: story.current.title,
      description: story.current.description,
      date: null,
      icon: OrderDetailIcons.Zap,
      tone: story.current.tone,
    });
  }

  return {
    story,
    situation,
    movements,
    action: {
      title: story.next.title,
      description: story.next.description,
      label: story.next.actionLabel,
      targetTab: story.next.targetTab,
      tone: story.next.tone,
    },
  };
}
