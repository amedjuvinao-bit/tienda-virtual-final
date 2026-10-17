export function resolveWhatsAppHref(config) {
  if (!config || config.enabled === false) return '';
  const phone = String(config.phone || '').replace(/\D/g, '');
  if (!phone) return '';
  const message = String(config.message || '');
  return `https://wa.me/${phone}${message ? `?text=${encodeURIComponent(message)}` : ''}`;
}
