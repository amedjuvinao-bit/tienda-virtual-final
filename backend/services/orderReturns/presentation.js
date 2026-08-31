'use strict';

function safeReturnView(returnCase) {
  const value = typeof returnCase?.toObject === 'function'
    ? returnCase.toObject()
    : returnCase;
  return {
    _id: value?._id,
    returnNumber: value?.returnNumber,
    order: value?.order,
    orderNumber: value?.orderNumber,
    status: value?.status,
    revision: Number(value?.revision || 0),
    requestedResolution: value?.requestedResolution,
    requestSource: value?.requestSource || 'admin',
    customerSnapshot: value?.customerSnapshot || {},
    items: value?.items || [],
    reasonSummary: value?.reasonSummary || '',
    eligibility: value?.eligibility || {},
    policySnapshot: value?.policySnapshot || {},
    riskAssessment: value?.riskAssessment || {},
    shipping: value?.shipping || {},
    inventoryRestorations: value?.inventoryRestorations || [],
    inventoryProcessedAt: value?.inventoryProcessedAt || null,
    estimatedRefundAmount: Number(value?.estimatedRefundAmount || 0),
    resolution: value?.resolution || {},
    rejectionReason: value?.rejectionReason || '',
    cancellationReason: value?.cancellationReason || '',
    requestedAt: value?.requestedAt || null,
    authorizedAt: value?.authorizedAt || null,
    rejectedAt: value?.rejectedAt || null,
    inTransitAt: value?.inTransitAt || null,
    receivedAt: value?.receivedAt || null,
    inspectedAt: value?.inspectedAt || null,
    resolvedAt: value?.resolvedAt || null,
    cancelledAt: value?.cancelledAt || null,
    requestedBy: value?.requestedBy || {},
    authorizedBy: value?.authorizedBy || {},
    receivedBy: value?.receivedBy || {},
    inspectedBy: value?.inspectedBy || {},
    resolvedBy: value?.resolvedBy || {},
    createdAt: value?.createdAt || null,
    updatedAt: value?.updatedAt || null,
  };
}

function safeCustomerReturnView(returnCase) {
  const value = safeReturnView(returnCase);
  return {
    _id: value._id,
    returnNumber: value.returnNumber,
    orderNumber: value.orderNumber,
    status: value.status,
    revision: value.revision,
    requestedResolution: value.requestedResolution,
    requestSource: value.requestSource,
    items: (value.items || []).map((item) => ({
      _id: item._id,
      orderItemId: item.orderItemId,
      title: item.title,
      variantKey: item.variantKey,
      size: item.size,
      color: item.color,
      requestedQuantity: item.requestedQuantity,
      authorizedQuantity: item.authorizedQuantity,
      receivedQuantity: item.receivedQuantity,
      acceptedQuantity: item.acceptedQuantity,
      rejectedQuantity: item.rejectedQuantity,
      reasonCode: item.reasonCode,
      reasonText: item.reasonText,
      policyRuleName: item.policyRuleName || 'Política general',
      policyWindowDays: Number(item.policyWindowDays || 30),
    })),
    reasonSummary: value.reasonSummary,
    eligibility: value.eligibility,
    shipping: {
      method: value.shipping?.method || 'pending',
      carrierName: value.shipping?.carrierName || '',
      trackingNumber: value.shipping?.trackingNumber || '',
      trackingUrl: value.shipping?.trackingUrl || '',
      labelUrl: value.shipping?.labelUrl || '',
      labelType: value.shipping?.labelType || 'none',
      instructions: value.shipping?.instructions || '',
    },
    estimatedRefundAmount: value.estimatedRefundAmount,
    resolution: {
      type: value.resolution?.type || null,
      state: value.resolution?.state || 'pending',
      amount: Number(value.resolution?.amount || 0),
      reference: value.resolution?.reference || '',
      storeCreditNumber: value.resolution?.storeCreditNumber || '',
      replacementOrderNumber: value.resolution?.replacementOrderNumber || '',
      completedAt: value.resolution?.completedAt || null,
    },
    rejectionReason: value.rejectionReason,
    cancellationReason: value.cancellationReason,
    requestedAt: value.requestedAt,
    authorizedAt: value.authorizedAt,
    inTransitAt: value.inTransitAt,
    receivedAt: value.receivedAt,
    resolvedAt: value.resolvedAt,
    cancelledAt: value.cancelledAt,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  };
}

function safeStoreCreditView(storeCredit) {
  const value = typeof storeCredit?.toObject === 'function'
    ? storeCredit.toObject()
    : storeCredit;
  return {
    _id: value?._id,
    creditNumber: value?.creditNumber || '',
    currency: value?.currency || 'COP',
    originalAmount: Number(value?.originalAmount || 0),
    balance: Number(value?.balance || 0),
    status: value?.status || 'active',
    issuedAt: value?.issuedAt || null,
    expiresAt: value?.expiresAt || null,
  };
}

module.exports = {
  safeCustomerReturnView,
  safeReturnView,
  safeStoreCreditView,
};
