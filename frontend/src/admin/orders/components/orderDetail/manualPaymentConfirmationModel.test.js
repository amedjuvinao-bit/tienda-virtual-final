import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
  canConfirmManualPaymentForOrder,
  createManualPaymentForm,
  getManualPaymentEvidence,
  validateManualPaymentForm,
} from './manualPaymentConfirmationModel';
import {
  buildOrderActionToolbarModel,
  canSelectOrderStatus,
} from './orderActionToolbarModel';

const MANUAL_ORDER = {
  _id: 'order-manual-1',
  status: 'pending',
  payment: {
    provider: 'manual',
    status: 'pending_manual',
    amount: 125000.5,
    currency: 'COP',
  },
};

describe('política frontend de confirmación manual', () => {
  it('exige permiso y solo habilita órdenes manuales realmente pendientes', () => {
    expect(canConfirmManualPaymentForOrder(MANUAL_ORDER, true)).toBe(true);
    expect(canConfirmManualPaymentForOrder({ ...MANUAL_ORDER, status: 'processing' }, true)).toBe(true);
    expect(canConfirmManualPaymentForOrder(MANUAL_ORDER, false)).toBe(false);
    expect(canConfirmManualPaymentForOrder({
      ...MANUAL_ORDER,
      payment: { ...MANUAL_ORDER.payment, provider: 'wompi' },
    }, true)).toBe(false);
    expect(canConfirmManualPaymentForOrder({
      ...MANUAL_ORDER,
      payment: { ...MANUAL_ORDER.payment, provider: 'payu' },
    }, true)).toBe(false);
    expect(canConfirmManualPaymentForOrder({ ...MANUAL_ORDER, status: 'paid' }, true)).toBe(false);
    expect(canConfirmManualPaymentForOrder({
      ...MANUAL_ORDER,
      payment: { ...MANUAL_ORDER.payment, status: 'paid' },
    }, true)).toBe(false);
  });

  it('construye el monto desde payment.amount y valida todos los campos', () => {
    const initial = createManualPaymentForm(MANUAL_ORDER);
    expect(initial).toMatchObject({ amount: 125000.5, currency: 'COP', verified: false });
    expect(validateManualPaymentForm(initial, MANUAL_ORDER).errors).toMatchObject({
      reference: expect.any(String),
      reason: expect.any(String),
      verified: expect.any(String),
    });

    const valid = validateManualPaymentForm({
      ...initial,
      method: 'cash',
      reference: ' REC-001 ',
      reason: ' Comprobante verificado en caja ',
      verified: true,
    }, MANUAL_ORDER);
    expect(valid.valid).toBe(true);
    expect(valid.request).toEqual({
      method: 'cash',
      reference: 'REC-001',
      amount: 125000.5,
      currency: 'COP',
      reason: 'Comprobante verificado en caja',
    });

    expect(validateManualPaymentForm({
      ...initial,
      method: 'crypto',
      reference: 'REC-001',
      reason: 'Motivo suficiente',
      verified: true,
    }, MANUAL_ORDER).errors.method).toMatch(/permitido/i);
  });

  it('normaliza evidencia persistida para una vista de solo lectura', () => {
    expect(getManualPaymentEvidence({
      payment: {
        manualConfirmation: {
          evidence: 'evidence-1',
          method: 'transfer',
          reference: 'TRX-009',
          amount: 125000.5,
          currency: 'COP',
          reason: 'Transferencia conciliada',
          actorLabel: 'Ana Admin',
          actorRole: 'billing',
          confirmedAt: '2026-08-27T10:00:00.000Z',
        },
      },
    })).toMatchObject({
      id: 'evidence-1',
      methodLabel: 'Transferencia',
      reference: 'TRX-009',
      actorLabel: 'Ana Admin',
    });
  });

  it('impide que el selector genérico convierta una deuda en pagada', async () => {
    const save = vi.fn();
    const pendingPaymentOrder = {
      ...MANUAL_ORDER,
      payment: { ...MANUAL_ORDER.payment, status: 'pending_manual' },
    };
    expect(canSelectOrderStatus(pendingPaymentOrder, 'paid')).toBe(false);
    const model = buildOrderActionToolbarModel({
      order: pendingPaymentOrder,
      statusLocal: 'paid',
      onSaveStatus: save,
    });
    expect(model.statusOptions.find(({ code }) => code === 'paid')?.disabled).toBe(true);
    await model.saveStatus();
    expect(save).not.toHaveBeenCalled();

    expect(canSelectOrderStatus({ payment: { status: 'paid' } }, 'paid')).toBe(true);
  });

  it('mantiene los módulos especializados dentro del límite de 250 líneas', () => {
    const root = 'src/admin/orders/components/orderDetail';
    [
      `${root}/manualPaymentConfirmationModel.js`,
      `${root}/hooks/useOrderManualPaymentConfirmation.js`,
      `${root}/OrderManualPaymentConfirmationCard.jsx`,
      `${root}/OrderManualPaymentEvidence.jsx`,
      `${root}/orderPaymentPanelModel.js`,
      `${root}/OrderDetailPaymentPanel.jsx`,
    ].forEach((file) => {
      const lines = readFileSync(resolve(process.cwd(), file), 'utf8')
        .trimEnd()
        .split(/\r?\n/).length;
      expect(lines, file).toBeLessThanOrEqual(250);
    });
  });
});
