// backend/scripts/test-create-order-reservation.js

const API_URL = 'http://localhost:5000/api/orders';

async function main() {
  const payload = {
    sessionId: `test_reservation_${Date.now()}`,

    cart: [
      {
        productId: '68a4a78a59706e44cade0316',
        title: 'Vestido Girasoles Lila',
        price: 90000,
        quantity: 1,
        size: '4',
        color: 'royalblue',
        image: '',
      },
    ],

    subtotal: 90000,
    shipping: 0,
    total: 90000,

    customer: {
      name: 'Cliente',
      lastname: 'Prueba',
      id: '123456789',
      emailOrPhone: 'cliente.prueba@test.com',
      phone: '3000000000',
      address: 'Dirección de prueba',
      city: 'Santa Marta',
      country: 'Colombia',
      department: 'Magdalena',
      deliveryType: 'envio',
      wantsNewsletter: false,
    },

    billing: {
      useSameAddress: true,
    },

    payment: {
      active: true,
      provider: 'wompi',
      providerLabel: 'Wompi',
      mode: 'sandbox',
      currency: 'COP',
      checkoutLabel: 'Wompi',
      enableWebhook: true,
      status: 'pending_gateway',
    },
  };

  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': `test-${Date.now()}`,
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json();

  console.log('STATUS:', response.status);
  console.log(JSON.stringify(data, null, 2));
}

main().catch((error) => {
  console.error('ERROR EN PRUEBA:', error);
});