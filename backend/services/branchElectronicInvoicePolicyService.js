'use strict';

const BRANCH_ELECTRONIC_INVOICE_DISABLED = 'BRANCH_ELECTRONIC_INVOICE_DISABLED';

async function resolveBranchElectronicInvoicePolicy(order = {}, { BranchModel } = {}) {
  // Older orders can have no assigned branch. Keep their existing billing path.
  if (!order.branch) return { allowed: true };

  const model = BranchModel || require('../models/Branch');
  const query = model.findById(order.branch);
  const branch = typeof query?.lean === 'function' ? await query.lean() : await query;
  if (!branch || branch.settings?.allowElectronicInvoice !== false) {
    return { allowed: true };
  }

  const branchName = String(branch.name || order.branchSnapshot?.name || 'esta sede').trim();
  return {
    allowed: false,
    code: BRANCH_ELECTRONIC_INVOICE_DISABLED,
    message: `La facturación electrónica está desactivada para ${branchName}. Actívala en Configuración → Sedes y después emite la factura desde Facturación.`,
  };
}

module.exports = {
  BRANCH_ELECTRONIC_INVOICE_DISABLED,
  resolveBranchElectronicInvoicePolicy,
};
