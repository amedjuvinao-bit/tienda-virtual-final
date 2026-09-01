import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  BadgeCheck,
  CalendarClock,
  Loader2,
  X,
} from 'lucide-react';

export const FOLLOW_UP_RESULT_OPTIONS = [
  ['resolved', 'Gestión resuelta'],
  ['payment_confirmed', 'Pago confirmado por el cliente'],
  ['promise_to_pay', 'Promesa de pago'],
  ['no_answer', 'Cliente no respondió'],
  ['customer_declined', 'Cliente rechazó la gestión'],
  ['rescheduled', 'Reprogramar contacto'],
  ['requires_follow_up', 'Requiere nuevo seguimiento'],
  ['other', 'Otro resultado'],
];

const CONTINUATION_OUTCOMES = new Set([
  'promise_to_pay',
  'no_answer',
  'rescheduled',
  'requires_follow_up',
]);

const EMPTY_RESULT = {
  outcome: '',
  outcomeNote: '',
  nextAction: '',
  dueAt: '',
};

function cleanText(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

export default function CustomerFollowUpResultModal({
  item,
  saving = false,
  onClose,
  onSubmit,
}) {
  const [form, setForm] = useState(EMPTY_RESULT);
  const [error, setError] = useState('');
  const continuesPending = CONTINUATION_OUTCOMES.has(form.outcome);

  useEffect(() => {
    setForm(EMPTY_RESULT);
    setError('');
  }, [item?.id]);

  const customerName = useMemo(
    () => item?.customer?.fullName || item?.customerName || 'Cliente',
    [item]
  );

  if (!item) return null;

  const updateField = (key, value) => {
    setError('');
    setForm((current) => ({ ...current, [key]: value }));
  };

  const submit = async (event) => {
    event.preventDefault();

    if (!form.outcome) {
      setError('Selecciona qué ocurrió en la gestión.');
      return;
    }
    if (cleanText(form.outcomeNote).length < 5) {
      setError('Describe el resultado con al menos 5 caracteres.');
      return;
    }
    if (continuesPending && cleanText(form.nextAction).length < 3) {
      setError('Indica la siguiente acción porque la gestión continuará pendiente.');
      return;
    }
    if (continuesPending && !form.dueAt) {
      setError('Programa la nueva fecha de seguimiento.');
      return;
    }

    try {
      await onSubmit?.({
        outcome: form.outcome,
        outcomeNote: cleanText(form.outcomeNote),
        nextAction: continuesPending ? cleanText(form.nextAction) : '',
        dueAt: continuesPending ? form.dueAt : null,
      });
    } catch (submitError) {
      setError(
        submitError?.message || 'No fue posible registrar el resultado.'
      );
    }
  };

  return (
    <div className="fixed inset-0 z-[180] flex items-center justify-center bg-slate-950/65 px-4 py-6 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="follow-up-result-title">
      <form onSubmit={submit} className="max-h-[92vh] w-full max-w-[660px] overflow-y-auto rounded-[30px] border bg-white p-5 shadow-2xl sm:p-7" style={{ borderColor: 'rgba(236,72,153,0.28)' }}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em]" style={{ color: 'var(--admin-primary)' }}>Cierre verificable</p>
            <h2 id="follow-up-result-title" className="mt-1 text-2xl font-black" style={{ color: 'var(--admin-card-text)' }}>Registrar resultado</h2>
            <p className="mt-2 text-sm font-bold" style={{ color: 'var(--admin-card-muted-text)' }}>{customerName} · {item.typeLabel || item.type || 'Gestión CRM'}</p>
          </div>
          <button type="button" onClick={onClose} disabled={saving} aria-label="Cerrar resultado" className="rounded-2xl border p-3 disabled:opacity-50" style={{ borderColor: 'rgba(236,72,153,0.20)' }}><X className="h-4 w-4" /></button>
        </div>

        <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold leading-relaxed text-amber-900">
          <div className="flex gap-2"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><p>Este registro documenta la gestión comercial. No aprueba pagos ni modifica Wompi, órdenes o facturas.</p></div>
        </div>

        {error ? <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">{error}</div> : null}

        <label className="mt-5 block">
          <span className="text-xs font-black uppercase tracking-[0.13em]" style={{ color: 'var(--admin-card-muted-text)' }}>¿Qué ocurrió?</span>
          <select aria-label="Resultado de la gestión" value={form.outcome} onChange={(event) => updateField('outcome', event.target.value)} className="mt-2 w-full rounded-2xl border bg-white px-4 py-3 text-sm font-bold" style={{ borderColor: 'rgba(236,72,153,0.24)' }}>
            <option value="">Seleccionar resultado</option>
            {FOLLOW_UP_RESULT_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>

        <label className="mt-4 block">
          <span className="text-xs font-black uppercase tracking-[0.13em]" style={{ color: 'var(--admin-card-muted-text)' }}>Evidencia del resultado</span>
          <textarea aria-label="Evidencia del resultado" value={form.outcomeNote} onChange={(event) => updateField('outcomeNote', event.target.value)} rows={4} placeholder="Ej: Se contactó por WhatsApp; el cliente confirmó que realizará el pago el viernes." className="mt-2 w-full resize-none rounded-2xl border px-4 py-3 text-sm font-bold outline-none" style={{ borderColor: 'rgba(236,72,153,0.24)' }} />
        </label>

        {continuesPending ? (
          <div className="mt-4 rounded-2xl border p-4" style={{ borderColor: 'rgba(236,72,153,0.18)', background: '#fff7fb' }}>
            <p className="flex items-center gap-2 text-sm font-black" style={{ color: 'var(--admin-card-text)' }}><CalendarClock className="h-4 w-4" style={{ color: 'var(--admin-primary)' }} /> La gestión continuará pendiente</p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label>
                <span className="text-xs font-black uppercase tracking-[0.12em]" style={{ color: 'var(--admin-card-muted-text)' }}>Siguiente acción</span>
                <input aria-label="Siguiente acción" value={form.nextAction} onChange={(event) => updateField('nextAction', event.target.value)} placeholder="Ej: volver a llamar" className="mt-2 w-full rounded-2xl border bg-white px-4 py-3 text-sm font-bold" style={{ borderColor: 'rgba(236,72,153,0.20)' }} />
              </label>
              <label>
                <span className="text-xs font-black uppercase tracking-[0.12em]" style={{ color: 'var(--admin-card-muted-text)' }}>Nueva fecha</span>
                <input aria-label="Nueva fecha" type="datetime-local" value={form.dueAt} onChange={(event) => updateField('dueAt', event.target.value)} className="mt-2 w-full rounded-2xl border bg-white px-4 py-3 text-sm font-bold" style={{ borderColor: 'rgba(236,72,153,0.20)' }} />
              </label>
            </div>
          </div>
        ) : null}

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} disabled={saving} className="rounded-2xl border px-5 py-3 text-sm font-black disabled:opacity-50" style={{ borderColor: 'rgba(236,72,153,0.22)', color: 'var(--admin-card-text)' }}>Cancelar</button>
          <button type="submit" disabled={saving} className="inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-black text-white disabled:opacity-50" style={{ background: 'var(--admin-primary)' }}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <BadgeCheck className="h-4 w-4" />} Guardar resultado</button>
        </div>
      </form>
    </div>
  );
}
