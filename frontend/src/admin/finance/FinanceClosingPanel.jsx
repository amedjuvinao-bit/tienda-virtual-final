import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileCheck2,
  Fingerprint,
  ArrowLeft,
  ArrowRight,
  Loader2,
  RefreshCw,
  ShieldAlert,
  X,
  XCircle,
} from 'lucide-react';
import { toast } from 'react-toastify';

import {
  certifyFinancePeriod,
  exportFinanceClosingCsv,
  getFinanceClosingControl,
} from './api/financeApi';
import './financeClosingPanel.css';

function currentPeriodKey() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function money(value) {
  return Number(value || 0).toLocaleString('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  });
}

function createRequestKey() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `finance-close-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

function errorMessage(error, fallback) {
  return error?.response?.data?.message || error?.userMessage || error?.message || fallback;
}

function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

const STATUS_META = {
  ready: { label: 'Listo para certificar', icon: CheckCircle2 },
  attention: { label: 'Requiere seguimiento', icon: AlertTriangle },
  blocked: { label: 'Con diferencias críticas', icon: XCircle },
};

const CLOSING_STEPS = [
  { key: 'summary', label: 'Resumen', hint: 'Situación del periodo' },
  { key: 'checks', label: 'Revisar', hint: 'Controles financieros' },
  { key: 'resolve', label: 'Resolver', hint: 'Alertas y diferencias' },
  { key: 'certify', label: 'Certificar', hint: 'Huella e informe' },
];

const CONTROL_ACTIONS = {
  open_cash_sessions: { label: 'Ir a Caja', href: '/admin/caja' },
  cash_difference: { label: 'Revisar Caja', href: '/admin/caja' },
  missing_product_costs: { label: 'Revisar inventario', href: '/admin/inventario' },
  estimated_product_costs: { label: 'Revisar inventario', href: '/admin/inventario' },
  pending_expenses: { label: 'Revisar gastos', section: 'expenses' },
  budget_exceptions: { label: 'Revisar presupuesto', section: 'budget' },
  unbudgeted_expenses: { label: 'Asignar presupuesto', section: 'budget' },
  overdue_treasury: { label: 'Revisar tesorería', section: 'treasury' },
};

function displayVersion(revision) {
  return Math.max(0, Number(revision || 0)) + 1;
}

function CertificationModal({ data, saving, onClose, onConfirm }) {
  const [notes, setNotes] = useState('');
  const [overrideReason, setOverrideReason] = useState('');
  const modalRef = useRef(null);
  const closeButtonRef = useRef(null);
  const blocked = Number(data?.readiness?.blockerCount || 0) > 0;
  const recertification = Boolean(data?.close);

  useEffect(() => {
    const previous = document.body.style.overflow;
    const returnFocus = document.activeElement;
    document.body.style.overflow = 'hidden';
    closeButtonRef.current?.focus();
    return () => {
      document.body.style.overflow = previous;
      if (returnFocus instanceof HTMLElement) returnFocus.focus();
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && !saving) {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== 'Tab') return;
      const focusable = Array.from(modalRef.current?.querySelectorAll(
        'button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'
      ) || []);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose, saving]);

  const submit = (event) => {
    event.preventDefault();
    if (!blocked && recertification && notes.trim().length < 8) {
      toast.error('Explica el motivo de la nueva certificación');
      return;
    }
    if (blocked && overrideReason.trim().length < 12) {
      toast.error('Debes justificar claramente la certificación excepcional');
      return;
    }
    onConfirm({
      notes: blocked ? overrideReason.trim() : notes.trim(),
      overrideReason: overrideReason.trim(),
    });
  };

  return createPortal(
    <div className="finance-closing-overlay" role="dialog" aria-modal="true" aria-label={recertification ? 'Actualizar certificación financiera' : 'Certificar cierre financiero'}>
      <div className="finance-closing-modal" ref={modalRef}>
        <header>
          <div>
            <p>{recertification ? 'NUEVA VERSIÓN CERTIFICADA' : 'CERTIFICACIÓN FINANCIERA'}</p>
            <h3>{data.period?.label} · {data.period?.periodKey}</h3>
            <span>{data.branch?.name}{recertification ? ` · Versión actual ${displayVersion(data.close?.revision)}` : ''}</span>
          </div>
          <button ref={closeButtonRef} type="button" onClick={onClose} disabled={saving} aria-label="Cerrar certificación"><X /></button>
        </header>

        <form onSubmit={submit}>
          <div className="finance-closing-modal__summary" data-status={data.readiness?.status}>
            <ShieldAlert />
            <div>
              <strong>{STATUS_META[data.readiness?.status]?.label || 'Control financiero'}</strong>
              <span>{data.readiness?.okCount || 0} controles correctos · {data.readiness?.warningCount || 0} alertas · {data.readiness?.blockerCount || 0} diferencias críticas</span>
            </div>
          </div>

          {blocked ? (
            <label className="finance-closing-modal__override">
              Justificación excepcional obligatoria
              <textarea value={overrideReason} onChange={(event) => setOverrideReason(event.target.value)} placeholder="Explica por qué se certifica a pesar de las diferencias críticas" required />
            </label>
          ) : (
            <label>
              {recertification ? 'Motivo de la nueva certificación' : 'Nota del responsable'}
              <textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder={recertification ? 'Explica qué cambió desde el corte anterior' : 'Observación opcional para la trazabilidad'} />
            </label>
          )}

          <div className="finance-closing-modal__actions">
            <button type="button" onClick={onClose} disabled={saving}>Volver</button>
            <button type="submit" disabled={saving}>
              {saving ? <Loader2 className="animate-spin" /> : <FileCheck2 />}
              {recertification ? 'Confirmar nueva versión' : 'Confirmar certificación'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}

export default function FinanceClosingPanel({
  selectedBranchId = '',
  branches = [],
  canCertify = false,
  canOverride = false,
  canExport = false,
  refreshKey = 0,
  onNavigate = () => {},
  onDataChanged = async () => {},
}) {
  const [periodKey, setPeriodKey] = useState(currentPeriodKey);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [activeStep, setActiveStep] = useState('summary');

  const selectedBranch = useMemo(
    () => branches.find((branch) => String(branch._id) === String(selectedBranchId)),
    [branches, selectedBranchId]
  );

  const load = useCallback(async () => {
    if (!selectedBranchId) {
      setData(null);
      setError('');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const result = await getFinanceClosingControl({ periodKey, branchId: selectedBranchId });
      setData(result || null);
    } catch (loadError) {
      setError(errorMessage(loadError, 'No se pudo preparar el cierre financiero'));
    } finally {
      setLoading(false);
    }
  }, [periodKey, selectedBranchId]);

  useEffect(() => { load(); }, [load, refreshKey]);
  useEffect(() => { setActiveStep('summary'); }, [periodKey, selectedBranchId]);

  const certify = async ({ notes, overrideReason }) => {
    setSaving(true);
    try {
      const result = await certifyFinancePeriod({
        branchId: selectedBranchId,
        periodKey,
        requestKey: createRequestKey(),
        notes,
        overrideReason,
        ...(data?.close ? { expectedRevision: Number(data.close.revision || 0) } : {}),
      });
      setModalOpen(false);
      toast.success(result?.unchanged ? 'El corte ya estaba actualizado' : 'Corte financiero certificado');
      await load();
      await onDataChanged();
    } catch (saveError) {
      toast.error(errorMessage(saveError, 'No se pudo certificar el cierre'));
    } finally {
      setSaving(false);
    }
  };

  const exportReport = async () => {
    setExporting(true);
    try {
      const blob = await exportFinanceClosingCsv({ periodKey, branchId: selectedBranchId });
      saveBlob(blob, `cierre-financiero-${periodKey}-${selectedBranch?.code || 'sede'}.csv`);
      toast.success('Informe ejecutivo descargado');
    } catch (exportError) {
      toast.error(errorMessage(exportError, 'No se pudo descargar el informe'));
    } finally {
      setExporting(false);
    }
  };

  const meta = STATUS_META[data?.readiness?.status] || STATUS_META.ready;
  const StatusIcon = meta.icon;
  const kpis = data?.financial?.kpis || {};
  const budget = data?.budget?.summary || {};
  const treasury = data?.treasury?.summary || {};
  const blockedWithoutAuthority = data?.readiness?.blockerCount > 0 && !canOverride;
  const certificationCurrent = Boolean(data?.close && !data?.drifted);
  const unresolvedChecks = (data?.readiness?.checks || []).filter((item) => item.status !== 'ok');
  const activeStepIndex = CLOSING_STEPS.findIndex((item) => item.key === activeStep);

  const goToStep = (step) => {
    setActiveStep(step);
  };

  return (
    <section className="finance-closing-panel">
      {modalOpen && data ? <CertificationModal data={data} saving={saving} onClose={() => setModalOpen(false)} onConfirm={certify} /> : null}

      <header className="finance-closing-panel__header">
        <div className="finance-closing-panel__title">
          <Fingerprint />
          <div>
            <p>CONTROL Y CIERRE</p>
            <h2>Cierre financiero mensual</h2>
            <span>Comprueba resultados, presupuesto, caja y tesorería antes de certificar.</span>
          </div>
        </div>
        <label>
          MES
          <input type="month" value={periodKey} max={currentPeriodKey()} onChange={(event) => setPeriodKey(event.target.value)} />
        </label>
      </header>

      {!selectedBranchId ? (
        <div className="finance-closing-panel__select-branch">
          <ShieldAlert />
          <div><strong>Selecciona una sede</strong><span>El cierre se certifica individualmente para conservar responsables y cifras exactas.</span></div>
        </div>
      ) : null}

      {selectedBranchId && loading ? <div className="finance-closing-panel__loading"><Loader2 className="animate-spin" />Preparando controles financieros…</div> : null}
      {selectedBranchId && !loading && error ? <div className="finance-closing-panel__error"><XCircle />{error}<button type="button" onClick={load}>Reintentar</button></div> : null}

      {selectedBranchId && !loading && !error && data ? (
        <>
          <div className="finance-closing-panel__status" data-status={data.readiness?.status}>
            <StatusIcon />
            <div>
              <p>{data.period?.label} · {data.branch?.name}</p>
              <strong>{meta.label}</strong>
              <span>{data.readiness?.okCount || 0} correctos · {data.readiness?.warningCount || 0} alertas · {data.readiness?.blockerCount || 0} diferencias críticas</span>
            </div>
            <div className="finance-closing-panel__version">
              <small>{data.close ? `Versión ${displayVersion(data.close.revision)}` : 'Sin certificar'}</small>
              <b>{data.drifted ? 'Hay cambios desde el último corte' : data.close ? 'Huella vigente' : data.period?.periodKey}</b>
            </div>
          </div>

          <nav className="finance-closing-steps" aria-label="Proceso de cierre financiero">
            {CLOSING_STEPS.map((step) => (
              <button
                type="button"
                key={step.key}
                aria-current={activeStep === step.key ? 'step' : undefined}
                aria-label={`${step.label}: ${step.hint}`}
                onClick={() => goToStep(step.key)}
              >
                <div><strong>{step.label}</strong><small>{step.hint}</small></div>
              </button>
            ))}
          </nav>

          <div className="finance-closing-stage" aria-live="polite">
            {activeStep === 'summary' ? (
              <>
                <div className="finance-closing-stage__intro">
                  <div><h3>Entiende el resultado del mes</h3><p>Estas cuatro cifras resumen lo que entró, lo disponible y lo que aún debe cobrarse o pagarse.</p></div>
                  <button type="button" onClick={load}><RefreshCw />Actualizar cifras</button>
                </div>
                <div className="finance-closing-panel__metrics">
                  <div><span>Ingresos netos</span><strong>{money(kpis.revenue)}</strong><small>Utilidad {money(kpis.netProfit)}</small></div>
                  <div><span>Presupuesto disponible</span><strong>{money(budget.availableAmount)}</strong><small>{budget.exceededCount || 0} línea(s) excedidas</small></div>
                  <div><span>Por cobrar / pagar</span><strong>{money(treasury.accountsReceivable)}</strong><small>Por pagar {money(treasury.accountsPayable)}</small></div>
                  <div><span>Flujo próximo 30 días</span><strong>{money(treasury.projectedNet30)}</strong><small>Cobros menos pagos</small></div>
                </div>
              </>
            ) : null}

            {activeStep === 'checks' ? (
              <>
                <div className="finance-closing-stage__intro">
                  <div><h3>Revisa los controles automáticos</h3><p>Verde significa conciliado. Amarillo necesita seguimiento. Rojo debe resolverse o justificarse con autorización.</p></div>
                </div>
                <div className="finance-closing-panel__checks">
                  {(data.readiness?.checks || []).map((item) => {
                    const Icon = item.status === 'ok' ? CheckCircle2 : item.status === 'warning' ? AlertTriangle : XCircle;
                    return <div key={item.code} data-status={item.status}><Icon /><div><strong>{item.label}</strong><span>{item.message}</span></div></div>;
                  })}
                </div>
              </>
            ) : null}

            {activeStep === 'resolve' ? (
              <>
                <div className="finance-closing-stage__intro">
                  <div><h3>{unresolvedChecks.length ? 'Resuelve lo que requiere atención' : 'Todo está conciliado'}</h3><p>{unresolvedChecks.length ? 'Cada alerta indica dónde corregir el dato antes de certificar.' : 'No existen alertas ni diferencias pendientes para este periodo.'}</p></div>
                </div>
                {unresolvedChecks.length ? (
                  <div className="finance-closing-resolutions">
                    {unresolvedChecks.map((item) => {
                      const action = CONTROL_ACTIONS[item.code];
                      const Icon = item.status === 'warning' ? AlertTriangle : XCircle;
                      return (
                        <article key={item.code} data-status={item.status}>
                          <Icon />
                          <div><strong>{item.label}</strong><span>{item.message}</span></div>
                          {action?.section ? <button type="button" onClick={() => onNavigate(action.section)}>{action.label}<ArrowRight /></button> : null}
                          {action?.href ? <a href={action.href}>{action.label}<ArrowRight /></a> : null}
                          {!action ? <button type="button" onClick={load}>Revisar nuevamente<RefreshCw /></button> : null}
                        </article>
                      );
                    })}
                  </div>
                ) : <div className="finance-closing-ready"><CheckCircle2 /><strong>El periodo está listo para certificar.</strong></div>}
              </>
            ) : null}

            {activeStep === 'certify' ? (
              <>
                <div className="finance-closing-stage__intro">
                  <div><h3>Genera la evidencia del cierre</h3><p>Descarga el informe y certifica una huella inalterable para este periodo y esta sede.</p></div>
                </div>
                <div className="finance-closing-certification">
                  <Fingerprint />
                  <div>
                    <small>HUELLA FINANCIERA SHA-256</small>
                    <strong>{String(data.snapshotHash || '')}</strong>
                    <span>{certificationCurrent ? `Certificación vigente · Versión ${displayVersion(data.close?.revision)}` : data.drifted ? 'Existen cambios que requieren una nueva certificación.' : 'Aún no se ha certificado este corte.'}</span>
                  </div>
                </div>
              </>
            ) : null}
          </div>

          <footer>
            <div><Fingerprint /><span>Huella: {String(data.snapshotHash || '').slice(0, 16)}…</span></div>
            <div>
              {activeStepIndex > 0 ? <button type="button" onClick={() => goToStep(CLOSING_STEPS[activeStepIndex - 1].key)}><ArrowLeft />Anterior</button> : null}
              {activeStepIndex < CLOSING_STEPS.length - 1 ? <button type="button" className="finance-closing-panel__certify" onClick={() => goToStep(CLOSING_STEPS[activeStepIndex + 1].key)}>Continuar<ArrowRight /></button> : null}
              {activeStep === 'certify' ? <button type="button" onClick={load}><RefreshCw />Revisar nuevamente</button> : null}
              {activeStep === 'certify' && canExport ? <button type="button" onClick={exportReport} disabled={exporting}>{exporting ? <Loader2 className="animate-spin" /> : <Download />}Informe ejecutivo</button> : null}
              {activeStep === 'certify' && canCertify ? (
                <button type="button" className="finance-closing-panel__certify" onClick={() => setModalOpen(true)} disabled={blockedWithoutAuthority || certificationCurrent}>
                  <FileCheck2 />
                  {certificationCurrent ? 'Certificación vigente' : data.close ? 'Actualizar certificación' : 'Certificar corte'}
                </button>
              ) : null}
            </div>
          </footer>
          {activeStep === 'certify' && blockedWithoutAuthority ? <p className="finance-closing-panel__authority">Las diferencias críticas requieren el permiso de autorización excepcional.</p> : null}
        </>
      ) : null}
    </section>
  );
}
