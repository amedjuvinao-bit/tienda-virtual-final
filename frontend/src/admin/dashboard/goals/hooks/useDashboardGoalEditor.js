// frontend/src/admin/dashboard/goals/hooks/useDashboardGoalEditor.js

import { useCallback, useEffect, useMemo, useState } from 'react';
import { getDashboardGoal, updateDashboardGoal } from '../api/dashboardGoalsApi';
import {
  buildGoalPayload,
  cleanAmountInput,
  normalizeGoalForForm,
  validateGoalForm,
} from '../utils/dashboardGoalFormatters';

const INITIAL_FORM = {
  targetAmount: '',
  currency: 'COP',
  notes: '',
  periodKey: '',
};

function getErrorMessage(error) {
  return (
    error?.response?.data?.message ||
    error?.response?.data?.error ||
    error?.message ||
    'No se pudo procesar la meta mensual.'
  );
}

export default function useDashboardGoalEditor({ goal, onGoalUpdated } = {}) {
  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm] = useState(INITIAL_FORM);
  const [currentGoal, setCurrentGoal] = useState(goal || null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const formError = useMemo(() => validateGoalForm(form), [form]);
  const canSave = Boolean(!formError && !saving && !loading);

  const syncGoalToForm = useCallback((nextGoal) => {
    setCurrentGoal(nextGoal || null);
    setForm(normalizeGoalForForm(nextGoal));
  }, []);

  useEffect(() => {
    if (!isOpen) {
      syncGoalToForm(goal);
    }
  }, [goal, isOpen, syncGoalToForm]);

  const openEditor = useCallback(async () => {
    setIsOpen(true);
    setError('');
    syncGoalToForm(goal);

    try {
      setLoading(true);
      const freshGoal = await getDashboardGoal();
      syncGoalToForm(freshGoal);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [goal, syncGoalToForm]);

  const closeEditor = useCallback(() => {
    if (saving) return;

    setIsOpen(false);
    setError('');
    syncGoalToForm(goal || currentGoal);
  }, [currentGoal, goal, saving, syncGoalToForm]);

  const updateField = useCallback((field, value) => {
    setError('');

    setForm((prev) => ({
      ...prev,
      [field]: field === 'targetAmount' ? cleanAmountInput(value) : value,
    }));
  }, []);

  const saveGoal = useCallback(async () => {
    const validationMessage = validateGoalForm(form);

    if (validationMessage) {
      setError(validationMessage);
      return null;
    }

    try {
      setSaving(true);
      setError('');

      const payload = buildGoalPayload(form);
      const updatedGoal = await updateDashboardGoal(payload);

      syncGoalToForm(updatedGoal);
      setIsOpen(false);

      if (typeof onGoalUpdated === 'function') {
        onGoalUpdated(updatedGoal);
      }

      return updatedGoal;
    } catch (err) {
      setError(getErrorMessage(err));
      return null;
    } finally {
      setSaving(false);
    }
  }, [form, onGoalUpdated, syncGoalToForm]);

  return {
    isOpen,
    form,
    currentGoal,
    loading,
    saving,
    error,
    formError,
    canSave,
    openEditor,
    closeEditor,
    updateField,
    saveGoal,
  };
}
