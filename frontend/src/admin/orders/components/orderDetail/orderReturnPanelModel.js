import { ORDER_DETAIL_THEME } from './orderDetailTheme';

const STATUS_META = {
  requested: ['Solicitado', 'warning'],
  authorized: ['Autorizado', 'primary'],
  rejected: ['Rechazado', 'danger'],
  in_transit: ['En tránsito', 'primary'],
  received: ['Recibido', 'warning'],
  inspected: ['Inspeccionado', 'warning'],
  resolution_required: ['Requiere resolución', 'warning'],
  resolved: ['Resuelto', 'success'],
  cancelled: ['Cancelado', 'neutral'],
};

export const RETURN_REASONS = [
  ['wrong_size', 'Talla incorrecta'],
  ['wrong_item', 'Producto equivocado'],
  ['damaged', 'Llegó averiado'],
  ['defective', 'Defecto de fabricación'],
  ['not_as_described', 'No coincide con la descripción'],
  ['changed_mind', 'Cambio de decisión'],
  ['warranty', 'Garantía'],
  ['other', 'Otro'],
];

export const returnInputStyle = (extra = {}) => ({
  width: '100%',
  minWidth: 0,
  border: `1px solid ${ORDER_DETAIL_THEME.inputBorder}`,
  background: ORDER_DETAIL_THEME.inputBg,
  color: ORDER_DETAIL_THEME.inputText,
  borderRadius: 12,
  padding: '10px 12px',
  fontSize: 12,
  outline: 'none',
  ...extra,
});

export function returnItemId(item) {
  return String(item?.orderItemId?._id || item?.orderItemId || item?._id || '');
}

export function positiveInteger(value) {
  const number = Math.floor(Number(value));
  return Number.isFinite(number) ? Math.max(0, number) : 0;
}

export function returnStatusMeta(status) {
  return STATUS_META[status] || [status || 'Sin estado', 'neutral'];
}

export function resolutionLabel(value) {
  if (value === 'no_refund') return 'Sin reembolso';
  if (value === 'exchange') return 'Cambio';
  if (value === 'store_credit') return 'Saldo a favor';
  return 'Reembolso';
}

export function riskLevelLabel(value) {
  if (value === 'blocked') return 'crítico';
  if (value === 'high') return 'alto';
  if (value === 'medium') return 'medio';
  return 'bajo';
}

export function inspectionPayload(returnCase, draft) {
  return {
    items: (returnCase.items || []).map((item) => {
      const id = returnItemId(item);
      const values = draft?.inspections?.[id] || {};
      return {
        orderItemId: id,
        sellableQuantity: positiveInteger(
          values.sellableQuantity ?? item.receivedQuantity
        ),
        damagedQuantity: positiveInteger(values.damagedQuantity),
        quarantineQuantity: positiveInteger(values.quarantineQuantity),
        rejectedQuantity: positiveInteger(values.rejectedQuantity),
        inspectionNote: String(values.inspectionNote || '').trim(),
      };
    }),
  };
}
