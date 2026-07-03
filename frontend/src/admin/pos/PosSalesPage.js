// frontend/src/admin/pos/PosSalesPage.js

import React, { useEffect, useState } from 'react';
import StablePosPage from './PosSalesPageSafe.jsx';
import PosCustomerSelector from './PosCustomerSelector.jsx';

function getOrderNumber(order = {}) {
  return order.orderNumber || order.number || order.receiptNumber || order._id || order.id || '';
}

function PosSaleToast({ message, onClose }) {
  if (!message) return null;

  return React.createElement(
    'div',
    {
      style: {
        position: 'fixed',
        top: '96px',
        right: '32px',
        zIndex: 9999,
        maxWidth: '420px',
        border: '1px solid #bbf7d0',
        background: '#ecfdf5',
        color: '#047857',
        borderRadius: '20px',
        padding: '16px 18px',
        boxShadow: '0 18px 40px rgba(15, 23, 42, 0.18)',
        fontSize: '14px',
        fontWeight: 800,
      },
    },
    React.createElement(
      'div',
      { style: { display: 'flex', gap: '12px', alignItems: 'flex-start' } },
      React.createElement('div', { style: { fontSize: '20px', lineHeight: 1 } }, '✓'),
      React.createElement(
        'div',
        { style: { flex: 1 } },
        React.createElement('div', { style: { fontWeight: 900, marginBottom: '4px' } }, 'Venta POS confirmada'),
        React.createElement('div', null, message)
      ),
      React.createElement(
        'button',
        {
          type: 'button',
          onClick: onClose,
          style: {
            border: 0,
            background: 'transparent',
            color: '#047857',
            cursor: 'pointer',
            fontWeight: 900,
            fontSize: '16px',
          },
        },
        '×'
      )
    )
  );
}

function PosSalesPage() {
  const [message, setMessage] = useState('');

  useEffect(() => {
    let timer = null;

    const onSaleCreated = (event) => {
      const number = getOrderNumber(event?.detail?.order || {});
      setMessage(number ? `Orden ${number} creada correctamente.` : 'Venta creada correctamente.');
      window.scrollTo({ top: 0, behavior: 'smooth' });

      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(() => setMessage(''), 9000);
    };

    window.addEventListener('pos:sale-created', onSaleCreated);

    return () => {
      window.removeEventListener('pos:sale-created', onSaleCreated);
      if (timer) window.clearTimeout(timer);
    };
  }, []);

  return React.createElement(
    React.Fragment,
    null,
    React.createElement(PosCustomerSelector),
    React.createElement(StablePosPage),
    React.createElement(PosSaleToast, {
      message,
      onClose: () => setMessage(''),
    })
  );
}

export default PosSalesPage;
