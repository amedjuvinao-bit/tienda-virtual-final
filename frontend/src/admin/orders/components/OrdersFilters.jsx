import OrdersFiltersControlPanel from './OrdersFiltersControlPanel';
import OrdersFiltersSummary from './OrdersFiltersSummary';
import { OrdersFiltersStyles } from './OrdersFilterUi';
import {
  buildOrdersFilterMetrics,
  mergeStatusFilters,
} from './ordersFiltersModel';

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
  controlPanelRef,
  onCloseControls,
  children,
}) {
  const safeStatusFilters = mergeStatusFilters(STATUS_FILTERS);
  const safeStatusFilter = Array.isArray(statusFilter) ? statusFilter : [];
  const safeBranches = Array.isArray(branches) ? branches : [];
  const hasActiveFilters = Boolean(
    typingQ || dateFrom || dateTo || tagsStr || branchId || safeStatusFilter.length,
  );

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

  return (
    <section className="orders-filter-fragments">
      <OrdersFiltersStyles />
      <OrdersFiltersSummary
        ADMIN_BORDER={ADMIN_BORDER}
        canExport={canExport}
        cards={buildOrdersFilterMetrics(financialSummary, total)}
        exportCsv={exportCsv}
        loading={loading}
        total={total}
      />
      <OrdersFiltersControlPanel
        ADMIN_BORDER={ADMIN_BORDER}
        branchId={branchId}
        branches={safeBranches}
        controlsOpen={controlsOpen}
        controlPanelRef={controlPanelRef}
        dateFrom={dateFrom}
        dateTo={dateTo}
        hasActiveFilters={hasActiveFilters}
        onBranchChange={handleBranchChange}
        onClearFilters={handleClearFilters}
        onCloseControls={onCloseControls}
        onStatusChange={handleStatusChange}
        populate={populate}
        setDateFrom={setDateFrom}
        setDateTo={setDateTo}
        setPage={setPage}
        setPopulate={setPopulate}
        setTagsMode={setTagsMode}
        setTagsStr={setTagsStr}
        setTypingQ={setTypingQ}
        statusFilter={safeStatusFilter}
        statusFilters={safeStatusFilters}
        tagsMode={tagsMode}
        tagsStr={tagsStr}
        typingQ={typingQ}
      >
        {children}
      </OrdersFiltersControlPanel>
    </section>
  );
}
