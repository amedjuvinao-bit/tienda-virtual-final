// frontend/src/admin/pos/PosReceiptActions.jsx

import React, { useMemo, useState } from 'react';
import { AlertCircle, Mail, Printer, ReceiptText, Send, X } from 'lucide-react';
import {
  getPosReceipt,
  openPosReceiptPdf,
  sendPosReceiptEmail,
} from '../api/adminPosReceiptApi';

const moneyFormatter = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
});

function money(value) {
  return moneyFormatter.format(Number(value || 0));
}

function cleanText(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function formatDate(value) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('es-CO', { hour12: false });
}

function getOrderNumber(order = {}) {
  if (!order || typeof order !== 'object') return '';
  return order.orderNumber || order.number || order.receiptNumber || order._id || order.id || '';
}

function getOrderId(order = {}) {
  if (!order || typeof order !== 'object') return '';
  return order._id || order.id || order.orderId || order.orderNumber || '';
}

function Button({ children, onClick, disabled = false, variant = 'primary' }) {
  const isPrimary = variant === 'primary';

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-xs font-black transition disabled:cursor-not-allowed disabled:opacity-60"
      style={{
        borderColor: isPrimary ? 'var(--admin-primary)' : 'var(--admin-card-border)',
        background: isPrimary ? 'var(--admin-primary)' : 'var(--admin-card-bg)',
        color: isPrimary ? '#fff' : 'var(--admin-card-text)',
      }}
    >
      {children}
    </button>
  );
}

function ReceiptModal({ receipt, onClose, onPrint, onSendEmail, loadingPrint, loadingEmail }) {
  if (!receipt) return null;

  const items = Array.isArray(receipt.items) ? receipt.items : [];

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/30 p-4">
      <div
        className="max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-3xl border"
        style={{ borderColor: 'var(--admin-card-border)', background: 'var(--admin-card-bg)' }}
      >
        <div className="flex items-start justify-between gap-4 border-b p-5" style={{ borderColor: 'var(--admin-card-border)' }}>
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em]" style={{ color: 'var(--admin-card-muted-text)' }}>
              Comprobante de venta POS
            </p>
            <h2 className="mt-1 text-xl font-black" style={{ color: 'var(--admin-card-text)' }}>
              Orden {receipt.order?.orderNumber || ''}
            </h2>
            <p className="mt-1 text-sm" style={{ color: 'var(--admin-card-muted-text)' }}>
              {formatDate(receipt.order?.date)} · {receipt.branch?.name || 'Sede POS'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-xl border"
            style={{ borderColor: 'var(--admin-card-border)', color: 'var(--admin-card-muted-text)' }}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="max-h-[62vh] overflow-y-auto p-5">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-2xl border p-4" style={{ borderColor: 'var(--admin-card-border)' }}>
              <p className="text-xs font-black uppercase tracking-[0.16em]" style={{ color: 'var(--admin-card-muted-text)' }}>Cliente</p>
              <p className="mt-2 text-sm font-black" style={{ color: 'var(--admin-card-text)' }}>{receipt.customer?.name || 'Consumidor final'}</p>
              <p className="mt-1 text-xs font-bold" style={{ color: 'var(--admin-card-muted-text)' }}>
                {[receipt.customer?.phone, receipt.customer?.email, receipt.customer?.documentNumber].filter(Boolean).join(' · ') || 'Sin datos adicionales'}
              </p>
            </div>
            <div className="rounded-2xl border p-4" style={{ borderColor: 'var(--admin-card-border)' }}>
              <p className="text-xs font-black uppercase tracking-[0.16em]" style={{ color: 'var(--admin-card-muted-text)' }}>Pago</p>
              <p className="mt-2 text-sm font-black" style={{ color: 'var(--admin-card-text)' }}>{receipt.payment?.methodLabel || receipt.payment?.method || 'Pago POS'}</p>
              <p className="mt-1 text-xs font-bold" style={{ color: 'var(--admin-card-muted-text)' }}>
                Recibido {money(receipt.payment?.receivedAmount)} · Cambio {money(receipt.payment?.changeAmount)}
              </p>
            </div>
          </div>

          <div className="mt-4 overflow-hidden rounded-2xl border" style={{ borderColor: 'var(--admin-card-border)' }}>
            <div className="grid grid-cols-[minmax(0,1fr)_80px_110px] gap-3 border-b px-4 py-3 text-xs font-black uppercase tracking-[0.14em]" style={{ borderColor: 'var(--admin-card-border)', color: 'var(--admin-card-muted-text)' }}>
              <span>Producto</span>
              <span className="text-center">Cant.</span>
              <span className="text-right">Subtotal</span>
            </div>
            {items.map((item, index) => (
              <div key={`${item.title}-${index}`} className="grid grid-cols-[minmax(0,1fr)_80px_110px] gap-3 border-b px-4 py-3 text-sm last:border-b-0" style={{ borderColor: 'var(--admin-card-border)' }}>
                <div className="min-w-0">
                  <p className="truncate font-black" style={{ color: 'var(--admin-card-text)' }}>{item.title}</p>
                  <p className="mt-1 text-xs font-bold" style={{ color: 'var(--admin-card-muted-text)' }}>{[item.size, item.color].filter(Boolean).join(' / ') || 'General'} · {money(item.unitPrice)}</p>
                </div>
                <p className="text-center font-black" style={{ color: 'var(--admin-card-text)' }}>{item.quantity}</p>
                <p className="text-right font-black" style={{ color: 'var(--admin-card-text)' }}>{money(item.subtotal)}</p>
              </div>
            ))}
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_260px]">
            <div className="rounded-2xl border p-4" style={{ borderColor: 'var(--admin-card-border)' }}>
              <p className="text-xs font-black uppercase tracking-[0.16em]" style={{ color: 'var(--admin-card-muted-text)' }}>Factura electrónica</p>
              <p className="mt-2 text-sm font-bold" style={{ color: 'var(--admin-card-text)' }}>{receipt.invoice?.message || 'Pendiente'}</p>
              {receipt.invoice?.invoiceNumber ? <p className="mt-1 text-xs font-bold" style={{ color: 'var(--admin-card-muted-text)' }}>Factura: {receipt.invoice.invoiceNumber}</p> : null}
              {receipt.invoice?.cufe ? <p className="mt-1 break-all text-xs font-bold" style={{ color: 'var(--admin-card-muted-text)' }}>CUFE: {receipt.invoice.cufe}</p> : null}
            </div>
            <div className="rounded-2xl border p-4" style={{ borderColor: 'var(--admin-card-border)' }}>
              <div className="flex items-center justify-between text-sm"><span style={{ color: 'var(--admin-card-muted-text)' }}>Subtotal</span><strong>{money(receipt.totals?.subtotal)}</strong></div>
              <div className="mt-2 flex items-center justify-between text-sm"><span style={{ color: 'var(--admin-card-muted-text)' }}>Descuento</span><strong>{money(receipt.totals?.discount)}</strong></div>
              <div className="mt-2 flex items-center justify-between text-sm"><span style={{ color: 'var(--admin-card-muted-text)' }}>Impuestos</span><strong>{money(receipt.totals?.taxes)}</strong></div>
              <div className="my-3 h-px" style={{ background: 'var(--admin-card-border)' }} />
              <div className="flex items-center justify-between text-base"><span className="font-black">Total</span><strong className="text-xl" style={{ color: 'var(--admin-primary)' }}>{money(receipt.totals?.total)}</strong></div>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap justify-end gap-2 border-t p-5" style={{ borderColor: 'var(--admin-card-border)' }}>
          <Button variant="ghost" onClick={onClose}>Cerrar</Button>
          <Button variant="ghost" onClick={onPrint} disabled={loadingPrint}><Printer className="h-4 w-4" /> {loadingPrint ? 'Abriendo...' : 'Imprimir'}</Button>
          <Button onClick={onSendEmail} disabled={loadingEmail}><Send className="h-4 w-4" /> {loadingEmail ? 'Enviando...' : 'Enviar por correo'}</Button>
        </div>
      </div>
    </div>
  );
}

export default function PosReceiptActions({ sale, onClose }) {
  const [receipt, setReceipt] = useState(null);
  const [loadingReceipt, setLoadingReceipt] = useState(false);
  const [loadingPrint, setLoadingPrint] = useState(false);
  const [loadingEmail, setLoadingEmail] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [error, setError] = useState('');

  const order = sale?.order || null;
  const orderId = useMemo(() => getOrderId(order), [order]);
  const number = getOrderNumber(order);

  if (!order || !orderId) return null;

  const loadReceipt = async () => {
    try {
      setLoadingReceipt(true);
      setError('');
      const data = await getPosReceipt(orderId, { generateInvoice: true });
      setReceipt(data?.receipt || null);
    } catch (err) {
      setError(err?.message || 'No fue posible cargar el comprobante.');
    } finally {
      setLoadingReceipt(false);
    }
  };

  const printReceipt = async () => {
    try {
      setLoadingPrint(true);
      setError('');
      await openPosReceiptPdf(orderId, { generateInvoice: true });
    } catch (err) {
      setError(err?.message || 'No fue posible abrir el PDF.');
    } finally {
      setLoadingPrint(false);
    }
  };

  const emailReceipt = async () => {
    try {
      setLoadingEmail(true);
      setError('');
      setStatusMessage('');

      const defaultEmail = cleanText(receipt?.customer?.email || order?.customer?.email || order?.billing?.email || '');
      const to = defaultEmail || cleanText(window.prompt('Correo destino para enviar el comprobante:', '') || '');

      if (!to) {
        setError('Debes indicar un correo destino para enviar el comprobante.');
        return;
      }

      const data = await sendPosReceiptEmail(orderId, { to, generateInvoice: true });
      setStatusMessage(data?.message || `Comprobante enviado correctamente a ${to}.`);
    } catch (err) {
      setError(err?.message || 'No fue posible enviar el comprobante por correo.');
    } finally {
      setLoadingEmail(false);
    }
  };

  return (
    <>
      <div
        className="fixed right-8 top-24 z-[9999] w-[min(460px,calc(100vw-2rem))] rounded-3xl border p-5"
        style={{
          borderColor: '#bbf7d0',
          background: '#ecfdf5',
          color: '#047857',
          boxShadow: '0 18px 40px rgba(15, 23, 42, 0.18)',
        }}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-black">Venta POS confirmada</p>
            <p className="mt-1 text-sm font-bold">Orden {number} creada correctamente.</p>
          </div>
          <button type="button" onClick={onClose} className="font-black" style={{ color: '#047857' }}>×</button>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="ghost" onClick={loadReceipt} disabled={loadingReceipt}>
            <ReceiptText className="h-4 w-4" /> {loadingReceipt ? 'Cargando...' : 'Ver comprobante'}
          </Button>
          <Button variant="ghost" onClick={printReceipt} disabled={loadingPrint}>
            <Printer className="h-4 w-4" /> {loadingPrint ? 'Abriendo...' : 'Imprimir'}
          </Button>
          <Button onClick={emailReceipt} disabled={loadingEmail}>
            <Mail className="h-4 w-4" /> {loadingEmail ? 'Enviando...' : 'Enviar por correo'}
          </Button>
        </div>

        {statusMessage ? <p className="mt-3 rounded-xl bg-white/70 p-3 text-xs font-black text-emerald-700">{statusMessage}</p> : null}
        {error ? (
          <div className="mt-3 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-bold text-red-700">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        ) : null}
      </div>

      <ReceiptModal
        receipt={receipt}
        onClose={() => setReceipt(null)}
        onPrint={printReceipt}
        onSendEmail={emailReceipt}
        loadingPrint={loadingPrint}
        loadingEmail={loadingEmail}
      />
    </>
  );
}
