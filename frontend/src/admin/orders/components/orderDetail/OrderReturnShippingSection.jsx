import { ORDER_DETAIL_THEME } from './orderDetailTheme';
import { GhostButton, PrimaryButton, SoftBadge } from './OrderDetailPrimitives';
import { returnInputStyle } from './orderReturnPanelModel';
import { toCOP } from './orderDetailUtils';

function idValue(value) {
  return String(value?._id || value || '');
}

function rateKey(rate = {}) {
  return [rate.carrier, rate.service, rate.totalPrice, rate.currency].join('|');
}

function validPackage(item = {}) {
  return ['weightGrams', 'lengthCm', 'widthCm', 'heightCm']
    .every((field) => Number(item[field]) > 0);
}

export default function OrderReturnShippingSection({
  busy,
  destinations = [],
  draft,
  id,
  onShipping,
  policy,
  providers = {},
  returnCase,
  setDraft,
}) {
  const shipping = returnCase.shipping || {};
  const integration = shipping.integration || {};
  const envia = providers.envia || {};
  const selectedDestinationId = String(
    draft.returnDestinationBranchId ||
    shipping.destinationBranch ||
    destinations[0]?._id ||
    ''
  );
  const destination = destinations.find(
    (item) => idValue(item) === selectedDestinationId
  ) || destinations[0] || null;
  const packageValue = draft.returnPackage ||
    shipping.packages?.[0] ||
    destination?.defaultPackages?.[0] ||
    {};
  const packages = [{
    code: `RET-${returnCase.returnNumber || 'RMA'}`,
    weightGrams: Number(packageValue.weightGrams || 0),
    lengthCm: Number(packageValue.lengthCm || 0),
    widthCm: Number(packageValue.widthCm || 0),
    heightCm: Number(packageValue.heightCm || 0),
  }];
  const rates = Array.isArray(draft.returnRates) ? draft.returnRates : [];
  const selectedRate = rates.find(
    (rate) => rateKey(rate) === draft.returnSelectedRateKey
  ) || null;
  const pickupOnGenerate = (selectedRate?.carrierActions || [])
    .includes('pickup_on_generate');
  const payer = returnCase.policySnapshot?.returnShippingPaidBy ||
    policy.returnShippingPaidBy ||
    'case_by_case';
  const activeLabel = Boolean(
    shipping.labelUrl && integration.status !== 'cancelled'
  );
  const carrierDelivered = Boolean(
    shipping.carrierDeliveredAt || shipping.awaitingWarehouseReceipt
  );
  const pickupCommitted = integration.handoffMode === 'pickup' &&
    ['scheduled', 'completed'].includes(integration.pickup?.status);
  const dropoffCommitted = integration.handoffMode === 'dropoff';
  const canAutomate = envia.enabled === true;

  const patchPackage = (field, value) => {
    setDraft(id, {
      returnPackage: {
        ...packageValue,
        [field]: Math.max(0, Number(value || 0)),
      },
    });
  };

  const quote = async () => {
    try {
      const result = await onShipping?.(returnCase, 'quote', {
        destinationBranchId: selectedDestinationId,
        packages,
      });
      const nextRates = Array.isArray(result?.rates) ? result.rates : [];
      setDraft(id, {
        returnRates: nextRates,
        returnSelectedRateKey: nextRates[0] ? rateKey(nextRates[0]) : '',
      });
    } catch {
      // El hook presenta el error con el detalle seguro enviado por el backend.
    }
  };

  const productionConfirmation = (message) => (
    envia.mode !== 'production' || window.confirm(message)
  );

  const generateLabel = async () => {
    if (!selectedRate) return;
    if (!productionConfirmation('Envia Producción consumirá saldo real. ¿Generar esta guía RMA?')) return;
    try {
      await onShipping?.(returnCase, 'label', {
        destinationBranchId: selectedDestinationId,
        packages,
        rate: selectedRate,
        pickupDate: draft.returnPickupDate || '',
        pickupInstructions: draft.returnPickupInstructions || '',
        confirmStorePaidShipping: payer === 'store' || draft.confirmStorePaidShipping === true,
        confirmProductionCharge: envia.mode === 'production',
      });
    } catch {
      // El hook conserva la misma clave idempotente para un reintento seguro.
    }
  };

  const run = async (action, payload = {}) => {
    if (!productionConfirmation(
      action === 'cancel_label'
        ? '¿Cancelar esta guía real en Envia Producción?'
        : '¿Confirmar esta operación real en Envia Producción?'
    )) return;
    try {
      await onShipping?.(returnCase, action, {
        ...payload,
        confirmProductionCharge: envia.mode === 'production',
      });
    } catch {
      // El hook muestra el error y mantiene la operación recuperable.
    }
  };

  return (
    <section style={{ marginTop: 12, padding: 12, borderRadius: 15, border: `1px solid ${ORDER_DETAIL_THEME.cardBorder}`, background: ORDER_DETAIL_THEME.cardBg }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
        <div>
          <strong style={{ display: 'block', fontSize: 12 }}>Logística inversa automática</strong>
          <span style={{ color: ORDER_DETAIL_THEME.mutedText, fontSize: 9 }}>
            Cliente → sede receptora, con guía y seguimiento separados del despacho de venta.
          </span>
        </div>
        <SoftBadge variant={canAutomate ? 'success' : 'warning'}>
          {canAutomate ? `Envia ${envia.mode === 'production' ? 'Producción' : 'Sandbox'}` : 'Envia no activo'}
        </SoftBadge>
      </div>

      {!canAutomate ? (
        <p style={{ margin: '9px 0 0', color: ORDER_DETAIL_THEME.warning, fontSize: 10 }}>
          Activa y verifica Envia desde Configuración → Envíos para cotizar sin usar datos simulados.
        </p>
      ) : null}

      {activeLabel ? (
        <div style={{ marginTop: 10, padding: 10, borderRadius: 13, border: `1px solid ${ORDER_DETAIL_THEME.success}`, background: ORDER_DETAIL_THEME.inputBg }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
            <div>
              <strong style={{ display: 'block', fontSize: 11 }}>{shipping.carrierName} · {shipping.trackingNumber}</strong>
              <span style={{ color: ORDER_DETAIL_THEME.mutedText, fontSize: 9 }}>
                {shipping.awaitingWarehouseReceipt
                  ? 'La transportadora reportó llegada; falta confirmar las unidades físicas.'
                  : integration.providerStatusDescription || 'Guía activa y conciliada.'}
              </span>
            </div>
            <a href={shipping.labelUrl} target="_blank" rel="noreferrer" style={{ color: ORDER_DETAIL_THEME.accent, fontSize: 10, fontWeight: 850 }}>
              Descargar etiqueta
            </a>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginTop: 9 }}>
            <GhostButton disabled={busy} onClick={() => run('track')}>Actualizar seguimiento</GhostButton>
            {!pickupCommitted && !carrierDelivered ? (
              <GhostButton disabled={busy || dropoffCommitted} onClick={() => run('dropoff')}>
                {dropoffCommitted ? 'Entrega en punto confirmada' : 'Entrega en punto'}
              </GhostButton>
            ) : null}
            {!carrierDelivered ? (
              <GhostButton disabled={busy} onClick={() => run('cancel_label')}>Cancelar guía</GhostButton>
            ) : null}
          </div>
          {!pickupCommitted && !dropoffCommitted && !carrierDelivered ? (
            <div className="order-return-form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: 7, marginTop: 8 }}>
              <input aria-label={`Fecha recolección ${returnCase.returnNumber}`} type="date" value={draft.returnPickupDate || ''} onChange={(event) => setDraft(id, { returnPickupDate: event.target.value })} style={returnInputStyle()} />
              <input aria-label={`Hora inicial recolección ${returnCase.returnNumber}`} type="time" value={draft.returnPickupTimeStart || ''} onChange={(event) => setDraft(id, { returnPickupTimeStart: event.target.value })} style={returnInputStyle()} />
              <input aria-label={`Hora final recolección ${returnCase.returnNumber}`} type="time" value={draft.returnPickupTimeEnd || ''} onChange={(event) => setDraft(id, { returnPickupTimeEnd: event.target.value })} style={returnInputStyle()} />
              <GhostButton disabled={busy || !draft.returnPickupDate || !draft.returnPickupTimeStart || !draft.returnPickupTimeEnd} onClick={() => run('pickup', {
                destinationBranchId: selectedDestinationId,
                pickupDate: draft.returnPickupDate,
                pickupTimeStart: draft.returnPickupTimeStart,
                pickupTimeEnd: draft.returnPickupTimeEnd,
                pickupInstructions: draft.returnPickupInstructions || '',
              })}>Solicitar recolección</GhostButton>
            </div>
          ) : null}
        </div>
      ) : (
        <>
          <div className="order-return-form-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(170px, 1.4fr) repeat(4, minmax(90px, .7fr))', gap: 7, marginTop: 10 }}>
            <select aria-label={`Sede receptora ${returnCase.returnNumber}`} value={selectedDestinationId} onChange={(event) => setDraft(id, { returnDestinationBranchId: event.target.value, returnRates: [], returnSelectedRateKey: '' })} style={returnInputStyle()}>
              {destinations.map((item) => <option key={idValue(item)} value={idValue(item)}>{item.name} · {item.code}</option>)}
            </select>
            {[
              ['weightGrams', 'Peso (g)'],
              ['lengthCm', 'Largo (cm)'],
              ['widthCm', 'Ancho (cm)'],
              ['heightCm', 'Alto (cm)'],
            ].map(([field, label]) => (
              <input key={field} aria-label={`${label} ${returnCase.returnNumber}`} type="number" min="0.01" step="0.01" value={packageValue[field] || ''} onChange={(event) => patchPackage(field, event.target.value)} placeholder={label} style={returnInputStyle()} />
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
            <GhostButton disabled={busy || !canAutomate || !selectedDestinationId || !validPackage(packages[0])} onClick={quote}>Cotizar devolución</GhostButton>
          </div>
          {rates.length ? (
            <div style={{ display: 'grid', gap: 7, marginTop: 9 }}>
              {rates.map((rate) => (
                <label key={rateKey(rate)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: 9, borderRadius: 12, border: `1px solid ${rateKey(rate) === draft.returnSelectedRateKey ? ORDER_DETAIL_THEME.accent : ORDER_DETAIL_THEME.cardBorder}` }}>
                  <span style={{ fontSize: 10 }}>
                    <input type="radio" name={`return-rate-${id}`} checked={rateKey(rate) === draft.returnSelectedRateKey} onChange={() => setDraft(id, { returnSelectedRateKey: rateKey(rate) })} />{' '}
                    <strong>{rate.carrier}</strong> · {rate.serviceDescription || rate.service}
                  </span>
                  <strong style={{ fontSize: 11 }}>{toCOP(rate.totalPrice)}</strong>
                </label>
              ))}
              {payer === 'customer' ? (
                <p style={{ margin: 0, color: ORDER_DETAIL_THEME.warning, fontSize: 10 }}>
                  La política asigna este costo al cliente; la tienda no puede emitir una guía pagada.
                </p>
              ) : null}
              {payer === 'case_by_case' ? (
                <label style={{ color: ORDER_DETAIL_THEME.mutedText, fontSize: 10 }}>
                  <input type="checkbox" checked={draft.confirmStorePaidShipping === true} onChange={(event) => setDraft(id, { confirmStorePaidShipping: event.target.checked })} />{' '}
                  Confirmo que la tienda asumirá el costo de esta devolución.
                </label>
              ) : null}
              {pickupOnGenerate ? (
                <label style={{ color: ORDER_DETAIL_THEME.mutedText, fontSize: 10 }}>
                  Fecha obligatoria de recolección
                  <input aria-label={`Fecha recolección al generar ${returnCase.returnNumber}`} type="date" value={draft.returnPickupDate || ''} onChange={(event) => setDraft(id, { returnPickupDate: event.target.value })} style={returnInputStyle({ marginTop: 5 })} />
                </label>
              ) : null}
              <PrimaryButton disabled={busy || !selectedRate || payer === 'customer' || (payer === 'case_by_case' && draft.confirmStorePaidShipping !== true) || (pickupOnGenerate && !draft.returnPickupDate)} onClick={generateLabel}>
                Generar guía RMA {envia.mode === 'production' ? 'real' : 'Sandbox'}
              </PrimaryButton>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
