import useAdminPermissions from '../../security/useAdminPermissions';

export default function useOrdersAdminCapabilities() {
  const { can } = useAdminPermissions();
  const capabilities = {
    canAddNotes: can('orders:notes'),
    canArchive: can('orders:archive'),
    canBulk: can('orders:bulk'),
    canDownloadBilling: can('billing:download'),
    canEditCustomerData: can('orders:customer_data'),
    canExport: can('orders:export'),
    canManageReturnPolicy: can('settings:store'),
    canManageReturns: can('orders:returns'),
    canMarkPrinted: can('orders:mark_printed'),
    canConfirmManualPayment: can('orders:confirm_manual_payment'),
    canRefund: can('orders:refund'),
    canSendEmail: can('orders:email'),
    canUpdateFulfillment: can('orders:fulfillment'),
    canUpdateStatus: can('orders:status'),
    canUpdateTags: can('orders:tags'),
    canView: can('orders:view'),
    canViewBranches: can('branches:view'),
  };

  return {
    ...capabilities,
    canAutomateRefund: capabilities.canRefund && can('billing:credit_note'),
    selectionEnabled: capabilities.canBulk || capabilities.canExport,
  };
}
