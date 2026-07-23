import React, { useMemo, useState } from 'react';
import api from '../../../../lib/api';

function apiError(error, fallback) {
  return error?.response?.data?.message || error?.message || fallback;
}

function formatDate(value) {
  if (!value) return 'Sin fecha informada';
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString('es-CO');
}

function rangeLabel(range = {}) {
  const prefix = range.prefix || 'Sin prefijo';
  const current = Number(range.current || 0).toLocaleString('es-CO');
  const to = Number(range.to || 0).toLocaleString('es-CO');
  return `${prefix} · actual ${current} de ${to} · vence ${formatDate(range.endDate)}`;
}

function RangeDetails({ range }) {
  if (!range) return null;

  return (
    <div className="grid gap-1 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-xs text-gray-600 md:grid-cols-2">
      <span>
        <strong className="text-gray-800">Documento:</strong>{' '}
        {range.documentName}
      </span>
      <span>
        <strong className="text-gray-800">ID Factus:</strong> {range.id}
      </span>
      <span>
        <strong className="text-gray-800">Resolución:</strong>{' '}
        {range.resolutionNumber || 'No informada'}
      </span>
      <span>
        <strong className="text-gray-800">Prefijo:</strong>{' '}
        {range.prefix || 'Sin prefijo'}
      </span>
      <span>
        <strong className="text-gray-800">Rango:</strong>{' '}
        {Number(range.from || 0).toLocaleString('es-CO')} –{' '}
        {Number(range.to || 0).toLocaleString('es-CO')}
      </span>
      <span>
        <strong className="text-gray-800">Siguiente consecutivo:</strong>{' '}
        {Number(range.current || 0).toLocaleString('es-CO')}
      </span>
      <span>
        <strong className="text-gray-800">Inicio:</strong>{' '}
        {formatDate(range.startDate)}
      </span>
      <span>
        <strong className="text-gray-800">Vencimiento:</strong>{' '}
        {formatDate(range.endDate)}
      </span>
    </div>
  );
}

function RangeSelector({ label, ranges, selectedId, onChange }) {
  const selected = useMemo(
    () => ranges.find((range) => Number(range.id) === Number(selectedId)) || null,
    [ranges, selectedId]
  );

  return (
    <div className="grid gap-2">
      <label className="text-sm font-semibold text-gray-800">{label}</label>
      <select
        value={selectedId || ''}
        onChange={(event) => onChange(Number(event.target.value || 0))}
        className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-pink-400"
      >
        <option value="">Selecciona un rango activo</option>
        {ranges.map((range) => (
          <option key={range.id} value={range.id}>
            {rangeLabel(range)}
          </option>
        ))}
      </select>
      <RangeDetails range={selected} />
    </div>
  );
}

export default function FactusNumberingRangesBlock({
  value = {},
  billing = {},
  onChange,
}) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [environment, setEnvironment] = useState('');
  const [invoiceRanges, setInvoiceRanges] = useState([]);
  const [creditNoteRanges, setCreditNoteRanges] = useState([]);
  const [invoiceRangeId, setInvoiceRangeId] = useState(
    Number(value.numberingRangeId || 0)
  );
  const [creditNoteRangeId, setCreditNoteRangeId] = useState(
    Number(value.creditNoteNumberingRangeId || 0)
  );
  const [feedback, setFeedback] = useState(null);

  const queryRanges = async () => {
    try {
      setLoading(true);
      setFeedback(null);
      const { data } = await api.post(
        '/api/dian-provider/numbering-ranges/query',
        { billing }
      );
      const invoices = Array.isArray(data.eligibleInvoiceRanges)
        ? data.eligibleInvoiceRanges
        : [];
      const creditNotes = Array.isArray(data.eligibleCreditNoteRanges)
        ? data.eligibleCreditNoteRanges
        : [];
      const storedInvoiceId = Number(
        data?.selected?.invoiceRangeId || value.numberingRangeId || 0
      );
      const storedCreditId = Number(
        data?.selected?.creditNoteRangeId ||
          value.creditNoteNumberingRangeId ||
          0
      );

      setEnvironment(data.environment || '');
      setInvoiceRanges(invoices);
      setCreditNoteRanges(creditNotes);
      setInvoiceRangeId(
        invoices.some((range) => Number(range.id) === storedInvoiceId)
          ? storedInvoiceId
          : invoices.length === 1
            ? Number(invoices[0].id)
            : 0
      );
      setCreditNoteRangeId(
        creditNotes.some((range) => Number(range.id) === storedCreditId)
          ? storedCreditId
          : creditNotes.length === 1
            ? Number(creditNotes[0].id)
            : 0
      );
      setLoaded(true);

      if (!invoices.length || !creditNotes.length) {
        setFeedback({
          type: 'error',
          message:
            'Factus no devolvió un rango vigente y disponible para facturas y otro para notas crédito en este ambiente.',
        });
      }
    } catch (error) {
      setLoaded(false);
      setFeedback({
        type: 'error',
        message: apiError(
          error,
          'No fue posible consultar los rangos oficiales de Factus.'
        ),
      });
    } finally {
      setLoading(false);
    }
  };

  const saveSelection = async () => {
    if (!(invoiceRangeId > 0) || !(creditNoteRangeId > 0)) {
      setFeedback({
        type: 'error',
        message: 'Selecciona un rango para facturas y otro para notas crédito.',
      });
      return;
    }

    try {
      setSaving(true);
      setFeedback(null);
      const { data } = await api.put('/api/dian-provider/numbering-ranges', {
        invoiceRangeId,
        creditNoteRangeId,
        billing,
      });

      if (typeof onChange === 'function' && data.dianResolution) {
        onChange(data.dianResolution);
      }
      setFeedback({
        type: 'success',
        message: data.message || 'Rangos oficiales guardados correctamente.',
      });
    } catch (error) {
      setFeedback({
        type: 'error',
        message: apiError(
          error,
          'No fue posible guardar los rangos seleccionados.'
        ),
      });
    } finally {
      setSaving(false);
    }
  };

  const storedInvoiceId = Number(value.numberingRangeId || 0);
  const storedCreditId = Number(value.creditNoteNumberingRangeId || 0);

  return (
    <div className="grid gap-4">
      <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
        Los rangos se consultan directamente en Factus. No se permiten IDs,
        consecutivos, prefijos, fechas ni claves técnicas escritos manualmente.
      </div>

      {(storedInvoiceId > 0 || storedCreditId > 0) && !loaded ? (
        <div className="grid gap-1 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <strong>Selección guardada</strong>
          <span>Rango de facturas: {storedInvoiceId || 'Pendiente'}</span>
          <span>Rango de notas crédito: {storedCreditId || 'Pendiente'}</span>
        </div>
      ) : null}

      <button
        type="button"
        onClick={queryRanges}
        disabled={loading || saving}
        className="rounded-xl border border-pink-300 bg-white px-4 py-2.5 text-sm font-semibold text-pink-600 hover:bg-pink-50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? 'Consultando Factus...' : 'Consultar rangos oficiales'}
      </button>

      {loaded ? (
        <div className="grid gap-5 rounded-2xl border border-gray-200 bg-white p-4">
          <div className="text-sm text-gray-600">
            Ambiente consultado:{' '}
            <strong className="text-gray-900">
              {environment === 'production' ? 'Producción' : 'Habilitación'}
            </strong>
          </div>

          <RangeSelector
            label="Rango para facturas electrónicas"
            ranges={invoiceRanges}
            selectedId={invoiceRangeId}
            onChange={setInvoiceRangeId}
          />

          <RangeSelector
            label="Rango para notas crédito"
            ranges={creditNoteRanges}
            selectedId={creditNoteRangeId}
            onChange={setCreditNoteRangeId}
          />

          <button
            type="button"
            onClick={saveSelection}
            disabled={
              saving ||
              loading ||
              !(invoiceRangeId > 0) ||
              !(creditNoteRangeId > 0)
            }
            className="rounded-xl bg-pink-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-pink-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? 'Validando y guardando...' : 'Guardar rangos seleccionados'}
          </button>
        </div>
      ) : null}

      {feedback ? (
        <div
          className={`rounded-xl border px-4 py-3 text-sm ${
            feedback.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-red-200 bg-red-50 text-red-800'
          }`}
        >
          {feedback.message}
        </div>
      ) : null}
    </div>
  );
}
