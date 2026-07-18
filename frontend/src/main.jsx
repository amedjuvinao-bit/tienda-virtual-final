// src/main.jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import './admin/productFormContrast.css';
import './admin/finance/financeLayoutFix.css';

// Toastify (estilos y contenedor global)
import 'react-toastify/dist/ReactToastify.css';
import { ToastContainer } from 'react-toastify';

ReactDOM.createRoot(document.getElementById('root')).render(
  <>
    <App />
    <ToastContainer position="top-right" autoClose={3000} />
  </>
);
