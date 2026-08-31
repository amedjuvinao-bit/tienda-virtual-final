// src/main.jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import './admin/productFormContrast.css';
import './admin/finance/financeLayoutFix.css';
import './admin/billing/billingDocumentsLayout.css';
import './admin/billing/billingLayoutStability.css';
import './admin/orders/electronicInvoice/electronicInvoiceModalFix.css';

// Toastify (el contenedor global se monta una sola vez dentro de App)
import 'react-toastify/dist/ReactToastify.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
);
