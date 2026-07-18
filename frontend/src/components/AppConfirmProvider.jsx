// frontend/src/components/AppConfirmProvider.jsx
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import ConfirmDialog from './ConfirmDialog';

const ConfirmContext = createContext(null);

const DEFAULT_OPTIONS = {
  title: 'Confirmación',
  message: '¿Deseas continuar?',
  confirmLabel: 'Aceptar',
  cancelLabel: 'Cancelar',
  tone: 'danger',
};

function normalizeOptions(input) {
  if (typeof input === 'string') {
    return { ...DEFAULT_OPTIONS, message: input };
  }

  return {
    ...DEFAULT_OPTIONS,
    ...(input || {}),
    message: input?.message || DEFAULT_OPTIONS.message,
  };
}

export function AppConfirmProvider({ children }) {
  const [dialog, setDialog] = useState(null);
  const resolverRef = useRef(null);
  const lastActionTargetRef = useRef(null);
  const replayingLegacyConfirmRef = useRef(false);

  const closeDialog = useCallback((result) => {
    const resolver = resolverRef.current;
    resolverRef.current = null;
    setDialog(null);
    resolver?.(Boolean(result));
  }, []);

  const confirm = useCallback((options) => {
    const normalized = normalizeOptions(options);

    return new Promise((resolve) => {
      resolverRef.current?.(false);
      resolverRef.current = resolve;
      setDialog(normalized);
    });
  }, []);

  useEffect(() => {
    const handlePointerDown = (event) => {
      const target = event.target?.closest?.('button, [role="button"], a, input[type="button"], input[type="submit"]');
      lastActionTargetRef.current = target || event.target || null;
    };

    document.addEventListener('pointerdown', handlePointerDown, true);
    return () => document.removeEventListener('pointerdown', handlePointerDown, true);
  }, []);

  useEffect(() => {
    const nativeConfirm = window.confirm?.bind(window);

    window.confirm = (message) => {
      if (replayingLegacyConfirmRef.current) return true;

      const target = lastActionTargetRef.current;

      confirm({
        title: 'Confirmación',
        message: String(message || '¿Deseas continuar?'),
        confirmLabel: 'Aceptar',
        cancelLabel: 'Cancelar',
        tone: 'danger',
      }).then((accepted) => {
        if (!accepted || !target || typeof target.click !== 'function' || !document.contains(target)) return;

        replayingLegacyConfirmRef.current = true;
        setTimeout(() => {
          try {
            target.click();
          } finally {
            setTimeout(() => {
              replayingLegacyConfirmRef.current = false;
            }, 0);
          }
        }, 0);
      });

      return false;
    };

    return () => {
      if (nativeConfirm) window.confirm = nativeConfirm;
    };
  }, [confirm]);

  const value = useMemo(() => ({ confirm }), [confirm]);

  return (
    <ConfirmContext.Provider value={value}>
      {children}
      <ConfirmDialog
        show={Boolean(dialog)}
        title={dialog?.title}
        message={dialog?.message}
        confirmLabel={dialog?.confirmLabel}
        cancelLabel={dialog?.cancelLabel}
        tone={dialog?.tone}
        onClose={() => closeDialog(false)}
        onConfirm={() => closeDialog(true)}
      />
    </ConfirmContext.Provider>
  );
}

export function useAppConfirm() {
  const context = useContext(ConfirmContext);
  if (!context) {
    throw new Error('useAppConfirm debe usarse dentro de AppConfirmProvider');
  }
  return context.confirm;
}
