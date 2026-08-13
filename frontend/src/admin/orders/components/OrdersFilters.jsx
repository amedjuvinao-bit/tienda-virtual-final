import {
  ShoppingBag,
  DollarSign,
  CreditCard,
  Truck,
  FileText,
  CheckCircle2,
  Search,
  FilterX,
  Download,
  Building2,
  X,
} from 'lucide-react';

const REQUIRED_STATUS_FILTERS = [
  { key: 'pending', label: 'Pendientes' },
  { key: 'processing', label: 'Procesando' },
  { key: 'paid', label: 'Pagadas' },
  { key: 'failed', label: 'Fallidas' },
  { key: 'shipped', label: 'Enviadas' },
  { key: 'delivered', label: 'Entregadas' },
  { key: 'cancelled', label: 'Canceladas' },
  { key: 'refunded', label: 'Reembolsadas' },
];

function mergeStatusFilters(filters) {
  const map = new Map();

  for (const item of Array.isArray(filters) ? filters : []) {
    const key = String(item?.key || '').trim();
    const label = String(item?.label || '').trim();

    if (key) map.set(key, { key, label: label || key });
  }

  for (const item of REQUIRED_STATUS_FILTERS) {
    if (!map.has(item.key)) map.set(item.key, item);
  }

  const preferredOrder = REQUIRED_STATUS_FILTERS.map((item) => item.key);

  return Array.from(map.values()).sort((a, b) => {
    const ai = preferredOrder.indexOf(a.key);
    const bi = preferredOrder.indexOf(b.key);

    if (ai === -1 && bi === -1) return 0;
    if (ai === -1) return 1;
    if (bi === -1) return -1;

    return ai - bi;
  });
}

export default function OrdersFilters({
  ADMIN_BORDER,
  STATUS_FILTERS,

  typingQ,
  setTypingQ,
  dateFrom,
  setDateFrom,
  dateTo,
  setDateTo,
  populate,
  setPopulate,

  statusFilter,
  toggleStatus,
  clearStatus,

  tagsStr,
  setTagsStr,
  tagsMode,
  setTagsMode,

  branchId = '',
  setBranchId,
  branches = [],

  setPage,
  exportCsv,
  canExport = false,
  loading,
  total,
  financialSummary,
  controlsOpen = true,
  onCloseControls,
  children,
}) {
  const safeStatusFilters = mergeStatusFilters(STATUS_FILTERS);
  const safeStatusFilter = Array.isArray(statusFilter) ? statusFilter : [];
  const safeBranches = Array.isArray(branches) ? branches : [];
  const summary = financialSummary || {};

  const hasActiveFilters =
    Boolean(typingQ) ||
    Boolean(dateFrom) ||
    Boolean(dateTo) ||
    Boolean(tagsStr) ||
    Boolean(branchId) ||
    safeStatusFilter.length > 0;

  const fmt = (v) => new Intl.NumberFormat('es-CO').format(Number(v || 0));

  const fmtMoney = (v) =>
    new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0,
    }).format(Number(v || 0));

  const currentStatus = safeStatusFilter.length === 1 ? safeStatusFilter[0] : 'all';

  const withoutInvoice =
    summary.withoutInvoice ||
    summary.withoutInvoiceOrders ||
    summary.ordersWithoutInvoice ||
    summary.noInvoiceOrders ||
    0;

  const validatedInvoices =
    summary.validatedInvoices ||
    summary.validatedInvoiceOrders ||
    summary.dianValidatedOrders ||
    summary.validatedDianOrders ||
    0;

  const cards = [
    {
      key: 'total',
      label: 'Total órdenes',
      value: fmt(summary.totalOrders || total || 0),
      helper: 'Órdenes registradas',
      Icon: ShoppingBag,
      accent: false,
    },
    {
      key: 'sales',
      label: 'Ventas totales',
      value: fmtMoney(summary.totalSales),
      helper: 'Ingresos confirmados',
      Icon: DollarSign,
      accent: true,
    },
    {
      key: 'ticket',
      label: 'Ticket promedio',
      value: fmtMoney(summary.averageTicket),
      helper: 'Promedio por orden',
      Icon: CreditCard,
      accent: false,
    },
    {
      key: 'pending',
      label: 'Pendientes',
      value: fmt(summary.pendingOrders),
      helper: 'Órdenes por procesar',
      Icon: Truck,
      accent: false,
    },
    {
      key: 'noinv',
      label: 'Sin factura',
      value: fmt(withoutInvoice),
      helper: 'Por facturar',
      Icon: FileText,
      accent: false,
    },
    {
      key: 'dian',
      label: 'Validadas DIAN',
      value: fmt(validatedInvoices),
      helper: 'Documentos validados',
      Icon: CheckCircle2,
      accent: false,
    },
  ];

  const handleClearFilters = () => {
    setTypingQ('');
    setDateFrom('');
    setDateTo('');
    setTagsStr('');
    setTagsMode('any');

    if (typeof setBranchId === 'function') setBranchId('');
    if (typeof clearStatus === 'function') clearStatus();

    setPage(1);
  };

  const handleStatusChange = (value) => {
    if (typeof clearStatus === 'function') clearStatus();
    if (value !== 'all' && typeof toggleStatus === 'function') toggleStatus(value);
    setPage(1);
  };

  const handleBranchChange = (value) => {
    if (typeof setBranchId === 'function') setBranchId(value);
    setPage(1);
  };

  const getBranchValue = (branch) => String(branch?._id || branch?.id || '');

  const getBranchLabel = (branch) => {
    const name = String(branch?.name || '').trim() || 'Sede sin nombre';
    const code = String(branch?.code || '').trim().toUpperCase();

    return code ? `${name} (${code})` : name;
  };

  return (
    <section className="orders-filter-fragments">
      <style>{`
        .orf-input::placeholder { color: var(--admin-input-placeholder) !important; }
        .orf-select option { background: var(--admin-input-bg); color: var(--admin-input-text); }
        .orf-field {
          border-color: var(--admin-input-border) !important;
          background: var(--admin-input-bg) !important;
          color: var(--admin-input-text) !important;
          transition: border-color 0.18s, box-shadow 0.18s;
        }
        .orf-field:focus {
          outline: none;
          border-color: var(--admin-primary) !important;
          box-shadow: 0 0 0 3px var(--admin-primary-soft-bg);
        }
        .orf-card-metric {
          transition: transform 0.18s, box-shadow 0.18s;
        }
        .orf-card-metric:hover {
          transform: translateY(-3px);
          box-shadow: 0 18px 40px rgba(0,0,0,0.18) !important;
        }
        .orf-icon-wrap {
          transition: transform 0.18s;
        }
        .orf-card-metric:hover .orf-icon-wrap {
          transform: scale(1.1) rotate(-4deg);
        }
        @media (max-width: 1100px) {
          .orf-metrics { grid-template-columns: repeat(3, minmax(0, 1fr)) !important; }
          .orf-filters { grid-template-columns: repeat(6, minmax(0, 1fr)) !important; }
          .orf-col-4, .orf-col-6, .orf-col-3, .orf-col-2 { grid-column: span 3 !important; }
        }
        @media (max-width: 720px) {
          .orf-metrics, .orf-filters { grid-template-columns: 1fr !important; }
          .orf-col-4, .orf-col-6, .orf-col-3, .orf-col-2 { grid-column: span 1 !important; }
        }
      `}</style>

      <div
        className="orders-admin-heading"
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          gap: '1rem',
          flexWrap: 'wrap',
        }}
      >
        <div>
          <h1
            style={{
              fontSize: 28,
              fontWeight: 900,
              lineHeight: 1.1,
              color: 'var(--admin-card-text)',
              margin: 0,
            }}
          >
            Órdenes
          </h1>

          <p
            style={{
              marginTop: 4,
              fontSize: 13,
              color: 'var(--admin-card-muted-text)',
              lineHeight: 1.5,
            }}
          >
            Gestiona tus ventas, revisa estados, sedes y controla la facturación electrónica.
          </p>
        </div>

        {canExport ? (
        <button
          onClick={exportCsv}
          disabled={loading || total === 0}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            height: 42,
            padding: '0 22px',
            background: 'var(--admin-primary)',
            color: 'var(--admin-primary-text)',
            border: 'none',
            borderRadius: 12,
            fontSize: 13,
            fontWeight: 800,
            cursor: loading || total === 0 ? 'not-allowed' : 'pointer',
            letterSpacing: '0.01em',
            boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
            opacity: loading || total === 0 ? 0.5 : 1,
          }}
        >
          <Download size={16} strokeWidth={2.5} />
          Exportar CSV
        </button>
        ) : null}
      </div>

      <div className="orders-admin-metrics orf-metrics" style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 10 }}>
        {cards.map(({ key, label, value, helper, Icon, accent }) => (
          <article
            key={key}
            className="orf-card-metric"
            style={{
              background: 'var(--admin-card-bg)',
              border: `1px solid ${ADMIN_BORDER}`,
              borderRadius: 16,
              padding: '14px 16px',
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
              boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            {accent && (
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: 3,
                  background: 'var(--admin-primary)',
                  borderRadius: '16px 16px 0 0',
                }}
              />
            )}

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: 'var(--admin-card-muted-text)',
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase',
                }}
              >
                {label}
              </span>

              <div
                className="orf-icon-wrap"
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 10,
                  background: 'var(--admin-primary-soft-bg)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--admin-primary)',
                  flexShrink: 0,
                }}
              >
                <Icon size={17} strokeWidth={2.3} />
              </div>
            </div>

            <div>
              <div
                style={{
                  fontSize: accent ? 18 : 22,
                  fontWeight: 900,
                  color: accent ? 'var(--admin-primary)' : 'var(--admin-card-text)',
                  lineHeight: 1,
                  letterSpacing: '-0.02em',
                }}
              >
                {value}
              </div>

              <div
                style={{
                  fontSize: 11,
                  color: 'var(--admin-card-muted-text)',
                  marginTop: 5,
                  fontWeight: 500,
                }}
              >
                {helper}
              </div>
            </div>
          </article>
        ))}
      </div>

      {controlsOpen ? (
        <button
          type="button"
          className="orders-control-backdrop"
          aria-label="Cerrar panel de filtros"
          onClick={onCloseControls}
        />
      ) : null}

      <aside
        id="orders-control-panel"
        aria-label="Filtros y estados de órdenes"
        aria-hidden={!controlsOpen}
        className={`orders-control-panel ${controlsOpen ? 'is-open' : 'is-closed'}`}
      >
        <div className="orders-control-mobile-heading">
          <div>
            <p>Panel de control</p>
            <span>Filtros, operación y facturación</span>
          </div>
          <button
            type="button"
            aria-label="Cerrar panel de filtros"
            onClick={onCloseControls}
          >
            <X size={17} strokeWidth={2.4} />
          </button>
        </div>

        <div
          className="orders-search-filters"
          style={{
            background: 'var(--admin-card-bg)',
            border: `1px solid ${ADMIN_BORDER}`,
            borderRadius: 16,
            padding: '14px',
            boxShadow: '0 8px 24px color-mix(in srgb, var(--admin-primary) 8%, transparent)',
          }}
        >
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.07em',
            textTransform: 'uppercase',
            color: 'var(--admin-card-muted-text)',
            marginBottom: 12,
          }}
        >
          Filtros de búsqueda
        </div>

        <div
          className="orf-filters"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(12, minmax(0, 1fr))',
            gap: 10,
            alignItems: 'end',
          }}
        >
          <Field className="orf-col-4 orf-sidebar-wide" label="Buscar" gridColumn="span 4">
            <div style={{ position: 'relative' }}>
              <Search
                size={16}
                strokeWidth={2}
                style={{
                  position: 'absolute',
                  left: 12,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--admin-card-muted-text)',
                  pointerEvents: 'none',
                }}
              />

              <input
                className="orf-input orf-field"
                placeholder="Buscar orden, cliente o email..."
                value={typingQ}
                onChange={(e) => {
                  setTypingQ(e.target.value);
                  setPage(1);
                }}
                style={inputStyle({ paddingLeft: 38 })}
              />
            </div>
          </Field>

          <Field className="orf-col-2" label="Desde" gridColumn="span 2">
            <input
              type="date"
              className="orf-field"
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value);
                setPage(1);
              }}
              style={inputStyle()}
            />
          </Field>

          <Field className="orf-col-2" label="Hasta" gridColumn="span 2">
            <input
              type="date"
              className="orf-field"
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value);
                setPage(1);
              }}
              style={inputStyle()}
            />
          </Field>

          <Field className="orf-col-4 orf-sidebar-wide" label="Estado" gridColumn="span 4">
            <select
              className="orf-select orf-field"
              value={currentStatus}
              onChange={(e) => handleStatusChange(e.target.value)}
              style={selectStyle()}
            >
              <option value="all">
                {safeStatusFilter.length > 1 ? 'Varios estados' : 'Todos los estados'}
              </option>

              {safeStatusFilters.map((st) => (
                <option key={st.key} value={st.key}>
                  {st.label}
                </option>
              ))}
            </select>
          </Field>

          <Field className="orf-col-6" label="Sede" gridColumn="span 6">
            <div style={{ position: 'relative' }}>
              <Building2
                size={15}
                strokeWidth={2}
                style={{
                  position: 'absolute',
                  left: 11,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--admin-card-muted-text)',
                  pointerEvents: 'none',
                }}
              />

              <select
                className="orf-select orf-field"
                value={branchId || ''}
                onChange={(e) => handleBranchChange(e.target.value)}
                style={selectStyle({ paddingLeft: 34 })}
              >
                <option value="">Todas las sedes</option>

                {safeBranches.map((branch) => {
                  const value = getBranchValue(branch);

                  if (!value) return null;

                  return (
                    <option key={value} value={value}>
                      {getBranchLabel(branch)}
                    </option>
                  );
                })}
              </select>
            </div>
          </Field>

          <Field className="orf-col-3" label="Datos" gridColumn="span 3">
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                height: 40,
                borderRadius: 10,
                border: '1px solid var(--admin-input-border)',
                overflow: 'hidden',
                background: 'var(--admin-input-bg)',
              }}
            >
              {[
                { val: false, label: 'Simple' },
                { val: true, label: 'Full' },
              ].map((opt) => (
                <button
                  key={String(opt.val)}
                  type="button"
                  onClick={() => {
                    setPopulate(opt.val);
                    setPage(1);
                  }}
                  style={{
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: 12,
                    fontWeight: 800,
                    background: populate === opt.val ? 'var(--admin-primary)' : 'transparent',
                    color:
                      populate === opt.val
                        ? 'var(--admin-primary-text)'
                        : 'var(--admin-input-text)',
                    letterSpacing: '0.02em',
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </Field>

          <Field className="orf-col-3 orf-sidebar-clear" label="Limpiar" gridColumn="span 3">
            <button
              type="button"
              disabled={!hasActiveFilters}
              onClick={handleClearFilters}
              style={{
                width: '100%',
                height: 40,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                border: `1px solid ${ADMIN_BORDER}`,
                borderRadius: 10,
                background: hasActiveFilters ? 'var(--admin-primary-soft-bg)' : 'var(--admin-input-bg)',
                color: hasActiveFilters ? 'var(--admin-primary-soft-text)' : 'var(--admin-card-muted-text)',
                cursor: hasActiveFilters ? 'pointer' : 'not-allowed',
                fontSize: 12,
                fontWeight: 850,
              }}
            >
              <FilterX size={15} strokeWidth={2.4} />
              Limpiar filtros
            </button>
          </Field>

          <Field className="orf-col-6" label="Tags" gridColumn="span 6">
            <input
              className="orf-input orf-field"
              placeholder="vip, urgente, mayorista..."
              value={tagsStr}
              onChange={(e) => {
                setTagsStr(e.target.value);
                setPage(1);
              }}
              style={inputStyle()}
            />
          </Field>

          <Field className="orf-col-3" label="Modo tags" gridColumn="span 3">
            <select
              className="orf-select orf-field"
              value={tagsMode}
              onChange={(e) => {
                setTagsMode(e.target.value === 'all' ? 'all' : 'any');
                setPage(1);
              }}
              style={selectStyle()}
            >
              <option value="any">Cualquier tag</option>
              <option value="all">Todos los tags</option>
            </select>
          </Field>
          </div>
        </div>

        {children}
      </aside>
    </section>
  );
}

function Field({ label, children, gridColumn, className = '' }) {
  return (
    <div
      className={className}
      style={{ display: 'flex', flexDirection: 'column', gap: 6, gridColumn }}
    >
      <label
        style={{
          fontSize: 11,
          fontWeight: 700,
          color: 'var(--admin-card-text)',
          letterSpacing: '0.03em',
        }}
      >
        {label}
      </label>

      {children}
    </div>
  );
}

function inputStyle(extra = {}) {
  return {
    width: '100%',
    height: 40,
    padding: '0 10px',
    border: '1px solid',
    borderRadius: 10,
    fontSize: 13,
    fontWeight: 600,
    boxSizing: 'border-box',
    ...extra,
  };
}

function selectStyle(extra = {}) {
  return {
    width: '100%',
    height: 40,
    padding: '0 10px',
    border: '1px solid',
    borderRadius: 10,
    fontSize: 13,
    fontWeight: 700,
    boxSizing: 'border-box',
    ...extra,
  };
}
