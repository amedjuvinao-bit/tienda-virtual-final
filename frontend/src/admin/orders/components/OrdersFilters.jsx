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
} from 'lucide-react';

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
  loading,
  total,
  financialSummary,
}) {
  const THEME = {
    cardBg: 'var(--admin-card-bg)',
    cardText: 'var(--admin-card-text)',
    mutedText: 'var(--admin-card-muted-text)',
    primary: 'var(--admin-primary)',
    primaryText: 'var(--admin-primary-text)',
    primarySoftBg: 'var(--admin-primary-soft-bg)',
    primarySoftText: 'var(--admin-primary-soft-text)',
    inputBg: 'var(--admin-input-bg)',
    inputText: 'var(--admin-input-text)',
    inputBorder: 'var(--admin-input-border)',
    inputPlaceholder: 'var(--admin-input-placeholder)',
    cardBorder: 'var(--admin-card-border)',
  };

  const safeStatusFilters = Array.isArray(STATUS_FILTERS) ? STATUS_FILTERS : [];
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

  const handleClearFilters = () => {
    setTypingQ('');
    setDateFrom('');
    setDateTo('');
    setTagsStr('');
    setTagsMode('any');

    if (typeof setBranchId === 'function') {
      setBranchId('');
    }

    if (typeof clearStatus === 'function') {
      clearStatus();
    }

    setPage(1);
  };

  const handleStatusChange = (value) => {
    if (typeof clearStatus === 'function') clearStatus();
    if (value !== 'all' && typeof toggleStatus === 'function') toggleStatus(value);
    setPage(1);
  };

  const handleBranchChange = (value) => {
    if (typeof setBranchId === 'function') {
      setBranchId(value);
    }

    setPage(1);
  };

  const getBranchValue = (branch) => String(branch?._id || branch?.id || '');

  const getBranchLabel = (branch) => {
    const name = String(branch?.name || '').trim() || 'Sede sin nombre';
    const code = String(branch?.code || '').trim().toUpperCase();

    return code ? `${name} (${code})` : name;
  };

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

  return (
    <section style={{ marginBottom: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
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
        .orf-btn-clear {
          transition: background 0.15s, transform 0.15s, opacity 0.15s;
        }
        .orf-btn-clear:hover:not(:disabled) {
          transform: translateY(-1px);
        }
        .orf-icon-wrap {
          transition: transform 0.18s;
        }
        .orf-card-metric:hover .orf-icon-wrap {
          transform: scale(1.1) rotate(-4deg);
        }
      `}</style>

      {/* ── Header ── */}
      <div
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
            cursor: 'pointer',
            letterSpacing: '0.01em',
            boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
            transition: 'transform 0.15s, filter 0.15s',
            opacity: loading || total === 0 ? 0.5 : 1,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.filter = 'brightness(1.1)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.filter = 'brightness(1)';
          }}
        >
          <Download size={16} strokeWidth={2.5} />
          Exportar CSV
        </button>
      </div>

      {/* ── Metric cards 6-col ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 10 }}>
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

      {/* ── Filter bar ── */}
      <div
        style={{
          background: 'var(--admin-card-bg)',
          border: `1px solid ${ADMIN_BORDER}`,
          borderRadius: 18,
          padding: '18px 20px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
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
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(12, minmax(0, 1fr))',
            gap: 10,
            alignItems: 'end',
          }}
        >
          {/* Buscar */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, gridColumn: 'span 4' }}>
            <label
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: 'var(--admin-card-text)',
                letterSpacing: '0.03em',
              }}
            >
              Buscar
            </label>

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
                style={{
                  width: '100%',
                  height: 40,
                  paddingLeft: 38,
                  paddingRight: 12,
                  border: '1px solid',
                  borderRadius: 10,
                  fontSize: 13,
                  fontWeight: 500,
                  boxSizing: 'border-box',
                }}
              />
            </div>
          </div>

          {/* Desde */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, gridColumn: 'span 2' }}>
            <label
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: 'var(--admin-card-text)',
                letterSpacing: '0.03em',
              }}
            >
              Desde
            </label>

            <input
              type="date"
              className="orf-field"
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value);
                setPage(1);
              }}
              style={{
                width: '100%',
                height: 40,
                padding: '0 10px',
                border: '1px solid',
                borderRadius: 10,
                fontSize: 13,
                fontWeight: 600,
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Hasta */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, gridColumn: 'span 2' }}>
            <label
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: 'var(--admin-card-text)',
                letterSpacing: '0.03em',
              }}
            >
              Hasta
            </label>

            <input
              type="date"
              className="orf-field"
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value);
                setPage(1);
              }}
              style={{
                width: '100%',
                height: 40,
                padding: '0 10px',
                border: '1px solid',
                borderRadius: 10,
                fontSize: 13,
                fontWeight: 600,
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Estado */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, gridColumn: 'span 4' }}>
            <label
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: 'var(--admin-card-text)',
                letterSpacing: '0.03em',
              }}
            >
              Estado
            </label>

            <select
              className="orf-select orf-field"
              value={currentStatus}
              onChange={(e) => handleStatusChange(e.target.value)}
              style={{
                width: '100%',
                height: 40,
                padding: '0 10px',
                border: '1px solid',
                borderRadius: 10,
                fontSize: 13,
                fontWeight: 700,
                boxSizing: 'border-box',
              }}
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
          </div>

          {/* Sede */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, gridColumn: 'span 6' }}>
            <label
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: 'var(--admin-card-text)',
                letterSpacing: '0.03em',
              }}
            >
              Sede
            </label>

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
                style={{
                  width: '100%',
                  height: 40,
                  padding: '0 34px 0 34px',
                  border: '1px solid',
                  borderRadius: 10,
                  fontSize: 13,
                  fontWeight: 700,
                  boxSizing: 'border-box',
                }}
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
          </div>

          {/* Datos toggle */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, gridColumn: 'span 3' }}>
            <label
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: 'var(--admin-card-text)',
                letterSpacing: '0.03em',
              }}
            >
              Datos
            </label>

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
                    transition: 'background 0.15s, color 0.15s',
                    letterSpacing: '0.02em',
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Limpiar */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, gridColumn: 'span 3' }}>
            <label
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: 'var(--admin-card-text)',
                letterSpacing: '0.03em',
              }}
            >
              Acción
            </label>

            <button
              className="orf-btn-clear"
              type="button"
              onClick={handleClearFilters}
              disabled={!hasActiveFilters}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                height: 40,
                width: '100%',
                border: '1px solid var(--admin-input-border)',
                borderRadius: 10,
                background: hasActiveFilters
                  ? 'var(--admin-primary-soft-bg)'
                  : 'var(--admin-input-bg)',
                color: hasActiveFilters ? 'var(--admin-primary)' : 'var(--admin-input-text)',
                fontSize: 12,
                fontWeight: 800,
                cursor: hasActiveFilters ? 'pointer' : 'not-allowed',
                opacity: hasActiveFilters ? 1 : 0.45,
                boxSizing: 'border-box',
                letterSpacing: '0.02em',
              }}
            >
              <FilterX size={14} strokeWidth={2.3} />
              Limpiar
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}