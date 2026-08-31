import { X } from 'lucide-react';

import OrdersSearchDateFields from './OrdersSearchDateFields';
import {
  OrdersBranchField,
  OrdersStatusField,
  OrdersTagsFields,
} from './OrdersStatusTagsFields';
import OrdersViewOptionsFields from './OrdersViewOptionsFields';

export default function OrdersFiltersControlPanel({
  ADMIN_BORDER,
  branchId,
  branches,
  children,
  controlsOpen,
  controlPanelRef,
  dateFrom,
  dateTo,
  hasActiveFilters,
  onBranchChange,
  onClearFilters,
  onCloseControls,
  onStatusChange,
  populate,
  setDateFrom,
  setDateTo,
  setPage,
  setPopulate,
  setTagsMode,
  setTagsStr,
  setTypingQ,
  statusFilter,
  statusFilters,
  tagsMode,
  tagsStr,
  typingQ,
}) {
  return (
    <>
      {controlsOpen ? (
        <button
          type="button"
          className="orders-control-backdrop"
          aria-label="Cerrar panel de filtros"
          onClick={onCloseControls}
        />
      ) : null}

      <aside
        ref={controlPanelRef}
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
            <OrdersSearchDateFields
              dateFrom={dateFrom}
              dateTo={dateTo}
              setDateFrom={setDateFrom}
              setDateTo={setDateTo}
              setPage={setPage}
              setTypingQ={setTypingQ}
              typingQ={typingQ}
            />
            <OrdersStatusField
              onStatusChange={onStatusChange}
              statusFilter={statusFilter}
              statusFilters={statusFilters}
            />
            <OrdersBranchField
              branchId={branchId}
              branches={branches}
              onBranchChange={onBranchChange}
            />
            <OrdersViewOptionsFields
              ADMIN_BORDER={ADMIN_BORDER}
              hasActiveFilters={hasActiveFilters}
              onClearFilters={onClearFilters}
              populate={populate}
              setPage={setPage}
              setPopulate={setPopulate}
            />
            <OrdersTagsFields
              setPage={setPage}
              setTagsMode={setTagsMode}
              setTagsStr={setTagsStr}
              tagsMode={tagsMode}
              tagsStr={tagsStr}
            />
          </div>
        </div>

        {children}
      </aside>
    </>
  );
}
