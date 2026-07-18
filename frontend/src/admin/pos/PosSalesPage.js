// frontend/src/admin/pos/PosSalesPage.js

import React, { useEffect, useState } from 'react';
import StablePosPage from './PosSalesPageSafe.jsx';
import PosCustomerSelector from './PosCustomerSelector.jsx';
import PosReceiptActions from './PosReceiptActions.jsx';

function PosSalesPage() {
  const [lastSale, setLastSale] = useState(null);

  useEffect(() => {
    const onSaleCreated = (event) => {
      setLastSale(event?.detail || null);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    window.addEventListener('pos:sale-created', onSaleCreated);

    return () => {
      window.removeEventListener('pos:sale-created', onSaleCreated);
    };
  }, []);

  return React.createElement(
    React.Fragment,
    null,
    React.createElement(PosCustomerSelector),
    React.createElement(PosReceiptActions, {
      sale: lastSale,
      onClose: () => setLastSale(null),
    }),
    React.createElement(StablePosPage)
  );
}

export default PosSalesPage;
