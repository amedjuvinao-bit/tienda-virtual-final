// frontend/src/admin/pos/PosCustomerSelector.jsx

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertCircle, Check, Loader2, Search, UserRound, X } from 'lucide-react';
import { searchAdminCustomers } from '../api/adminCustomersApi';

const EMPTY_QUICK_CUSTOMER = {
  fullName: '',
  phone: '',
  documentType: 'CC',
  documentNumber: '',
  email: '',
};

function cleanText(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function publishCustomerSelection(state) {
  if (typeof window === 'undefined') return;
  window.__rbPosCustomerSelection = state;
  window.dispatchEvent(new CustomEvent('pos:customer-selection-changed'));
}

function findCustomerSlot() {
  if (typeof document === 'undefined') return null;

  const labels = Array.from(document.querySelectorAll('label'));
  const saleBranchLabel = labels.find((label) =>
    cleanText(label.textContent).toLowerCase() === 'sede de venta'
  );

  const configCard = saleBranchLabel?.closest('section');
  const parent = configCard?.parentElement;

  if (!configCard || !parent) return null;

  let slot = parent.querySelector(':scope > [data-pos-customer-inline-slot="true"]');

  if (!slot) {
    slot = document.createElement('div');
    slot.setAttribute('data-pos-customer-inline-slot', 'true');
    configCard.insertAdjacentElement('afterend', slot);
  }

  return slot;
}

function isCustomerError(message) {
  const text = cleanText(message).toLowerCase();

  return (
    text.includes('cliente') ||
    text.includes('correo') ||
    text.includes('celular') ||
    text.includes('email')
  );
}

function CustomerResult({ customer, onSelect }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(customer)}
      className="flex w-full items-center justify-between gap-3 rounded-2xl border p-3 text-left"
      style={{ borderColor: 'var(--admin-card-border)', background: 'var(--admin-page-bg)' }}
    >
      <div className="min-w-0">
        <p className="truncate text-sm font-black" style={{ color: 'var(--admin-card-text)' }}>
          {customer.fullName || customer.displayName || 'Cliente sin nombre'}
        </p>
        <p className="mt-1 truncate text-xs font-bold" style={{ color: 'var(--admin-card-muted-text)' }}>
          {[customer.phone, customer.email, customer.documentNumber].filter(Boolean).join(' · ') || customer.customerCode || 'Sin datos'}
        </p>
      </div>
      <span
        className="rounded-xl px-3 py-1 text-xs font-black"
        style={{ background: 'var(--admin-primary-soft-bg)', color: 'var(--admin-primary)' }}
      >
        Seleccionar
      </span>
    </button>
  );
}

function PosCustomerSelectorContent() {
  const [mode, setMode] = useState('guest');
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [validationError, setValidationError] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [quickCustomer, setQuickCustomer] = useState(EMPTY_QUICK_CUSTOMER);

  useEffect(() => {
    publishCustomerSelection({
      mode,
      selectedCustomer,
      quickCustomer,
    });
  }, [mode, selectedCustomer, quickCustomer]);

  useEffect(() => {
    const restoreSelection = (event) => {
      const selection = event?.detail || {};
      const nextMode = ['guest', 'existing', 'quick'].includes(selection.mode)
        ? selection.mode
        : 'guest';
      const nextSelected = nextMode === 'existing'
        ? selection.selectedCustomer || null
        : null;
      const nextQuick = nextMode === 'quick'
        ? { ...EMPTY_QUICK_CUSTOMER, ...(selection.quickCustomer || {}) }
        : EMPTY_QUICK_CUSTOMER;

      setMode(nextMode);
      setSelectedCustomer(nextSelected);
      setQuickCustomer(nextQuick);
      setSearchTerm(nextSelected?.fullName || nextSelected?.displayName || '');
      setResults([]);
      setError('');
      setValidationError('');
    };

    window.addEventListener('pos:restore-customer-selection', restoreSelection);
    return () => {
      window.removeEventListener('pos:restore-customer-selection', restoreSelection);
    };
  }, []);

  useEffect(() => {
    const onSaleError = (event) => {
      const message = cleanText(event?.detail?.message || '');
      if (message && isCustomerError(message)) {
        setValidationError(message);
      }
    };

    window.addEventListener('pos:sale-error', onSaleError);

    return () => {
      window.removeEventListener('pos:sale-error', onSaleError);
    };
  }, []);

  useEffect(() => {
    if (mode !== 'existing') return undefined;

    const q = cleanText(searchTerm);

    if (selectedCustomer && q === (selectedCustomer.fullName || selectedCustomer.displayName || '')) {
      return undefined;
    }

    if (q.length < 2) {
      setResults([]);
      setError('');
      return undefined;
    }

    let active = true;
    const timeout = window.setTimeout(async () => {
      try {
        setLoading(true);
        setError('');
        const data = await searchAdminCustomers(q, { limit: 8 });
        if (active) setResults(Array.isArray(data?.customers) ? data.customers : []);
      } catch (err) {
        if (active) {
          setResults([]);
          setError(err?.message || 'No fue posible buscar clientes.');
        }
      } finally {
        if (active) setLoading(false);
      }
    }, 350);

    return () => {
      active = false;
      window.clearTimeout(timeout);
    };
  }, [mode, searchTerm, selectedCustomer]);

  const changeMode = (nextMode) => {
    setMode(nextMode);
    setError('');
    setValidationError('');
    setResults([]);

    if (nextMode !== 'existing') {
      setSelectedCustomer(null);
      setSearchTerm('');
    }

    if (nextMode !== 'quick') {
      setQuickCustomer(EMPTY_QUICK_CUSTOMER);
    }
  };

  const selectCustomer = (customer) => {
    setSelectedCustomer(customer);
    setSearchTerm(customer?.fullName || customer?.displayName || '');
    setResults([]);
    setError('');
    setValidationError('');
  };

  const updateQuickCustomer = (key, value) => {
    setValidationError('');
    setQuickCustomer((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <section
      className="rounded-2xl border p-5"
      style={{
        borderColor: 'var(--admin-card-border)',
        background: 'var(--admin-card-bg)',
        boxShadow: 'var(--admin-shadow-sm, 0 8px 24px rgba(0,0,0,0.06))',
      }}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className="flex h-11 w-11 items-center justify-center rounded-2xl border"
            style={{ borderColor: 'var(--admin-primary-soft-border)', background: 'var(--admin-primary-soft-bg)', color: 'var(--admin-primary)' }}
          >
            <UserRound className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-black" style={{ color: 'var(--admin-card-text)' }}>Cliente de la venta</h2>
            <p className="mt-1 text-sm" style={{ color: 'var(--admin-card-muted-text)' }}>
              Elige consumidor final, cliente existente o crea uno rápido para esta venta POS.
            </p>
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {[
          ['guest', 'Consumidor final'],
          ['existing', 'Cliente existente'],
          ['quick', 'Crear cliente rápido'],
        ].map(([itemMode, label]) => (
          <button
            key={itemMode}
            type="button"
            onClick={() => changeMode(itemMode)}
            aria-pressed={mode === itemMode}
            className="flex items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm font-black transition-colors"
            style={{
              borderColor: mode === itemMode ? 'var(--admin-primary)' : 'var(--admin-card-border)',
              background: mode === itemMode ? 'var(--admin-primary)' : 'var(--admin-page-bg)',
              color: mode === itemMode ? 'var(--admin-primary-text)' : 'var(--admin-card-text)',
              boxShadow: mode === itemMode
                ? '0 8px 18px color-mix(in srgb, var(--admin-primary) 24%, transparent)'
                : 'none',
            }}
          >
            {mode === itemMode ? <Check className="h-4 w-4 shrink-0" aria-hidden="true" /> : null}
            <span>{label}</span>
          </button>
        ))}
      </div>

      {validationError ? (
        <div className="mt-4 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="font-black">Revisa los datos del cliente</p>
            <p className="mt-1">{validationError}</p>
          </div>
        </div>
      ) : null}

      {mode === 'existing' ? (
        <div className="mt-4 space-y-3">
          {selectedCustomer ? (
            <div className="flex items-center justify-between gap-3 rounded-2xl border p-4" style={{ borderColor: 'var(--admin-card-border)', background: 'var(--admin-page-bg)' }}>
              <div className="min-w-0">
                <p className="truncate text-sm font-black" style={{ color: 'var(--admin-card-text)' }}>{selectedCustomer.fullName || selectedCustomer.displayName}</p>
                <p className="mt-1 truncate text-xs font-bold" style={{ color: 'var(--admin-card-muted-text)' }}>{[selectedCustomer.phone, selectedCustomer.email, selectedCustomer.documentNumber].filter(Boolean).join(' · ') || 'Cliente seleccionado'}</p>
              </div>
              <button type="button" onClick={() => { setSelectedCustomer(null); setSearchTerm(''); setValidationError(''); }} className="flex h-9 w-9 items-center justify-center rounded-xl border" style={{ borderColor: 'var(--admin-card-border)', color: 'var(--admin-card-muted-text)' }}>
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : null}

          <div className="flex items-center gap-3 rounded-2xl border px-4 py-3" style={{ borderColor: 'var(--admin-card-border)', background: 'var(--admin-page-bg)' }}>
            <Search className="h-5 w-5 shrink-0" style={{ color: 'var(--admin-card-muted-text)' }} />
            <input
              type="text"
              value={searchTerm}
              onChange={(event) => { setSelectedCustomer(null); setValidationError(''); setSearchTerm(event.target.value); }}
              placeholder="Buscar cliente por nombre, celular, correo o documento"
              className="w-full bg-transparent text-sm font-semibold outline-none"
              style={{ color: 'var(--admin-card-text)' }}
            />
            {loading ? <Loader2 className="h-5 w-5 animate-spin" style={{ color: 'var(--admin-primary)' }} /> : null}
          </div>

          {error ? (
            <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
              <div>
                <p className="font-black">No se pudo buscar clientes</p>
                <p className="mt-1">{error}</p>
              </div>
            </div>
          ) : null}

          {!selectedCustomer && searchTerm.trim().length >= 2 && !loading && results.length === 0 && !error ? (
            <p className="text-sm font-bold" style={{ color: 'var(--admin-card-muted-text)' }}>No hay clientes con esa búsqueda.</p>
          ) : null}

          {!selectedCustomer && results.length > 0 ? (
            <div className="space-y-2">
              {results.map((customer) => <CustomerResult key={customer.id} customer={customer} onSelect={selectCustomer} />)}
            </div>
          ) : null}
        </div>
      ) : null}

      {mode === 'quick' ? (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <input value={quickCustomer.fullName} onChange={(event) => updateQuickCustomer('fullName', event.target.value)} placeholder="Nombre completo" className="rounded-xl border bg-transparent px-4 py-3 text-sm font-bold outline-none" style={{ borderColor: 'var(--admin-card-border)', color: 'var(--admin-card-text)', background: 'var(--admin-card-bg)' }} />
          <input value={quickCustomer.phone} onChange={(event) => updateQuickCustomer('phone', event.target.value)} placeholder="Celular" className="rounded-xl border bg-transparent px-4 py-3 text-sm font-bold outline-none" style={{ borderColor: 'var(--admin-card-border)', color: 'var(--admin-card-text)', background: 'var(--admin-card-bg)' }} />
          <div className="grid gap-3 sm:grid-cols-[110px_minmax(0,1fr)]">
            <select value={quickCustomer.documentType} onChange={(event) => updateQuickCustomer('documentType', event.target.value)} className="rounded-xl border bg-transparent px-4 py-3 text-sm font-bold outline-none" style={{ borderColor: 'var(--admin-card-border)', color: 'var(--admin-card-text)', background: 'var(--admin-card-bg)' }}>
              <option value="CC">CC</option>
              <option value="CE">CE</option>
              <option value="TI">TI</option>
              <option value="NIT">NIT</option>
              <option value="PP">PP</option>
              <option value="OTHER">Otro</option>
            </select>
            <input value={quickCustomer.documentNumber} onChange={(event) => updateQuickCustomer('documentNumber', event.target.value)} placeholder="Documento" className="rounded-xl border bg-transparent px-4 py-3 text-sm font-bold outline-none" style={{ borderColor: 'var(--admin-card-border)', color: 'var(--admin-card-text)', background: 'var(--admin-card-bg)' }} />
          </div>
          <input value={quickCustomer.email} onChange={(event) => updateQuickCustomer('email', event.target.value)} placeholder="Correo opcional" className="rounded-xl border bg-transparent px-4 py-3 text-sm font-bold outline-none" style={{ borderColor: validationError.toLowerCase().includes('correo') ? '#fecaca' : 'var(--admin-card-border)', color: 'var(--admin-card-text)', background: 'var(--admin-card-bg)' }} />
        </div>
      ) : null}
    </section>
  );
}

export default function PosCustomerSelector() {
  const [slot, setSlot] = useState(null);

  useEffect(() => {
    let active = true;

    const refresh = () => {
      if (!active) return;
      const nextSlot = findCustomerSlot();
      if (nextSlot) setSlot(nextSlot);
    };

    refresh();
    const interval = window.setInterval(refresh, 200);
    const timeout = window.setTimeout(() => window.clearInterval(interval), 3000);

    return () => {
      active = false;
      window.clearInterval(interval);
      window.clearTimeout(timeout);
    };
  }, []);

  if (!slot) return null;

  return createPortal(<PosCustomerSelectorContent />, slot);
}
