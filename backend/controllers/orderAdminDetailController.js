const ElectronicInvoice = require('../models/ElectronicInvoice');
const Order = require('../models/Order');
const requirePermission = require('../middleware/requirePermission');
const {
  applyOrderBranchAccessFilter,
} = require('../services/orderAdminScopeService');
const {
  INVOICE_DOCUMENT_ORDER_ACCESS,
  buildOrderOperationFilter,
} = require('../services/orderRouteAccessService');
const {
  ADMIN_ORDER_INVOICE_DOWNLOAD_LINK_PROJECTION,
  ADMIN_ORDER_INVOICE_SUMMARY_PROJECTION,
  presentAdminOrderDetail,
} = require('../services/orderAdminDetailPresentationService');
const {
  createOrderBranchPresentationScope,
  scopeOrderForBranchPresentation,
} = require('../services/orderBranchPresentationScopeService');

async function canExposeInvoiceDownloadLinks({
  req,
  orderId,
  OrderModel,
  buildDownloadAccessFilter = buildOrderOperationFilter,
}) {
  const hasDownloadPermission = await requirePermission.hasEffectivePermission(
    req,
    'billing:download'
  );
  if (!hasDownloadPermission) return false;

  const access = buildDownloadAccessFilter(
    req,
    orderId,
    INVOICE_DOCUMENT_ORDER_ACCESS
  );
  if (!access.ok) return false;

  return Boolean(await OrderModel.exists(access.filter));
}

function createOrderAdminDetailController({
  OrderModel = Order,
  ElectronicInvoiceModel = ElectronicInvoice,
  applyBranchAccessFilter = applyOrderBranchAccessFilter,
  buildDownloadAccessFilter = buildOrderOperationFilter,
} = {}) {
  return async function getAdminOrderDetail(req, res) {
    try {
      const filter = {
        _id: req.params.id,
      };
      const branchAccess = applyBranchAccessFilter(req, filter);

      if (!branchAccess.ok) {
        return res.status(branchAccess.status || 403).json({
          error: branchAccess.error || 'BRANCH_ACCESS_DENIED',
          message:
            branchAccess.message ||
            'No tienes permiso para consultar órdenes de esa sede.',
        });
      }

      const order = await OrderModel.findOne(filter).lean();
      if (!order) return res.status(404).json({ error: 'Orden no encontrada' });

      const canDownloadBilling = await canExposeInvoiceDownloadLinks({
        req,
        orderId: order._id,
        OrderModel,
        buildDownloadAccessFilter,
      });

      const invoice = await ElectronicInvoiceModel.findOne({
        orderId: order._id,
      })
        .select(
          canDownloadBilling
            ? ADMIN_ORDER_INVOICE_DOWNLOAD_LINK_PROJECTION
            : ADMIN_ORDER_INVOICE_SUMMARY_PROJECTION
        )
        .lean();

      const presentationScope = createOrderBranchPresentationScope(branchAccess);
      const scopedOrder = scopeOrderForBranchPresentation(
        order,
        presentationScope
      );

      return res.json(
        presentAdminOrderDetail(scopedOrder, invoice, {
          includeDownloadLinks: canDownloadBilling,
        })
      );
    } catch {
      return res.status(400).json({ error: 'ID inválido' });
    }
  };
}

const getAdminOrderDetail = createOrderAdminDetailController();

module.exports = {
  canExposeInvoiceDownloadLinks,
  createOrderAdminDetailController,
  getAdminOrderDetail,
};
