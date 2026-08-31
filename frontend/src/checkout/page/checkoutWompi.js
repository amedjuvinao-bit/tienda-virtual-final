const WOMPI_WIDGET_URL = 'https://checkout.wompi.co/widget.js';

export function loadWompiWidgetScript() {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Wompi solo puede cargarse en el navegador.'));
  }
  if (typeof window.WidgetCheckout === 'function') {
    return Promise.resolve(window.WidgetCheckout);
  }

  const existing = document.querySelector(`script[src="${WOMPI_WIDGET_URL}"]`);
  if (existing) {
    return new Promise((resolve, reject) => {
      if (typeof window.WidgetCheckout === 'function') {
        resolve(window.WidgetCheckout);
        return;
      }
      const handleLoad = () => {
        if (typeof window.WidgetCheckout === 'function') {
          resolve(window.WidgetCheckout);
        } else {
          reject(
            new Error(
              'El script de Wompi cargó, pero WidgetCheckout no está disponible.'
            )
          );
        }
      };
      const handleError = () =>
        reject(new Error('No se pudo cargar el script de Wompi.'));
      existing.addEventListener('load', handleLoad, { once: true });
      existing.addEventListener('error', handleError, { once: true });
    });
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = WOMPI_WIDGET_URL;
    script.async = true;
    script.onload = () => {
      if (typeof window.WidgetCheckout === 'function') {
        resolve(window.WidgetCheckout);
      } else {
        reject(
          new Error(
            'El script de Wompi cargó, pero WidgetCheckout no quedó disponible.'
          )
        );
      }
    };
    script.onerror = () =>
      reject(new Error('No se pudo cargar el widget de Wompi.'));
    document.head.appendChild(script);
  });
}

function normalizePhoneDigits(value) {
  return String(value || '').replace(/\D+/g, '');
}

function inferPhonePrefixFromCountryCode(countryCode) {
  const safe = String(countryCode || '').trim().toUpperCase();
  if (safe === 'CO') return '+57';
  return '';
}

export function buildWompiCustomerData(customerData, selectedCountryCode) {
  const raw = customerData && typeof customerData === 'object' ? customerData : {};
  const phoneNumber = normalizePhoneDigits(raw.phone_number);
  const phonePrefix = inferPhonePrefixFromCountryCode(selectedCountryCode);
  const result = {
    email:
      typeof raw.email === 'string' && raw.email.trim()
        ? raw.email.trim()
        : undefined,
    fullName:
      typeof raw.full_name === 'string' && raw.full_name.trim()
        ? raw.full_name.trim()
        : undefined,
    legalId:
      typeof raw.legal_id === 'string' && raw.legal_id.trim()
        ? raw.legal_id.trim()
        : undefined,
    legalIdType:
      typeof raw.legal_id_type === 'string' && raw.legal_id_type.trim()
        ? raw.legal_id_type.trim()
        : undefined,
  };
  if (phoneNumber && phonePrefix) {
    result.phoneNumber = phoneNumber;
    result.phoneNumberPrefix = phonePrefix;
  }
  return Object.fromEntries(
    Object.entries(result).filter(
      ([, value]) => value !== undefined && value !== null && value !== ''
    )
  );
}

export function buildWompiShippingAddress({
  deliveryType,
  customerAddress,
  customerCity,
  customerPhone,
  selectedCountryCode,
  selectedRegion,
  customerName,
  customerLastname,
  customerPostalCode,
}) {
  if (deliveryType !== 'envio') return undefined;
  const addressLine1 = String(customerAddress || '').trim();
  const city = String(customerCity || '').trim();
  const phoneNumber = normalizePhoneDigits(customerPhone);
  const region = String(selectedRegion || '').trim();
  const country = String(selectedCountryCode || '').trim().toUpperCase() || 'CO';
  const name = [customerName, customerLastname].filter(Boolean).join(' ').trim();
  const postalCode = String(customerPostalCode || '').trim();
  if (!addressLine1 || !city || !phoneNumber || !region || !country) {
    return undefined;
  }
  const shippingAddress = {
    addressLine1,
    city,
    phoneNumber,
    region,
    country,
  };
  if (name) shippingAddress.name = name;
  if (postalCode) shippingAddress.postalCode = postalCode;
  return shippingAddress;
}
