import React, { useMemo, useState } from 'react';
import api from '../../../../lib/api';
import {
  billingFieldClass,
  billingFieldStyle,
  billingMessageStyle,
  billingPanelStyle,
  billingPrimaryButtonStyle,
  billingSecondaryButtonStyle,
  billingSoftPanelStyle,
} from './billingTheme';

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
    <div
      className="grid gap-1 rounded-xl border px-4 py-3 text-xs md:grid-cols-2"
      style={billingSoftPanelStyle}
    >
      <span>
        <strong>Documento:</strong>{' '}
        {range.documentName}
      </span>
      <span>
        <strong>ID Factus:</strong> {range.id}
      </span>
      <span>
        <strong>Resolución:</strong>{' '}
        {range.resolutionNumber || 'No informada'}
      </span>
      <span>
        <strong>Prefijo:</strong>{' '}
        {range.prefix || 'Sin prefijo'}
      </span>
      <span>
        <strong>Rango:</strong>{' '}
        {Number(range.from || 0).toLocaleString('es-CO')} –{' '}
        {Number(range.to || 0).toLocaleString('es-CO')}
      </span>
      <span>
        <strong>Siguiente consecutivo:</strong>{' '}
        {Number(range.current || 0).toLocaleString('es-CO')}
      </span>
      <span>
        <strong>Inicio:</strong>{' '}
        {formatDate(range.startDate)}
      </span>
      <span>
        <strong>Vencimiento:</strong>{' '}
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
      <label
        className="text-sm font-semibold"
        style={{ color: 'var(--admin-card-text)' }}
      >
        {label}
      </label>
      <select
        value={selectedId || ''}
        onChange={(event) => onChange(Number(event.target.value || 0))}
        className={billingFieldClass}
        style={billingFieldStyle}
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
  onActivated,
}) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activating, setActivating] = useState(false);
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
  const [selectionSaved, setSelectionSaved] = useState(
    Number(value.numberingRangeId || 0) > 0 &&
      Number(value.creditNoteNumberingRangeId || 0) > 0
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
      const nextInvoiceId = invoices.some(
        (range) => Number(range.id) === storedInvoiceId
      )
        ? storedInvoiceId
        : invoices.length === 1
          ? Number(invoices[0].id)
          : 0;
      const nextCreditId = creditNotes.some(
        (range) => Number(range.id) === storedCreditId
      )
        ? storedCreditId
        : creditNotes.length === 1
          ? Number(creditNotes[0].id)
          : 0;

      setEnvironment(data.environment || '');
      setInvoiceRanges(invoices);
      setCreditNoteRanges(creditNotes);
      setInvoiceRangeId(nextInvoiceId);
      setCreditNoteRangeId(nextCreditId);
      setSelectionSaved(
        nextInvoiceId > 0 &&
          nextCreditId > 0 &&
          nextInvoiceId === storedInvoiceId &&
          nextCreditId === storedCreditId
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
      setSelectionSaved(false);
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
      setSelectionSaved(true);
      setFeedback({
        type: 'success',
        message: data.message || 'Rangos oficiales guardados correctamente.',
      });
    } catch (error) {
      setSelectionSaved(false);
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

  const activateProduction = async () => {
    if (environment !== 'production') {
      setFeedback({
        type: 'error',
        message:
          'La activación final solo se ejecuta con la cuenta productiva del propietario de la tienda.',
      });
      return;
    }
    if (!selectionSaved || !(invoiceRangeId > 0) || !(creditNoteRangeId > 0)) {
      setFeedback({
        type: 'error',
        message:
          'Guarda primero el rango oficial de facturas y el rango oficial de notas crédito.',
      });
      return;
    }

    try {
      setActivating(true);
      setFeedback(null);
      const candidate = {
        ...billing,
        dian: {
          ...(billing.dian || {}),
          enabled: true,
          mode: 'production',
          environment: '1',
        },
        dianResolution: {
          ...(billing.dianResolution || {}),
          ...value,
          numberingRangeId: invoiceRangeId,
          creditNoteNumberingRangeId: creditNoteRangeId,
          environment: '1',
        },
        electronicProvider: {
          ...(billing.electronicProvider || {}),
          provider: 'factus',
          numberingRangeId: invoiceRangeId,
          creditNoteNumberingRangeId: creditNoteRangeId,
        },
      };
      const { data } = await api.post(
        '/api/dian-provider/activate-production',
        {
          billing: candidate,
          invoiceRangeId,
          creditNoteRangeId,
        }
      );

      if (typeof onActivated === 'function' && data.settings) {
        onActivated(data.settings);
      }
      setFeedback({
        type: 'success',
        message:
          data.message ||
          'Facturación electrónica activada correctamente en Producción.',
      });
    } catch (error) {
      setFeedback({
        type: 'error',
        message: apiError(
          error,
          'No fue posible activar Factus en Producción.'
        ),
      });
    } finally {
      setActivating(false);
    }
  };

  const storedInvoiceId = Number(value.numberingRangeId || 0);
  const storedCreditId = Number(value.creditNoteNumberingRangeId || 0);
  const busy = loading || saving || activating;

  return (
    <div className="grid gap-4">
      <div
        className="rounded-xl border px-4 py-3 text-sm"
        style={billingMessageStyle('info')}
      >
        Los rangos se consultan directamente en Factus. No se permiten IDs,
        consecutivos, prefijos, fechas ni claves técnicas escritos manualmente.
      </div>

      {(storedInvoiceId > 0 || storedCreditId > 0) && !loaded ? (
        <div
          className="grid gap-1 rounded-xl border px-4 py-3 text-sm"
          style={billingMessageStyle('success')}
        >
          <strong>Selección guardada</strong>
          <span>Rango de facturas: {storedInvoiceId || 'Pendiente'}</span>
          <span>Rango de notas crédito: {storedCreditId || 'Pendiente'}</span>
        </div>
      ) : null}

      <button
        type="button"
        onClick={queryRanges}
        disabled={busy}
        className="rounded-xl border px-4 py-2.5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
        style={billingSecondaryButtonStyle}
      >
        {loading ? 'Consultando Factus...' : 'Consultar rangos oficiales'}
      </button>

      {loaded ? (
        <div
          className="grid gap-5 rounded-2xl border p-4"
          style={billingPanelStyle}
        >
          <div
            className="text-sm"
            style={{ color: 'var(--admin-card-muted-text)' }}
          >
            Ambiente consultado:{' '}
            <strong style={{ color: 'var(--admin-card-text)' }}>
              {environment === 'production' ? 'Producción' : 'Habilitación'}
            </strong>
          </div>

          <RangeSelector
            label="Rango para facturas electrónicas"
            ranges={invoiceRanges}
            selectedId={invoiceRangeId}
            onChange={(nextId) => {
              setInvoiceRangeId(nextId);
              setSelectionSaved(false);
              setFeedback(null);
            }}
          />

          <RangeSelector
            label="Rango para notas crédito"
            ranges={creditNoteRanges}
            selectedId={creditNoteRangeId}
            onChange={(nextId) => {
              setCreditNoteRangeId(nextId);
              setSelectionSaved(false);
              setFeedback(null);
            }}
          />

          <button
            type="button"
            onClick={saveSelection}
            disabled={
              busy ||
              !(invoiceRangeId > 0) ||
              !(creditNoteRangeId > 0)
            }
            className="rounded-xl border px-4 py-2.5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
            style={billingPrimaryButtonStyle}
          >
            {saving ? 'Validando y guardando...' : 'Guardar rangos seleccionados'}
          </button>

          {environment === 'production' ? (
            <div
              className="grid gap-3 rounded-xl border px-4 py-4 text-sm"
              style={billingMessageStyle('success')}
            >
              <div>
                <strong className="block">
                  Activación final del cliente
                </strong>
                <p className="mt-1">
                  El backend volverá a verificar la empresa, ambos rangos y el
                  correo transaccional. Esta acción no genera facturas ni notas
                  crédito.
                </p>
              </div>
              <button
                type="button"
                onClick={activateProduction}
                disabled={
                  busy ||
                  !selectionSaved ||
                  !(invoiceRangeId > 0) ||
                  !(creditNoteRangeId > 0)
                }
                className="rounded-xl border px-4 py-2.5 font-semibold disabled:cursor-not-allowed disabled:opacity-50"
                style={billingPrimaryButtonStyle}
              >
                {activating
                  ? 'Validando y activando...'
                  : 'Validar todo y activar producción'}
              </button>
            </div>
          ) : (
            <div
              className="rounded-xl border px-4 py-3 text-sm"
              style={billingMessageStyle('warning')}
            >
              La habilitación sirve para probar el módulo. La activación final
              aparecerá cuando el propietario conecte su cuenta de Producción y
              Factus devuelva los dos rangos oficiales.
            </div>
          )}
        </div>
      ) : null}

      {feedback ? (
        <div
          className="rounded-xl border px-4 py-3 text-sm"
          style={billingMessageStyle(feedback.type)}
        >
          {feedback.message}
        </div>
      ) : null}
    </div>
  );
}
