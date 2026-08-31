import { useEffect, useMemo, useState } from 'react';

import { positiveInteger } from '../orderReturnPanelModel';

export default function useOrderReturnsPanel({ data = {}, onCreate }) {
  const eligibility = Array.isArray(data?.eligibility) ? data.eligibility : [];
  const returns = Array.isArray(data?.returns) ? data.returns : [];
  const policy = data?.policy || {};
  const [createOpen, setCreateOpen] = useState(false);
  const [policyOpen, setPolicyOpen] = useState(false);
  const [policyDraft, setPolicyDraft] = useState(policy);
  const [resolution, setResolution] = useState('refund');
  const [reasonSummary, setReasonSummary] = useState('');
  const [overrideReason, setOverrideReason] = useState('');
  const [requestItems, setRequestItems] = useState({});
  const [drafts, setDrafts] = useState({});

  const allowedCreateResolutions = (
    Array.isArray(policy.allowedResolutions) && policy.allowedResolutions.length
      ? policy.allowedResolutions
      : ['refund', 'exchange']
  ).filter((value) => policy.storeCreditEnabled !== false || value !== 'store_credit');

  useEffect(() => {
    setCreateOpen(false);
    setResolution('refund');
    setReasonSummary('');
    setOverrideReason('');
    setRequestItems({});
    setDrafts({});
  }, [data?.orderId]);

  useEffect(() => {
    setPolicyDraft(policy);
  }, [policy?.revision, data?.orderId]);

  useEffect(() => {
    if (!allowedCreateResolutions.includes(resolution)) {
      setResolution(allowedCreateResolutions[0] || 'refund');
    }
  }, [allowedCreateResolutions.join('|'), resolution]);

  const requestable = useMemo(
    () => eligibility.filter((item) => positiveInteger(item.availableQuantity) > 0),
    [eligibility]
  );

  const selectedItems = requestable
    .map((item) => {
      const draft = requestItems[item.orderItemId] || {};
      return {
        orderItemId: item.orderItemId,
        quantity: positiveInteger(draft.quantity),
        reasonCode: draft.reasonCode || 'other',
        reasonText: String(draft.reasonText || '').trim(),
        expired: item.expired === true,
        policyReturnable: item.policyReturnable !== false,
        policyManualReview: item.policyManualReview === true,
        allowedResolutions: Array.isArray(item.allowedResolutions)
          ? item.allowedResolutions
          : allowedCreateResolutions,
      };
    })
    .filter((item) => item.quantity > 0);

  const needsOverride = selectedItems.some(
    (item) => item.expired || !item.policyReturnable
  );
  const selectedNeedsManualReview = selectedItems.some(
    (item) => item.policyManualReview
  );
  const resolutionAllowedForSelection = selectedItems.every(
    (item) => item.allowedResolutions.includes(resolution)
  );

  const patchPolicy = (patch) => {
    setPolicyDraft((current) => ({ ...current, ...patch }));
  };

  const togglePolicyResolution = (value) => {
    const current = new Set(policyDraft.allowedResolutions || []);
    if (current.has(value)) current.delete(value);
    else current.add(value);
    patchPolicy({ allowedResolutions: Array.from(current) });
  };

  const setRequestItem = (id, patch) => {
    setRequestItems((current) => ({
      ...current,
      [id]: { ...(current[id] || {}), ...patch },
    }));
  };

  const setDraft = (returnId, patch) => {
    setDrafts((current) => ({
      ...current,
      [returnId]: { ...(current[returnId] || {}), ...patch },
    }));
  };

  const setLineValue = (returnId, group, lineId, value) => {
    setDrafts((current) => ({
      ...current,
      [returnId]: {
        ...(current[returnId] || {}),
        [group]: {
          ...(current[returnId]?.[group] || {}),
          [lineId]: value,
        },
      },
    }));
  };

  const setInspection = (returnId, lineId, patch) => {
    setDrafts((current) => ({
      ...current,
      [returnId]: {
        ...(current[returnId] || {}),
        inspections: {
          ...(current[returnId]?.inspections || {}),
          [lineId]: {
            ...(current[returnId]?.inspections?.[lineId] || {}),
            ...patch,
          },
        },
      },
    }));
  };

  const submitCreate = async () => {
    if (
      !selectedItems.length ||
      !resolutionAllowedForSelection ||
      (needsOverride && overrideReason.trim().length < 8)
    ) return;

    await onCreate?.({
      requestedResolution: resolution,
      reasonSummary: reasonSummary.trim(),
      overrideEligibility: needsOverride,
      overrideReason: needsOverride ? overrideReason.trim() : '',
      items: selectedItems.map(({
        expired,
        policyReturnable,
        policyManualReview,
        allowedResolutions,
        ...item
      }) => item),
    });
  };

  return {
    allowedCreateResolutions,
    createOpen,
    drafts,
    needsOverride,
    overrideReason,
    patchPolicy,
    policy,
    policyDraft,
    policyOpen,
    reasonSummary,
    requestItems,
    requestable,
    resolution,
    resolutionAllowedForSelection,
    returns,
    selectedItems,
    selectedNeedsManualReview,
    setCreateOpen,
    setDraft,
    setInspection,
    setLineValue,
    setOverrideReason,
    setPolicyDraft,
    setPolicyOpen,
    setReasonSummary,
    setRequestItem,
    setResolution,
    submitCreate,
    togglePolicyResolution,
  };
}
