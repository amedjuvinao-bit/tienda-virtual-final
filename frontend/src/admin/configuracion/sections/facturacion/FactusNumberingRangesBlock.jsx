import React, { useMemo, useState } from 'react';
import api from '../../../../lib/api';
import {
  billingDangerButtonStyle,
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

function unavailableCreditNoteRangeMessage(ranges = []) {
  if (!ranges.length) {
    return 'Factus no devolvió ningún rango de nota crédito para esta cuenta y este ambiente.';
  }

  const reasons = new Set();
  ranges.forEach((range) => {
    if (range.active === false) reasons.add('inactivo');
    if (range.expired === true) reasons.add('vencido');
    if (range.exhausted === true) reasons.add('agotado');
  });

  return reasons.size
    ? `Factus devolvió ${ranges.length} rango(s), pero están ${Array.from(reasons).join(', ')}.`
    : 'Factus devolvió rangos de nota crédito, pero ninguno está vigente y disponible.';
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

function CreditNoteRangeConfirmation({
  open,
  environment,
  prefix,
  current,
  loading,
  onCancel,
  onConfirm,
}) {
  if (!open) return null;

  const production = environment === 'production';

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/55 p-4"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !loading) onCancel();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="credit-note-range-confirmation-title"
        className="w-full max-w-lg rounded-2xl border p-5 shadow-2xl"
        style={billingPanelStyle}
      >
        <h3
          id="credit-note-range-confirmation-title"
          className="text-lg font-bold"
        >
          Confirmar creación en Factus
        </h3>
        <p
          className="mt-2 text-sm"
          style={{ color: 'var(--admin-card-muted-text)' }}
        >
          Esta acción creará un rango fiscal en la cuenta conectada. No genera
          facturas ni notas crédito y no se puede deshacer desde esta pantalla.
        </p>

        <div
          className="mt-4 grid gap-2 rounded-xl border px-4 py-3 text-sm"
          style={production ? billingMessageStyle('error') : billingSoftPanelStyle}
        >
          <span>
            <strong>Ambiente:</strong>{' '}
            {production ? 'Producción' : 'Habilitación'}
          </span>
          <span>
            <strong>Documento:</strong> Nota crédito (22)
          </span>
          <span>
            <strong>Prefijo:</strong> {prefix}
          </span>
          <span>
            <strong>Consecutivo:</strong>{' '}
            {Number(current).toLocaleString('es-CO')}
          </span>
          {production ? (
            <strong>
              Verifica que estos datos pertenezcan al propietario real de la
              tienda antes de confirmar.
            </strong>
          ) : null}
        </div>

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="rounded-xl border px-4 py-2.5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
            style={billingSecondaryButtonStyle}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="rounded-xl border px-4 py-2.5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
            style={
              production
                ? billingDangerButtonStyle
                : billingPrimaryButtonStyle
            }
          >
            {loading
              ? 'Creando en Factus...'
              : production
                ? 'Confirmar creación en Producción'
                : 'Crear rango en Habilitación'}
          </button>
        </div>
      </div>
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
  const [creatingCreditNoteRange, setCreatingCreditNoteRange] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [environment, setEnvironment] = useState('');
  const [invoiceRanges, setInvoiceRanges] = useState([]);
  const [creditNoteRanges, setCreditNoteRanges] = useState([]);
  const [allCreditNoteRanges, setAllCreditNoteRanges] = useState([]);
  const [showCreditNoteRangeForm, setShowCreditNoteRangeForm] = useState(false);
  const [confirmCreditNoteRange, setConfirmCreditNoteRange] = useState(false);
  const [creditNoteRangeDraft, setCreditNoteRangeDraft] = useState({
    prefix: 'NC',
    current: '1',
  });
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

  const applyRangeResponse = (data = {}, preferredCreditRangeId = 0) => {
    const invoices = Array.isArray(data.eligibleInvoiceRanges)
      ? data.eligibleInvoiceRanges
      : [];
    const creditNotes = Array.isArray(data.eligibleCreditNoteRanges)
      ? data.eligibleCreditNoteRanges
      : [];
    const everyCreditNote = Array.isArray(data.creditNoteRanges)
      ? data.creditNoteRanges
      : [];
    const storedInvoiceId = Number(
      data?.selected?.invoiceRangeId || value.numberingRangeId || 0
    );
    const storedCreditId = Number(
      data?.selected?.creditNoteRangeId ||
        value.creditNoteNumberingRangeId ||
        0
    );
    const requestedCreditId = Number(preferredCreditRangeId || storedCreditId);
    const nextInvoiceId = invoices.some(
      (range) => Number(range.id) === storedInvoiceId
    )
      ? storedInvoiceId
      : invoices.length === 1
        ? Number(invoices[0].id)
        : 0;
    const nextCreditId = creditNotes.some(
      (range) => Number(range.id) === requestedCreditId
    )
      ? requestedCreditId
      : creditNotes.length === 1
        ? Number(creditNotes[0].id)
        : 0;

    setEnvironment(data.environment || '');
    setInvoiceRanges(invoices);
    setCreditNoteRanges(creditNotes);
    setAllCreditNoteRanges(everyCreditNote);
    setInvoiceRangeId(nextInvoiceId);
    setCreditNoteRangeId(nextCreditId);
    setSelectionSaved(
      nextInvoiceId > 0 &&
        nextCreditId > 0 &&
        nextInvoiceId === storedInvoiceId &&
        nextCreditId === storedCreditId
    );
    setLoaded(true);

    return {
      invoices,
      creditNotes,
      nextCreditId,
    };
  };

  const queryRanges = async () => {
    try {
      setLoading(true);
      setFeedback(null);
      const { data } = await api.post(
        '/api/dian-provider/numbering-ranges/query',
        { billing }
      );
      const { invoices, creditNotes } = applyRangeResponse(data);

      if (!invoices.length) {
        setFeedback({
          type: 'error',
          message:
            'Factus no devolvió un rango vigente y disponible para facturas en este ambiente.',
        });
      } else if (!creditNotes.length) {
        setFeedback({
          type: 'warning',
          message:
            'No hay un rango de nota crédito disponible. Puedes crearlo desde este mismo paso.',
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

  const requestCreditNoteRangeCreation = () => {
    const prefix = String(creditNoteRangeDraft.prefix || '')
      .trim()
      .toUpperCase();
    const current = String(creditNoteRangeDraft.current || '').trim();

    if (!/^[A-Z0-9]{1,4}$/.test(prefix)) {
      setFeedback({
        type: 'error',
        message:
          'El prefijo debe tener entre 1 y 4 caracteres alfanuméricos.',
      });
      return;
    }
    if (!/^\d+$/.test(current) || !(Number(current) > 0)) {
      setFeedback({
        type: 'error',
        message: 'El consecutivo debe ser un número entero mayor que cero.',
      });
      return;
    }

    setCreditNoteRangeDraft({ prefix, current });
    setFeedback(null);
    setConfirmCreditNoteRange(true);
  };

  const createCreditNoteRange = async () => {
    try {
      setCreatingCreditNoteRange(true);
      setFeedback(null);
      const { data } = await api.post(
        '/api/dian-provider/numbering-ranges/credit-note',
        {
          billing,
          prefix: creditNoteRangeDraft.prefix,
          current: Number(creditNoteRangeDraft.current),
          confirmProduction: environment === 'production',
        }
      );
      const createdId = Number(data?.createdCreditNoteRange?.id || 0);

      applyRangeResponse(data, createdId);
      setConfirmCreditNoteRange(false);
      setShowCreditNoteRangeForm(false);
      setSelectionSaved(false);
      setFeedback({
        type: 'success',
        message:
          data.message ||
          'Rango de nota crédito creado y verificado directamente en Factus. Ahora guarda la selección.',
      });
    } catch (error) {
      setConfirmCreditNoteRange(false);
      setFeedback({
        type: 'error',
        message: apiError(
          error,
          'No fue posible crear el rango de nota crédito en Factus.'
        ),
      });
    } finally {
      setCreatingCreditNoteRange(false);
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
  const busy =
    loading || saving || activating || creatingCreditNoteRange;

  return (
    <div className="grid gap-4">
      <div
        className="rounded-xl border px-4 py-3 text-sm"
        style={billingMessageStyle('info')}
      >
        Los rangos existentes se consultan directamente en Factus. Los IDs,
        fechas, resoluciones y claves técnicas nunca se escriben manualmente.
        Si falta el rango de nota crédito, este asistente puede crearlo en la
        cuenta conectada usando únicamente el prefijo y el consecutivo.
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

          {!creditNoteRanges.length ? (
            <div
              className="grid gap-3 rounded-xl border px-4 py-4 text-sm"
              style={billingMessageStyle('warning')}
            >
              <div>
                <strong className="block">
                  No hay un rango de nota crédito disponible
                </strong>
                <p className="mt-1">
                  {unavailableCreditNoteRangeMessage(allCreditNoteRanges)}
                </p>
              </div>

              {!showCreditNoteRangeForm ? (
                <button
                  type="button"
                  onClick={() => {
                    setShowCreditNoteRangeForm(true);
                    setFeedback(null);
                  }}
                  disabled={busy}
                  className="rounded-xl border px-4 py-2.5 font-semibold disabled:cursor-not-allowed disabled:opacity-50"
                  style={billingPrimaryButtonStyle}
                >
                  Crear rango de nota crédito
                </button>
              ) : (
                <div
                  className="grid gap-4 rounded-xl border p-4"
                  style={billingPanelStyle}
                >
                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="grid gap-1.5">
                      <span className="font-semibold">
                        Prefijo
                      </span>
                      <input
                        type="text"
                        value={creditNoteRangeDraft.prefix}
                        maxLength={4}
                        autoComplete="off"
                        onChange={(event) => {
                          setCreditNoteRangeDraft((current) => ({
                            ...current,
                            prefix: event.target.value
                              .replace(/[^a-zA-Z0-9]/g, '')
                              .toUpperCase()
                              .slice(0, 4),
                          }));
                          setFeedback(null);
                        }}
                        className={billingFieldClass}
                        style={billingFieldStyle}
                        placeholder="NC"
                      />
                      <small>
                        Entre 1 y 4 caracteres alfanuméricos.
                      </small>
                    </label>

                    <label className="grid gap-1.5">
                      <span className="font-semibold">
                        Consecutivo actual
                      </span>
                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={creditNoteRangeDraft.current}
                        onChange={(event) => {
                          setCreditNoteRangeDraft((current) => ({
                            ...current,
                            current: event.target.value.replace(/\D/g, ''),
                          }));
                          setFeedback(null);
                        }}
                        className={billingFieldClass}
                        style={billingFieldStyle}
                        placeholder="1"
                      />
                      <small>
                        Para un rango nuevo normalmente se utiliza 1.
                      </small>
                    </label>
                  </div>

                  <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        setShowCreditNoteRangeForm(false);
                        setFeedback(null);
                      }}
                      disabled={busy}
                      className="rounded-xl border px-4 py-2.5 font-semibold disabled:cursor-not-allowed disabled:opacity-50"
                      style={billingSecondaryButtonStyle}
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={requestCreditNoteRangeCreation}
                      disabled={busy}
                      className="rounded-xl border px-4 py-2.5 font-semibold disabled:cursor-not-allowed disabled:opacity-50"
                      style={
                        environment === 'production'
                          ? billingDangerButtonStyle
                          : billingPrimaryButtonStyle
                      }
                    >
                      Revisar y confirmar
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : null}

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

      <CreditNoteRangeConfirmation
        open={confirmCreditNoteRange}
        environment={environment}
        prefix={creditNoteRangeDraft.prefix}
        current={creditNoteRangeDraft.current}
        loading={creatingCreditNoteRange}
        onCancel={() => {
          if (!creatingCreditNoteRange) setConfirmCreditNoteRange(false);
        }}
        onConfirm={createCreditNoteRange}
      />
    </div>
  );
}
