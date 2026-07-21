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
import './admin/billing/billingGenerateConfirmBridge';
import './admin/billing/billingSyncBridge';
import './checkout/checkoutCouponBridge';

// Toastify (estilos y contenedor global)
import 'react-toastify/dist/ReactToastify.css';
import { ToastContainer } from 'react-toastify';

ReactDOM.createRoot(document.getElementById('root')).render(
  <>
    <App />
    <ToastContainer position="top-right" autoClose={3000} />
  </>
);
