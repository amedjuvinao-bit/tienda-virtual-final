// frontend/src/admin/OrdersAdmin.jsx
import React, { useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';

import { useAuth } from '../context/AuthContext';
import OrderDetailModal from './orders/components/OrderDetailModal';
import OrdersActiveFilters from './orders/components/OrdersActiveFilters';
import OrdersBulkActions from './orders/components/OrdersBulkActions';
import OrdersControlToggle from './orders/components/OrdersControlToggle';
import OrdersFilters from './orders/components/OrdersFilters';
import OrdersInvoiceFilters from './orders/components/OrdersInvoiceFilters';
import OrdersPagination from './orders/components/OrdersPagination';
import OrdersQuickViews from './orders/components/OrdersQuickViews';
import OrdersTable from './orders/components/OrdersTable';
import useOrdersAdminCapabilities from './orders/hooks/useOrdersAdminCapabilities';
import useOrdersAdminDetail from './orders/hooks/useOrdersAdminDetail';
import useOrdersAdminFilters from './orders/hooks/useOrdersAdminFilters';
import useOrdersAdminQuery from './orders/hooks/useOrdersAdminQuery';
import useOrdersAdminSelectionActions from './orders/hooks/useOrdersAdminSelectionActions';
import useOrdersControlPanel from './orders/hooks/useOrdersControlPanel';
import {
  ADMIN_BORDER,
  STATUS_FILTERS,
  STATUS_OPTIONS,
  fmtDate,
  statusBadgeClasses,
  toCOP,
} from './orders/ordersAdminModel';
import './orders/ordersAdmin.css';

export default function OrdersAdmin() {
  const [searchParams] = useSearchParams();
  const requestedOrderId = String(searchParams.get('openOrder') || '').trim();
  const linkedOrderId = /^[a-f0-9]{24}$/i.test(requestedOrderId)
    ? requestedOrderId
    : '';
  const linkedOrderNumber = String(searchParams.get('q') || '').trim();
  const openedLinkedOrderRef = useRef('');
  const { isAuthenticated, adminToken, authLoading } = useAuth();
  const capabilities = useOrdersAdminCapabilities();
  const hasSession = !authLoading && isAuthenticated && Boolean(adminToken);
  const controls = useOrdersControlPanel();
  const filters = useOrdersAdminFilters({
    authLoading,
    canView: capabilities.canView,
    canViewBranches: capabilities.canViewBranches,
    hasSession,
  });
  const query = useOrdersAdminQuery({
    authLoading,
    hasSession,
    canView: capabilities.canView,
    params: filters.params,
  });

  const requireSessionAndPermission = (allowed, message) => {
    if (hasSession && allowed) return true;
    query.setErr(
      hasSession
        ? message
        : 'Tu sesión administrativa no es válida. Inicia sesión nuevamente.'
    );
    return false;
  };

  const selection = useOrdersAdminSelectionActions({
    canBulk: capabilities.canBulk,
    canExport: capabilities.canExport,
    data: query.data,
    params: filters.params,
    requireSessionAndPermission,
    selectionEnabled: capabilities.selectionEnabled,
    setData: query.setData,
  });
  const detail = useOrdersAdminDetail({
    canArchive: capabilities.canArchive,
    canMarkPrinted: capabilities.canMarkPrinted,
    canUpdateStatus: capabilities.canUpdateStatus,
    canUpdateTags: capabilities.canUpdateTags,
    canView: capabilities.canView,
    requireSessionAndPermission,
    setData: query.setData,
  });

  useEffect(() => {
    if (!linkedOrderId) {
      openedLinkedOrderRef.current = '';
      return;
    }
    if (
      authLoading ||
      !hasSession ||
      !capabilities.canView ||
      openedLinkedOrderRef.current === linkedOrderId
    ) return;

    const linkedOrder = query.data.find(
      (order) => String(order?._id || '') === linkedOrderId
    ) || {
      _id: linkedOrderId,
      orderNumber: linkedOrderNumber,
    };

    openedLinkedOrderRef.current = linkedOrderId;
    detail.openOrderDetail(linkedOrder);
  }, [
    authLoading,
    capabilities.canView,
    hasSession,
    linkedOrderId,
    linkedOrderNumber,
    query.data,
  ]);

  const from = query.total === 0
    ? 0
    : (query.page - 1) * filters.limit + 1;
  const to = Math.min(query.total, query.page * filters.limit);

  return (
    <div ref={controls.ordersShellRef} className={`orders-admin-shell p-4 ${controls.controlsOpen ? 'controls-open' : 'controls-closed'}`}>
      <OrdersControlToggle
        controlsOpen={controls.controlsOpen}
        dragging={controls.draggingControlToggle}
        pinned={controls.controlTogglePinned}
        position={controls.controlTogglePosition}
        toggleRef={controls.controlToggleRef}
        onClick={controls.handleControlToggleClick}
        onPointerDown={controls.handleControlTogglePointerDown}
        onPointerMove={controls.handleControlTogglePointerMove}
        onPointerUp={controls.finishControlToggleDrag}
        onPointerCancel={controls.finishControlToggleDrag}
        onTogglePin={controls.handleControlTogglePin}
      />

      <OrdersFilters
        ADMIN_BORDER={ADMIN_BORDER}
        STATUS_FILTERS={STATUS_FILTERS}
        typingQ={filters.typingQuery}
        setTypingQ={filters.setTypingQuery}
        dateFrom={filters.dateFrom}
        setDateFrom={filters.setDateFrom}
        dateTo={filters.dateTo}
        setDateTo={filters.setDateTo}
        populate={filters.populate}
        setPopulate={filters.setPopulate}
        statusFilter={filters.statusFilter}
        toggleStatus={filters.toggleStatus}
        clearStatus={filters.clearStatus}
        tagsStr={filters.tagsInput}
        setTagsStr={filters.setTagsInput}
        tagsMode={filters.tagsMode}
        setTagsMode={filters.setTagsMode}
        branchId={filters.branchId}
        setBranchId={filters.setBranchId}
        branches={filters.branches}
        setPage={filters.setPage}
        exportCsv={selection.exportCsv}
        canExport={capabilities.canExport}
        loading={query.loading}
        total={query.total}
        financialSummary={query.financialSummary}
        controlsOpen={controls.controlsOpen}
        controlPanelRef={controls.controlPanelRef}
        onCloseControls={() => controls.setControlsOpen(false)}
      >
        <OrdersQuickViews
          compact
          quickView={filters.quickViews.quickView}
          onApplyQuickView={filters.quickViews.applyQuickView}
          operationalSummary={query.operationalSummary}
        />

        <OrdersInvoiceFilters
          compact
          invoiceFilter={filters.invoiceFilters.invoiceFilter}
          setInvoiceFilter={filters.invoiceFilters.setInvoiceFilter}
          onApplyInvoiceFilter={filters.invoiceFilters.applyInvoiceFilter}
        />
      </OrdersFilters>

      <main className="orders-table-workspace">
        <OrdersActiveFilters
          quickView={filters.quickViews.quickView}
          onApplyQuickView={filters.quickViews.applyQuickView}
          typingQ={filters.typingQuery}
          setTypingQ={filters.setTypingQuery}
          dateFrom={filters.dateFrom}
          setDateFrom={filters.setDateFrom}
          dateTo={filters.dateTo}
          setDateTo={filters.setDateTo}
          statusFilter={filters.statusFilter}
          setStatusFilter={filters.setStatusFilter}
          clearStatus={filters.clearStatus}
          STATUS_FILTERS={STATUS_FILTERS}
          tagsStr={filters.tagsInput}
          setTagsStr={filters.setTagsInput}
          setPage={filters.setPage}
        />

        <OrdersBulkActions
          selectedCount={capabilities.selectionEnabled ? selection.selectedIds.size : 0}
          canBulk={capabilities.canBulk}
          canExport={capabilities.canExport}
          busy={selection.bulkBusy}
          status={selection.bulkStatus}
          statusOptions={STATUS_OPTIONS}
          tags={selection.bulkTags}
          tagsMode={selection.bulkMode}
          onClearSelection={selection.clearSelection}
          onStatusChange={selection.setBulkStatus}
          onRunStatus={selection.runBulkStatus}
          onTagsModeChange={selection.setBulkMode}
          onTagsChange={selection.setBulkTags}
          onRunTags={selection.runBulkTags}
          onExportSelected={selection.exportSelectedCsv}
        />

        {query.err ? (
          <div className="orders-admin-error" role="alert">
            {query.err}
          </div>
        ) : null}

        <OrdersTable
          ADMIN_BORDER={ADMIN_BORDER}
          data={query.data}
          loading={query.loading}
          total={query.total}
          from={from}
          to={to}
          limit={filters.limit}
          onLimitChange={(nextLimit) => {
            filters.setLimit(nextLimit);
            filters.setPage(1);
          }}
          selectedIds={selection.selectedIds}
          selectionEnabled={capabilities.selectionEnabled}
          toggleSelectAllVisible={selection.toggleSelectAllVisible}
          toggleOne={selection.toggleOne}
          isSelected={selection.isSelected}
          toggleSort={filters.toggleSort}
          sortAria={filters.sortAria}
          sortIcon={filters.sortIcon}
          fmtDate={fmtDate}
          toCOP={toCOP}
          statusBadgeClasses={statusBadgeClasses}
          openOrderDetail={detail.openOrderDetail}
        />

        <OrdersPagination
          page={query.page}
          totalPages={query.totalPages}
          loading={query.loading}
          canGoPrevious={query.canGoPrevious}
          canGoNext={query.canGoNext}
          onPrevious={query.cursorMode
            ? query.goToPreviousCursorPage
            : () => filters.setPage((current) => Math.max(1, current - 1))}
          onNext={query.cursorMode
            ? query.goToNextCursorPage
            : () => filters.setPage((current) => Math.min(query.totalPages, current + 1))}
        />
      </main>

      <OrderDetailModal
        open={detail.showDetail}
        onClose={detail.closeOrderDetail}
        order={detail.orderSelected}
        onSaveStatus={capabilities.canUpdateStatus ? detail.saveStatus : null}
        onSaveTags={capabilities.canUpdateTags ? detail.saveTags : null}
        onTogglePrinted={capabilities.canMarkPrinted ? detail.togglePrinted : null}
        onToggleArchived={capabilities.canArchive ? detail.toggleArchived : null}
        canAddNotes={capabilities.canAddNotes}
        canSendEmail={capabilities.canSendEmail}
        canEditCustomerData={capabilities.canEditCustomerData}
        onCustomerDataUpdated={detail.handleOrderUpdated}
        onOrderUpdated={detail.handleOrderUpdated}
        canUpdateFulfillment={capabilities.canUpdateFulfillment}
        canDownloadBilling={capabilities.canDownloadBilling}
        canConfirmManualPayment={capabilities.canConfirmManualPayment}
        canRefund={capabilities.canRefund}
        canAutomateRefund={capabilities.canAutomateRefund}
        canManageReturns={capabilities.canManageReturns}
        canManageReturnPolicy={capabilities.canManageReturnPolicy}
        savingId={detail.savingId}
        populated={filters.populate}
      />
    </div>
  );
}
