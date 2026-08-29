const STRATEGIES = new Set(['balanced', 'cheapest', 'fastest']);
const HANDOFF_PREFERENCES = new Set(['any', 'pickup', 'dropoff']);

function normalizedText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function deliveryDays(rate = {}) {
  const estimate = normalizedText(rate.deliveryEstimate);
  if (!estimate) return null;
  if (/mismo dia|same day|hoy/.test(estimate)) return 0;
  if (/dia siguiente|next day|manana/.test(estimate)) return 1;

  const range = estimate.match(/(\d+)\s*(?:-|a)\s*(\d+)\s*d/);
  if (range) return Number(range[2]);

  const single = estimate.match(/(\d+)\s*d/);
  return single ? Number(single[1]) : null;
}

export function shippingRateKey(rate = {}) {
  const source = rate || {};
  return [
    source.carrier,
    source.service,
    source.serviceDescription,
    source.deliveryEstimate,
    Number(source.totalPrice || 0),
    source.currency || 'COP',
  ].map((value) => String(value || '').trim().toLowerCase()).join('|');
}

export function validShippingRates(rates = []) {
  return (Array.isArray(rates) ? rates : []).filter((rate) => (
    rate &&
    String(rate.carrier || '').trim() &&
    String(rate.service || '').trim() &&
    Number.isFinite(Number(rate.totalPrice)) &&
    Number(rate.totalPrice) >= 0
  ));
}

function normalizedCarrierActions(rate = {}) {
  return [...new Set((Array.isArray(rate?.carrierActions) ? rate.carrierActions : [])
    .map((action) => String(action || '').trim().toLowerCase())
    .filter(Boolean))];
}

export function shippingRateHandoff(rate = {}) {
  const actions = normalizedCarrierActions(rate);

  if (actions.includes('pickup_on_generate')) {
    return {
      key: 'pickup_on_generate',
      label: 'Recolección al crear la guía',
      description: 'Envia solicitará la recolección junto con la guía.',
      supportsDropoff: false,
      supportsPickup: true,
      tone: 'warning',
    };
  }
  if (actions.includes('pickup_mandatory')) {
    return {
      key: 'pickup_mandatory',
      label: 'Recolección obligatoria',
      description: 'Esta transportadora no admite entrega en punto.',
      supportsDropoff: false,
      supportsPickup: true,
      tone: 'warning',
    };
  }
  if (actions.includes('pickup')) {
    return {
      key: 'pickup',
      label: 'Admite recolección',
      description: 'Después de crear la guía podrás pedir recolección o llevar el paquete.',
      supportsDropoff: true,
      supportsPickup: true,
      tone: 'success',
    };
  }
  if (rate?.carrierActionsResolved === true) {
    return {
      key: 'dropoff_only',
      label: 'Solo entrega en punto',
      description: 'Envia no ofrece recolección para esta tarifa.',
      supportsDropoff: true,
      supportsPickup: false,
      tone: 'neutral',
    };
  }
  return {
    key: 'unknown',
    label: 'Forma de entrega por confirmar',
    description: 'Envia no confirmó si esta tarifa admite recolección.',
    supportsDropoff: false,
    supportsPickup: false,
    tone: 'unknown',
  };
}

export function filterShippingRatesByHandoff(rates = [], preference = 'any') {
  const safePreference = HANDOFF_PREFERENCES.has(preference) ? preference : 'any';
  const valid = validShippingRates(rates);
  if (safePreference === 'any') return valid;
  return valid.filter((rate) => {
    const handoff = shippingRateHandoff(rate);
    return safePreference === 'pickup'
      ? handoff.supportsPickup
      : handoff.supportsDropoff;
  });
}

function normalizedMetric(value, minimum, maximum, unknown = 1) {
  if (!Number.isFinite(value)) return unknown;
  if (maximum === minimum) return 0;
  return (value - minimum) / (maximum - minimum);
}

export function rankShippingRates(rates = [], strategy = 'balanced') {
  const safeStrategy = STRATEGIES.has(strategy) ? strategy : 'balanced';
  const valid = validShippingRates(rates);
  if (valid.length < 2) return valid;

  const prices = valid.map((rate) => Number(rate.totalPrice));
  const knownDays = valid.map(deliveryDays).filter(Number.isFinite);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const minDays = knownDays.length ? Math.min(...knownDays) : 0;
  const maxDays = knownDays.length ? Math.max(...knownDays) : 0;

  return valid
    .map((rate, index) => {
      const price = Number(rate.totalPrice);
      const days = deliveryDays(rate);
      const priceScore = normalizedMetric(price, minPrice, maxPrice);
      const speedScore = normalizedMetric(days, minDays, maxDays);
      const score = safeStrategy === 'cheapest'
        ? priceScore
        : safeStrategy === 'fastest'
          ? speedScore
          : (priceScore * 0.6) + (speedScore * 0.4);
      return { rate, index, score, price, days };
    })
    .sort((left, right) => (
      left.score - right.score ||
      left.price - right.price ||
      (left.days ?? Number.POSITIVE_INFINITY) - (right.days ?? Number.POSITIVE_INFINITY) ||
      left.index - right.index
    ))
    .map(({ rate }) => rate);
}

export function recommendedShippingRate(rates = [], strategy = 'balanced') {
  return rankShippingRates(rates, strategy)[0] || null;
}

export function recommendationExplanation(strategy = 'balanced') {
  if (strategy === 'cheapest') return 'Menor precio informado por Envia.';
  if (strategy === 'fastest') return 'Menor tiempo de entrega informado por Envia.';
  return 'Equilibra costo (60 %) y tiempo estimado (40 %) entre las tarifas recibidas.';
}
