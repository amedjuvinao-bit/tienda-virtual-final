import { OrderDetailIcons } from './OrderDetailIcons';
import {
  EmptyState,
  OrderDetailPanel,
  SectionTitle,
  SoftBadge,
} from './OrderDetailPrimitives';
import OrderReturnCaseCard from './OrderReturnCaseCard';
import OrderReturnCreateSection from './OrderReturnCreateSection';
import {
  OrderReturnResponsiveStyles,
  ReturnWorkflowGuide,
} from './OrderReturnPanelUi';
import OrderReturnPolicySection from './OrderReturnPolicySection';
import useOrderReturnsPanel from './hooks/useOrderReturnsPanel';

export default function OrderDetailReturnsPanel({
  data = {},
  loading = false,
  busyId = '',
  canManage = false,
  canManagePolicy = false,
  canRefund = false,
  onCreate,
  onAction,
  onRefund,
  onExchange,
  onAutomaticExchange,
  onStoreCredit,
  onShipping,
  onSavePolicy,
}) {
  const panel = useOrderReturnsPanel({ data, onCreate });

  return (
    <OrderDetailPanel style={{ padding: 18 }}>
      <SectionTitle
        icon={OrderDetailIcons.RotateCcw}
        title="Posventa · RMA"
        subtitle="Devoluciones y cambios con autorización, recepción, inspección e inventario trazable."
        action={loading ? <SoftBadge variant="warning">Consultando</SoftBadge> : null}
      />

      <ReturnWorkflowGuide />

      <OrderReturnPolicySection
        busyId={busyId}
        canManagePolicy={canManagePolicy}
        onSavePolicy={onSavePolicy}
        patchPolicy={panel.patchPolicy}
        policy={panel.policy}
        policyDraft={panel.policyDraft}
        policyOpen={panel.policyOpen}
        setPolicyDraft={panel.setPolicyDraft}
        setPolicyOpen={panel.setPolicyOpen}
        togglePolicyResolution={panel.togglePolicyResolution}
      />

      <OrderReturnCreateSection
        allowedCreateResolutions={panel.allowedCreateResolutions}
        busyId={busyId}
        canManage={canManage}
        createOpen={panel.createOpen}
        needsOverride={panel.needsOverride}
        overrideReason={panel.overrideReason}
        policy={panel.policy}
        reasonSummary={panel.reasonSummary}
        requestItems={panel.requestItems}
        requestable={panel.requestable}
        resolution={panel.resolution}
        resolutionAllowedForSelection={panel.resolutionAllowedForSelection}
        selectedItems={panel.selectedItems}
        selectedNeedsManualReview={panel.selectedNeedsManualReview}
        setCreateOpen={panel.setCreateOpen}
        setOverrideReason={panel.setOverrideReason}
        setReasonSummary={panel.setReasonSummary}
        setRequestItem={panel.setRequestItem}
        setResolution={panel.setResolution}
        submitCreate={panel.submitCreate}
      />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 16 }}>
        {!loading && panel.returns.length === 0 ? (
          <EmptyState>No hay expedientes RMA para esta orden.</EmptyState>
        ) : null}

        {panel.returns.map((returnCase) => {
          const id = String(returnCase._id || returnCase.returnNumber);
          return (
            <OrderReturnCaseCard
              key={id}
              busyId={busyId}
              canManage={canManage}
              canRefund={canRefund}
              draft={panel.drafts[id] || {}}
              onAction={onAction}
              onAutomaticExchange={onAutomaticExchange}
              onExchange={onExchange}
              onRefund={onRefund}
              onStoreCredit={onStoreCredit}
              onShipping={onShipping}
              policy={panel.policy}
              shippingDestinations={data?.shippingDestinations || []}
              shippingProviders={data?.shippingProviders || {}}
              returnCase={returnCase}
              setDraft={panel.setDraft}
              setInspection={panel.setInspection}
              setLineValue={panel.setLineValue}
            />
          );
        })}
      </div>

      <OrderReturnResponsiveStyles />
    </OrderDetailPanel>
  );
}
