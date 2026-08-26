function money(value) {
  const number = Number(value);
  return Number.isFinite(number)
    ? Math.max(0, Math.round((number + Number.EPSILON) * 100) / 100)
    : 0;
}

export function calculateStoreCreditApplication({
  enabled,
  eligible,
  balance,
  requestedAmount,
  orderTotal,
} = {}) {
  const total = money(orderTotal);
  const available = money(balance);
  const requested = money(requestedAmount);
  const appliedAmount =
    enabled === true && eligible === true
      ? money(Math.min(requested, available, total))
      : 0;

  return {
    appliedAmount,
    amountDue: money(total - appliedAmount),
  };
}

export function buildStoreCreditOrderPayload({ amount, accessToken } = {}) {
  const appliedAmount = money(amount);
  const token = String(accessToken || '').trim();
  return appliedAmount > 0 && token
    ? { apply: true, amount: appliedAmount, accessToken: token }
    : { apply: false };
}
